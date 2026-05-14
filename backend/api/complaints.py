from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_conn
from services.warning_system import issue_warning

router = APIRouter()

class ComplaintSubmit(BaseModel):
    from_id: str
    from_role: str
    against_id: str
    text: str

class ComplaintResolveRequest(BaseModel):
    complaintId: int
    action: str

@router.post("/api/complaint/submit")
async def submit_complaint(complaint: ComplaintSubmit):
    """Submit a complaint from student or instructor"""
    with get_conn() as conn:
        against = conn.execute(
            "SELECT role FROM users WHERE id = ?", (complaint.against_id,)
        ).fetchone()
        
        if not against:
            return {"success": False, "message": "Target user not found"}
        
        conn.execute("""
            INSERT INTO complaints (from_id, from_role, against_id, against_role, text, status, created_at)
            VALUES (?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
        """, (complaint.from_id, complaint.from_role, complaint.against_id, against['role'], complaint.text))
        
        return {"success": True, "message": "Complaint submitted successfully"}

@router.get("/api/complaints/all")
async def get_all_complaints():
    """Get all complaints (pending and resolved)"""
    with get_conn() as conn:
        # FIX: users table has no 'name' column — resolve names via students/instructors
        pending = conn.execute("""
            SELECT c.*,
                   COALESCE(s1.name, i1.name, u1.username) as from_name, u1.role as from_role_display,
                   COALESCE(s2.name, i2.name, u2.username) as against_name, u2.role as against_role_display
            FROM complaints c
            JOIN users u1 ON c.from_id = u1.id
            JOIN users u2 ON c.against_id = u2.id
            LEFT JOIN students s1 ON u1.id = s1.user_id
            LEFT JOIN instructors i1 ON u1.id = i1.user_id
            LEFT JOIN students s2 ON u2.id = s2.user_id
            LEFT JOIN instructors i2 ON u2.id = i2.user_id
            WHERE c.status = 'pending'
            ORDER BY c.created_at DESC
        """).fetchall()
        
        resolved = conn.execute("""
            SELECT c.*,
                   COALESCE(s1.name, i1.name, u1.username) as from_name, u1.role as from_role_display,
                   COALESCE(s2.name, i2.name, u2.username) as against_name, u2.role as against_role_display
            FROM complaints c
            JOIN users u1 ON c.from_id = u1.id
            JOIN users u2 ON c.against_id = u2.id
            LEFT JOIN students s1 ON u1.id = s1.user_id
            LEFT JOIN instructors i1 ON u1.id = i1.user_id
            LEFT JOIN students s2 ON u2.id = s2.user_id
            LEFT JOIN instructors i2 ON u2.id = i2.user_id
            WHERE c.status = 'resolved'
            ORDER BY c.created_at DESC
            LIMIT 50
        """).fetchall()
        
        return {
            "pending": [dict(c) for c in pending],
            "resolved": [dict(c) for c in resolved]
        }

@router.get("/api/complaints/pending")
async def get_pending_complaints():
    """Get only pending complaints"""
    with get_conn() as conn:
        # FIX: users table has no 'name' column — resolve names via students/instructors
        complaints = conn.execute("""
            SELECT c.*,
                   COALESCE(s1.name, i1.name, u1.username) as from_name, u1.role as from_role_display,
                   COALESCE(s2.name, i2.name, u2.username) as against_name, u2.role as against_role_display
            FROM complaints c
            JOIN users u1 ON c.from_id = u1.id
            JOIN users u2 ON c.against_id = u2.id
            LEFT JOIN students s1 ON u1.id = s1.user_id
            LEFT JOIN instructors i1 ON u1.id = i1.user_id
            LEFT JOIN students s2 ON u2.id = s2.user_id
            LEFT JOIN instructors i2 ON u2.id = i2.user_id
            WHERE c.status = 'pending'
            ORDER BY c.created_at DESC
        """).fetchall()
        
        return {"complaints": [dict(c) for c in complaints]}

@router.get("/api/complaints/student/{student_id}")
async def get_student_complaints(student_id: str):
    """Get complaints filed by a student"""
    with get_conn() as conn:
        complaints = conn.execute("""
            SELECT c.*, 
                   COALESCE(s.name, i.name, u.username) as against_name,
                   c.against_role
            FROM complaints c
            LEFT JOIN students s ON c.against_id = s.user_id AND c.against_role = 'student'
            LEFT JOIN instructors i ON c.against_id = i.user_id AND c.against_role = 'instructor'
            LEFT JOIN users u ON c.against_id = u.id
            WHERE c.from_id = ? AND c.from_role = 'student'
            ORDER BY c.created_at DESC
        """, (student_id,)).fetchall()
        
        return {"complaints": [dict(c) for c in complaints]}

@router.get("/api/complaints/targets/{student_id}")
async def get_complaint_targets(student_id: str):
    """Get possible targets for a student complaint"""
    with get_conn() as conn:
        semester = conn.execute("SELECT value FROM settings WHERE key = 'semester'").fetchone()
        current_semester = int(semester['value']) if semester else 1
        
        enrolled_classes = conn.execute("""
            SELECT class_id FROM enrollments 
            WHERE student_id = ? AND semester = ? AND status = 'registered'
        """, (student_id, current_semester)).fetchall()
        
        class_ids = [c['class_id'] for c in enrolled_classes]
        
        instructors = []
        if class_ids:
            placeholders = ','.join('?' * len(class_ids))
            instructors = conn.execute(f"""
                SELECT DISTINCT i.id, i.name
                FROM instructors i
                JOIN classes c ON c.instructor_id = i.id
                WHERE c.id IN ({placeholders})
            """, class_ids).fetchall()
        
        students = conn.execute("""
            SELECT s.id, s.name, s.student_code
            FROM students s
            JOIN users u ON s.user_id = u.id
            WHERE u.id != ? AND u.terminated = 0
        """, (student_id,)).fetchall()
        
        return {
            "instructors": [dict(i) for i in instructors],
            "students": [dict(s) for s in students]
        }

@router.post("/api/complaint/resolve")
async def resolve_complaint(req: ComplaintResolveRequest):
    """Resolve a complaint with an action"""
    with get_conn() as conn:
        complaint = conn.execute(
            "SELECT * FROM complaints WHERE id = ?", (req.complaintId,)
        ).fetchone()
        
        if not complaint:
            return {"success": False, "message": "Complaint not found"}
        
        conn.execute("""
            UPDATE complaints 
            SET status = 'resolved', resolution = ?, resolved_at = datetime('now')
            WHERE id = ?
        """, (req.action, req.complaintId))
        
        if req.action == 'warn_against':
            warnings, suspended, _ = issue_warning(0, complaint['against_role'])
            if complaint['against_role'] == 'student':
                conn.execute("UPDATE students SET warnings = warnings + 1 WHERE user_id = ?", (complaint['against_id'],))
            else:
                conn.execute("UPDATE instructors SET warnings = warnings + 1 WHERE user_id = ?", (complaint['against_id'],))
                
        elif req.action == 'warn_filer':
            if complaint['from_role'] == 'student':
                conn.execute("UPDATE students SET warnings = warnings + 1 WHERE user_id = ?", (complaint['from_id'],))
            else:
                conn.execute("UPDATE instructors SET warnings = warnings + 1 WHERE user_id = ?", (complaint['from_id'],))
                
        elif req.action == 'deregister':
            conn.execute("""
                UPDATE enrollments 
                SET status = 'dropped' 
                WHERE student_id = ? AND status = 'registered'
            """, (complaint['against_id'],))
        
        return {"success": True, "message": f"Complaint resolved with action: {req.action}"}

@router.get("/api/complaints/instructor/{user_id}")
async def get_instructor_complaints(user_id: int):
    """Get complaints filed by an instructor"""
    with get_conn() as conn:
        complaints = conn.execute("""
            SELECT c., 
                   COALESCE(s.name, i.name, u.username) as against_name,
                   c.against_role
            FROM complaints c
            LEFT JOIN students s ON c.against_id = s.user_id AND c.against_role = 'student'
            LEFT JOIN instructors i ON c.against_id = i.user_id AND c.against_role = 'instructor'
            LEFT JOIN users u ON c.against_id = u.id
            WHERE c.from_id = ? AND c.from_role = 'instructor'
            ORDER BY c.created_at DESC
        """, (user_id,)).fetchall()
        
        return {"complaints": [dict(c) for c in complaints]}
