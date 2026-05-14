PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('registrar','instructor','student')),
    must_change_password INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE,
    student_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    gpa REAL DEFAULT 0,
    semester_gpa REAL DEFAULT 0,
    warnings INTEGER DEFAULT 0,
    suspended_until_semester INTEGER DEFAULT 0,
    terminated INTEGER DEFAULT 0,
    honor_roll INTEGER DEFAULT 0,
    completed_classes INTEGER DEFAULT 0,
    fine_paid INTEGER DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS instructors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE,
    name TEXT NOT NULL,
    email TEXT,
    warnings INTEGER DEFAULT 0,
    suspended_until_semester INTEGER DEFAULT 0,
    fired INTEGER DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id)
);

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
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    required INTEGER DEFAULT 0,
    description TEXT
);

CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL,
    instructor_id INTEGER,
    semester INTEGER NOT NULL,
    class_time TEXT NOT NULL,
    capacity INTEGER NOT NULL,
    cancelled INTEGER DEFAULT 0,
    avg_rating REAL DEFAULT 0,
    FOREIGN KEY(course_id) REFERENCES courses(id),
    FOREIGN KEY(instructor_id) REFERENCES instructors(id)
);

CREATE TABLE IF NOT EXISTS enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    class_id INTEGER NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('registered','waitlisted','completed','dropped')),
    grade TEXT,
    UNIQUE(student_id, class_id),
    FOREIGN KEY(student_id) REFERENCES students(id),
    FOREIGN KEY(class_id) REFERENCES classes(id)
);

CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    class_id INTEGER NOT NULL,
    stars INTEGER NOT NULL CHECK(stars BETWEEN 1 AND 5),
    text TEXT NOT NULL,
    shown INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(student_id) REFERENCES students(id),
    FOREIGN KEY(class_id) REFERENCES classes(id)
);

CREATE TABLE IF NOT EXISTS complaints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    complainant_role TEXT NOT NULL,
    complainant_id INTEGER NOT NULL,
    target_role TEXT NOT NULL,
    target_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    action TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS taboo_words (
    word TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS knowledge (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    audience TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL
);


CREATE TABLE IF NOT EXISTS graduation_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
    note TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(student_id) REFERENCES students(id)
);
