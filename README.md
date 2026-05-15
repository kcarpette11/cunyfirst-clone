# CunyZero — Colorful CUNYFirst Competitor

CunyZero is a local GUI college-management demo built for the rubric/checklist. It uses Python, Tkinter, and SQLite. It has seeded fake data so you can demo registrar, instructor, student, and visitor workflows quickly.

## Prerequisites
- Node.js (v18+)
- Python (3.10+)
- SQLite3

## Setup

### 1. Create virtual environment
cd backend
python -m venv venv

### 2. Activate virtual environment
On Mac/Linux:
source venv/bin/activate

On Windows (PowerShell):
venv\Scripts\activate.ps1

On Windows (Command Prompt):
venv\Scripts\activate.bat

### 3. Install dependencies
pip install -r requirements.txt

### 4. Set up environment variables
On Mac/Linux:
cp .env.example .env

On Windows (PowerShell):
Copy-Item .env.example .env

Then open .env and add your Anthropic API key:
ANTHROPIC_API_KEY=sk-ant-your-key-here

### 6. Seed the database
python seed.py

### 7. Start the backend
uvicorn main:app --reload --port 8000

### 8. Start the frontend (new terminal)
cd frontend
npm install
npm run dev

---

## Demo Logins
| Role       | Username   | Password    |
| ---------- | ---------- | ----------- |
| Registrar  | `dean`     | `dean123`   |
| Instructor | `inst_lee` | `pass123`   |
| Instructor | `okafor`   | `okafor123` |
| Student    | `alice`    | `alice123`  |
| Student    | `ben`      | `ben123`    |

## Demo Flow
1. **Visitor** – Browse public class and student info
2. **Apply** – Submit student/instructor application
3. **Registrar** – Approve apps, manage semesters, create classes, resolve complaints
4. **Instructor** – Manage waitlists, post grades, view rosters
5. **Student** – Register for courses, submit reviews, file complaints, apply for graduation
6. **AI Assistant** – Ask questions about College0 policies and rules

## Reset Database
cd backend
python seed.py

## Project Structure
| File                   | Purpose                                  |
| ---------------------- | ---------------------------------------- |
| `frontend/src/`        | React frontend with role-based pages     |
| `backend/main.py`      | FastAPI server entry point               |
| `backend/database.py`  | SQLite connection and schema             |
| `backend/seed.py`      | Demo data generator                      |
| `backend/api/`         | API route handlers                       |
| `backend/services/`    | Business logic                           |
