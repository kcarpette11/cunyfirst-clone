# api/applications.py - Application management endpoints
from fastapi import APIRouter, HTTPException
from typing import Optional
from database import get_conn
from models.request_models import ApplicationRequest, ApplicationProcessRequest

router = APIRouter()

# ===== Applications submission endpoint for prospective students and instructors to submit their applications,
# which are stored with a pending status for review by the registrar ============================================================

@router.post("/api/application/submit")
async def submit_application(req: ApplicationRequest):
    """Submit a new application"""
    with get_conn() as conn:
        cursor = conn.execute("""
            INSERT INTO applications (
                applicant_type, name, email, incoming_gpa, program, statement, status
            ) VALUES (?, ?, ?, ?, ?, ?, 'pending')
        """, (req.applicant_type, req.name, req.email, req.incoming_gpa, req.program, req.statement))
        
        return {
            "success": True,
            "message": "Application submitted successfully",
            "applicationId": cursor.lastrowid
        }

# Application retrieval endpoints for the registrar to view pending applications and filter by status (pending/accepted/rejected) ============================================================

@router.get("/api/applications")
async def get_applications(status: Optional[str] = None):
    """Get applications, optionally filtered by status"""
    with get_conn() as conn:
        if status:
            apps = conn.execute(
                "SELECT * FROM applications WHERE status = ? ORDER BY created_at DESC",
                (status,)
            ).fetchall()
        else:
            apps = conn.execute(
                "SELECT * FROM applications ORDER BY created_at DESC"
            ).fetchall()
        
        return {"applications": [dict(app) for app in apps]}

@router.get("/api/applications/pending")
async def get_pending_applications():
    """Get all pending applications"""
    with get_conn() as conn:
        apps = conn.execute(
            "SELECT * FROM applications WHERE status = 'pending' ORDER BY created_at ASC"
        ).fetchall()
        return {"applications": [dict(app) for app in apps]}

# Application processing endpoint for the registrar to accept or reject applications, which updates the application status and, if accepted, 
# creates a new user account with a temporary password and returns the credentials to the registrar for communication to the applicant ============================================================

@router.post("/api/application/process")
async def process_application(req: ApplicationProcessRequest):
    """Process an application (accept/reject)"""
    import random
    
    with get_conn() as conn:
        # Get application
        app = conn.execute(
            "SELECT * FROM applications WHERE id = ?", (req.applicationId,)
        ).fetchone()
        
        if not app:
            raise HTTPException(status_code=404, detail="Application not found")
        
        # Update application status
        conn.execute("""
            UPDATE applications 
            SET status = ?, registrar_note = ?, reviewed_at = datetime('now')
            WHERE id = ?
        """, (req.decision, req.justification, req.applicationId))
        
        # Handle accepted applications
        if req.decision == 'accepted':
            # Generate unique username
            base_username = app['email'].split('@')[0] if app['email'] else app['name'].lower().replace(' ', '')
            username = base_username
            counter = 1
            
            while conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone():
                username = f"{base_username}{counter}"
                counter += 1
            
            # Generate temporary password
            temp_password = f"temp{random.randint(1000, 9999)}"
            
            # Create user account
            cursor = conn.execute("""
                INSERT INTO users (username, password, role, must_change_password, active)
                VALUES (?, ?, ?, 1, 1)
            """, (username, temp_password, app['applicant_type']))
            
            user_id = cursor.lastrowid
            
            # Create role-specific record
            if app['applicant_type'] == 'student':
                student_count = conn.execute("SELECT COUNT(*) as count FROM students").fetchone()['count']
                student_code = f"S{str(student_count + 1).zfill(4)}"
                
                conn.execute("""
                    INSERT INTO students (user_id, student_code, name, email, gpa, incoming_gpa, program)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (user_id, student_code, app['name'], app['email'], 
                      app['incoming_gpa'], app['incoming_gpa'], app['program']))
                
            elif app['applicant_type'] == 'instructor':
                conn.execute("""
                    INSERT INTO instructors (user_id, name, email)
                    VALUES (?, ?, ?)
                """, (user_id, app['name'], app['email']))
            
            # Store assigned credentials
            conn.execute("""
                UPDATE applications SET assigned_username = ?, assigned_password = ? WHERE id = ?
            """, (username, temp_password, req.applicationId))
            
            return {
                "success": True,
                "message": f"Application accepted. Created account: {username} (temp password: {temp_password})"
            }
        
        # Handle rejected applications
        return {"success": True, "message": f"Application {req.decision}"}