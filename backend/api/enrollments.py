# api/enrollments.py - Enrollment endpoints
from fastapi import APIRouter, HTTPException
from models.request_models import EnrollmentRequest, DropEnrollmentRequest, GradeRequest
from database import get_conn
from services.gpa_calculator import calculate_gpa
from services.warning_system import issue_warning

router = APIRouter()

@router.post("/api/enroll")
async def enroll_student(req: EnrollmentRequest):
    """Enroll a student in a class"""
    with get_conn() as conn:
        # Check if class exists
        cls = conn.execute(
            "SELECT c.*, cs.code FROM classes c JOIN courses cs ON c.course_id = cs.id WHERE c.id = ?",
            (req.classId,)
        ).fetchone()
        
        if not cls:
            return {"success": False, "message": "Class not found"}
        
        if cls['cancelled']:
            return {"success": False, "message": "Class is cancelled"}
        
        # Check if already enrolled
        existing = conn.execute("""
            SELECT * FROM enrollments 
            WHERE student_id = ? AND class_id = ? AND semester = ?
        """, (req.studentId, req.classId, req.semester)).fetchone()
        
        if existing and existing['status'] == 'registered':
            return {"success": False, "message": "Already enrolled"}
        
        # Check current enrollments count
        current_enrolled = conn.execute("""
            SELECT COUNT(*) as count FROM enrollments 
            WHERE student_id = ? AND semester = ? AND status = 'registered'
        """, (req.studentId, req.semester)).fetchone()
        
        if current_enrolled['count'] >= 4:
            return {"success": False, "message": "Maximum 4 courses per semester"}
        
        # Check time conflict
        student_classes = conn.execute("""
            SELECT c.class_time FROM enrollments e
            JOIN classes c ON e.class_id = c.id
            WHERE e.student_id = ? AND e.semester = ? AND e.status = 'registered'
        """, (req.studentId, req.semester)).fetchall()
        
        for sc in student_classes:
            if sc['class_time'] == cls['class_time']:
                return {"success": False, "message": f"Time conflict with another class"}
        
        # Check capacity
        enrolled_count = conn.execute("""
            SELECT COUNT(*) as count FROM enrollments 
            WHERE class_id = ? AND status = 'registered'
        """, (req.classId,)).fetchone()
        
        if enrolled_count['count'] >= cls['capacity']:
            # Add to waitlist
            conn.execute("""
                INSERT INTO enrollments (student_id, class_id, semester, status)
                VALUES (?, ?, ?, 'waitlisted')
            """, (req.studentId, req.classId, req.semester))
            return {"success": True, "message": f"Course full. Added to waitlist for {cls['code']}.", "waitlist": True}
        
        # Enroll
        conn.execute("""
            INSERT INTO enrollments (student_id, class_id, semester, status)
            VALUES (?, ?, ?, 'registered')
        """, (req.studentId, req.classId, req.semester))
        
        return {"success": True, "message": f"Enrolled in {cls['code']}."}

@router.post("/api/enrollment/drop")
async def drop_enrollment(req: DropEnrollmentRequest):
    """Drop an enrollment"""
    with get_conn() as conn:
        # FIX: 'code' is on courses (cs), not classes (c) — corrected JOIN order too
        enrollment = conn.execute(
            "SELECT e.*, cs.code FROM enrollments e JOIN classes c ON e.class_id = c.id JOIN courses cs ON c.course_id = cs.id WHERE e.id = ?",
            (req.enrollmentId,)
        ).fetchone()
        
        if not enrollment:
            return {"success": False, "message": "Enrollment not found"}
        
        conn.execute(
            "UPDATE enrollments SET status = 'dropped' WHERE id = ?",
            (req.enrollmentId,)
        )
        
        return {"success": True, "message": f"Dropped {enrollment['code']}"}

@router.get("/api/student/{user_id}/enrollments")
async def get_student_enrollments(user_id: str):
    """Get all enrollments for a student"""
    with get_conn() as conn:
        student = conn.execute(
            "SELECT id FROM students WHERE user_id = ?", (user_id,)
        ).fetchone()
        
        if not student:
            return {"enrolled": [], "waitlisted": []}
        
        # FIX: 'code' is on courses (cs), not classes (c)
        enrollments = conn.execute("""
            SELECT e.*, cs.code, cs.title as name, c.class_time, i.name as instructor_name
            FROM enrollments e
            JOIN classes c ON e.class_id = c.id
            JOIN courses cs ON c.course_id = cs.id
            LEFT JOIN instructors i ON c.instructor_id = i.id
            WHERE e.student_id = ?
        """, (student['id'],)).fetchall()
        
        enrolled = [dict(e) for e in enrollments if e['status'] == 'registered']
        waitlisted = [dict(e) for e in enrollments if e['status'] == 'waitlisted']
        
        return {"enrolled": enrolled, "waitlisted": waitlisted}

@router.get("/api/student/{user_id}/current-enrollments")
async def get_current_enrollments(user_id: str):
    """Get current semester enrollments for a student"""
    with get_conn() as conn:
        semester = conn.execute("SELECT value FROM settings WHERE key = 'semester'").fetchone()
        current_semester = int(semester['value']) if semester else 1
        
        student = conn.execute(
            "SELECT id FROM students WHERE user_id = ?", (user_id,)
        ).fetchone()
        
        if not student:
            return {"enrollments": []}
        
        # FIX: 'code' is on courses (cs), not classes (c)
        enrollments = conn.execute("""
            SELECT e.*, cs.code, cs.title as name, c.class_time, i.name as instructor_name
            FROM enrollments e
            JOIN classes c ON e.class_id = c.id
            JOIN courses cs ON c.course_id = cs.id
            LEFT JOIN instructors i ON c.instructor_id = i.id
            WHERE e.student_id = ? AND e.semester = ? AND e.status = 'registered'
        """, (student['id'], current_semester)).fetchall()
        
        return {"enrollments": [dict(e) for e in enrollments]}

@router.post("/api/grade/post")
async def post_grade(req: GradeRequest):
    """Post a grade for an enrollment"""
    with get_conn() as conn:
        enrollment = conn.execute(
            "SELECT e.*, c.instructor_id FROM enrollments e JOIN classes c ON e.class_id = c.id WHERE e.id = ?",
            (req.enrollmentId,)
        ).fetchone()
        
        if not enrollment:
            return {"success": False, "message": "Enrollment not found"}
        
        conn.execute(
            "UPDATE enrollments SET grade = ? WHERE id = ?",
            (req.grade, req.enrollmentId)
        )
        
        # Update student GPA
        student_id = enrollment['student_id']
        grades = conn.execute(
            "SELECT grade FROM enrollments WHERE student_id = ? AND grade IS NOT NULL",
            (student_id,)
        ).fetchall()
        
        gpa = calculate_gpa([g['grade'] for g in grades if g['grade']])
        
        if gpa:
            conn.execute(
                "UPDATE students SET gpa = ? WHERE id = ?",
                (gpa, student_id)
            )
        
        return {"success": True, "message": f"Grade {req.grade} posted"}

@router.post("/api/waitlist/admit")
async def admit_waitlist(enrollmentId: int):
    """Admit a student from waitlist"""
    with get_conn() as conn:
        enrollment = conn.execute(
            "SELECT * FROM enrollments WHERE id = ?", (enrollmentId,)
        ).fetchone()
        
        if not enrollment:
            return {"success": False, "message": "Enrollment not found"}
        
        # Check if there's space in the class
        class_id = enrollment['class_id']
        enrolled_count = conn.execute(
            "SELECT COUNT(*) as count FROM enrollments WHERE class_id = ? AND status = 'registered'",
            (class_id,)
        ).fetchone()['count']
        
        cls = get_class_by_id(class_id)
        if enrolled_count >= cls['capacity']:
            return {"success": False, "message": "Class is full"}
        
        conn.execute(
            "UPDATE enrollments SET status = 'registered' WHERE id = ?",
            (enrollmentId,)
        )
        
        return {"success": True, "message": "Student admitted from waitlist"}

@router.get("/api/instructor/{user_id}/classes")
async def get_instructor_classes(user_id: int):
    """Get all classes taught by an instructor with student rosters"""
    from database import get_conn, get_setting
    
    with get_conn() as conn:
        instructor = conn.execute(
            "SELECT id FROM instructors WHERE user_id = ?", (user_id,)
        ).fetchone()
        
        if not instructor:
            return {"classes": []}
        
        semester = get_setting('semester') or 1
        
        classes = conn.execute("""
            SELECT c.*, cs.code, cs.title as name,
                   (SELECT AVG(CASE 
                        WHEN e.grade = 'A' THEN 4.0
                        WHEN e.grade = 'B' THEN 3.0
                        WHEN e.grade = 'C' THEN 2.0
                        WHEN e.grade = 'D' THEN 1.0
                        WHEN e.grade = 'F' THEN 0.0
                        ELSE NULL END)
                    FROM enrollments e
                    WHERE e.class_id = c.id AND e.status = 'registered' AND e.grade IS NOT NULL
                   ) as class_gpa,
                   (SELECT COUNT(*) FROM grade_justifications 
                    WHERE class_id = c.id AND instructor_id = ?) as has_justification
            FROM classes c
            JOIN courses cs ON c.course_id = cs.id
            WHERE c.instructor_id = ? AND c.semester = ?
        """, (instructor['id'], instructor['id'], semester)).fetchall()
        
        result = []
        for cls in classes:
            students = conn.execute("""
                SELECT e.id as enrollment_id, e.status, e.grade,
                       s.id, s.student_code, s.name, s.gpa
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
                "cancelled": cls['cancelled'],
                "class_gpa": cls['class_gpa'],
                "has_justification": cls['has_justification'] > 0,
                "students": [dict(s) for s in students]
            })
        
        return {"classes": result}

@router.post("/api/grade-justification/submit")
async def submit_grade_justification(instructorId: int, classId: int, justification: str):
    """Submit a grade justification for review"""
    from database import get_conn
    
    with get_conn() as conn:
        conn.execute("""
            INSERT INTO grade_justifications (instructor_id, class_id, justification, created_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        """, (instructorId, classId, justification))
        
        return {"success": True, "message": "Justification submitted"}
