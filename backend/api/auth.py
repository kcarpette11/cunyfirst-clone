# api/auth.py - Authentication endpoints
from fastapi import APIRouter, HTTPException
from database import get_conn
from models.request_models import LoginRequest, ChangePasswordRequest

router = APIRouter()

@router.post("/api/login")
async def login(req: LoginRequest):
    with get_conn() as conn:
        user = conn.execute("""
            SELECT u.*, 
                   s.student_code, s.name as student_name, s.gpa, s.warnings as student_warnings,
                   i.name as instructor_name, i.warnings as instructor_warnings
            FROM users u
            LEFT JOIN students s ON u.id = s.user_id
            LEFT JOIN instructors i ON u.id = i.user_id
            WHERE u.username = ? AND u.password = ? AND u.active = 1
        """, (req.username, req.password)).fetchone()
        
        if not user:
            raise HTTPException(status_code=401, detail="Invalid username or password")
        
        user_dict = dict(user)
        user_dict.pop('password', None)
        
        # Make sure name is set correctly for instructors
        if user_dict['role'] == 'instructor':
            user_dict['name'] = user_dict.get('instructor_name') or user_dict.get('name')
        elif user_dict['role'] == 'student':
            user_dict['name'] = user_dict.get('student_name')
            user_dict['studentId'] = user_dict.get('student_code')
        
        print(f"Login user dict: {user_dict}")  # Debug print
        
        return user_dict

@router.post("/api/logout")
async def logout():
    """Logout user"""
    return {"success": True}

@router.get("/api/user/{user_id}")
async def get_user(user_id: int):
    """Get user by ID"""
    with get_conn() as conn:
        user = conn.execute("""
            SELECT u.*, s.student_code, s.name as student_name, i.name as instructor_name
            FROM users u
            LEFT JOIN students s ON u.id = s.user_id
            LEFT JOIN instructors i ON u.id = i.user_id
            WHERE u.id = ?
        """, (user_id,)).fetchone()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        user_dict = dict(user)
        user_dict.pop('password', None)
        return user_dict

@router.post("/api/user/change-password")
async def change_password(req: ChangePasswordRequest):
    """Change user password"""
    with get_conn() as conn:
        conn.execute("""
            UPDATE users SET password = ?, must_change_password = 0 WHERE id = ?
        """, (req.newPassword, req.userId))
        
        return {"success": True, "message": "Password changed successfully"}

@router.put("/api/user/{user_id}")
async def update_user(user_id: int, must_change_password: bool = None, warnings: int = None):
    """Update user information"""
    with get_conn() as conn:
        if must_change_password is not None:
            conn.execute(
                "UPDATE users SET must_change_password = ? WHERE id = ?",
                (must_change_password, user_id)
            )
        
        if warnings is not None:
            user = conn.execute("SELECT role FROM users WHERE id = ?", (user_id,)).fetchone()
            if user and user['role'] == 'student':
                conn.execute("UPDATE students SET warnings = ? WHERE user_id = ?", (warnings, user_id))
            elif user and user['role'] == 'instructor':
                conn.execute("UPDATE instructors SET warnings = ? WHERE user_id = ?", (warnings, user_id))
        
        return {"success": True}