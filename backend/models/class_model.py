# models/class_model.py
from pydantic import BaseModel
from typing import Optional

class Course(BaseModel):
    id: Optional[int] = None
    code: str
    title: str
    required: bool = False
    description: Optional[str] = None

class Class(BaseModel):
    id: Optional[int] = None
    course_id: int
    instructor_id: int
    semester: int
    class_time: str
    capacity: int = 30
    avg_rating: Optional[float] = None
    cancelled: bool = False
    
    # These may come from JOINs
    code: Optional[str] = None
    name: Optional[str] = None
    instructor_name: Optional[str] = None
    enrolled_count: Optional[int] = None
    waitlisted_count: Optional[int] = None