"""
main.py — CUNYFirst Clone Backend
==================================
FastAPI entry point. Registers all routers, initializes the DB,
and loads environment variables.

Run
---
    uvicorn main:app --reload --port 8000
"""

import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import init_db
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

# Load .env (ANTHROPIC_API_KEY, etc.)
load_dotenv()

app = FastAPI(title="CUNYFirst Clone", version="1.0")

# ── CORS ────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── DB init on startup ───────────────────────────────────────────
@app.on_event("startup")
async def startup():
    init_db()

# ── Routers ──────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(ai_router)
app.include_router(students_router)
app.include_router(instructors_router)
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

# ── Health check ─────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "version": "1.0",
        "message": "CUNYFirst Clone API is running"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
