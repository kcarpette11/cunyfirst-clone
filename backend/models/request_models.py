# models/request_models.py
from pydantic import BaseModel
from typing import Any, Optional, List

# ===== AI Chat Models ============================================================
class Message(BaseModel):
    role: str  
    content: str

class AskRequest(BaseModel):
    question: str
    history: List[Message] = []
    user_role: str = "visitor"
    user_context: dict[str, Any] = {}

class AskResponse(BaseModel):
    answer: str
    source: str  
    hallucination_warning: bool

# ===== Auth Models ============================================================
class LoginRequest(BaseModel):
    username: str
    password: str

class ChangePasswordRequest(BaseModel):
    userId: str
    newPassword: str

class UserUpdateRequest(BaseModel):
    warnings: Optional[int] = None
    mustChangePassword: Optional[bool] = None
    suspended: Optional[bool] = None
    terminated: Optional[bool] = None

# ===== Enrollment Models ============================================================
class EnrollmentRequest(BaseModel):
    studentId: str
    classId: str
    semester: int = 1

class DropEnrollmentRequest(BaseModel):
    enrollment_id: int 

class AdmitWaitlistRequest(BaseModel):
    enrollmentId: int

# ===== Grade Models ============================================================
class GradeRequest(BaseModel):
    enrollmentId: int
    grade: str  # 'A', 'B', 'C', 'D', 'F'

class GradeJustificationRequest(BaseModel):
    instructorId: int
    classId: int
    justification: str

# ===== Review Model ============================================================
class ReviewRequest(BaseModel):
    studentId: str
    classId: int
    stars: int  # 1-5
    text: str

# ===== Complaint Models ============================================================
class ComplaintRequest(BaseModel):
    fromId: str
    fromRole: str
    againstId: str
    text: str

class ComplaintResolveRequest(BaseModel):
    complaintId: int
    action: str  # 'warn_against', 'warn_filer', 'deregister', 'dismissed'

# ===== Application Models ============================================================
class ApplicationRequest(BaseModel):
    applicant_type: str  # 'student' or 'instructor'
    name: str
    email: Optional[str] = None
    incoming_gpa: Optional[float] = None
    program: Optional[str] = None
    statement: str

class ApplicationProcessRequest(BaseModel):
    applicationId: int
    decision: str  # 'accepted' or 'rejected'
    justification: Optional[str] = None

# ===== Graduation Models ============================================================
class GraduationApplyRequest(BaseModel):
    studentId: str

class GraduationProcessRequest(BaseModel):
    applicationId: int
    approve: bool
    note: Optional[str] = None

# ===== Semester Model ============================================================
class SetPeriodRequest(BaseModel):
    period: str  # 'setup', 'registration', 'running', 'grading', 'closed'

# ===== Class Management Models ============================================================
class CreateClassRequest(BaseModel):
    code: str
    name: str
    instructorId: int
    time: str
    maxSize: int
    required: bool
    semester: int

class UpdateClassRequest(BaseModel):
    code: str
    name: str
    instructorId: int
    time: str
    maxSize: int
    required: bool
    semester: int

# ===== Taboo Word Model ============================================================
class TabooWordRequest(BaseModel):
    word: str

# ===== Notification Model ============================================================
class MarkNotificationReadRequest(BaseModel):
    notificationId: int

# ===== Admin Models ============================================================
class WarnUserRequest(BaseModel):
    userId: str
    reason: Optional[str] = None

class SuspendUserRequest(BaseModel):
    userId: str
    duration_semesters: int = 1

class TerminateUserRequest(BaseModel):
    userId: str
    reason: Optional[str] = None