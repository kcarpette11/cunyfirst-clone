# api/__init__.py - CORRECT VERSION
from .auth import router as auth_router
from .students import router as students_router
from .instructors import router as instructors_router
from .classes import router as classes_router
from .enrollments import router as enrollments_router
from .reviews import router as reviews_router
from .complaints import router as complaints_router
from .applications import router as applications_router
from .graduation import router as graduation_router
from .semester import router as semester_router
from .notifications import router as notifications_router
from .taboo import router as taboo_router
from .admin import router as admin_router
from .ai import router as ai_router

__all__ = [
    'auth_router',
    'students_router',
    'instructors_router', 
    'classes_router',
    'enrollments_router',
    'reviews_router',
    'complaints_router',
    'applications_router',
    'graduation_router',
    'semester_router',
    'notifications_router',
    'taboo_router',
    'admin_router',
    'ai_router'
]