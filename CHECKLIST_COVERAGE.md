## Checklist Coverage

### Frontend

- ✅ React-based single-page application with modern UI
- ✅ Colorful header, sidebar, cards, buttons, and tables (CSS variables + styled components)
- ✅ Visitor access is restricted to the homepage only
- ✅ Information loads on demand via sidebar navigation and homepage buttons
- ✅ Public homepage includes buttons for:
  - Highest-rated classes
  - Lowest-rated classes
  - Highest-GPA students
  - Public class information
  - Public student information
  - Make account / apply form
- ✅ Login form in the navbar
- ✅ First-login password change for registrar-approved accounts
- ✅ Student pages: Dashboard, Registration, Reviews, Complaints, Graduation, AI Chat
- ✅ Instructor pages: My Classes, Rosters, Grading, Complaints, AI Chat
- ✅ Registrar pages: Users, Applications, Semester Controls, Class Setup, Reviews/Taboo, Complaints, Graduation, Grade Review, AI Chat

### Backend

- ✅ SQLite stores all data (users, students, instructors, courses, classes, enrollments, reviews, taboo words, complaints, applications, settings, knowledge base)
- ✅ Login/authentication with username/password validation
- ✅ Role-based navigation and page restrictions
- ✅ Visitor limited to homepage only
- ✅ Direct account creation and applications stored in database
- ✅ Registrar approves/rejects applications, creates accounts with temporary passwords
- ✅ Semester period control (setup, registration, running, grading)
- ✅ Course registration with period checks, time conflicts, capacity, waitlist, retake rules
- ✅ Reviews with taboo word filtering, censorship, warnings, and class average tracking
- ✅ Grade posting with GPA recalculation and academic standing rules
- ✅ Complaint storage and registrar resolution
- ✅ Graduation application with course completion checks
- ✅ AI assistant with local knowledge retrieval + LLM fallback with warning

### Full-Stack Integration

- ✅ React frontend communicates with FastAPI backend via REST API
- ✅ All changes persist in SQLite database
- ✅ Seeded database with demo data for immediate testing
- ✅ AI assistant uses backend API with role-based context
