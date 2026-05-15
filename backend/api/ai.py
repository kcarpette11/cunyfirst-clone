# api/ai.py - AI Chat endpoints
from fastapi import APIRouter, HTTPException
from services.knowledge import build_idf, retrieve_relevant, get_static_knowledge
from models.request_models import AskRequest, AskResponse
import anthropic
import os
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()
client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

def build_dynamic_entries(user_role: str, ctx: dict) -> list:
    """Build knowledge entries from context"""
    entries = []
    
    period = ctx.get("currentPeriod", "unknown")
    quota = ctx.get("programQuota", "unknown")
    taboo = ctx.get("tabooWords", [])
    
    entries.append(f"Current semester period: {period}.")
    entries.append(f"Program quota: {quota} students.")
    
    if taboo:
        entries.append(f"Taboo words: {', '.join(taboo)}.")
    
    for cls in ctx.get("classes", []):
        rating = cls.get("avgRating")
        rating_text = f"Average rating: {rating:.1f}/5." if rating else "No ratings yet."
        entries.append(
            f"Class {cls.get('code')} ({cls.get('name')}) is taught by "
            f"{cls.get('instructorName', 'TBD')} at {cls.get('time')}. "
            f"Max size: {cls.get('maxSize')}. "
            f"{'Cancelled.' if cls.get('cancelled') else 'Active.'} "
            f"{rating_text}"
        )
    
    if user_role == "student":
        student = ctx.get("student", {})
        if student:
            gpa = student.get("gpa")
            gpa_text = f"{gpa:.2f}" if gpa else "N/A"
            entries.append(
                f"You ({student.get('name')}, ID {student.get('studentId')}) "
                f"have an overall GPA of {gpa_text}. "
                f"Warnings: {student.get('warnings', 0)}."
            )
            for enrollment in student.get("enrollments", []):
                entries.append(
                    f"You are enrolled in {enrollment.get('code')} "
                    f"({enrollment.get('name')}). "
                    f"Grade: {enrollment.get('grade') or 'In Progress'}."
                )
    
    if user_role == "instructor":
        for cls in ctx.get("instructorClasses", []):
            entries.append(f"You teach {cls.get('code')}. Enrolled students: {cls.get('enrolledCount', 0)}.")
            for student in cls.get("students", []):
                gpa = student.get("gpa")
                gpa_text = f"{gpa:.2f}" if gpa else "N/A"
                entries.append(
                    f"Student {student.get('name')} ({student.get('studentId')}) "
                    f"in your {cls.get('code')}: grade {student.get('grade') or 'pending'}, "
                    f"overall GPA {gpa_text}."
                )
    
    return entries

@router.get("/ai/context/{user_id}")
async def get_ai_context(user_id: int):
    """Get context data for AI assistant"""
    from database import get_conn, get_setting
    
    with get_conn() as conn:
        # Get user info
        user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        
        context = {
            "currentPeriod": get_setting("period") or "registration",
            "programQuota": 100,
            "tabooWords": [w["word"] for w in conn.execute("SELECT word FROM taboo_words").fetchall()],
            "classes": [],
            "student": None,
            "instructor": None
        }
        
        # Get classes
        classes = conn.execute("""
            SELECT c.*, cs.code, cs.title as name, 
                   i.name as instructor_name
            FROM classes c
            JOIN courses cs ON c.course_id = cs.id
            LEFT JOIN instructors i ON c.instructor_id = i.id
            WHERE c.semester = (SELECT value FROM settings WHERE key = 'semester')
        """).fetchall()
        
        for cls in classes:
            context["classes"].append({
                "id": cls["id"],
                "code": cls["code"],
                "name": cls["name"],
                "time": cls["class_time"],
                "maxSize": cls["capacity"],
                "instructorName": cls["instructor_name"] or "TBD",
                "avgRating": cls["avg_rating"]
            })
        
        # Get student info if user is student
        if user and user['role'] == 'student':
            student = conn.execute(
                "SELECT * FROM students WHERE user_id = ?", (user_id,)
            ).fetchone()
            if student:
                student_dict = dict(student)
                
                enrollments = conn.execute("""
                    SELECT e.grade, cs.code, cs.title as name
                    FROM enrollments e
                    JOIN classes c ON e.class_id = c.id
                    JOIN courses cs ON c.course_id = cs.id
                    WHERE e.student_id = ? AND e.status = 'registered'
                """, (student['id'],)).fetchall()
                
                student_dict["enrollments"] = [dict(e) for e in enrollments]
                context["student"] = student_dict
        
        # Get instructor info if user is instructor
        if user and user['role'] == 'instructor':
            instructor = conn.execute(
                "SELECT * FROM instructors WHERE user_id = ?", (user_id,)
            ).fetchone()
            if instructor:
                context["instructor"] = dict(instructor)
        
        return context

@router.post("/ask", response_model=AskResponse)
async def ask(req: AskRequest):
    """Process an AI question"""
    import traceback
    
    try:
        print("\n" + "="*60)
        print("ASK ENDPOINT CALLED")
        print(f"Question: {req.question[:100] if req.question else 'None'}")
        print(f"User role: {req.user_role}")
        print(f"History length: {len(req.history)}")
        print("="*60)
        
        question = req.question.strip()
        if not question:
            raise HTTPException(status_code=400, detail="Question must not be empty.")
        
        print("Step 1: Getting static knowledge...")
        static = get_static_knowledge()
        print(f"  ✓ Got {len(static)} static entries")
        
        print("Step 2: Building dynamic entries...")
        dynamic_entries = build_dynamic_entries(req.user_role, req.user_context)
        print(f"  ✓ Got {len(dynamic_entries)} dynamic entries")
        
        print("Step 3: Building full corpus...")
        full_corpus = static + dynamic_entries
        print(f"  ✓ Total: {len(full_corpus)} documents")
        
        print("Step 4: Building IDF...")
        full_idf = build_idf(full_corpus)
        print(f"  ✓ IDF built with {len(full_idf)} terms")
        
        print("Step 5: Retrieving relevant documents...")
        relevant = retrieve_relevant(question, full_corpus, full_idf)
        print(f"  ✓ Found {len(relevant)} relevant documents")
        
        use_local_only = len(relevant) >= 2
        
        print("Step 6: Building system prompt...")
        context_entries = dynamic_entries + relevant
        system_prompt = (
            "You are the CunyZero AI assistant. Answer based on the provided context about "
            "the student and their data. Never say you don't have access to their information — "
            "it is provided below. Do not invent facts not in the context.\n\nContext:\n"
            + "\n".join(f"- {entry}" for entry in context_entries)
        )
        print(f"  ✓ System prompt length: {len(system_prompt)}")
        
        print("Step 7: Building history messages...")
        history_messages = [{"role": msg.role, "content": msg.content} for msg in req.history if msg.role in ("user", "assistant")]
        if history_messages and history_messages[0]["role"] == "assistant":
            history_messages.pop(0)
        history_messages.append({"role": "user", "content": question})
        print(f"  ✓ History messages: {len(history_messages)}")
        
        print("Step 8: Calling Anthropic API...")
        print(f"  Model: claude-4-6")
        print(f"  Max tokens: 512")
        
        response = client.messages.create(
            model="claude-sonnet-4-6", 
            max_tokens=512,
            system=system_prompt,
            messages=history_messages,
        )
        print(f"  ✓ Anthropic response received")
        
        print("Step 9: Extracting answer...")
        answer = "".join(block.text for block in response.content if hasattr(block, "text")).strip()
        if not answer:
            answer = "Sorry, I could not generate an answer."
        print(f"  ✓ Answer length: {len(answer)}")
        
        print("Step 10: Returning response...")
        return AskResponse(
            answer=answer,
            source="local" if use_local_only else "llm",
            hallucination_warning=not use_local_only,
        )
        
    except Exception as e:
        print("\n" + "!"*60)
        print("ERROR IN ASK ENDPOINT:")
        print(f"Error type: {type(e).__name__}")
        print(f"Error message: {str(e)}")
        print("\nFull traceback:")
        traceback.print_exc()
        print("!"*60 + "\n")
        raise HTTPException(status_code=500, detail=f"AI server error: {str(e)}")