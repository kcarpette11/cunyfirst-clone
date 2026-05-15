# api/instructors.py - Instructor endpoints
from fastapi import APIRouter, HTTPException
from typing import Optional
from database import get_conn
from services.warning_system import issue_warning
from pydantic import BaseModel

class FireInstructorRequest(BaseModel):
    instructorId: int

class InstructorActionRequest(BaseModel):
    instructorId: int

router = APIRouter()

# ===== Instructor listing endpoints with optional active filter, includes user details and warning status ============================================================

@router.get("/api/instructors")
async def get_instructors():
    """Get all active instructors"""
    with get_conn() as conn:
        instructors = conn.execute("""
            SELECT i.id, i.name, i.email, i.warnings, i.suspended, i.fired,
                   u.username
            FROM instructors i
            JOIN users u ON i.user_id = u.id
            WHERE u.terminated = 0 AND u.active = 1
        """).fetchall()
        
        return {"instructors": [dict(i) for i in instructors]}

@router.get("/api/instructors/all")
async def get_all_instructors():
    """Get all instructors (including inactive)"""
    with get_conn() as conn:
        instructors = conn.execute("""
            SELECT i.id, i.name, i.email, i.warnings, i.suspended, i.fired,
                   u.username, u.active, u.terminated
            FROM instructors i
            JOIN users u ON i.user_id = u.id
        """).fetchall()
        
        return {"instructors": [dict(i) for i in instructors]}

# ===== Single instructor endpoint by user ID, includes user details and warning status ============================================================

@router.get("/api/instructor/{user_id}")
async def get_instructor(user_id: int):
    """Get a specific instructor by user ID"""
    with get_conn() as conn:
        instructor = conn.execute("""
            SELECT i.*, u.username, u.email as user_email
            FROM instructors i
            JOIN users u ON i.user_id = u.id
            WHERE u.id = ?
        """, (user_id,)).fetchone()
        
        if not instructor:
            raise HTTPException(status_code=404, detail="Instructor not found")
        
        return dict(instructor)

# ===== Instructor classes and rosters endpoints, includes enrollment status and student details ============================================================

@router.get("/api/instructor/{user_id}/classes")
async def get_instructor_classes(user_id: int):
    """Get all classes taught by an instructor"""
    with get_conn() as conn:
        instructor = conn.execute(
            "SELECT id FROM instructors WHERE user_id = ?", (user_id,)
        ).fetchone()
        
        if not instructor:
            return {"classes": []}
        
        classes = conn.execute("""
            SELECT c.*, cs.code, cs.title as name,
                   (SELECT COUNT(*) FROM enrollments e 
                    WHERE e.class_id = c.id AND e.status = 'registered') as enrolled_count,
                   (SELECT COUNT(*) FROM enrollments e 
                    WHERE e.class_id = c.id AND e.status = 'waitlisted') as waitlisted_count
            FROM classes c
            JOIN courses cs ON c.course_id = cs.id
            WHERE c.instructor_id = ?
        """, (instructor['id'],)).fetchall()
        
        result = []
        for cls in classes:
            students = conn.execute("""
                SELECT e.id as enrollment_id, e.status, e.grade,
                       s.id, s.user_id, s.student_code, s.name, s.email, s.gpa
                FROM enrollments e
                JOIN students s ON e.student_id = s.id
                WHERE e.class_id = ? AND e.status IN ('registered', 'waitlisted')
            """, (cls['id'],)).fetchall()
            
            result.append({
                "id": cls['id'],
                "code": cls['code'],
                "name": cls['name'],
                "class_time": cls['class_time'],
                "capacity": cls['capacity'],
                "avg_rating": cls['avg_rating'],
                "cancelled": cls['cancelled'],
                "enrolled_count": cls['enrolled_count'],
                "waitlisted_count": cls['waitlisted_count'],
                "students": [dict(s) for s in students]
            })
        
        return {"classes": result}

@router.get("/api/instructor/{user_id}/roster/{class_id}")
async def get_class_roster(user_id: int, class_id: int):
    """Get roster for a specific class (instructor only)"""
    with get_conn() as conn:
        instructor = conn.execute(
            "SELECT id FROM instructors WHERE user_id = ?", (user_id,)
        ).fetchone()
        
        if not instructor:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        cls = conn.execute(
            "SELECT * FROM classes WHERE id = ? AND instructor_id = ?",
            (class_id, instructor['id'])
        ).fetchone()
        
        if not cls:
            raise HTTPException(status_code=404, detail="Class not found or not yours")
        
        students = conn.execute("""
            SELECT e.id as enrollment_id, e.status, e.grade,
                   s.id, s.student_code, s.name, s.gpa, s.warnings
            FROM enrollments e
            JOIN students s ON e.student_id = s.id
            WHERE e.class_id = ? AND e.status IN ('registered', 'waitlisted')
        """, (class_id,)).fetchall()
        
        return {"students": [dict(s) for s in students]}

# ===== Instructor actions - warn and fire, which update the instructor's warning count and employment status, 
# and also update the associated user account and add notifications ============================================================

@router.post("/api/instructor/warn")
async def warn_instructor(req: InstructorActionRequest):
    """Issue a warning to an instructor"""
    with get_conn() as conn:
        instructor = conn.execute(
            "SELECT i.*, u.id as user_id FROM instructors i JOIN users u ON i.user_id = u.id WHERE i.id = ?",
            (req.instructorId,)
        ).fetchone()
        
        if not instructor:
            return {"success": False, "message": "Instructor not found"}
        
        warnings, suspended, message = issue_warning(instructor['warnings'] or 0, 'instructor')
        
        conn.execute(
            "UPDATE instructors SET warnings = ?, suspended = ? WHERE id = ?",
            (warnings, 1 if suspended else 0, req.instructorId)
        )
        
        return {"success": True, "message": message}

@router.post("/api/instructor/fire")
async def fire_instructor(req: FireInstructorRequest):
    """Fire an instructor"""
    with get_conn() as conn:
        instructor = conn.execute(
            "SELECT i.*, u.id as user_id FROM instructors i JOIN users u ON i.user_id = u.id WHERE i.id = ?",
            (req.instructorId,)
        ).fetchone()
        
        if not instructor:
            return {"success": False, "message": "Instructor not found"}
        
        conn.execute("UPDATE instructors SET fired = 1 WHERE id = ?", (req.instructorId,))
        conn.execute("UPDATE users SET active = 0, terminated = 1 WHERE id = ?", (instructor['user_id'],))
        
        # Add notification
        conn.execute("""
            INSERT INTO notifications (user_id, message, type, created_at)
            VALUES (?, 'You have been fired from College0.', 'danger', datetime('now'))
        """, (instructor['user_id'],))
        
        return {"success": True, "message": "Instructor fired"}