from pathlib import Path
from database import init_db, get_conn, DB_PATH

def seed():
    if DB_PATH.exists():
        DB_PATH.unlink()
    init_db()
    
    with get_conn() as conn:
        # Settings
        conn.execute("INSERT INTO settings(key,value) VALUES('period','registration')")
        conn.execute("INSERT INTO settings(key,value) VALUES('semester','1')")
        conn.execute("INSERT INTO settings(key,value) VALUES('program_quota','20')")

        # Users
        conn.execute("INSERT INTO users(username,password,role) VALUES('registrar','admin123','registrar')")
        conn.execute("INSERT INTO users(username,password,role) VALUES('dean','dean123','registrar')")

        # Instructors
        instructors = [
            ("inst_lee", "pass123", "Dr. Lee", "lee@college0.edu"),
            ("inst_khan", "pass123", "Prof. Khan", "khan@college0.edu"),
            ("inst_rivera", "pass123", "Dr. Rivera", "rivera@college0.edu"),
            ("chen", "chen123", "Prof. Chen", "chen@college0.edu"),
            ("okafor", "okafor123", "Prof. Okafor", "okafor@college0.edu"),
            # NEW INSTRUCTORS
            ("wong", "wong123", "Prof. Wong", "wong@college0.edu"),
            ("martinez", "martinez123", "Dr. Martinez", "martinez@college0.edu"),
            ("gupta", "gupta123", "Dr. Gupta", "gupta@college0.edu"),
        ]
        for username, password, name, email in instructors:
            cur = conn.execute("INSERT INTO users(username,password,role) VALUES(?,?,?)", 
                               (username, password, "instructor"))
            conn.execute("INSERT INTO instructors(user_id,name,email,warnings,suspended,fired) VALUES(?,?,?,0,0,0)", 
                         (cur.lastrowid, name, email))

        # Students (with all fields matching db.js)
        students = [
            ("alice", "alice123", "S001", "Alice Johnson", 3.91, 3.91, 0, 0, 0, 0, 0),
            ("ben", "ben123", "S002", "Ben Martinez", 3.20, 3.20, 0, 0, 0, 0, 0),
            ("cora", "cora123", "S003", "Cora Lee", 2.80, 2.80, 0, 0, 0, 0, 0),
            ("david", "david123", "S004", "David Kim", 3.60, 3.60, 0, 0, 0, 0, 0),
            ("eva", "eva123", "S005", "Eva Rossi", 2.15, 2.15, 0, 0, 0, 0, 0),
            # NEW STUDENTS
            ("frank", "frank123", "S006", "Frank Zhang", 3.45, 3.45, 0, 0, 0, 0, 0),
            ("grace", "grace123", "S007", "Grace Williams", 3.78, 3.78, 0, 0, 0, 0, 0),
            ("henry", "henry123", "S008", "Henry Brown", 2.95, 2.95, 0, 0, 0, 0, 0),
            ("isabel", "isabel123", "S009", "Isabel Garcia", 3.52, 3.52, 0, 0, 0, 0, 0),
            ("jack", "jack123", "S010", "Jack Wilson", 3.15, 3.15, 0, 0, 0, 0, 0),
        ]
        for username, pwd, code, name, gpa, sem_gpa, warnings, honor, suspended, interview, terminated in students:
            cur = conn.execute("INSERT INTO users(username,password,role,must_change_password) VALUES(?,?,?,0)", 
                               (username, pwd, "student"))
            conn.execute("""
                INSERT INTO students(
                    user_id, student_code, name, email, gpa, semester_gpa,
                    warnings, honor_roll, honor_count, semesters_completed,
                    suspended_until_semester, pending_interview, terminated, fine_paid
                ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,0)
            """, (cur.lastrowid, code, name, f"{code.lower()}@college0.edu", 
                  gpa, sem_gpa, warnings, honor, 0, 0, suspended, interview, terminated))

        # Courses
        courses = [
            ("CS101", "Intro to Computing", 1, "Basic programming concepts"),
            ("CS201", "Data Structures", 1, "Arrays, lists, trees, and algorithms"),
            ("MATH301", "Linear Algebra", 1, "Vectors, matrices, and linear transformations"),
            ("CS301", "Algorithms", 0, "Sorting, searching, and complexity analysis"),
            ("C0-501", "AI Systems", 1, "Build AI-enabled tools with local data"),
            ("C0-502", "Database Design", 1, "SQL, schemas, and transactions"),
            ("C0-503", "Software Engineering", 1, "Team workflow and deployment"),
            ("C0-504", "Cybersecurity Basics", 0, "Auth, access control, security risks"),
            # NEW COURSES
            ("C0-505", "Cloud Computing", 0, "AWS, Azure, and cloud infrastructure"),
            ("C0-506", "DevOps Practices", 0, "CI/CD, containers, and automation"),
            ("C0-507", "Machine Learning", 1, "ML algorithms and practical applications"),
            ("C0-508", "Web Development", 0, "Full-stack web development with React"),
        ]
        for code, title, required, desc in courses:
            conn.execute("INSERT INTO courses(code,title,required,description) VALUES(?,?,?,?)", 
                         (code, title, required, desc))

        # Get IDs
        instructor_ids = [r["id"] for r in conn.execute("SELECT id FROM instructors").fetchall()]
        student_ids = [r["id"] for r in conn.execute("SELECT id FROM students").fetchall()]
        # user_id FK values (what complaints table actually references via users.id)
        instructor_user_ids = [r["user_id"] for r in conn.execute("SELECT user_id FROM instructors").fetchall()]
        student_user_ids = [r["user_id"] for r in conn.execute("SELECT user_id FROM students").fetchall()]
        course_ids = {r["code"]: r["id"] for r in conn.execute("SELECT id, code FROM courses").fetchall()}

        # Classes - EXPANDED with more classes and instructor assignments
        class_data = [
            # Existing classes
            ("CS101", instructor_ids[0], "Mon/Wed 9-10:30am", 5, 4.0),
            ("CS201", instructor_ids[1], "Tue/Thu 11am-12:30pm", 5, 4.0),
            ("MATH301", instructor_ids[2], "Mon/Wed 2-3:30pm", 5, 4.0),
            ("CS301", instructor_ids[0], "Fri 10am-1pm", 3, 4.0),
            # NEW CLASSES
            ("C0-501", instructor_ids[3], "Mon 1-4pm", 6, 0.0),
            ("C0-502", instructor_ids[4], "Tue 2-5pm", 6, 0.0),
            ("C0-503", instructor_ids[5], "Wed 10am-1pm", 5, 0.0),
            ("C0-504", instructor_ids[6], "Thu 1-4pm", 5, 0.0),
            ("C0-505", instructor_ids[7], "Fri 9am-12pm", 4, 0.0),
            ("C0-506", instructor_ids[3], "Mon 10am-1pm", 5, 0.0),
            ("C0-507", instructor_ids[4], "Wed 2-5pm", 6, 0.0),
            ("C0-508", instructor_ids[5], "Fri 1-4pm", 5, 0.0),
        ]
        class_ids = []
        for code, inst, time, cap, rating in class_data:
            course_id = course_ids[code]
            cur = conn.execute("""
                INSERT INTO classes(course_id, instructor_id, semester, class_time, capacity, avg_rating, cancelled)
                VALUES(?,?,1,?,?,?,0)
            """, (course_id, inst, time, cap, rating))
            class_ids.append(cur.lastrowid)

        # Enrollments - EXPANDED with more student enrollments
        # Map instructors to their classes
        # instructor_ids: 0=inst_lee, 1=inst_khan, 2=inst_rivera, 3=chen, 4=okafor, 5=wong, 6=martinez, 7=gupta
        
        # Existing enrollments
        # stu1 (alice) -> c1, c2, c3 (class_ids[0], [1], [2])
        # stu2 (ben) -> c1, c3, c4 (class_ids[0], [2], [3])
        # stu3 (cora) -> c1, c2, c4 (class_ids[0], [1], [3])
        # stu4 (david) -> c2, c3 (class_ids[1], [2])
        # stu5 (eva) -> c1, c4 (class_ids[0], [3])
        
        # NEW ENROLLMENTS for existing students
        # Alice takes more classes
        for cid in [class_ids[4], class_ids[5]]:  # C0-501, C0-502
            conn.execute("INSERT INTO enrollments(student_id, class_id, semester, status) VALUES(?,?,1,'registered')", 
                         (student_ids[0], cid))
        
        # Ben takes more classes
        for cid in [class_ids[4], class_ids[6]]:  # C0-501, C0-503
            conn.execute("INSERT INTO enrollments(student_id, class_id, semester, status) VALUES(?,?,1,'registered')", 
                         (student_ids[1], cid))
        
        # Cora takes more classes
        for cid in [class_ids[5], class_ids[7]]:  # C0-502, C0-504
            conn.execute("INSERT INTO enrollments(student_id, class_id, semester, status) VALUES(?,?,1,'registered')", 
                         (student_ids[2], cid))
        
        # NEW STUDENTS enrollments
        # Frank (student_ids[5]) -> C0-501, C0-503, C0-505
        for cid in [class_ids[4], class_ids[6], class_ids[8]]:
            conn.execute("INSERT INTO enrollments(student_id, class_id, semester, status) VALUES(?,?,1,'registered')", 
                         (student_ids[5], cid))
        
        # Grace (student_ids[6]) -> C0-502, C0-504, C0-506
        for cid in [class_ids[5], class_ids[7], class_ids[9]]:
            conn.execute("INSERT INTO enrollments(student_id, class_id, semester, status) VALUES(?,?,1,'registered')", 
                         (student_ids[6], cid))
        
        # Henry (student_ids[7]) -> C0-503, C0-507
        for cid in [class_ids[6], class_ids[10]]:
            conn.execute("INSERT INTO enrollments(student_id, class_id, semester, status) VALUES(?,?,1,'registered')", 
                         (student_ids[7], cid))
        
        # Isabel (student_ids[8]) -> C0-504, C0-508
        for cid in [class_ids[7], class_ids[11]]:
            conn.execute("INSERT INTO enrollments(student_id, class_id, semester, status) VALUES(?,?,1,'registered')", 
                         (student_ids[8], cid))
        
        # Jack (student_ids[9]) -> C0-505, C0-506
        for cid in [class_ids[8], class_ids[9]]:
            conn.execute("INSERT INTO enrollments(student_id, class_id, semester, status) VALUES(?,?,1,'registered')", 
                         (student_ids[9], cid))

        # Waitlist examples
        conn.execute("INSERT INTO enrollments(student_id, class_id, semester, status) VALUES(?,?,1,'waitlisted')", 
                     (student_ids[9], class_ids[4]))  # Jack waitlisted for C0-501
        conn.execute("INSERT INTO enrollments(student_id, class_id, semester, status) VALUES(?,?,1,'waitlisted')", 
                     (student_ids[7], class_ids[5]))  # Henry waitlisted for C0-502

                # FIX: Enroll students in Dr. Lee's classes (CS101 and CS301)
        # Dr. Lee's classes are at index 0 (CS101) and index 3 (CS301)
        print("Enrolling students in Dr. Lee's classes...")
        
        # Enroll all students in CS101 (class_ids[0])
        for sid in student_ids:
            conn.execute("""
                INSERT OR IGNORE INTO enrollments(student_id, class_id, semester, status) 
                VALUES(?,?,1,'registered')
            """, (sid, class_ids[0]))
        
        # Enroll all students in CS301 (class_ids[3])  
        for sid in student_ids:
            conn.execute("""
                INSERT OR IGNORE INTO enrollments(student_id, class_id, semester, status) 
                VALUES(?,?,1,'registered')
            """, (sid, class_ids[3]))
        
        print(f"  - Enrolled {len(student_ids)} students in CS101")
        print(f"  - Enrolled {len(student_ids)} students in CS301")

        # ──────────────────────────────────────────────────────────────
        # NEW TABLES ADDED BELOW
        # ──────────────────────────────────────────────────────────────

        # Taboo words
        taboo_words = ["badword", "inappropriate", "offensive", "trash", "stupid", "idiot", "hate", "useless", "terrible", "awful", "worst"]
        for word in taboo_words:
            conn.execute("INSERT OR IGNORE INTO taboo_words(word) VALUES(?)", (word,))

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
        
        # Sample notifications for all students
        sample_notifications = [
            (student_ids[0], "Welcome to College0! Your account has been created.", "info"),
            (student_ids[0], "Registration for the new semester is now open!", "success"),
            (student_ids[1], "Don't forget to submit your course reviews before the deadline.", "warn"),
            (student_ids[2], "Your GPA is below 3.0. Consider meeting with an advisor.", "warn"),
            (student_ids[3], "Congratulations! You've been placed on the Honor Roll.", "success"),
            (student_ids[4], "Warning: You have 2 warnings remaining before suspension.", "danger"),
            (student_ids[5], "New course registration is open!", "info"),
            (student_ids[6], "You have been selected for academic recognition!", "success"),
            (student_ids[7], "Please complete your course evaluations.", "warn"),
            (student_ids[8], "Your scholarship application deadline is approaching.", "info"),
            (student_ids[9], "Welcome to the new semester!", "info"),
        ]
        for user_id, message, type in sample_notifications:
            conn.execute("""
                INSERT INTO notifications (user_id, message, type, created_at)
                VALUES (?, ?, ?, datetime('now'))
            """, (user_id, message, type))

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
        
        # Sample grade justifications for multiple classes
        grade_justifications_data = [
            (instructor_ids[0], class_ids[0], "The class performed exceptionally well this semester due to extra study sessions and high motivation.", 0),
            (instructor_ids[1], class_ids[1], "Students struggled initially but showed great improvement. Grades reflect final performance.", 0),
            (instructor_ids[3], class_ids[4], "AI Systems class had high engagement and project quality was outstanding.", 0),
        ]
        for inst_id, cls_id, justification, reviewed in grade_justifications_data:
            conn.execute("""
                INSERT INTO grade_justifications (instructor_id, class_id, justification, reviewed)
                VALUES (?, ?, ?, ?)
            """, (inst_id, cls_id, justification, reviewed))

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
        
        # Graduation applications for eligible students
        conn.execute("""
            INSERT INTO graduation_apps (student_id, status, created_at)
            VALUES (?, 'pending', datetime('now'))
        """, (student_ids[0],))  # Alice pending
        conn.execute("""
            INSERT INTO graduation_apps (student_id, status, created_at)
            VALUES (?, 'approved', datetime('now', '-7 days'))
        """, (student_ids[3],))  # David approved
        conn.execute("""
            INSERT INTO graduation_apps (student_id, status, created_at)
            VALUES (?, 'rejected', datetime('now', '-14 days'))
        """, (student_ids[6],))  # Grace rejected

        # Applications table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS applications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                applicant_type TEXT NOT NULL CHECK(applicant_type IN ('student','instructor')),
                name TEXT NOT NULL,
                email TEXT,
                incoming_gpa REAL,
                program TEXT,
                statement TEXT,
                status TEXT DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected')),
                registrar_note TEXT,
                assigned_username TEXT,
                assigned_password TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                reviewed_at TIMESTAMP
            )
        """)
        
        # Sample applications
        sample_apps = [
            ("student", "John Smith", "john@email.com", 3.8, "Computer Science", "I have a strong background in programming and want to pursue AI."),
            ("student", "Mary Jones", "mary@email.com", 2.9, "Business", "Looking to enhance my career with a graduate degree."),
            ("instructor", "Dr. Williams", "williams@email.com", None, None, "Experienced professor with 10 years of teaching experience."),
            ("student", "Sarah Chen", "sarah@email.com", 3.95, "Data Science", "Passionate about data analytics and machine learning."),
            ("instructor", "Prof. Anderson", "anderson@email.com", None, None, "Expert in cloud computing with industry experience."),
        ]
        for app_type, name, email, gpa, program, statement in sample_apps:
            conn.execute("""
                INSERT INTO applications (applicant_type, name, email, incoming_gpa, program, statement, status)
                VALUES (?, ?, ?, ?, ?, ?, 'pending')
            """, (app_type, name, email, gpa, program, statement))

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
        
        # Helper: look up users.id by username — avoids any array-index confusion
        def uid(username):
            row = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
            return row["id"] if row else None

# No preset complaints — complaints are submitted live by students and instructors.

        # Knowledge base
        
        knowledge = [
            ("all", "College0 overview", "College0 is an AI-enabled online college program management system for registrars, instructors, students, and visitors."),
            ("visitor", "How to apply", "Visitors can apply as students or instructors. Student applications should be accepted when GPA is above 3.0 and quota is not full."),
            ("student", "Registration rules", "Students register for 2 to 4 courses. They cannot register with time conflicts. Full courses place them on the waitlist."),
            ("student", "Graduation rules", "A student can apply for graduation after finishing 8 classes and completing all required courses."),
            ("instructor", "Instructor grading", "Instructors assign grades during the grading period. Missing grades can create warnings."),
            ("registrar", "Registrar powers", "Registrars manage periods, approve applications, set classes, resolve complaints, and can see all records."),
            ("all", "Warning system", "Students with 3 warnings are suspended. Instructors with 3 warnings are suspended."),
            ("all", "GPA rules", "Students with GPA below 2.0 are terminated. GPA between 2.0-2.25 requires registrar interview."),
            # NEW KNOWLEDGE
            ("student", "Course load", "Students can take up to 4 courses per semester. Minimum load is 2 courses."),
            ("instructor", "Office hours", "Instructors are required to hold at least 2 office hours per week."),
            ("registrar", "Quota management", "Program quota can be adjusted during semester setup period."),
            ("all", "Waitlist policy", "Students on waitlist are automatically enrolled when spots open, in order of signup."),
        ]
        for audience, title, body in knowledge:
            conn.execute("INSERT INTO knowledge(audience,title,body) VALUES(?,?,?)", (audience, title, body))

    print(f"✅ Seeded database at {DB_PATH}")
    print("📊 Data includes:")
    print("   - 8 instructors, 10 students")
    print("   - 12 classes, expanded enrollments")
    print("   - Taboo words, knowledge base")
    print("   - Notifications, grade justifications")
    print("   - Graduation applications, complaints")
    print("   - Sample applications for testing")

if __name__ == "__main__":
    seed()
