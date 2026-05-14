import { useState, useEffect } from 'react';
import { useAuth } from './auth.jsx';
import Navbar from './components/Navbar.jsx';
import InactivityWarning from './components/InactivityWarning.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Login from './pages/Login.jsx';
import Apply from './pages/Apply.jsx';

// Registrar pages
import RegistrarHome from './pages/registrar/RegistrarHome.jsx';
import Applications from './pages/registrar/Applications.jsx';
import SemesterControl from './pages/registrar/SemesterControl.jsx';
import ClassSetup from './pages/registrar/ClassSetup.jsx';
import RegistrarComplaints from './pages/registrar/RegistrarComplaints.jsx';
import TabooWords from './pages/registrar/TabooWords.jsx';
import GradeReview from './pages/registrar/GradeReview.jsx';

// Instructor pages
import InstructorHome from './pages/instructor/InstructorHome.jsx';
import MyClasses from './pages/instructor/MyClasses.jsx';
import Grades from './pages/instructor/Grades.jsx';
import InstructorComplaints from './pages/instructor/InstructorComplaints.jsx';

// Student pages
import StudentHome from './pages/student/StudentHome.jsx';
import CourseRegistration from './pages/student/CourseRegistration.jsx';
import MyReviews from './pages/student/MyReviews.jsx';
import StudentComplaints from './pages/student/StudentComplaints.jsx';
import Graduation from './pages/student/Graduation.jsx';

const styles = {
  app: { display: 'flex', flexDirection: 'column', minHeight: '100vh' },
  main: { flex: 1, padding: '2rem', maxWidth: '1100px', margin: '0 auto', width: '100%' },
};

// Helper function to get default home page based on role
const getDefaultHomePage = (role) => {
  switch (role) {
    case 'registrar':
      return 'home';
    case 'instructor':
      return 'home';
    case 'student':
      return 'home';
    default:
      return 'dashboard';
  }
};

export default function App() {
  const { currentUser, loading } = useAuth();
  const [page, setPage] = useState('dashboard');
  const navigate = (p) => setPage(p);

  // Redirect to role-specific home page when user logs in
  useEffect(() => {
    if (currentUser && page === 'dashboard') {
      // If user is on public dashboard and just logged in, redirect to their home
      const defaultPage = getDefaultHomePage(currentUser.role);
      setPage(defaultPage);
    }
  }, [currentUser, page]);

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'var(--bg)'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid var(--border)',
          borderTopColor: 'var(--accent)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  const renderPage = () => {
    // If not logged in, show public pages
    if (!currentUser) {
      if (page === 'dashboard') return <Dashboard navigate={navigate} />;
      if (page === 'login') return <Login navigate={navigate} />;
      if (page === 'apply') return <Apply navigate={navigate} />;
      return <Dashboard navigate={navigate} />;
    }

    // Logged in users - show role-specific pages
    // Registrar
    if (currentUser.role === 'registrar') {
      if (page === 'home') return <RegistrarHome navigate={navigate} />;
      if (page === 'applications') return <Applications navigate={navigate} />;
      if (page === 'semester') return <SemesterControl navigate={navigate} />;
      if (page === 'classes') return <ClassSetup navigate={navigate} />;
      if (page === 'complaints') return <RegistrarComplaints navigate={navigate} />;
      if (page === 'taboo') return <TabooWords navigate={navigate} />;
      if (page === 'grades') return <GradeReview navigate={navigate} />;
      return <RegistrarHome navigate={navigate} />;
    }

    // Instructor
    if (currentUser.role === 'instructor') {
      if (page === 'home') return <InstructorHome navigate={navigate} />;
      if (page === 'myclasses') return <MyClasses navigate={navigate} />;
      if (page === 'grades') return <Grades navigate={navigate} />;
      if (page === 'complaints') return <InstructorComplaints navigate={navigate} />;
      return <InstructorHome navigate={navigate} />;
    }

    // Student
    if (currentUser.role === 'student') {
      if (page === 'home') return <StudentHome navigate={navigate} />;
      if (page === 'register') return <CourseRegistration navigate={navigate} />;
      if (page === 'reviews') return <MyReviews navigate={navigate} />;
      if (page === 'complaints') return <StudentComplaints navigate={navigate} />;
      if (page === 'graduation') return <Graduation navigate={navigate} />;
      return <StudentHome navigate={navigate} />;
    }

    return <Dashboard navigate={navigate} />;
  };

  return (
    <div style={styles.app}>
      <Navbar navigate={navigate} currentPage={page} />
      <main style={styles.main}>
        {renderPage()}
      </main>
      <footer style={{ textAlign: 'center', padding: '1rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: '11px', borderTop: '1px solid var(--border)' }}>
        CunyZero © {new Date().getFullYear()} — AI-Enabled College Management System
      </footer>

      {/* Inactivity Warning - only shows when user is logged in */}
      {currentUser && <InactivityWarning />}
    </div>
  );
}