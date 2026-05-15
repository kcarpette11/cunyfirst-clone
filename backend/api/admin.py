from fastapi import APIRouter, HTTPException
from typing import Optional
from database import get_conn
from services.warning_system import issue_warning

router = APIRouter()


# ===== User Management ===========================================================

@router.get("/api/admin/users")
async def get_all_users(role: Optional[str] = None):
    """Get all users, optionally filtered by role"""
    with get_conn() as conn:
        if role:
            users = conn.execute(
                "SELECT u.*, s.student_code, s.name as student_name, i.name as instructor_name "
                "FROM users u "
                "LEFT JOIN students s ON u.id = s.user_id "
                "LEFT JOIN instructors i ON u.id = i.user_id "
                "WHERE u.role = ? AND u.active = 1",
                (role,)
            ).fetchall()
        else:
            users = conn.execute(
                "SELECT u.*, s.student_code, s.name as student_name, i.name as instructor_name "
                "FROM users u "
                "LEFT JOIN students s ON u.id = s.user_id "
                "LEFT JOIN instructors i ON u.id = i.user_id "
                "WHERE u.active = 1"
            ).fetchall()

        result = []
        for user in users:
            user_dict = dict(user)
            if user_dict['role'] == 'student':
                user_dict['name'] = user_dict.get('student_name')
            elif user_dict['role'] == 'instructor':
                user_dict['name'] = user_dict.get('instructor_name')
            result.append(user_dict)

        return {"users": result}


# ===== Dashboard Statistics ===========================================================

@router.get("/api/admin/stats")
async def get_admin_stats():
    """Get dashboard statistics for admin"""
    with get_conn() as conn:
        # Active headcounts
        student_count = conn.execute(
            "SELECT COUNT(*) as count FROM students WHERE terminated = 0"
        ).fetchone()['count']

        instructor_count = conn.execute(
            "SELECT COUNT(*) as count FROM instructors WHERE fired = 0"
        ).fetchone()['count']

        # Pending action items
        pending_apps = conn.execute(
            "SELECT COUNT(*) as count FROM applications WHERE status = 'pending'"
        ).fetchone()['count']

        pending_complaints = conn.execute(
            "SELECT COUNT(*) as count FROM complaints WHERE status = 'pending'"
        ).fetchone()['count']

        pending_grad = conn.execute(
            "SELECT COUNT(*) as count FROM graduation_apps WHERE status = 'pending'"
        ).fetchone()['count']

        return {
            "students": student_count,
            "instructors": instructor_count,
            "pending_applications": pending_apps,
            "pending_complaints": pending_complaints,
            "pending_graduations": pending_grad
        }


# ===== Warning / Disciplinary Actions ===========================================

@router.post("/api/admin/warn/{user_id}")
async def admin_warn_user(user_id: int, reason: Optional[str] = None):
    """Admin issues a warning to a user"""
    with get_conn() as conn:
        user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        warnings, suspended, message = issue_warning(user['warnings'] or 0, user['role'])

        conn.execute(
            "UPDATE users SET warnings = ? WHERE id = ?",
            (warnings, user_id)
        )

        if suspended:
            conn.execute(
                "UPDATE users SET suspended = 1 WHERE id = ?",
                (user_id,)
            )

        return {"success": True, "message": message, "warnings": warnings, "suspended": suspended}