# models/enrollment.py
from pydantic import BaseModel
from typing import Optional

class Enrollment(BaseModel):
    id: Optional[int] = None
    student_id: int
    class_id: int
    semester: int
    status: str = 'registered'  # 'registered', 'waitlisted', 'dropped', 'completed'
    grade: Optional[str] = None  # 'A', 'B', 'C', 'D', 'F', 'IP'
    
    # These may come from JOINs
    code: Optional[str] = None
    name: Optional[str] = None
    class_time: Optional[str] = None
    instructor_name: Optional[str] = None