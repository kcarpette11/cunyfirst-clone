# models/user.py
from pydantic import BaseModel
from typing import Optional

class User(BaseModel):
    id: Optional[int] = None
    username: str
    password: Optional[str] = None
    role: str  # 'registrar', 'instructor', 'student', 'visitor'
    email: Optional[str] = None
    active: bool = True
    terminated: bool = False
    must_change_password: bool = False

class Student(BaseModel):
    id: Optional[int] = None
    user_id: int
    student_code: str
    name: str
    email: str
    gpa: Optional[float] = None
    semester_gpa: Optional[float] = None
    warnings: int = 0
    honor_roll: bool = False
    honor_count: int = 0
    semesters_completed: int = 0
    suspended_until_semester: Optional[int] = None
    pending_interview: bool = False
    terminated: bool = False
    graduated: bool = False
    fine_paid: bool = False
    incoming_gpa: Optional[float] = None
    program: Optional[str] = None

class Instructor(BaseModel):
    id: Optional[int] = None
    user_id: int
    name: str
    email: str
    warnings: int = 0
    suspended: bool = False
    fired: bool = False
    assigned_classes: Optional[str] = None  # Comma-separated class IDs or JSON