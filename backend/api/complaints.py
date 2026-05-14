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
    """Submit a complaint. from_id and against_id must be users.id values."""
    with get_conn() as conn:

        # Verify filer exists in users table
        filer = conn.execute(
            "SELECT id, role FROM users WHERE id = ?", (complaint.from_id,)
        ).fetchone()

        if not filer:
            return {"success": False, "message": "Filer account not found"}

        # Registrar/dean cannot file complaints — they resolve them
        if filer['role'] == 'registrar':
            return {"success": False, "message": "Registrar accounts cannot file complaints."}

        # Verify target exists in users table
        against = conn.execute(
            "SELECT id, role FROM users WHERE id = ?", (complaint.against_id,)
        ).fetchone()

        if not against:
            return {"success": False, "message": "Target user not found"}

        # Registrar/dean cannot be complained against — they are the arbiters
        if against['role'] == 'registrar':
            return {"success": False, "message": "Complaints cannot be filed against the registrar."}

        # Enforce valid complaint directions:
        # - student   → student    ✓
        # - student   → instructor ✓
        # - instructor → student  ✓
        # - instructor → instructor ✗
        if filer['role'] == 'instructor' and against['role'] == 'instructor':
            return {"success": False, "message": "Instructors may only file complaints against students."}

        conn.execute("""
            INSERT INTO complaints (from_id, from_role, against_id, against_role, text, status, created_at)
            VALUES (?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
        """, (complaint.from_id, filer['role'], complaint.against_id, against['role'], complaint.text))

        conn.commit()

        return {"success": True, "message": "Complaint submitted successfully"}


@router.get("/api/complaints/all")
async def get_all_complaints():
    """Get all complaints. Names resolved via students/instructors tables joined on user_id."""
    with get_conn() as conn:
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
    """Get only pending complaints."""
    with get_conn() as conn:
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
    """Get complaints filed by a student. student_id is users.id."""
    with get_conn() as conn:
        complaints = conn.execute("""
            SELECT c.*,
                   COALESCE(s2.name, i2.name, u2.username) as against_name,
                   u2.role as against_role
            FROM complaints c
            JOIN users u2 ON c.against_id = u2.id
            LEFT JOIN students s2 ON u2.id = s2.user_id
            LEFT JOIN instructors i2 ON u2.id = i2.user_id
            WHERE c.from_id = ? AND c.from_role = 'student'
            ORDER BY c.created_at DESC
        """, (student_id,)).fetchall()

        return {"complaints": [dict(c) for c in complaints]}


@router.get("/api/complaints/targets/{student_id}")
async def get_complaint_targets(student_id: str):
    """Get possible complaint targets for a student. student_id is users.id.
    Returns user_id (users.id) as 'id' so the frontend sends the correct FK."""
    with get_conn() as conn:
        semester = conn.execute("SELECT value FROM settings WHERE key = 'semester'").fetchone()
        current_semester = int(semester['value']) if semester else 1

        student_row = conn.execute(
            "SELECT id FROM students WHERE user_id = ?", (student_id,)
        ).fetchone()

        instructors = []
        if student_row:
            enrolled_classes = conn.execute("""
                SELECT class_id FROM enrollments
                WHERE student_id = ? AND semester = ? AND status = 'registered'
            """, (student_row['id'], current_semester)).fetchall()

            class_ids = [c['class_id'] for c in enrolled_classes]

            if class_ids:
                placeholders = ','.join('?' * len(class_ids))
                instructors = conn.execute(f"""
                    SELECT DISTINCT i.user_id as id, i.name
                    FROM instructors i
                    JOIN classes c ON c.instructor_id = i.id
                    WHERE c.id IN ({placeholders})
                """, class_ids).fetchall()

        # All other active students — expose user_id as 'id'
        students = conn.execute("""
            SELECT s.user_id as id, s.name, s.student_code
            FROM students s
            JOIN users u ON s.user_id = u.id
            WHERE u.id != ? AND u.terminated = 0
        """, (student_id,)).fetchall()

        return {
            "instructors": [dict(i) for i in instructors],
            "students": [dict(s) for s in students]
        }


def _warn_student(conn, user_id: int) -> str:
    """
    Issue one warning to a student (looked up by users.id).
    If warnings reach 3: suspend for 1 semester and flag fine_paid = 0.
    Returns a human-readable outcome message.
    """
    semester_row = conn.execute(
        "SELECT value FROM settings WHERE key = 'semester'"
    ).fetchone()
    current_semester = int(semester_row['value']) if semester_row else 1

    student = conn.execute(
        "SELECT id, warnings, suspended_until_semester FROM students WHERE user_id = ?",
        (user_id,)
    ).fetchone()
    if not student:
        return "Student record not found."

    new_warnings = (student['warnings'] or 0) + 1

    if new_warnings >= 3:
        suspend_until = current_semester + 1
        conn.execute("""
            UPDATE students
            SET warnings = ?,
                suspended_until_semester = ?,
                fine_paid = 0
            WHERE user_id = ?
        """, (new_warnings, suspend_until, user_id))
        # Drop all current registrations
        conn.execute("""
            UPDATE enrollments SET status = 'dropped'
            WHERE student_id = ? AND status = 'registered'
        """, (student['id'],))
        return (
            f"Warning {new_warnings} issued. Student suspended until semester "
            f"{suspend_until} and must pay a fine before re-enrolling."
        )
    else:
        conn.execute(
            "UPDATE students SET warnings = ? WHERE user_id = ?",
            (new_warnings, user_id)
        )
        return f"Warning {new_warnings}/3 issued to student."


def _warn_instructor(conn, user_id: int) -> str:
    """
    Issue one warning to an instructor (looked up by users.id).
    At 3 warnings the instructor is suspended for the next semester.
    Returns a human-readable outcome message.
    """
    semester_row = conn.execute(
        "SELECT value FROM settings WHERE key = 'semester'"
    ).fetchone()
    current_semester = int(semester_row['value']) if semester_row else 1

    instructor = conn.execute(
        "SELECT id, warnings, suspended_until_semester FROM instructors WHERE user_id = ?", (user_id,)
    ).fetchone()
    if not instructor:
        return "Instructor record not found."

    new_warnings = (instructor['warnings'] or 0) + 1

    if new_warnings >= 3:
        suspend_until = current_semester + 1
        conn.execute(
            "UPDATE instructors SET warnings = ?, suspended_until_semester = ? WHERE user_id = ?",
            (new_warnings, suspend_until, user_id)
        )
        return f"Warning {new_warnings} issued. Instructor suspended until semester {suspend_until}."
    else:
        conn.execute(
            "UPDATE instructors SET warnings = ? WHERE user_id = ?",
            (new_warnings, user_id)
        )
        return f"Warning {new_warnings}/3 issued to instructor."


@router.post("/api/complaint/resolve")
async def resolve_complaint(req: ComplaintResolveRequest):
    """
    Resolve a pending complaint.

    Valid actions:
      warn_against  — warn the person complained about
      warn_filer    — warn the person who filed (unfounded complaint)
      deregister    — drop all enrollments for the student complained about
      dismissed     — close with no action
    """
    with get_conn() as conn:
        complaint = conn.execute(
            "SELECT * FROM complaints WHERE id = ?", (req.complaintId,)
        ).fetchone()

        if not complaint:
            return {"success": False, "message": "Complaint not found"}

        outcome_msg = f"Complaint resolved with action: {req.action}"

        conn.execute("""
            UPDATE complaints
            SET status = 'resolved', resolution = ?, resolved_at = datetime('now')
            WHERE id = ?
        """, (req.action, req.complaintId))

        if req.action == 'warn_against':
            if complaint['against_role'] == 'student':
                outcome_msg = _warn_student(conn, complaint['against_id'])
            elif complaint['against_role'] == 'instructor':
                outcome_msg = _warn_instructor(conn, complaint['against_id'])

        elif req.action == 'warn_filer':
            if complaint['from_role'] == 'student':
                outcome_msg = _warn_student(conn, complaint['from_id'])
            elif complaint['from_role'] == 'instructor':
                outcome_msg = _warn_instructor(conn, complaint['from_id'])

        elif req.action == 'deregister':
            student_row = conn.execute(
                "SELECT id FROM students WHERE user_id = ?", (complaint['against_id'],)
            ).fetchone()
            if student_row:
                conn.execute("""
                    UPDATE enrollments
                    SET status = 'dropped'
                    WHERE student_id = ? AND status = 'registered'
                """, (student_row['id'],))
                outcome_msg = "Student de-registered from all current courses."

        conn.commit()
        return {"success": True, "message": outcome_msg}


@router.get("/api/complaints/instructor/{user_id}")
async def get_instructor_complaints(user_id: int):
    """Get complaints filed by an instructor. user_id is users.id."""
    with get_conn() as conn:
        complaints = conn.execute("""
            SELECT c.*,
                   COALESCE(s.name, i.name, u.username) as against_name,
                   u.role as against_role
            FROM complaints c
            JOIN users u ON c.against_id = u.id
            LEFT JOIN students s ON u.id = s.user_id
            LEFT JOIN instructors i ON u.id = i.user_id
            WHERE c.from_id = ? AND c.from_role = 'instructor'
            ORDER BY c.created_at DESC
        """, (user_id,)).fetchall()

        return {"complaints": [dict(c) for c in complaints]}
