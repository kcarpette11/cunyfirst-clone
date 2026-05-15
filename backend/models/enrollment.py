from pydantic import BaseModel
from typing import Optional

class Enrollment(BaseModel):
    id: Optional[int] = None
    student_id: int
    class_id: int
    semester: int
    status: str = 'registered'  
    grade: Optional[str] = None  
    
    code: Optional[str] = None
    name: Optional[str] = None
    class_time: Optional[str] = None
    instructor_name: Optional[str] = None