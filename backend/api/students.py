from fastapi import APIRouter, HTTPException
from typing import Optional
from database import get_conn
from services.gpa_calculator import calculate_gpa, is_honor_roll_eligible
from services.graduation_checker import check_graduation_eligibility

router = APIRouter()

# ===== Student Listing Endpoints ===========================================================

@router.get("/api/students/all")
async def get_all_students():
    """Get all students"""
    with get_conn() as conn:
        students = conn.execute("""
            SELECT s.*, u.username, u.email, u.active, u.terminated
            FROM students s
            JOIN users u ON s.user_id = u.id
            ORDER BY s.name
        """).fetchall()
        
        return {"students": [dict(s) for s in students]}
        
@router.get("/api/students/top-gpa")
async def get_top_gpa_students(limit: int = 3):
    """Get students with highest GPA"""
    with get_conn() as conn:
        students = conn.execute("""
            SELECT s.*, u.username
            FROM students s
            JOIN users u ON s.user_id = u.id
            WHERE s.gpa IS NOT NULL AND s.terminated = 0
            ORDER BY s.gpa DESC
            LIMIT ?
        """, (limit,)).fetchall()
        
        return {"students": [dict(s) for s in students]}

# ===== Student Detail Endpoint ===========================================================

@router.get("/api/student/{user_id}")
async def get_student(user_id: int):
    """Get a specific student by user ID"""
    with get_conn() as conn:
        student = conn.execute("""
            SELECT s.*, u.username, u.email
            FROM students s
            JOIN users u ON s.user_id = u.id
            WHERE u.id = ?
        """, (user_id,)).fetchone()
        
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        
        return dict(student)

# ===== Student Dashboard Endpoint ===========================================================

@router.get("/api/student/{user_id}/dashboard")
async def get_student_dashboard(user_id: int):
    """Get dashboard data for a student"""
    with get_conn() as conn:
        student = conn.execute("""
            SELECT s.* 
            FROM students s 
            WHERE s.user_id = ?
        """, (user_id,)).fetchone()
        
        if not student:
            return {"error": "Student not found"}
        
        semester_result = conn.execute("SELECT value FROM settings WHERE key = 'semester'").fetchone()
        current_semester = int(semester_result['value']) if semester_result else 1
        
        all_grades = conn.execute("""
            SELECT grade FROM enrollments 
            WHERE student_id = ? AND grade IS NOT NULL AND grade != 'IP'
        """, (student['id'],)).fetchall()
        
        grade_points = {'A': 4.0, 'B': 3.0, 'C': 2.0, 'D': 1.0, 'F': 0.0}
        overall_gpa = None
        if all_grades:
            total = 0
            for g in all_grades:
                total += grade_points.get(g['grade'], 0)
            overall_gpa = total / len(all_grades)
        
        sem_grades = conn.execute("""
            SELECT grade FROM enrollments 
            WHERE student_id = ? AND semester = ? AND grade IS NOT NULL AND grade != 'IP'
        """, (student['id'], current_semester)).fetchall()
        
        semester_gpa = None
        if sem_grades:
            total = 0
            for g in sem_grades:
                total += grade_points.get(g['grade'], 0)
            semester_gpa = total / len(sem_grades)
        
        completed_result = conn.execute("""
            SELECT COUNT(*) as count FROM enrollments 
            WHERE student_id = ? AND grade IS NOT NULL AND grade != 'F' AND grade != 'IP'
        """, (student['id'],)).fetchone()
        
        return {
            "overallGPA": overall_gpa,
            "semesterGPA": semester_gpa,
            "completedCourses": completed_result['count'] if completed_result else 0,
            "warnings": student['warnings'] or 0,
            "honorCount": student['honor_count'] or 0,
            "onHonorRoll": student['honor_roll'] or False,
            "isTerminated": student['terminated'] or False,
            "isGraduated": student['graduated'] if 'graduated' in student.keys() else False,
            "isSuspended": student['suspended'] if 'suspended' in student.keys() else False,
            "pendingInterview": student['pending_interview'] if 'pending_interview' in student.keys() else False,
            "isNew": False
        }

# ===== Academic History Endpoint ===========================================================

@router.get("/api/student/{user_id}/academic-history")
async def get_academic_history(user_id: int):
    """Get academic history for a student"""
    with get_conn() as conn:
        student = conn.execute(
            "SELECT id FROM students WHERE user_id = ?", (user_id,)
        ).fetchone()
        
        if not student:
            return {"history": []}
        
        grade_points = {'A': 4.0, 'B': 3.0, 'C': 2.0, 'D': 1.0, 'F': 0.0}
        
        history = conn.execute("""
            SELECT e.semester, e.grade, cs.code, cs.title as name
            FROM enrollments e
            JOIN classes c ON e.class_id = c.id
            JOIN courses cs ON c.course_id = cs.id
            WHERE e.student_id = ? AND e.grade IS NOT NULL AND e.grade != 'IP'
            ORDER BY e.semester DESC, cs.code
        """, (student['id'],)).fetchall()
        
        result = []
        for h in history:
            result.append({
                "semester": h['semester'],
                "code": h['code'],
                "name": h['name'],
                "grade": h['grade'],
                "points": grade_points.get(h['grade'])
            })
        
        return {"history": result}

# ===== Student Honor Credit Endpoint ===========================================================

@router.post("/api/student/use-honor")
async def use_honor_credit(student_id: str):
    """Use an honor credit to remove a warning"""
    with get_conn() as conn:
        student = conn.execute(
            "SELECT * FROM students WHERE user_id = ?", (student_id,)
        ).fetchone()
        
        if not student:
            return {"success": False, "message": "Student not found"}
        
        if not student['honor_count'] or student['honor_count'] < 1:
            return {"success": False, "message": "No honor credits available"}
        
        if not student['warnings'] or student['warnings'] < 1:
            return {"success": False, "message": "No warnings to remove"}
        
        conn.execute("""
            UPDATE students 
            SET honor_count = honor_count - 1, warnings = warnings - 1 
            WHERE user_id = ?
        """, (student_id,))
        
        return {"success": True, "message": "Warning removed using honor credit"}