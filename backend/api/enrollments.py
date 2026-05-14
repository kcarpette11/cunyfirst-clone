# api/enrollments.py - Enrollment endpoints
MAX_COURSES_PER_SEMESTER = 6
from fastapi import APIRouter, HTTPException
from models.request_models import EnrollmentRequest, DropEnrollmentRequest, GradeRequest, AdmitWaitlistRequest
from database import get_conn, get_setting
from services.gpa_calculator import calculate_gpa
from services.warning_system import issue_warning
router = APIRouter()

@router.post("/api/enroll")
async def enroll_student(req: EnrollmentRequest):
    """Enroll a student in a class"""
    try:
        with get_conn() as conn:
            # Convert to integers to ensure proper matching
            student_id = int(req.studentId)
            class_id = int(req.classId)
            semester = int(req.semester)
            
            print(f"📚 Enrolling - Student: {student_id}, Class: {class_id}, Semester: {semester}")
            
            cls = conn.execute(
                "SELECT c.*, cs.code FROM classes c JOIN courses cs ON c.course_id = cs.id WHERE c.id = ?",
                (class_id,)
            ).fetchone()

            if not cls:
                return {"success": False, "message": "Class not found"}

            if cls['cancelled']:
                return {"success": False, "message": "Class is cancelled"}

            # First, check if student exists
            student = conn.execute(
                "SELECT id FROM students WHERE id = ? OR user_id = ?",
                (student_id, student_id)
            ).fetchone()
            
            if not student:
                return {"success": False, "message": "Student not found"}
            
            actual_student_id = student['id']
            print(f"Actual student ID in DB: {actual_student_id}")

            existing = conn.execute("""
                SELECT * FROM enrollments
                WHERE student_id = ? AND class_id = ? AND semester = ?
            """, (actual_student_id, class_id, semester)).fetchone()

            if existing:
                if existing['status'] == 'registered':
                    return {"success": False, "message": "Already enrolled"}
                elif existing['status'] == 'dropped':
                    conn.execute("""
                        UPDATE enrollments 
                        SET status = 'registered', grade = NULL 
                        WHERE id = ?
                    """, (existing['id'],))
                    return {"success": True, "message": f"Re-enrolled in {cls['code']}."}
                elif existing['status'] == 'waitlisted':
                    return {"success": False, "message": "Already on waitlist"}

            current_enrolled = conn.execute("""
                SELECT COUNT(*) as count FROM enrollments
                WHERE student_id = ? AND semester = ? AND status = 'registered'
            """, (actual_student_id, semester)).fetchone()

            if current_enrolled['count'] >= MAX_COURSES_PER_SEMESTER:
                return {"success": False, "message": f"Maximum {MAX_COURSES_PER_SEMESTER} courses per semester"}

            # Check time conflict
            student_classes = conn.execute("""
                SELECT c.class_time FROM enrollments e
                JOIN classes c ON e.class_id = c.id
                WHERE e.student_id = ? AND e.semester = ? AND e.status = 'registered'
            """, (actual_student_id, semester)).fetchall()

            for sc in student_classes:
                if sc['class_time'] == cls['class_time']:
                    return {"success": False, "message": "Time conflict with another class"}

            # Check capacity
            enrolled_count = conn.execute("""
                SELECT COUNT(*) as count FROM enrollments
                WHERE class_id = ? AND status = 'registered'
            """, (class_id,)).fetchone()

            if enrolled_count['count'] >= cls['capacity']:
                conn.execute("""
                    INSERT INTO enrollments (student_id, class_id, semester, status)
                    VALUES (?, ?, ?, 'waitlisted')
                """, (actual_student_id, class_id, semester))
                return {"success": True, "message": f"Course full. Added to waitlist for {cls['code']}.", "waitlist": True}

            # Finally, enroll
            conn.execute("""
                INSERT INTO enrollments (student_id, class_id, semester, status)
                VALUES (?, ?, ?, 'registered')
            """, (actual_student_id, class_id, semester))
            
            print(f"✅ Successfully enrolled student {actual_student_id} in class {class_id}")

            return {"success": True, "message": f"Enrolled in {cls['code']}."}
    except Exception as e:
        print(f"❌ Error in enroll_student: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "message": f"Server error: {str(e)}"}

async def admit_waitlist(req: AdmitWaitlistRequest):
    enrollmentId = req.enrollmentId

@router.post("/api/enrollment/drop")
async def drop_enrollment(req: DropEnrollmentRequest):
    """Drop an enrollment and promote the next waitlisted student if applicable"""
    with get_conn() as conn:
        # FIX: 'code' is on courses (cs), not classes (c) — corrected JOIN order too
        enrollment = conn.execute(
            """SELECT e.*, cs.code, e.class_id, c.capacity
               FROM enrollments e
               JOIN classes c ON e.class_id = c.id
               JOIN courses cs ON c.course_id = cs.id
               WHERE e.id = ?""",
            (req.enrollment_id,)
        ).fetchone()

        if not enrollment:
            return {"success": False, "message": "Enrollment not found"}

        conn.execute(
            "UPDATE enrollments SET status = 'dropped' WHERE id = ?",
            (req.enrollment_id,)
        )

        if enrollment['status'] == 'registered':
            next_waitlisted = conn.execute("""
                SELECT id FROM enrollments
                WHERE class_id = ? AND status = 'waitlisted'
                ORDER BY id ASC
                LIMIT 1
            """, (enrollment['class_id'],)).fetchone()

            if next_waitlisted:
                conn.execute(
                    "UPDATE enrollments SET status = 'registered' WHERE id = ?",
                    (next_waitlisted['id'],)
                )

        return {"success": True, "message": f"Dropped {enrollment['code']}"}


@router.get("/api/student/{user_id}/enrollments")
async def get_student_enrollments(user_id: str):
    """Get current semester enrollments for a student"""
    with get_conn() as conn:
        # FIX #4: scope to current semester only
        semester = get_setting('semester') or 1

        student = conn.execute(
            "SELECT id FROM students WHERE user_id = ?", (user_id,)
        ).fetchone()

        if not student:
            return {"enrolled": [], "waitlisted": []}

        enrollments = conn.execute("""
            SELECT e.id as enrollment_id, e.status, e.class_id,
                   cs.code, cs.title as name, c.class_time,
                   i.name as instructor_name
            FROM enrollments e
            JOIN classes c ON e.class_id = c.id
            JOIN courses cs ON c.course_id = cs.id
            LEFT JOIN instructors i ON c.instructor_id = i.id
            WHERE e.student_id = ? AND e.semester = ?
        """, (student['id'], semester)).fetchall()  # FIX #2: alias id -> enrollment_id in SQL

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

        enrollments = conn.execute("""
            SELECT e.id as enrollment_id, e.status, e.class_id,
                   cs.code, cs.title as name, c.class_time,
                   i.name as instructor_name
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

        class_id = enrollment['class_id']
        enrolled_count = conn.execute(
            "SELECT COUNT(*) as count FROM enrollments WHERE class_id = ? AND status = 'registered'",
            (class_id,)
        ).fetchone()['count']

        # FIX #3: inline the capacity lookup instead of calling undefined get_class_by_id()
        cls = conn.execute(
            "SELECT capacity FROM classes WHERE id = ?", (class_id,)
        ).fetchone()

        if not cls:
            return {"success": False, "message": "Class not found"}

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
    with get_conn() as conn:
        conn.execute("""
            INSERT INTO grade_justifications (instructor_id, class_id, justification, created_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        """, (instructorId, classId, justification))

        return {"success": True, "message": "Justification submitted"}

@router.post("/api/enroll-debug")
async def enroll_student_debug(req: EnrollmentRequest):
    """Debug version to see what's happening"""
    print("=" * 50)
    print("DEBUG ENROLLMENT CALLED")
    print(f"Student ID: {req.studentId} (type: {type(req.studentId)})")
    print(f"Class ID: {req.classId} (type: {type(req.classId)})")
    print(f"Semester: {req.semester}")
    print("=" * 50)
    
    with get_conn() as conn:
        # Check if student exists
        student = conn.execute(
            "SELECT * FROM students WHERE user_id = ? OR id = ?", 
            (req.studentId, req.studentId)
        ).fetchone()
        print(f"Student found: {student is not None}")
        if student:
            print(f"Student ID in DB: {student['id']}, user_id: {student['user_id']}")
        
        # Check if class exists
        cls = conn.execute(
            "SELECT * FROM classes WHERE id = ?", (req.classId,)
        ).fetchone()
        print(f"Class found: {cls is not None}")
        if cls:
            print(f"Class capacity: {cls['capacity']}")
            
            # Check current enrollment count
            enrolled_count = conn.execute(
                "SELECT COUNT(*) as count FROM enrollments WHERE class_id = ? AND status = 'registered'",
                (req.classId,)
            ).fetchone()
            print(f"Current enrolled count: {enrolled_count['count']}")
            print(f"Available spots: {cls['capacity'] - enrolled_count['count']}")
        
        # Check existing enrollment
        existing = conn.execute("""
            SELECT * FROM enrollments
            WHERE student_id = ? AND class_id = ? AND semester = ?
        """, (req.studentId, req.classId, req.semester)).fetchone()
        print(f"Existing enrollment: {existing is not None}")
        if existing:
            print(f"Existing status: {existing['status']}")
        
        return {
            "debug": {
                "student_exists": student is not None,
                "class_exists": cls is not None,
                "existing_enrollment": existing is not None,
                "student_id_type": str(type(req.studentId)),
                "class_id_type": str(type(req.classId))
            }
        }