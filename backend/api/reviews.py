# api/reviews.py - Review endpoints
from fastapi import APIRouter, HTTPException
from models.request_models import ReviewRequest
from database import get_conn
from services.warning_system import issue_warning

router = APIRouter()

@router.post("/api/review/submit")
async def submit_review(req: ReviewRequest):
    """Submit a review for a class"""
    with get_conn() as conn:
        # FIRST: Get the actual student ID from the user_id
        student = conn.execute(
            "SELECT id FROM students WHERE user_id = ?", (req.studentId,)
        ).fetchone()
        
        if not student:
            return {"success": False, "message": "Student not found"}
        
        # Check if student is enrolled using the student's internal ID
        enrollment = conn.execute("""
            SELECT e.*, c.instructor_id 
            FROM enrollments e
            JOIN classes c ON e.class_id = c.id
            WHERE e.student_id = ? AND e.class_id = ? AND e.status = 'registered'
        """, (student['id'], req.classId)).fetchone()
        
        if not enrollment:
            return {"success": False, "message": "You are not enrolled in this class"}
        
        # Check if grade already posted
        if not enrollment['grade'] or enrollment['grade'] == 'IP':
            return {"success": False, "message": "Reviews can only be submitted after grades are posted"}
        
        # Check if already reviewed
        existing = conn.execute(
            "SELECT * FROM reviews WHERE student_id = ? AND class_id = ?",
            (student['id'], req.classId)
        ).fetchone()
        
        if existing:
            return {"success": False, "message": "You have already reviewed this class"}
        
        # Check taboo words
        taboo_words = conn.execute("SELECT word FROM taboo_words").fetchall()
        taboo_list = [w['word'].lower() for w in taboo_words]
        
        text_lower = req.text.lower()
        taboo_count = sum(1 for tw in taboo_list if tw in text_lower)
        
        shown = taboo_count < 3
        author_warned = taboo_count > 0
        
        # Process text with censorship
        processed_text = req.text
        for tw in taboo_list:
            if tw in text_lower:
                processed_text = processed_text.replace(tw, '*' * len(tw))
        
        # Insert review (use student['id'], not req.studentId)
        conn.execute("""
            INSERT INTO reviews (student_id, class_id, stars, text, shown, author_warned, semester, created_at)
            VALUES (?, ?, ?, ?, ?, ?, (SELECT value FROM settings WHERE key = 'semester'), datetime('now'))
        """, (student['id'], req.classId, req.stars, processed_text, 1 if shown else 0, 1 if author_warned else 0))
        
        # Issue warnings if needed (use req.studentId for user_id)
        if taboo_count >= 3:
            conn.execute("UPDATE students SET warnings = warnings + 2 WHERE user_id = ?", (req.studentId,))
            message = "Review hidden due to 3+ taboo words. 2 warnings issued."
        elif taboo_count >= 1:
            conn.execute("UPDATE students SET warnings = warnings + 1 WHERE user_id = ?", (req.studentId,))
            message = "Review censored. Warning issued for taboo words."
        else:
            message = "Review submitted successfully"
        
        # Update class average rating
        avg_rating = conn.execute("""
            SELECT AVG(stars) as avg FROM reviews WHERE class_id = ? AND shown = 1
        """, (req.classId,)).fetchone()
        
        if avg_rating and avg_rating['avg']:
            conn.execute(
                "UPDATE classes SET avg_rating = ? WHERE id = ?",
                (avg_rating['avg'], req.classId)
            )
            
            # Check if instructor should be warned
            if avg_rating['avg'] < 2:
                class_info = conn.execute(
                    "SELECT instructor_id FROM classes WHERE id = ?", (req.classId,)
                ).fetchone()
                
                if class_info:
                    instructor = conn.execute(
                        "SELECT user_id FROM instructors WHERE id = ?", (class_info['instructor_id'],)
                    ).fetchone()
                    
                    if instructor:
                        warnings, suspended, _ = issue_warning(0, 'instructor')
                        conn.execute(
                            "UPDATE instructors SET warnings = warnings + 1 WHERE user_id = ?",
                            (instructor['user_id'],)
                        )
        
        return {"success": True, "message": message, "shown": shown}

@router.get("/api/class/{class_id}/reviews")
async def get_class_reviews(class_id: int, show_all: bool = False):
    """Get reviews for a class"""
    with get_conn() as conn:
        if show_all:
            reviews = conn.execute("""
                SELECT r.*, s.name as student_name, s.student_code
                FROM reviews r
                JOIN students s ON r.student_id = s.id
                WHERE r.class_id = ?
                ORDER BY r.created_at DESC
            """, (class_id,)).fetchall()
        else:
            reviews = conn.execute("""
                SELECT r.stars, r.text, r.created_at
                FROM reviews r
                WHERE r.class_id = ? AND r.shown = 1
                ORDER BY r.created_at DESC
            """, (class_id,)).fetchall()
        
        return {"reviews": [dict(r) for r in reviews]}

@router.get("/api/student/{user_id}/review/{class_id}")
async def get_student_review(user_id: str, class_id: int):
    """Get a specific student's review for a class"""
    with get_conn() as conn:
        student = conn.execute(
            "SELECT id FROM students WHERE user_id = ?", (user_id,)
        ).fetchone()
        
        if not student:
            return {"review": None}
        
        review = conn.execute("""
            SELECT * FROM reviews WHERE student_id = ? AND class_id = ?
        """, (student['id'], class_id)).fetchone()
        
        return {"review": dict(review) if review else None}