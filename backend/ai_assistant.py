"""
ai_assistant.py  —  College0 AI Assistant Backend
==================================================
A FastAPI server that acts as a secure proxy between the React frontend
and the Anthropic API.

Run
---
    uvicorn ai_assistant:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.auth import router as auth_router
from api.ai import router as ai_router
from api.classes import router as classes_router
from api.enrollments import router as enrollments_router
from api.reviews import router as reviews_router
from api.complaints import router as complaints_router
from api.applications import router as applications_router
from api.graduation import router as graduation_router
from api.semester import router as semester_router
from api.notifications import router as notifications_router
from api.taboo import router as taboo_router
from api.admin import router as admin_router
from api.students import router as students_router
from api.instructors import router as instructors_router

app = FastAPI(title="College0 AI Assistant", version="1.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all route routers
app.include_router(auth_router)
app.include_router(ai_router)
app.include_router(classes_router)
app.include_router(enrollments_router)
app.include_router(reviews_router)
app.include_router(complaints_router)
app.include_router(applications_router)
app.include_router(graduation_router)
app.include_router(semester_router)
app.include_router(notifications_router)
app.include_router(taboo_router)
app.include_router(admin_router)
app.include_router(students_router)
app.include_router(instructors_router)

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "version": "1.0",
        "model": "claude-sonnet-4-20250514",
        "message": "College0 API is running"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)