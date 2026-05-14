# api/classes.py - Class and Course endpoints
from fastapi import APIRouter, HTTPException
from typing import Optional
from database import get_conn
from models.request_models import CreateClassRequest, UpdateClassRequest

router = APIRouter()

@router.get("/api/classes")
async def get_classes(semester: Optional[int] = None):
    with get_conn() as conn:
        if semester:
            classes = conn.execute("""
                SELECT c.id, c.course_id, c.instructor_id, c.semester, 
                       c.class_time as time,
                       c.capacity, 
                       c.avg_rating as avgRating,
                       c.cancelled,
                       cs.code, 
                       cs.title as name, 
                       cs.required,
                       i.name as instructorName,
                       (SELECT COUNT(*) FROM enrollments e 
                        WHERE e.class_id = c.id AND e.status = 'registered') as enrolledCount
                FROM classes c
                JOIN courses cs ON c.course_id = cs.id
                LEFT JOIN instructors i ON c.instructor_id = i.id
                WHERE c.semester = ?
                ORDER BY cs.code
            """, (semester,)).fetchall()
        else:
            classes = conn.execute("""
                SELECT c.id, c.course_id, c.instructor_id, c.semester, 
                       c.class_time as time,
                       c.capacity, 
                       c.avg_rating as avgRating,
                       c.cancelled,
                       cs.code, 
                       cs.title as name, 
                       cs.required,
                       i.name as instructorName,
                       (SELECT COUNT(*) FROM enrollments e 
                        WHERE e.class_id = c.id AND e.status = 'registered') as enrolledCount
                FROM classes c
                JOIN courses cs ON c.course_id = cs.id
                LEFT JOIN instructors i ON c.instructor_id = i.id
                ORDER BY c.semester, cs.code
            """).fetchall()
        
        return {"classes": [dict(cls) for cls in classes]}

@router.get("/api/classes/top-rated")
async def get_top_rated_classes(limit: int = 3):
    """Get top rated classes"""
    with get_conn() as conn:
        classes = conn.execute("""
            SELECT c.*, cs.code, cs.title as name,
                   i.name as instructor_name, c.avg_rating
            FROM classes c
            JOIN courses cs ON c.course_id = cs.id
            LEFT JOIN instructors i ON c.instructor_id = i.id
            WHERE c.avg_rating IS NOT NULL
            ORDER BY c.avg_rating DESC
            LIMIT ?
        """, (limit,)).fetchall()
        
        return {"classes": [dict(cls) for cls in classes]}

@router.get("/api/classes/lowest-rated")
async def get_lowest_rated_classes(limit: int = 3):
    """Get lowest rated classes"""
    with get_conn() as conn:
        classes = conn.execute("""
            SELECT c.*, cs.code, cs.title as name,
                   i.name as instructor_name, c.avg_rating
            FROM classes c
            JOIN courses cs ON c.course_id = cs.id
            LEFT JOIN instructors i ON c.instructor_id = i.id
            WHERE c.avg_rating IS NOT NULL
            ORDER BY c.avg_rating ASC
            LIMIT ?
        """, (limit,)).fetchall()
        
        return {"classes": [dict(cls) for cls in classes]}

@router.get("/api/classes/gpa-review")
async def get_classes_for_gpa_review(semester: int = 1):
    """Get classes with GPA outliers for registrar review"""
    with get_conn() as conn:
        classes = conn.execute("""
            SELECT c.id, c.course_id, c.instructor_id, c.semester, 
                   c.class_time, c.capacity, c.avg_rating,
                   cs.code, cs.title as name, cs.required,
                   (SELECT AVG(CASE 
                        WHEN e.grade = 'A' THEN 4.0
                        WHEN e.grade = 'B' THEN 3.0
                        WHEN e.grade = 'C' THEN 2.0
                        WHEN e.grade = 'D' THEN 1.0
                        WHEN e.grade = 'F' THEN 0.0
                        ELSE NULL END)
                    FROM enrollments e
                    WHERE e.class_id = c.id AND e.status = 'registered' AND e.grade IS NOT NULL
                   ) as class_gpa
            FROM classes c
            JOIN courses cs ON c.course_id = cs.id
            WHERE c.semester = ?
        """, (semester,)).fetchall()
        
        all_classes = []
        flagged = []
        
        for cls in classes:
            cls_dict = dict(cls)
            gpa = cls_dict.get('class_gpa')
            cls_dict['class_gpa'] = gpa
            
            all_classes.append(cls_dict)
            
            if gpa is not None and (gpa > 3.5 or gpa < 2.5):
                flagged.append(cls_dict)
        
        return {"all": all_classes, "flagged": flagged}

@router.get("/api/class/{class_id}")
async def get_class(class_id: int):
    """Get a specific class by ID"""
    with get_conn() as conn:
        cls = conn.execute("""
            SELECT c.*, cs.code, cs.title as name, cs.required, cs.description,
                   i.name as instructor_name,
                   (SELECT COUNT(*) FROM enrollments e 
                    WHERE e.class_id = c.id AND e.status = 'registered') as enrolled_count
            FROM classes c
            JOIN courses cs ON c.course_id = cs.id
            LEFT JOIN instructors i ON c.instructor_id = i.id
            WHERE c.id = ?
        """, (class_id,)).fetchone()
        
        if not cls:
            raise HTTPException(status_code=404, detail="Class not found")
        
        return dict(cls)

@router.post("/api/class/create")
async def create_class(req: CreateClassRequest):
    """Create a new class"""
    with get_conn() as conn:
        # Check if course exists, if not create it
        course = conn.execute(
            "SELECT id FROM courses WHERE code = ?", (req.code,)
        ).fetchone()
        
        if not course:
            cursor = conn.execute("""
                INSERT INTO courses (code, title, required, description)
                VALUES (?, ?, ?, ?)
            """, (req.code, req.name, 1 if req.required else 0, f"Course: {req.name}"))
            course_id = cursor.lastrowid
        else:
            course_id = course['id']
        
        cursor = conn.execute("""
            INSERT INTO classes (course_id, instructor_id, semester, class_time, capacity, avg_rating, cancelled)
            VALUES (?, ?, ?, ?, ?, 0, 0)
        """, (course_id, req.instructorId, req.semester, req.time, req.maxSize))
        
        return {"success": True, "classId": cursor.lastrowid, "message": "Class created successfully"}

@router.put("/api/class/{class_id}")
async def update_class(class_id: int, req: UpdateClassRequest):
    """Update an existing class"""
    with get_conn() as conn:
        conn.execute("""
            UPDATE courses 
            SET code = ?, title = ?, required = ?
            WHERE id = (SELECT course_id FROM classes WHERE id = ?)
        """, (req.code, req.name, 1 if req.required else 0, class_id))
        
        conn.execute("""
            UPDATE classes 
            SET instructor_id = ?, class_time = ?, capacity = ?
            WHERE id = ?
        """, (req.instructorId, req.time, req.maxSize, class_id))
        
        return {"success": True, "message": "Class updated successfully"}

@router.get("/api/class/{class_id}/enrollment-count")
async def get_class_enrollment_count(class_id: int):
    """Get enrollment count for a class"""
    with get_conn() as conn:
        registered = conn.execute(
            "SELECT COUNT(*) as count FROM enrollments WHERE class_id = ? AND status = 'registered'",
            (class_id,)
        ).fetchone()
        
        waitlisted = conn.execute(
            "SELECT COUNT(*) as count FROM enrollments WHERE class_id = ? AND status = 'waitlisted'",
            (class_id,)
        ).fetchone()
        
        return {"registered": registered['count'], "waitlisted": waitlisted['count']}