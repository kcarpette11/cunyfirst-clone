# CunyZero — Colorful CUNYFirst Competitor

CunyZero is a local GUI college-management demo built for the rubric/checklist. It uses Python, Tkinter, and SQLite. It has seeded fake data so you can demo registrar, instructor, student, and visitor workflows quickly.

## Prerequisites

- Node.js (v18+)
- Python (3.10+)
- SQLite3

## Run

## Backend

cd backend
python -m venv venv

# Activate virtual environment

# On Mac/Linux:

source venv/bin/activate

# On Windows (PowerShell):

venv\Scripts\activate.ps1

# On Windows (Command Prompt):

venv\Scripts\activate.bat

pip install -r requirements.txt
python seed.py
uvicorn ai_assistant:app --reload --port 8000

# Run this anytime to reset the database to default values

python seed.py

## Frontend

cd frontend
npm install
npm run dev

## Demo Logins

| Role       | Username   | Password    |
| ---------- | ---------- | ----------- |
| Registrar  | `dean`     | `dean123`   |
| Instructor | `inst_lee` | `pass123`   |
| Instructor | `okafor`   | `okafor123` |
| Student    | `alice`    | `alice123`  |
| Student    | `ben`      | `ben123`    |

## Latest Updates

- **Modern Stack** – React frontend + FastAPI backend (replaced Tkinter)
- **Persistent SQLite** – All data survives server restarts
- **AI Assistant** – Local knowledge + Claude API with hallucination warnings
- **Role Portals** – Student, Instructor, and Registrar dashboards
- **Full Workflows** – Registration, grades, reviews, complaints, graduation
- **Semester Control** – Registrar controls all academic periods

## Main Files

| File                      | Purpose                                  |
| ------------------------- | ---------------------------------------- |
| `frontend/src/`           | React frontend with role-based pages     |
| `backend/ai_assistant.py` | FastAPI server with all API endpoints    |
| `backend/database.py`     | SQLite connection and database functions |
| `backend/seed.py`         | Demo data generator                      |
| `backend/api/`            | API route handlers                       |
| `backend/services/`       | Business logic                           |

## Demo Flow

1. **Visitor** – Browse public class and student info
2. **Apply** – Submit student/instructor application
3. **Registrar** – Approve apps, manage semesters, create classes, resolve complaints
4. **Instructor** – Manage waitlists, post grades, view rosters
5. **Student** – Register for courses, submit reviews, file complaints, apply for graduation
6. **AI Assistant** – Ask questions about College0 policies and rules

## Creative Feature

The student dashboard has a **Degree Progress / Risk Dashboard** that shows completed classes, required course progress, and graduation eligibility.

# CunyZero — AI-Enabled College Management System

CunyZero is a full-stack college management demo built with React, FastAPI, and SQLite. It features role-based dashboards (Student, Instructor, Registrar), course registration, grade management, reviews, complaints, graduation applications, and an AI assistant.
