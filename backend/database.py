# backend/database.py
import sqlite3
from pathlib import Path
from contextlib import contextmanager

DB_PATH = Path(__file__).parent / "college0.db"

@contextmanager
def get_conn():
    """Context manager for database connections"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()

def init_db():
    """Create all tables if they don't exist"""
    with get_conn() as conn:
        # Users table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL,
                email TEXT,
                active INTEGER DEFAULT 1,
                terminated INTEGER DEFAULT 0,
                suspended INTEGER DEFAULT 0,
                warnings INTEGER DEFAULT 0,
                must_change_password INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Students table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS students (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER UNIQUE,
                student_code TEXT UNIQUE,
                name TEXT,
                email TEXT,
                gpa REAL,
                semester_gpa REAL,
                warnings INTEGER DEFAULT 0,
                honor_roll INTEGER DEFAULT 0,
                honor_count INTEGER DEFAULT 0,
                semesters_completed INTEGER DEFAULT 0,
                suspended_until_semester INTEGER,
                pending_interview INTEGER DEFAULT 0,
                terminated INTEGER DEFAULT 0,
                graduated INTEGER DEFAULT 0,
                fine_paid INTEGER DEFAULT 0,
                incoming_gpa REAL,
                program TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        
        # Instructors table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS instructors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER UNIQUE,
                name TEXT,
                email TEXT,
                warnings INTEGER DEFAULT 0,
                suspended INTEGER DEFAULT 0,
                fired INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        
        # Courses table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS courses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT UNIQUE,
                title TEXT,
                required INTEGER DEFAULT 0,
                description TEXT
            )
        """)
        
        # Classes table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS classes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                course_id INTEGER,
                instructor_id INTEGER,
                semester INTEGER,
                class_time TEXT,
                capacity INTEGER,
                avg_rating REAL,
                cancelled INTEGER DEFAULT 0,
                FOREIGN KEY (course_id) REFERENCES courses(id),
                FOREIGN KEY (instructor_id) REFERENCES instructors(id)
            )
        """)
        
        # Enrollments table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS enrollments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER,
                class_id INTEGER,
                semester INTEGER,
                status TEXT DEFAULT 'registered',
                grade TEXT,
                FOREIGN KEY (student_id) REFERENCES students(id),
                FOREIGN KEY (class_id) REFERENCES classes(id)
            )
        """)
        
        # Reviews table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS reviews (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER,
                class_id INTEGER,
                stars INTEGER,
                text TEXT,
                shown INTEGER DEFAULT 1,
                author_warned INTEGER DEFAULT 0,
                semester INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (student_id) REFERENCES students(id),
                FOREIGN KEY (class_id) REFERENCES classes(id)
            )
        """)
        
        # Taboo words table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS taboo_words (
                word TEXT PRIMARY KEY
            )
        """)
        
        # Settings table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        """)
        
        # Knowledge base table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS knowledge (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                audience TEXT,
                title TEXT,
                body TEXT
            )
        """)
        
        # Applications table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS applications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                applicant_type TEXT NOT NULL,
                name TEXT NOT NULL,
                email TEXT,
                incoming_gpa REAL,
                program TEXT,
                statement TEXT,
                status TEXT DEFAULT 'pending',
                registrar_note TEXT,
                assigned_username TEXT,
                assigned_password TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                reviewed_at TIMESTAMP
            )
        """)
        
        # Complaints table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS complaints (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                from_id INTEGER,
                from_role TEXT,
                against_id INTEGER,
                against_role TEXT,
                text TEXT,
                status TEXT DEFAULT 'pending',
                resolution TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                resolved_at TIMESTAMP,
                FOREIGN KEY (from_id) REFERENCES users(id),
                FOREIGN KEY (against_id) REFERENCES users(id)
            )
        """)
        
        # Graduation applications table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS graduation_apps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER,
                status TEXT DEFAULT 'pending',
                note TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                processed_at TIMESTAMP,
                FOREIGN KEY (student_id) REFERENCES students(id)
            )
        """)
        
        # Grade justifications table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS grade_justifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                instructor_id INTEGER,
                class_id INTEGER,
                justification TEXT,
                reviewed INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                reviewed_at TIMESTAMP,
                FOREIGN KEY (instructor_id) REFERENCES instructors(id),
                FOREIGN KEY (class_id) REFERENCES classes(id)
            )
        """)
        
        # Notifications table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                message TEXT,
                type TEXT,
                read INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        
        print("✅ All tables created successfully")


# ─── User Functions ────────────────────────────────────────────
def get_user_by_id(user_id):
    with get_conn() as conn:
        return conn.execute(
            "SELECT * FROM users WHERE id = ?", (user_id,)
        ).fetchone()


def get_user_by_username(username):
    with get_conn() as conn:
        return conn.execute(
            "SELECT * FROM users WHERE username = ?", (username,)
        ).fetchone()


def get_user_by_email(email):
    with get_conn() as conn:
        return conn.execute(
            "SELECT * FROM users WHERE email = ?", (email,)
        ).fetchone()


def verify_password(username, password):
    user = get_user_by_username(username)
    if user and user['password'] == password:
        return user
    return None


def update_user_password(user_id, new_password):
    with get_conn() as conn:
        conn.execute(
            "UPDATE users SET password = ?, must_change_password = 0 WHERE id = ?",
            (new_password, user_id)
        )


def update_user(user_id, **kwargs):
    """Generic user update function"""
    with get_conn() as conn:
        for key, value in kwargs.items():
            conn.execute(
                f"UPDATE users SET {key} = ? WHERE id = ?",
                (value, user_id)
            )


# ─── Student Functions ─────────────────────────────────────────
def get_student_by_user_id(user_id):
    with get_conn() as conn:
        return conn.execute(
            "SELECT * FROM students WHERE user_id = ?", (user_id,)
        ).fetchone()


def get_student_by_code(student_code):
    with get_conn() as conn:
        return conn.execute(
            "SELECT * FROM students WHERE student_code = ?", (student_code,)
        ).fetchone()


def get_all_students():
    with get_conn() as conn:
        return conn.execute(
            "SELECT s.*, u.username, u.email FROM students s JOIN users u ON s.user_id = u.id"
        ).fetchall()


def update_student_gpa(student_id, gpa, semester_gpa):
    with get_conn() as conn:
        conn.execute(
            "UPDATE students SET gpa = ?, semester_gpa = ? WHERE id = ?",
            (gpa, semester_gpa, student_id)
        )


def get_current_enrollments(student_id, semester=None):
    """Get current semester enrollments for a student"""
    if semester is None:
        semester = get_setting('semester') or 1
        semester = int(semester)
    
    with get_conn() as conn:
        return conn.execute("""
            SELECT e.*, c.code, cs.title as name, c.class_time, i.name as instructor_name
            FROM enrollments e
            JOIN classes c ON e.class_id = c.id
            JOIN courses cs ON c.course_id = cs.id
            LEFT JOIN instructors i ON c.instructor_id = i.id
            WHERE e.student_id = ? AND e.semester = ? AND e.status = 'registered'
        """, (student_id, semester)).fetchall()

def get_academic_history(student_id):
    """Get all completed courses for a student"""
    with get_conn() as conn:
        return conn.execute("""
            SELECT e.semester, e.grade, c.code, cs.title as name
            FROM enrollments e
            JOIN classes c ON e.class_id = c.id
            JOIN courses cs ON c.course_id = cs.id
            WHERE e.student_id = ? AND e.grade IS NOT NULL AND e.grade != 'IP'
            ORDER BY e.semester DESC
        """, (student_id,)).fetchall()


def use_honor_to_remove_warning(student_user_id):
    """Use an honor credit to remove a warning"""
    with get_conn() as conn:
        student = conn.execute(
            "SELECT * FROM students WHERE user_id = ?", (student_user_id,)
        ).fetchone()
        
        if not student or student['honor_count'] < 1 or student['warnings'] < 1:
            return {"ok": False, "msg": "No honor credits or warnings available"}
        
        conn.execute("""
            UPDATE students 
            SET honor_count = honor_count - 1, warnings = warnings - 1 
            WHERE user_id = ?
        """, (student_user_id,))
        
        return {"ok": True, "msg": "Warning removed using honor credit"}


# ─── Instructor Functions ──────────────────────────────────────
def get_instructor_by_user_id(user_id):
    with get_conn() as conn:
        return conn.execute(
            "SELECT * FROM instructors WHERE user_id = ?", (user_id,)
        ).fetchone()


def get_all_instructors():
    with get_conn() as conn:
        return conn.execute(
            "SELECT i.*, u.username, u.email FROM instructors i JOIN users u ON i.user_id = u.id"
        ).fetchall()


def get_instructor_classes(instructor_id, semester=None):
    """Get classes taught by an instructor"""
    if semester is None:
        semester = get_setting('semester') or 1
        semester = int(semester)
    
    with get_conn() as conn:
        return conn.execute("""
            SELECT c.*, cs.code, cs.title as name,
                   (SELECT COUNT(*) FROM enrollments e 
                    WHERE e.class_id = c.id AND e.status = 'registered') as enrolled_count
            FROM classes c
            JOIN courses cs ON c.course_id = cs.id
            WHERE c.instructor_id = ? AND c.semester = ?
        """, (instructor_id, semester)).fetchall()


def get_class_roster(class_id):
    """Get all students enrolled in a class"""
    with get_conn() as conn:
        return conn.execute("""
            SELECT e.id as enrollment_id, e.status, e.grade,
                   s.id, s.student_code, s.name, s.gpa, s.warnings
            FROM enrollments e
            JOIN students s ON e.student_id = s.id
            WHERE e.class_id = ? AND e.status IN ('registered', 'waitlisted')
        """, (class_id,)).fetchall()


def issue_warning_to_instructor(instructor_user_id):
    """Issue a warning to an instructor"""
    with get_conn() as conn:
        instructor = conn.execute(
            "SELECT * FROM instructors WHERE user_id = ?", (instructor_user_id,)
        ).fetchone()
        
        if not instructor:
            return {"success": False, "message": "Instructor not found"}
        
        new_warnings = (instructor['warnings'] or 0) + 1
        suspended = new_warnings >= 3
        
        conn.execute(
            "UPDATE instructors SET warnings = ?, suspended = ? WHERE user_id = ?",
            (new_warnings, 1 if suspended else 0, instructor_user_id)
        )
        
        return {"success": True, "warnings": new_warnings, "suspended": suspended}


# ─── Course/Class Functions ────────────────────────────────────
def get_all_courses():
    with get_conn() as conn:
        return conn.execute("SELECT * FROM courses").fetchall()


def get_course_by_code(code):
    with get_conn() as conn:
        return conn.execute(
            "SELECT * FROM courses WHERE code = ?", (code,)
        ).fetchone()


def get_all_classes(semester=None):
    with get_conn() as conn:
        if semester:
            return conn.execute("""
                SELECT c.*, cs.code, cs.title as name, cs.required,
                       i.name as instructor_name
                FROM classes c
                JOIN courses cs ON c.course_id = cs.id
                LEFT JOIN instructors i ON c.instructor_id = i.id
                WHERE c.semester = ?
            """, (semester,)).fetchall()
        else:
            return conn.execute("""
                SELECT c.*, cs.code, cs.title as name, cs.required,
                       i.name as instructor_name
                FROM classes c
                JOIN courses cs ON c.course_id = cs.id
                LEFT JOIN instructors i ON c.instructor_id = i.id
            """).fetchall()


def get_class_by_id(class_id):
    with get_conn() as conn:
        return conn.execute("""
            SELECT c.*, cs.code, cs.title as name, cs.required, cs.description,
                   i.name as instructor_name,
                   (SELECT COUNT(*) FROM enrollments e 
                    WHERE e.class_id = c.id AND e.status = 'registered') as enrolled_count
            FROM classes c
            JOIN courses cs ON c.course_id = cs.id
            LEFT JOIN instructors i ON c.instructor_id = i.id
            WHERE c.id = ?
        """, (class_id,)).fetchone()


def get_class_avg_rating(class_id):
    """Get the average rating for a class"""
    with get_conn() as conn:
        result = conn.execute(
            "SELECT AVG(stars) as avg FROM reviews WHERE class_id = ? AND shown = 1",
            (class_id,)
        ).fetchone()
        return result['avg'] if result and result['avg'] else None


def get_class_gpa(class_id):
    """Calculate GPA for a class"""
    with get_conn() as conn:
        grade_points = {'A': 4.0, 'B': 3.0, 'C': 2.0, 'D': 1.0, 'F': 0.0}
        
        enrollments = conn.execute("""
            SELECT grade FROM enrollments 
            WHERE class_id = ? AND grade IS NOT NULL AND grade != 'IP'
        """, (class_id,)).fetchall()
        
        if not enrollments:
            return None
        
        total = sum(grade_points.get(e['grade'], 0) for e in enrollments)
        return total / len(enrollments)


def create_class(course_id, instructor_id, semester, class_time, capacity):
    """Create a new class"""
    with get_conn() as conn:
        cursor = conn.execute("""
            INSERT INTO classes (course_id, instructor_id, semester, class_time, capacity, avg_rating, cancelled)
            VALUES (?, ?, ?, ?, ?, 0, 0)
        """, (course_id, instructor_id, semester, class_time, capacity))
        return cursor.lastrowid


def update_class(class_id, **kwargs):
    """Update a class"""
    with get_conn() as conn:
        for key, value in kwargs.items():
            conn.execute(
                f"UPDATE classes SET {key} = ? WHERE id = ?",
                (value, class_id)
            )


# ─── Enrollment Functions ──────────────────────────────────────
def get_enrollments_for_student(student_id, semester=None):
    with get_conn() as conn:
        if semester:
            return conn.execute("""
                SELECT e.*, c.code, cs.title as name, cl.class_time, i.name as instructor_name
                FROM enrollments e
                JOIN classes cl ON e.class_id = cl.id
                JOIN courses cs ON cl.course_id = cs.id
                LEFT JOIN instructors i ON cl.instructor_id = i.id
                WHERE e.student_id = ? AND e.semester = ?
            """, (student_id, semester)).fetchall()
        else:
            return conn.execute("""
                SELECT e.*, c.code, cs.title as name, cl.class_time, i.name as instructor_name
                FROM enrollments e
                JOIN classes cl ON e.class_id = cl.id
                JOIN courses cs ON cl.course_id = cs.id
                LEFT JOIN instructors i ON cl.instructor_id = i.id
                WHERE e.student_id = ?
            """, (student_id,)).fetchall()


def get_enrollments_for_class(class_id):
    with get_conn() as conn:
        return conn.execute("""
            SELECT e.*, s.student_code, s.name as student_name
            FROM enrollments e
            JOIN students s ON e.student_id = s.id
            WHERE e.class_id = ? AND e.status = 'registered'
        """, (class_id,)).fetchall()


def enroll_student(student_id, class_id, semester):
    with get_conn() as conn:
        # Check if already enrolled
        existing = conn.execute(
            "SELECT * FROM enrollments WHERE student_id = ? AND class_id = ? AND semester = ?",
            (student_id, class_id, semester)
        ).fetchone()
        
        if existing and existing['status'] == 'registered':
            return False, "Already enrolled", False
        
        # Check current enrollments count
        current_enrolled = conn.execute("""
            SELECT COUNT(*) as count FROM enrollments 
            WHERE student_id = ? AND semester = ? AND status = 'registered'
        """, (student_id, semester)).fetchone()
        
        if current_enrolled['count'] >= 4:
            return False, "Maximum 4 courses per semester", False
        
        # Check capacity
        enrolled_count = conn.execute(
            "SELECT COUNT(*) as count FROM enrollments WHERE class_id = ? AND status = 'registered'",
            (class_id,)
        ).fetchone()['count']
        
        cls = get_class_by_id(class_id)
        if enrolled_count >= cls['capacity']:
            # Add to waitlist
            conn.execute(
                "INSERT INTO enrollments (student_id, class_id, semester, status) VALUES (?, ?, ?, 'waitlisted')",
                (student_id, class_id, semester)
            )
            return True, "Course full. Added to waitlist", True
        
        # Enroll
        conn.execute(
            "INSERT INTO enrollments (student_id, class_id, semester, status) VALUES (?, ?, ?, 'registered')",
            (student_id, class_id, semester)
        )
        return True, "Enrolled successfully", False


def drop_enrollment(enrollment_id):
    with get_conn() as conn:
        conn.execute(
            "UPDATE enrollments SET status = 'dropped' WHERE id = ?",
            (enrollment_id,)
        )


def admit_from_waitlist(enrollment_id):
    with get_conn() as conn:
        conn.execute(
            "UPDATE enrollments SET status = 'registered' WHERE id = ?",
            (enrollment_id,)
        )


def post_grade(enrollment_id, grade):
    """Post a grade for an enrollment"""
    with get_conn() as conn:
        conn.execute(
            "UPDATE enrollments SET grade = ? WHERE id = ?",
            (grade, enrollment_id)
        )


# ─── Review Functions ──────────────────────────────────────────
def get_reviews_for_class(class_id, show_all=False):
    with get_conn() as conn:
        if show_all:
            return conn.execute("""
                SELECT r.*, s.name as student_name, s.student_code
                FROM reviews r
                JOIN students s ON r.student_id = s.id
                WHERE r.class_id = ?
                ORDER BY r.created_at DESC
            """, (class_id,)).fetchall()
        else:
            return conn.execute("""
                SELECT r.stars, r.text, r.created_at
                FROM reviews r
                WHERE r.class_id = ? AND r.shown = 1
                ORDER BY r.created_at DESC
            """, (class_id,)).fetchall()


def get_student_review(student_id, class_id):
    with get_conn() as conn:
        return conn.execute("""
            SELECT * FROM reviews WHERE student_id = ? AND class_id = ?
        """, (student_id, class_id)).fetchone()


def submit_review(student_id, class_id, stars, text, semester):
    with get_conn() as conn:
        # Check for taboo words
        taboo_words = conn.execute("SELECT word FROM taboo_words").fetchall()
        text_lower = text.lower()
        taboo_count = sum(1 for tw in taboo_words if tw['word'].lower() in text_lower)
        
        shown = taboo_count < 3
        author_warned = taboo_count > 0
        
        # Process text with censorship
        processed_text = text
        for tw in taboo_words:
            if tw['word'].lower() in text_lower:
                processed_text = processed_text.replace(tw['word'], '*' * len(tw['word']))
        
        conn.execute(
            "INSERT INTO reviews (student_id, class_id, stars, text, shown, author_warned, semester) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (student_id, class_id, stars, processed_text, 1 if shown else 0, 1 if author_warned else 0, semester)
        )
        
        # Issue warnings if needed
        if taboo_count >= 3:
            conn.execute("UPDATE students SET warnings = warnings + 2 WHERE id = ?", (student_id,))
        elif taboo_count >= 1:
            conn.execute("UPDATE students SET warnings = warnings + 1 WHERE id = ?", (student_id,))
        
        # Update class average rating
        avg_rating = conn.execute(
            "SELECT AVG(stars) as avg FROM reviews WHERE class_id = ? AND shown = 1",
            (class_id,)
        ).fetchone()['avg']
        
        if avg_rating:
            conn.execute(
                "UPDATE classes SET avg_rating = ? WHERE id = ?",
                (avg_rating, class_id)
            )
            
            # Check if instructor should be warned
            if avg_rating < 2:
                class_info = conn.execute(
                    "SELECT instructor_id FROM classes WHERE id = ?", (class_id,)
                ).fetchone()
                
                if class_info:
                    conn.execute("""
                        UPDATE instructors SET warnings = warnings + 1 WHERE id = ?
                    """, (class_info['instructor_id'],))
        
        return shown, author_warned, taboo_count


# ─── Application Functions ─────────────────────────────────────
def submit_application(applicant_type, name, email, incoming_gpa, program, statement):
    with get_conn() as conn:
        cursor = conn.execute("""
            INSERT INTO applications (applicant_type, name, email, incoming_gpa, program, statement, status)
            VALUES (?, ?, ?, ?, ?, ?, 'pending')
        """, (applicant_type, name, email, incoming_gpa, program, statement))
        return cursor.lastrowid


def get_pending_applications():
    with get_conn() as conn:
        return conn.execute(
            "SELECT * FROM applications WHERE status = 'pending' ORDER BY created_at ASC"
        ).fetchall()


def get_all_applications():
    with get_conn() as conn:
        return conn.execute(
            "SELECT * FROM applications ORDER BY created_at DESC"
        ).fetchall()


def process_application(app_id, decision, justification=None):
    with get_conn() as conn:
        conn.execute("""
            UPDATE applications 
            SET status = ?, registrar_note = ?, reviewed_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (decision, justification, app_id))


# ─── Complaint Functions ───────────────────────────────────────
def submit_complaint(from_id, from_role, against_id, against_role, text):
    with get_conn() as conn:
        conn.execute("""
            INSERT INTO complaints (from_id, from_role, against_id, against_role, text, status, created_at)
            VALUES (?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
        """, (from_id, from_role, against_id, against_role, text))


def get_pending_complaints():
    with get_conn() as conn:
        return conn.execute("""
            SELECT c.*, u1.name as from_name, u2.name as against_name
            FROM complaints c
            JOIN users u1 ON c.from_id = u1.id
            JOIN users u2 ON c.against_id = u2.id
            WHERE c.status = 'pending'
            ORDER BY c.created_at DESC
        """).fetchall()


def resolve_complaint(complaint_id, resolution):
    with get_conn() as conn:
        conn.execute("""
            UPDATE complaints 
            SET status = 'resolved', resolution = ?, resolved_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (resolution, complaint_id))


# ─── Notification Functions ────────────────────────────────────
def add_notification(user_id, message, type="info"):
    """Add a notification for a user, skipping GPA notifications for instructors and registrars"""
    with get_conn() as conn:
        user = conn.execute("SELECT role FROM users WHERE id = ?", (user_id,)).fetchone()
        
        if user and user['role'] in ['instructor', 'registrar']:
            gpa_keywords = ['GPA', 'gpa', 'grade point average', 'honor roll', 'Honor Roll', 'below 3.0', 'academic standing']
            if any(keyword in message for keyword in gpa_keywords):
                print(f"Skipping GPA notification for {user['role']}: {message[:50]}")
                return
        
        conn.execute("""
            INSERT INTO notifications (user_id, message, type, created_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        """, (user_id, message, type))


def get_user_notifications(user_id):
    with get_conn() as conn:
        return conn.execute("""
            SELECT * FROM notifications 
            WHERE user_id = ? 
            ORDER BY created_at DESC
        """, (user_id,)).fetchall()


def mark_notification_read(notification_id):
    with get_conn() as conn:
        conn.execute(
            "UPDATE notifications SET read = 1 WHERE id = ?",
            (notification_id,)
        )


def mark_all_notifications_read(user_id):
    with get_conn() as conn:
        conn.execute(
            "UPDATE notifications SET read = 1 WHERE user_id = ?",
            (user_id,)
        )


# ─── Settings Functions ────────────────────────────────────────
def get_setting(key):
    with get_conn() as conn:
        result = conn.execute(
            "SELECT value FROM settings WHERE key = ?", (key,)
        ).fetchone()
        return result['value'] if result else None


def set_setting(key, value):
    with get_conn() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
            (key, value)
        )


# ─── Knowledge Base Functions ──────────────────────────────────
def get_knowledge_for_role(role):
    with get_conn() as conn:
        return conn.execute(
            "SELECT title, body FROM knowledge WHERE audience = ? OR audience = 'all'",
            (role,)
        ).fetchall()


def get_all_knowledge():
    with get_conn() as conn:
        return conn.execute("SELECT * FROM knowledge").fetchall()


# ─── Graduation Functions ──────────────────────────────────────
def apply_for_graduation(student_id):
    with get_conn() as conn:
        # Check if already applied
        existing = conn.execute(
            "SELECT * FROM graduation_apps WHERE student_id = ? AND status = 'pending'",
            (student_id,)
        ).fetchone()
        
        if existing:
            return {"ok": False, "msg": "Already have a pending application"}
        
        conn.execute("""
            INSERT INTO graduation_apps (student_id, status, created_at)
            VALUES (?, 'pending', CURRENT_TIMESTAMP)
        """, (student_id,))
        
        return {"ok": True, "msg": "Graduation application submitted"}


def get_pending_graduation_apps():
    with get_conn() as conn:
        return conn.execute("""
            SELECT g.*, s.name as student_name, s.student_code
            FROM graduation_apps g
            JOIN students s ON g.student_id = s.id
            WHERE g.status = 'pending'
            ORDER BY g.created_at ASC
        """).fetchall()


def process_graduation(app_id, approve, note=None):
    with get_conn() as conn:
        status = 'approved' if approve else 'rejected'
        
        conn.execute("""
            UPDATE graduation_apps 
            SET status = ?, note = ?, processed_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (status, note, app_id))
        
        if approve:
            # Get application
            app = conn.execute(
                "SELECT * FROM graduation_apps WHERE id = ?", (app_id,)
            ).fetchone()
            
            if app:
                conn.execute("""
                    UPDATE students SET graduated = 1, terminated = 1 WHERE id = ?
                """, (app['student_id'],))


# ─── Warning Functions ─────────────────────────────────────────
def issue_warning(user_id):
    with get_conn() as conn:
        user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user:
            return
        
        new_warnings = (user['warnings'] or 0) + 1
        conn.execute(
            "UPDATE users SET warnings = ? WHERE id = ?",
            (new_warnings, user_id)
        )
        
        # Check suspension
        if user['role'] == 'instructor' and new_warnings >= 3:
            conn.execute("UPDATE users SET suspended = 1 WHERE id = ?", (user_id,))
        elif user['role'] == 'student' and new_warnings >= 3:
            conn.execute("UPDATE users SET suspended = 1 WHERE id = ?", (user_id,))


# ─── Taboo Words Functions ─────────────────────────────────────
def get_taboo_words():
    with get_conn() as conn:
        return [w['word'] for w in conn.execute("SELECT word FROM taboo_words").fetchall()]


def add_taboo_word(word):
    with get_conn() as conn:
        conn.execute("INSERT OR IGNORE INTO taboo_words (word) VALUES (?)", (word.lower(),))


def remove_taboo_word(word):
    with get_conn() as conn:
        conn.execute("DELETE FROM taboo_words WHERE word = ?", (word.lower(),))


print("✅ database.py loaded successfully")