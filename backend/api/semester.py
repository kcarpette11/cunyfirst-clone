# api/semester.py - Semester control endpoints
from fastapi import APIRouter, HTTPException
from models.request_models import SetPeriodRequest
from database import get_conn

router = APIRouter()
PERIODS = ['setup', 'registration', 'running', 'grading', 'closed']

@router.get("/api/semester/period")
async def get_semester_period():
    """Get current semester period and number"""
    with get_conn() as conn:
        period = conn.execute("SELECT value FROM settings WHERE key = 'period'").fetchone()
        semester = conn.execute("SELECT value FROM settings WHERE key = 'semester'").fetchone()
        quota = conn.execute("SELECT value FROM settings WHERE key = 'program_quota'").fetchone()
        
        return {
            "period": period['value'] if period else 'registration',
            "semester": int(semester['value']) if semester else 1,
            "quota": int(quota['value']) if quota else 20
        }

@router.post("/api/semester/advance")
async def advance_semester_period():
    """Advance to the next semester period"""
    with get_conn() as conn:
        current = conn.execute("SELECT value FROM settings WHERE key = 'period'").fetchone()
        current_period = current['value'] if current else 'registration'
        
        idx = PERIODS.index(current_period)
        if idx < len(PERIODS) - 1:
            next_period = PERIODS[idx + 1]
            
            conn.execute("UPDATE settings SET value = ? WHERE key = 'period'", (next_period,))
            
            # Run period-specific checks
            if next_period == 'running':
                await _run_period_start_checks(conn)
            elif next_period == 'closed':
                await _run_end_of_semester(conn)
            
            return {"success": True, "newPeriod": next_period}
        else:
            return {"success": False, "message": "Already at final period"}

@router.post("/api/semester/set-period")
async def set_semester_period(req: SetPeriodRequest):
    """Directly set the semester period"""
    if req.period not in PERIODS:
        return {"success": False, "message": "Invalid period"}
    
    with get_conn() as conn:
        conn.execute("UPDATE settings SET value = ? WHERE key = 'period'", (req.period,))
        return {"success": True, "newPeriod": req.period}

@router.post("/api/semester/new")
async def start_new_semester():
    """Start a new semester (reset period, increment semester)"""
    with get_conn() as conn:
        await _run_end_of_semester(conn)
        
        semester = conn.execute("SELECT value FROM settings WHERE key = 'semester'").fetchone()
        new_semester = int(semester['value']) + 1 if semester else 2
        
        conn.execute("UPDATE settings SET value = 'setup' WHERE key = 'period'")
        conn.execute("UPDATE settings SET value = ? WHERE key = 'semester'", (str(new_semester),))
        
        # Reset suspension flags for new semester
        conn.execute("UPDATE users SET suspended = 0, suspended_next_semester = 0 WHERE suspended = 1")
        
        return {"success": True, "newSemester": new_semester}

async def _run_period_start_checks(conn):
    """Run checks when entering running period"""
    # Warn students with < 2 courses
    semester = conn.execute("SELECT value FROM settings WHERE key = 'semester'").fetchone()
    current_semester = int(semester['value']) if semester else 1
    
    students = conn.execute("SELECT id FROM students WHERE terminated = 0").fetchall()
    for student in students:
        enrolled = conn.execute("""
            SELECT COUNT(*) as count FROM enrollments 
            WHERE student_id = ? AND semester = ? AND status = 'registered'
        """, (student['id'], current_semester)).fetchone()
        
        if enrolled['count'] < 2:
            conn.execute("""
                INSERT INTO notifications (user_id, message, type, created_at)
                VALUES ((SELECT user_id FROM students WHERE id = ?), 
                        'Warning: You are enrolled in fewer than 2 courses this semester.', 
                        'warn', datetime('now'))
            """, (student['id'],))
            conn.execute("UPDATE students SET warnings = warnings + 1 WHERE id = ?", (student['id'],))
    
    # Cancel courses with < 3 students
    classes = conn.execute("""
        SELECT c.*, i.user_id as instructor_user_id
        FROM classes c
        JOIN instructors i ON c.instructor_id = i.id
        WHERE c.semester = ? AND c.cancelled = 0
    """, (current_semester,)).fetchall()
    
    for cls in classes:
        enrolled_count = conn.execute("""
            SELECT COUNT(*) as count FROM enrollments 
            WHERE class_id = ? AND status = 'registered'
        """, (cls['id'],)).fetchone()
        
        if enrolled_count['count'] < 3:
            conn.execute("UPDATE classes SET cancelled = 1 WHERE id = ?", (cls['id'],))
            
            conn.execute("""
                INSERT INTO notifications (user_id, message, type, created_at)
                VALUES (?, 'Your course has been cancelled due to low enrollment.', 'warn', datetime('now'))
            """, (cls['instructor_user_id'],))
            
            # Drop enrolled students
            conn.execute("""
                UPDATE enrollments SET status = 'dropped' 
                WHERE class_id = ? AND status = 'registered'
            """, (cls['id'],))

async def _run_end_of_semester(conn):
    """Run end of semester processing"""
    semester = conn.execute("SELECT value FROM settings WHERE key = 'semester'").fetchone()
    current_semester = int(semester['value']) if semester else 1
    
    # Apply suspensions for next semester
    conn.execute("""
        UPDATE users SET suspended = 1, suspended_next_semester = 0 
        WHERE suspended_next_semester = 1
    """)
    
    # Process student GPAs and academic standing
    students = conn.execute("SELECT * FROM students WHERE terminated = 0").fetchall()
    for student in students:
        grades = conn.execute("""
            SELECT grade FROM enrollments 
            WHERE student_id = ? AND grade IS NOT NULL AND grade != 'IP'
        """, (student['id'],)).fetchall()
        
        if grades:
            grade_points = {'A': 4.0, 'B': 3.0, 'C': 2.0, 'D': 1.0, 'F': 0.0}
            total_points = sum(grade_points.get(g['grade'], 0) for g in grades)
            gpa = total_points / len(grades)
            
            conn.execute("UPDATE students SET gpa = ?, semester_gpa = ? WHERE id = ?", 
                        (gpa, gpa, student['id']))
            
            # Check for termination
            if gpa < 2.0:
                conn.execute("UPDATE students SET terminated = 1 WHERE id = ?", (student['id'],))
                conn.execute("""
                    INSERT INTO notifications (user_id, message, type, created_at)
                    VALUES ((SELECT user_id FROM students WHERE id = ?), 
                            'You have been terminated: GPA below 2.0.', 'danger', datetime('now'))
                """, (student['id'],))