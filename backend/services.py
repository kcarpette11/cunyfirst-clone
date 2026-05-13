from collections import Counter
from db import get_conn, one, all_rows, execute

GRADE_POINTS = {
    "A": 4.0, "A-": 3.7, "B+": 3.3, "B": 3.0, "B-": 2.7,
    "C+": 2.3, "C": 2.0, "C-": 1.7, "D": 1.0, "F": 0.0
}

PROGRAM_QUOTA = 20


def current_period():
    row = one("SELECT value FROM settings WHERE key='period'")
    return row["value"] if row else "setup"


def current_semester():
    row = one("SELECT value FROM settings WHERE key='semester'")
    return int(row["value"]) if row else 1


def set_period(period):
    if period not in ("setup", "registration", "special_registration", "running", "grading"):
        raise ValueError("Invalid period")
    execute("INSERT OR REPLACE INTO settings(key,value) VALUES('period',?)", (period,))
    return apply_period_rules(period)


def list_home_stats():
    highest = all_rows("""
        SELECT courses.code, courses.title, classes.avg_rating
        FROM classes JOIN courses ON courses.id=classes.course_id
        WHERE classes.avg_rating > 0
        ORDER BY classes.avg_rating DESC LIMIT 5
    """)
    lowest = all_rows("""
        SELECT courses.code, courses.title, classes.avg_rating
        FROM classes JOIN courses ON courses.id=classes.course_id
        WHERE classes.avg_rating > 0
        ORDER BY classes.avg_rating ASC LIMIT 5
    """)
    top_students = all_rows("""
        SELECT student_code, name, gpa FROM students
        WHERE terminated=0
        ORDER BY gpa DESC LIMIT 5
    """)
    return highest, lowest, top_students


def submit_application(applicant_type, name, email, incoming_gpa=None, program="", statement=""):
    if applicant_type not in ("student", "instructor"):
        raise ValueError("Applicant type must be student or instructor")
    execute(
        """INSERT INTO applications(applicant_type,name,email,incoming_gpa,program,statement)
           VALUES(?,?,?,?,?,?)""",
        (applicant_type, name, email, incoming_gpa, program, statement),
    )


def pending_applications():
    return all_rows("SELECT * FROM applications WHERE status='pending' ORDER BY created_at")


def decide_application(app_id, accept, note=""):
    app = one("SELECT * FROM applications WHERE id=?", (app_id,))
    if not app:
        raise ValueError("Application not found")

    if accept:
        if app["applicant_type"] == "student":
            count = one("SELECT COUNT(*) AS c FROM students WHERE terminated=0")["c"]
            follows_rule = (app["incoming_gpa"] or 0) > 3.0 and count < PROGRAM_QUOTA
            if not follows_rule and not note.strip():
                raise ValueError("Registrar must justify accepting outside the GPA/quota rule.")
            code = next_student_code()
            username = code
            password = "changeme"
            with get_conn() as conn:
                cur = conn.execute(
                    "INSERT INTO users(username,password,role,must_change_password) VALUES(?,?,?,1)",
                    (username, password, "student"),
                )
                user_id = cur.lastrowid
                conn.execute(
                    """INSERT INTO students(user_id,student_code,name,email,gpa)
                       VALUES(?,?,?,?,?)""",
                    (user_id, code, app["name"], app["email"], app["incoming_gpa"] or 0),
                )
                conn.execute(
                    "UPDATE applications SET status='accepted', registrar_note=? WHERE id=?",
                    (note or "Accepted by registrar.", app_id),
                )
            return f"Accepted student. Login username: {username}, temp password: {password}"
        else:
            username = "inst_" + app["name"].lower().split()[0].replace(" ", "")
            password = "changeme"
            with get_conn() as conn:
                cur = conn.execute(
                    "INSERT INTO users(username,password,role,must_change_password) VALUES(?,?,?,1)",
                    (username, password, "instructor"),
                )
                user_id = cur.lastrowid
                conn.execute(
                    "INSERT INTO instructors(user_id,name,email) VALUES(?,?,?)",
                    (user_id, app["name"], app["email"]),
                )
                conn.execute(
                    "UPDATE applications SET status='accepted', registrar_note=? WHERE id=?",
                    (note or "Accepted by registrar.", app_id),
                )
            return f"Accepted instructor. Login username: {username}, temp password: {password}"
    else:
        if app["applicant_type"] == "student":
            count = one("SELECT COUNT(*) AS c FROM students WHERE terminated=0")["c"]
            follows_rule = (app["incoming_gpa"] or 0) > 3.0 and count < PROGRAM_QUOTA
            if follows_rule and not note.strip():
                raise ValueError("Registrar must justify rejecting a student who meets GPA/quota rule.")
        execute("UPDATE applications SET status='rejected', registrar_note=? WHERE id=?", (note or "Rejected.", app_id))
        return "Application rejected."


def next_student_code():
    row = one("SELECT student_code FROM students ORDER BY id DESC LIMIT 1")
    if not row:
        return "S1001"
    num = int(row["student_code"][1:]) + 1
    return f"S{num}"


def login(username, password):
    return one("SELECT * FROM users WHERE username=? AND password=? AND active=1", (username, password))


def change_password(user_id, new_password):
    execute("UPDATE users SET password=?, must_change_password=0 WHERE id=?", (new_password, user_id))


def list_classes():
    return all_rows("""
        SELECT classes.id, courses.code, courses.title, instructors.name AS instructor,
               classes.semester, classes.class_time, classes.capacity, classes.cancelled,
               classes.avg_rating,
               (SELECT COUNT(*) FROM enrollments e WHERE e.class_id=classes.id AND e.status='registered') AS enrolled,
               (SELECT COUNT(*) FROM enrollments e WHERE e.class_id=classes.id AND e.status='waitlisted') AS waitlisted
        FROM classes
        JOIN courses ON courses.id=classes.course_id
        LEFT JOIN instructors ON instructors.id=classes.instructor_id
        ORDER BY classes.semester DESC, courses.code
    """)


def create_course(code, title, required=False, description=""):
    execute("INSERT OR IGNORE INTO courses(code,title,required,description) VALUES(?,?,?,?)",
            (code, title, int(required), description))


def create_class(course_code, instructor_id, class_time, capacity):
    if current_period() != "setup":
        raise ValueError("Classes can only be set up during the setup period.")
    course = one("SELECT id FROM courses WHERE code=?", (course_code,))
    if not course:
        raise ValueError("Course code does not exist.")
    execute(
        "INSERT INTO classes(course_id,instructor_id,semester,class_time,capacity) VALUES(?,?,?,?,?)",
        (course["id"], instructor_id, current_semester(), class_time, int(capacity)),
    )


def available_instructors():
    sem = current_semester()
    return all_rows("""
        SELECT id, name FROM instructors
        WHERE fired=0 AND suspended_until_semester < ?
        ORDER BY name
    """, (sem,))


def get_student_by_user(user_id):
    return one("SELECT * FROM students WHERE user_id=?", (user_id,))


def get_instructor_by_user(user_id):
    return one("SELECT * FROM instructors WHERE user_id=?", (user_id,))


def register_student(student_id, class_id):
    if current_period() not in ("registration", "special_registration"):
        raise ValueError("Registration is not open.")
    student = one("SELECT * FROM students WHERE id=?", (student_id,))
    if not student or student["terminated"]:
        raise ValueError("Student is not allowed to register.")
    if student["suspended_until_semester"] >= current_semester():
        raise ValueError("Student is suspended this semester.")

    cls = one("SELECT * FROM classes WHERE id=?", (class_id,))
    if not cls or cls["cancelled"]:
        raise ValueError("Class not available.")

    existing = all_rows("""
        SELECT c.class_time, co.code, e.grade
        FROM enrollments e
        JOIN classes c ON c.id=e.class_id
        JOIN courses co ON co.id=c.course_id
        WHERE e.student_id=? AND e.status IN ('registered','completed')
    """, (student_id,))

    target_course = one("SELECT courses.code FROM classes JOIN courses ON courses.id=classes.course_id WHERE classes.id=?", (class_id,))
    for e in existing:
        if e["class_time"] == cls["class_time"] and e["grade"] is None:
            raise ValueError("Time conflict with another registered class.")
        if e["code"] == target_course["code"] and e["grade"] != "F":
            raise ValueError("A student can only retake the same class after receiving an F.")

    active_count = one("SELECT COUNT(*) AS c FROM enrollments WHERE student_id=? AND status='registered' AND grade IS NULL", (student_id,))["c"]
    if active_count >= 4:
        raise ValueError("Students cannot register for more than 4 current courses.")

    enrolled_count = one("SELECT COUNT(*) AS c FROM enrollments WHERE class_id=? AND status='registered'", (class_id,))["c"]
    status = "registered" if enrolled_count < cls["capacity"] else "waitlisted"
    execute("INSERT OR REPLACE INTO enrollments(student_id,class_id,status) VALUES(?,?,?)", (student_id, class_id, status))
    if active_count + (1 if status == "registered" else 0) < 2:
        return f"Student is {status}. Warning: students must register for at least 2 courses before the period closes."
    return f"Student is {status}."


def student_schedule(student_id):
    return all_rows("""
        SELECT e.id, e.status, e.grade, courses.code, courses.title, classes.class_time, instructors.name AS instructor
        FROM enrollments e
        JOIN classes ON classes.id=e.class_id
        JOIN courses ON courses.id=classes.course_id
        LEFT JOIN instructors ON instructors.id=classes.instructor_id
        WHERE e.student_id=?
        ORDER BY classes.class_time
    """, (student_id,))


def instructor_classes(instructor_id):
    return all_rows("""
        SELECT classes.id, courses.code, courses.title, classes.class_time, classes.capacity, classes.cancelled, classes,avg_rating,
                    (SELECT COUNT(*) FROM enrollments e where e.class_id=classes_id AND e.status = 'registered') AS enrolled,
                    (SELECT COUNT (*) FROM enrollments e WHERE e.class_id=classes.id AND e.status= 'waitlisted') AS waitlisted
        FROM classes JOIN courses ON courses.id=classes.course_id
        WHERE classes.instructor_id=? AND classes.semester=?
        ORDER BY courses.code
    """, (instructor_id, current_semester()))


def class_roster(class_id):
    return all_rows("""
        SELECT students.id, students.student_code, students.name, students.gpa, students.warnings, e.status, e.grade
        FROM enrollments e JOIN students ON students.id=e.student_id
        WHERE e.class_id=?
        ORDER BY e.status, students.name
    """, (class_id,))


def admit_waitlisted(instructor_id, enrollment_id):
    row = one("""
        SELECT e.id, e.class_id, c.capacity
        FROM enrollments e JOIN classes c ON c.id=e.class_id
        WHERE e.id=? AND c.instructor_id=? AND e.status='waitlisted'
    """, (enrollment_id, instructor_id))
    if not row:
        raise ValueError("Waitlist row not found or not controlled by this instructor.")
    enrolled = one("SELECT COUNT(*) AS c FROM enrollments WHERE class_id=? AND status='registered'", (row["class_id"],))["c"]
    if enrolled >= row["capacity"]:
        raise ValueError("Class is full.")
    execute("UPDATE enrollments SET status='registered' WHERE id=?", (enrollment_id,))


def submit_review(student_id, class_id, stars, text):
    if current_period() == "grading":
        raise ValueError("Reviews cannot be posted after grades are being posted.")
    enrolled = one("SELECT * FROM enrollments WHERE student_id=? AND class_id=? AND status='registered'", (student_id, class_id))
    if not enrolled:
        raise ValueError("Only students in the class can review it.")
    if enrolled["grade"]:
        raise ValueError("Cannot rate after grade is posted.")

    taboo = [r["word"].lower() for r in all_rows("SELECT word FROM taboo_words")]
    words = text.split()
    count = 0
    clean_words = []
    for w in words:
        stripped = w.strip(".,!?;:").lower()
        if stripped in taboo:
            count += 1
            clean_words.append("*" * len(w))
        else:
            clean_words.append(w)
    shown = 0 if count >= 3 else 1
    clean_text = " ".join(clean_words)
    execute("INSERT INTO reviews(student_id,class_id,stars,text,shown) VALUES(?,?,?,?,?)",
            (student_id, class_id, int(stars), clean_text, shown))

    if count == 1 or count == 2:
        warn_student(student_id, 1)
    elif count >= 3:
        warn_student(student_id, 2)

    update_class_rating(class_id)
    cls = one("SELECT avg_rating, instructor_id FROM classes WHERE id=?", (class_id,))
    if cls and cls["avg_rating"] < 2 and cls["avg_rating"] > 0 and cls["instructor_id"]:
        warn_instructor(cls["instructor_id"], 1)
    return "Review saved. Taboo handling applied."


def update_class_rating(class_id):
    row = one("SELECT AVG(stars) AS avg_rating FROM reviews WHERE class_id=? AND shown=1", (class_id,))
    avg = row["avg_rating"] or 0
    execute("UPDATE classes SET avg_rating=? WHERE id=?", (avg, class_id))


def visible_reviews(class_id):
    return all_rows("""
        SELECT stars, text, created_at FROM reviews
        WHERE class_id=? AND shown=1 ORDER BY created_at DESC
    """, (class_id,))


def post_grade(instructor_id, student_id, class_id, grade):
    if current_period() != "grading":
        raise ValueError("Grades can only be posted during grading period.")
    if grade not in GRADE_POINTS:
        raise ValueError("Invalid grade.")
    allowed = one("SELECT id FROM classes WHERE id=? AND instructor_id=?", (class_id, instructor_id))
    if not allowed:
        raise ValueError("Instructor cannot grade this class.")
    execute("""
        UPDATE enrollments SET grade=?, status='completed'
        WHERE student_id=? AND class_id=? AND status='registered'
    """, (grade, student_id, class_id))
    recalc_student_gpa(student_id)


def recalc_student_gpa(student_id):
    grades = all_rows("SELECT grade FROM enrollments WHERE student_id=? AND grade IS NOT NULL", (student_id,))
    pts = [GRADE_POINTS[g["grade"]] for g in grades if g["grade"] in GRADE_POINTS]
    if not pts:
        return
    overall = sum(pts) / len(pts)
    execute("UPDATE students SET gpa=?, semester_gpa=?, completed_classes=? WHERE id=?",
            (overall, overall, len(pts), student_id))
    apply_student_academic_rules(student_id)


def apply_student_academic_rules(student_id):
    st = one("SELECT * FROM students WHERE id=?", (student_id,))
    if not st:
        return
    if st["gpa"] < 2:
        execute("UPDATE students SET terminated=1 WHERE id=?", (student_id,))
    elif 2 <= st["gpa"] <= 2.25:
        warn_student(student_id, 1)

    failed = all_rows("""
        SELECT courses.code
        FROM enrollments e JOIN classes c ON c.id=e.class_id JOIN courses ON courses.id=c.course_id
        WHERE e.student_id=? AND e.grade='F'
    """, (student_id,))
    counts = Counter([r["code"] for r in failed])
    if any(v >= 2 for v in counts.values()):
        execute("UPDATE students SET terminated=1 WHERE id=?", (student_id,))

    if st["semester_gpa"] > 3.75 or (st["completed_classes"] > 1 and st["gpa"] > 3.5):
        if st["warnings"] > 0:
            execute("UPDATE students SET honor_roll=1, warnings=warnings-1 WHERE id=?", (student_id,))
        else:
            execute("UPDATE students SET honor_roll=1 WHERE id=?", (student_id,))


def end_grading_period_checks():
    messages = []
    classes = all_rows("SELECT id, instructor_id FROM classes WHERE semester=? AND cancelled=0", (current_semester(),))
    for c in classes:
        missing = one("""
            SELECT COUNT(*) AS c FROM enrollments
            WHERE class_id=? AND status='registered' AND grade IS NULL
        """, (c["id"],))["c"]
        if missing > 0 and c["instructor_id"]:
            warn_instructor(c["instructor_id"], 1)
            messages.append(f"Instructor {c['instructor_id']} warned for missing grades.")

        grades = all_rows("SELECT grade FROM enrollments WHERE class_id=? AND grade IS NOT NULL", (c["id"],))
        pts = [GRADE_POINTS[g["grade"]] for g in grades if g["grade"] in GRADE_POINTS]
        if pts and c["instructor_id"]:
            avg = sum(pts) / len(pts)
            if avg > 3.5 or avg < 2.5:
                warn_instructor(c["instructor_id"], 1)
                messages.append(f"Instructor {c['instructor_id']} questioned/warned for class GPA {avg:.2f}.")
    execute("INSERT OR REPLACE INTO settings(key,value) VALUES('semester',?)", (str(current_semester()+1),))
    execute("INSERT OR REPLACE INTO settings(key,value) VALUES('period','setup')")
    return messages or ["Grading closed. New semester started."]


def apply_period_rules(period):
    messages = []
    if period == "running":
        # warn students taking fewer than 2 courses
        rows = all_rows("""
            SELECT students.id, students.name, COUNT(e.id) AS c
            FROM students LEFT JOIN enrollments e ON students.id=e.student_id AND e.status='registered'
            WHERE students.terminated=0
            GROUP BY students.id
        """)
        for r in rows:
            if r["c"] < 2:
                warn_student(r["id"], 1)
                messages.append(f"{r['name']} warned for fewer than 2 courses.")

        # cancel courses with fewer than 3 students
        classes = all_rows("SELECT id, instructor_id FROM classes WHERE semester=? AND cancelled=0", (current_semester(),))
        cancelled_instructors = []
        for c in classes:
            enrolled = one("SELECT COUNT(*) AS c FROM enrollments WHERE class_id=? AND status='registered'", (c["id"],))["c"]
            if enrolled < 3:
                execute("UPDATE classes SET cancelled=1 WHERE id=?", (c["id"],))
                if c["instructor_id"]:
                    warn_instructor(c["instructor_id"], 1)
                    cancelled_instructors.append(c["instructor_id"])
                messages.append(f"Class {c['id']} cancelled for fewer than 3 students.")

        for inst_id in set(cancelled_instructors):
            active = one("""
                SELECT COUNT(*) AS c FROM classes
                WHERE instructor_id=? AND semester=? AND cancelled=0
            """, (inst_id, current_semester()))["c"]
            if active == 0:
                execute("UPDATE instructors SET suspended_until_semester=? WHERE id=?", (current_semester()+1, inst_id))
                messages.append(f"Instructor {inst_id} suspended next semester because all classes were cancelled.")

    return messages


def warn_student(student_id, amount=1):
    execute("UPDATE students SET warnings=warnings+? WHERE id=?", (amount, student_id))
    st = one("SELECT warnings FROM students WHERE id=?", (student_id,))
    if st and st["warnings"] >= 3:
        execute("UPDATE students SET suspended_until_semester=? WHERE id=?", (current_semester()+1, student_id))


def warn_instructor(instructor_id, amount=1):
    execute("UPDATE instructors SET warnings=warnings+? WHERE id=?", (amount, instructor_id))
    inst = one("SELECT warnings FROM instructors WHERE id=?", (instructor_id,))
    if inst and inst["warnings"] >= 3:
        execute("UPDATE instructors SET suspended_until_semester=? WHERE id=?", (current_semester()+1, instructor_id))


def submit_complaint(complainant_role, complainant_id, target_role, target_id, text):
    execute("""
        INSERT INTO complaints(complainant_role,complainant_id,target_role,target_id,text)
        VALUES(?,?,?,?,?)
    """, (complainant_role, complainant_id, target_role, target_id, text))


def pending_complaints():
    return all_rows("SELECT * FROM complaints WHERE status='pending' ORDER BY created_at")


def process_complaint(complaint_id, action):
    comp = one("SELECT * FROM complaints WHERE id=?", (complaint_id,))
    if not comp:
        raise ValueError("Complaint not found.")
    if action == "warn_target":
        if comp["target_role"] == "student":
            warn_student(comp["target_id"], 1)
        elif comp["target_role"] == "instructor":
            warn_instructor(comp["target_id"], 1)
        result = "Target warned."
    elif action == "deregister_student":
        if comp["target_role"] != "student":
            raise ValueError("Only students can be deregistered.")
        execute("UPDATE enrollments SET status='dropped' WHERE student_id=? AND status='registered'", (comp["target_id"],))
        result = "Student deregistered."
    elif action == "warn_complainant":
        if comp["complainant_role"] == "student":
            warn_student(comp["complainant_id"], 1)
        elif comp["complainant_role"] == "instructor":
            warn_instructor(comp["complainant_id"], 1)
        result = "Complainant warned."
    else:
        result = "No punishment."
    execute("UPDATE complaints SET status='processed', action=? WHERE id=?", (result, complaint_id))


def apply_graduation(student_id):
    st = one("SELECT * FROM students WHERE id=?", (student_id,))
    if not st:
        raise ValueError("Student not found.")
    app_id = execute("INSERT INTO graduation_applications(student_id,status,note) VALUES(?,?,?)", (student_id, "pending", "Submitted by student"))
    if st["completed_classes"] < 8:
        warn_student(student_id, 1)
        execute("UPDATE graduation_applications SET status='rejected', note=? WHERE id=?", ("Rejected: fewer than 8 completed classes. Warning issued.", app_id))
        return "Graduation rejected: fewer than 8 completed classes. Warning issued."

    required = all_rows("SELECT code FROM courses WHERE required=1")
    completed = all_rows("""
        SELECT DISTINCT courses.code
        FROM enrollments e JOIN classes c ON c.id=e.class_id JOIN courses ON courses.id=c.course_id
        WHERE e.student_id=? AND e.grade IS NOT NULL AND e.grade!='F'
    """, (student_id,))
    req = {r["code"] for r in required}
    got = {r["code"] for r in completed}
    missing = req - got
    if missing:
        warn_student(student_id, 1)
        msg = "Graduation rejected. Missing required courses: " + ", ".join(sorted(missing))
        execute("UPDATE graduation_applications SET status='rejected', note=? WHERE id=?", (msg, app_id))
        return msg
    execute("UPDATE users SET active=0 WHERE id=?", (st["user_id"],))
    execute("UPDATE graduation_applications SET status='approved', note=? WHERE id=?", ("Approved. Student leaves College0 with a Bachelor's degree.", app_id))
    return "Graduation approved. Student leaves College0 with a Bachelor's degree."


def degree_progress(student_id):
    required = all_rows("SELECT code,title FROM courses WHERE required=1")
    completed = all_rows("""
        SELECT DISTINCT courses.code
        FROM enrollments e JOIN classes c ON c.id=e.class_id JOIN courses ON courses.id=c.course_id
        WHERE e.student_id=? AND e.grade IS NOT NULL AND e.grade!='F'
    """, (student_id,))
    got = {r["code"] for r in completed}
    lines = []
    for r in required:
        mark = "DONE" if r["code"] in got else "MISSING"
        lines.append(f"{mark}: {r['code']} — {r['title']}")
    st = one("SELECT gpa,warnings,completed_classes,honor_roll,terminated,suspended_until_semester FROM students WHERE id=?", (student_id,))
    risk = "Good standing"
    if st["terminated"]:
        risk = "Terminated"
    elif st["warnings"] >= 2:
        risk = "High warning risk"
    elif st["gpa"] < 2.25:
        risk = "Academic risk"
    return "\n".join(lines) + f"\n\nCompleted classes: {st['completed_classes']}\nGPA: {st['gpa']:.2f}\nWarnings: {st['warnings']}\nHonor roll: {'Yes' if st['honor_roll'] else 'No'}\nStatus: {risk}"

# ---------- Extra checklist/frontend helper functions ----------
def public_students():
    return all_rows("""
        SELECT student_code, name, gpa, honor_roll
        FROM students WHERE terminated=0
        ORDER BY gpa DESC, name LIMIT 10
    """)


def all_users():
    return all_rows("SELECT id, username, role, active, must_change_password FROM users ORDER BY role, username")


def all_students():
    return all_rows("""
        SELECT id, student_code, name, gpa, warnings, suspended_until_semester,
               terminated, honor_roll, completed_classes, fine_paid
        FROM students ORDER BY student_code
    """)


def list_taboo_words():
    return all_rows("SELECT word FROM taboo_words ORDER BY word")


def add_taboo_word(word):
    word = (word or "").strip().lower()
    if not word:
        raise ValueError("Enter a taboo word.")
    execute("INSERT OR IGNORE INTO taboo_words(word) VALUES(?)", (word,))


def all_reviews():
    return all_rows("""
        SELECT reviews.class_id, courses.code || ' - ' || courses.title AS course,
               reviews.stars, reviews.text, reviews.shown
        FROM reviews
        JOIN classes ON classes.id=reviews.class_id
        JOIN courses ON courses.id=classes.course_id
        ORDER BY reviews.created_at DESC
    """)


def graduation_applications():
    return all_rows("""
        SELECT ga.id, ga.status, ga.note, ga.created_at, students.name, students.student_code
        FROM graduation_applications ga
        JOIN students ON students.id=ga.student_id
        ORDER BY ga.created_at DESC
    """)


def class_gpa_reviews():
    rows = all_rows("""
        SELECT classes.id AS class_id, courses.code || ' - ' || courses.title AS course,
               instructors.name AS instructor
        FROM classes
        JOIN courses ON courses.id=classes.course_id
        LEFT JOIN instructors ON instructors.id=classes.instructor_id
        ORDER BY classes.id
    """)
    out = []
    for r in rows:
        grades = all_rows("SELECT grade FROM enrollments WHERE class_id=? AND grade IS NOT NULL", (r["class_id"],))
        pts = [GRADE_POINTS[g["grade"]] for g in grades if g["grade"] in GRADE_POINTS]
        avg = sum(pts)/len(pts) if pts else None
        out.append({"class_id": r["class_id"], "course": r["course"], "instructor": r["instructor"], "class_gpa": avg, "needs_review": bool(avg is not None and (avg > 3.5 or avg < 2.5))})
    return out


def registrar_action(role, target_id, action):
    if role == "student":
        if action == "warn":
            warn_student(target_id, 1); return "Student warned."
        if action == "suspend_next":
            execute("UPDATE students SET suspended_until_semester=? WHERE id=?", (current_semester()+1, target_id)); return "Student suspended next semester."
        if action == "terminate_or_fire":
            execute("UPDATE students SET terminated=1 WHERE id=?", (target_id,)); return "Student terminated."
        if action == "mark_fine_paid":
            execute("UPDATE students SET fine_paid=1 WHERE id=?", (target_id,)); return "Fine marked as paid."
    elif role == "instructor":
        if action == "warn":
            warn_instructor(target_id, 1); return "Instructor warned."
        if action == "suspend_next":
            execute("UPDATE instructors SET suspended_until_semester=? WHERE id=?", (current_semester()+1, target_id)); return "Instructor suspended next semester."
        if action == "terminate_or_fire":
            execute("UPDATE instructors SET fired=1 WHERE id=?", (target_id,)); return "Instructor fired."
    raise ValueError("Invalid registrar action for that role.")


def checklist_summary():
    return """FRONTEND COVERAGE
✓ One colorful Tkinter GUI window with tabs, not constant pop-ups.
✓ Public homepage: intro, highest/lowest rated classes, top GPA students, class info, public student info.
✓ Login with username/student ID, password, error handling, and first-login password reset.
✓ Visitor student/instructor application forms and AI question box.
✓ Student dashboard: profile, tutorial, records, courses, waitlist status, registration, reviews, complaints, graduation, warnings, suspension, honor roll, AI tab.
✓ Instructor dashboard: profile, assigned classes, roster/academic records, waitlist approval, grades, complaints, warning/suspension, AI tab.
✓ Registrar dashboard: all users/students, applications, approval/rejection with justification, period controls, class setup, taboo words, complaints, warning/suspension/firing controls, graduation applications, GPA review, AI tab.
✓ Registration UI shows classes, times, instructors, seats, waitlist, conflict/full-course messages.
✓ Review UI supports 1–5 stars, taboo censoring, hidden reviews, average ratings.
✓ AI UI searches local College0 data first and warns on fallback.

BACKEND COVERAGE
✓ SQLite models for users, students, instructors, applications, courses/classes, semester settings, registrations, waitlist, grades, reviews, warnings via counters, complaints, taboo words, graduation applications, and local AI knowledge.
✓ Authentication, role-based permissions, temporary password changes, unique student IDs.
✓ Application rules: GPA > 3.0 plus quota, justification required when registrar breaks student rule.
✓ Semester period rules: setup, registration, running, special_registration, grading.
✓ Course creation, instructor assignment, class time/size, cancellation, waitlists, suspensions.
✓ Registration checks for matriculation, period, 2–4 load warnings, time conflicts, capacity, waitlist, F retake rule.
✓ Review rules: enrolled only, no review after grade, taboo warnings/censoring/hiding, low rating instructor warning.
✓ Grading/GPA rules: instructor-only grading, GPA calculation, low/high class GPA review, student termination/warnings/honor roll.
✓ Complaint processing with registrar actions.
✓ AI backend with local information store and role-limited knowledge.

CREATIVE FEATURE
✓ Degree Progress / Risk Dashboard: shows required course completion, GPA, warnings, honor roll, and risk status.
"""


def _require_text(value, field):
    if value is None or not str(value).strip():
        raise ValueError(f"{field} is required.")
    return str(value).strip()


def create_student_account(name, email, incoming_gpa=0, username="", password=""):
    """Create and store a student login account immediately for demo use."""
    name = _require_text(name, "Name")
    email = _require_text(email, "Email")
    username = _require_text(username, "Username")
    password = _require_text(password, "Password")
    if len(password) < 4:
        raise ValueError("Password must be at least 4 characters.")
    if one("SELECT id FROM users WHERE username=?", (username,)):
        raise ValueError("That username already exists.")
    code = next_student_code()
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO users(username,password,role,must_change_password) VALUES(?,?,?,0)",
            (username, password, "student"),
        )
        user_id = cur.lastrowid
        conn.execute(
            "INSERT INTO students(user_id,student_code,name,email,gpa) VALUES(?,?,?,?,?)",
            (user_id, code, name, email, float(incoming_gpa or 0)),
        )
    return f"Student account stored. Login username: {username}. Student ID: {code}."


def create_instructor_account(name, email, username="", password=""):
    """Create and store an instructor login account immediately for demo use."""
    name = _require_text(name, "Name")
    email = _require_text(email, "Email")
    username = _require_text(username, "Username")
    password = _require_text(password, "Password")
    if len(password) < 4:
        raise ValueError("Password must be at least 4 characters.")
    if one("SELECT id FROM users WHERE username=?", (username,)):
        raise ValueError("That username already exists.")
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO users(username,password,role,must_change_password) VALUES(?,?,?,0)",
            (username, password, "instructor"),
        )
        user_id = cur.lastrowid
        conn.execute("INSERT INTO instructors(user_id,name,email) VALUES(?,?,?)", (user_id, name, email))
    return f"Instructor account stored. Login username: {username}."

def registrar_approve_graduation(app_id, approve, note=""):
    app = one("SELECT * FROM graduation_applications WHERE id=?", (app_id,))
    if not app:
        raise ValueError("Graduation application not found.")
    if app["status"] != "pending":
        raise ValueError("This application has already been processed.")
    if approve:
        status = "approved"
        msg = note.strip() or "Approved by registrar."
        # deactivate the student account
        student = one("SELECT user_id FROM students WHERE id=?", (app["student_id"],))
        if student:
            execute("UPDATE users SET active=0 WHERE id=?", (student["user_id"],))
    else:
        if not note.strip():
            raise ValueError("A note is required when rejecting a graduation application.")
        status = "rejected"
        msg = note.strip()
    execute("UPDATE graduation_applications SET status=?, note=? WHERE id=?", (status, msg, app_id))