# api/graduation.py - Graduation endpoints
from fastapi import APIRouter, HTTPException
from models.request_models import GraduationApplyRequest, GraduationProcessRequest
from database import get_conn
from services.graduation_checker import check_graduation_eligibility

router = APIRouter()

@router.post("/api/graduation/apply")
async def apply_for_graduation(req: GraduationApplyRequest):
    """Apply for graduation"""
    with get_conn() as conn:
        # Get student
        student = conn.execute(
            "SELECT s.* FROM students s WHERE s.user_id = ?",
            (req.studentId,)
        ).fetchone()
        
        if not student:
            return {"success": False, "message": "Student not found"}
        
        # Check if already applied
        existing = conn.execute(
            "SELECT * FROM graduation_apps WHERE student_id = ? AND status = 'pending'",
            (student['id'],)
        ).fetchone()
        
        if existing:
            return {"success": False, "message": "Already have a pending application"}
        
        # Check if already graduated
        if student.get('graduated'):
            return {"success": False, "message": "Already graduated"}
        
        # Get completed courses
        completed = conn.execute("""
            SELECT * FROM enrollments 
            WHERE student_id = ? AND grade IS NOT NULL AND grade != 'F' AND grade != 'IP'
        """, (student['id'],)).fetchall()
        
        # Get required courses
        required = conn.execute(
            "SELECT id FROM courses WHERE required = 1"
        ).fetchall()
        
        required_ids = [r['id'] for r in required]
        is_eligible, missing, completed_count = check_graduation_eligibility(completed, required_ids)
        
        if not is_eligible:
            return {"success": False, "message": f"Not eligible. Need {8 - completed_count} more courses. Missing {len(missing)} required."}
        
        # Create application
        conn.execute("""
            INSERT INTO graduation_apps (student_id, status, created_at)
            VALUES (?, 'pending', datetime('now'))
        """, (student['id'],))
        
        return {"success": True, "message": "Graduation application submitted"}

@router.get("/api/graduation/applications")
async def get_graduation_applications():
    """Get all graduation applications"""
    with get_conn() as conn:
        pending = conn.execute("""
            SELECT g.*, s.name as student_name, s.student_code
            FROM graduation_apps g
            JOIN students s ON g.student_id = s.id
            WHERE g.status = 'pending'
            ORDER BY g.created_at ASC
        """).fetchall()
        
        processed = conn.execute("""
            SELECT g.*, s.name as student_name, s.student_code
            FROM graduation_apps g
            JOIN students s ON g.student_id = s.id
            WHERE g.status != 'pending'
            ORDER BY g.created_at DESC
            LIMIT 50
        """).fetchall()
        
        return {
            "pending": [dict(g) for g in pending],
            "processed": [dict(g) for g in processed]
        }

@router.get("/api/graduation/pending")
async def get_pending_graduation_applications():
    """Get only pending graduation applications"""
    with get_conn() as conn:
        applications = conn.execute("""
            SELECT g.*, s.name as student_name, s.student_code,
                   (SELECT COUNT(*) FROM enrollments 
                    WHERE student_id = g.student_id AND grade IS NOT NULL AND grade != 'F' AND grade != 'IP') as completed_classes
            FROM graduation_apps g
            JOIN students s ON g.student_id = s.id
            WHERE g.status = 'pending'
            ORDER BY g.created_at ASC
        """).fetchall()
        
        return {"applications": [dict(app) for app in applications]}

@router.post("/api/graduation/process")
async def process_graduation(req: GraduationProcessRequest):
    """Process a graduation application (approve/reject)"""
    with get_conn() as conn:
        app = conn.execute(
            "SELECT * FROM graduation_apps WHERE id = ?", (req.applicationId,)
        ).fetchone()
        
        if not app:
            return {"success": False, "message": "Application not found"}
        
        status = 'approved' if req.approve else 'rejected'
        
        conn.execute("""
            UPDATE graduation_apps 
            SET status = ?, note = ?, processed_at = datetime('now')
            WHERE id = ?
        """, (status, req.note, req.applicationId))
        
        if req.approve:
            # Mark student as graduated
            conn.execute("""
                UPDATE students SET graduated = 1, terminated = 1 WHERE id = ?
            """, (app['student_id'],))
            
            # Add notification
            conn.execute("""
                INSERT INTO notifications (user_id, message, type, created_at)
                VALUES ((SELECT user_id FROM students WHERE id = ?), 
                        'Congratulations! Your graduation has been approved!', 
                        'success', datetime('now'))
            """, (app['student_id'],))
        
        return {"success": True, "message": f"Application {status}"}

@router.get("/api/student/{user_id}/graduation-status")
async def get_graduation_status(user_id: str):
    """Get graduation status for a student"""
    with get_conn() as conn:
        # FIX: users table has no 'name' column — query students directly
        student = conn.execute(
            "SELECT s.* FROM students s WHERE s.user_id = ?",
            (user_id,)
        ).fetchone()
        
        if not student:
            return {"error": "Student not found"}
        
        # Get completed courses
        # FIX: 'code' is on courses (cs), not classes (c)
        completed = conn.execute("""
            SELECT e.*, cs.code, cs.title as name, cs.required
            FROM enrollments e
            JOIN classes c ON e.class_id = c.id
            JOIN courses cs ON c.course_id = cs.id
            WHERE e.student_id = ? AND e.grade IS NOT NULL AND e.grade != 'F' AND e.grade != 'IP'
        """, (student['id'],)).fetchall()
        
        # Get failed courses
        # FIX: 'code' is on courses (cs), not classes (c)
        failed = conn.execute("""
            SELECT e.*, cs.code, cs.title as name
            FROM enrollments e
            JOIN classes c ON e.class_id = c.id
            JOIN courses cs ON c.course_id = cs.id
            WHERE e.student_id = ? AND e.grade = 'F'
        """, (student['id'],)).fetchall()
        
        # Get required courses
        required = conn.execute("SELECT * FROM courses WHERE required = 1").fetchall()
        
        completed_ids = [e['class_id'] for e in completed]
        completed_required = [c for c in required if c['id'] in completed_ids]
        missing_required = [c for c in required if c['id'] not in completed_ids]
        
        existing_app = conn.execute(
            "SELECT * FROM graduation_apps WHERE student_id = ? AND status = 'pending'",
            (student['id'],)
        ).fetchone()
        
        return {
            "completedCount": len(completed),
            "completedCourses": [dict(e) for e in completed],
            "failedCourses": [dict(f) for f in failed],
            "requiredCourses": [dict(r) for r in required],
            "completedRequired": [dict(c) for c in completed_required],
            "missingRequired": [dict(m) for m in missing_required],
            "existingApp": dict(existing_app) if existing_app else None,
            "canApply": len(completed) >= 8 and len(missing_required) == 0 and not existing_app and not student.get('graduated'),
            "isGraduated": student.get('graduated', False)
        }
