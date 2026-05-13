import { useState, useEffect } from 'react';
import { useAuth } from '../../auth.jsx';
import { PageTitle, Card, Grid, SectionTitle, Tag, Btn, Alert, Table } from '../../components/UI.jsx';
import AIChat from '../../components/AIChat.jsx';

const API_BASE = 'http://localhost:8000';

const TUTORIAL_STEPS = [
  { icon: '📋', title: 'Register for Courses', desc: 'During registration period, go to "Register" to enroll in 2–4 courses. Check for time conflicts!' },
  { icon: '📚', title: 'Attend Classes', desc: 'Once the running period begins, attend your classes. You cannot register for new courses (unless yours is cancelled).' },
  { icon: '⭐', title: 'Write Reviews', desc: 'Rate and review your classes (1–5 stars) during the running period. Reviews are anonymous to everyone except the registrar.' },
  { icon: '🎓', title: 'Graduate', desc: 'After completing 8 courses, apply for graduation. The registrar will verify your required courses.' },
  { icon: '⚠️', title: 'Warnings', desc: 'Avoid warnings! 3 warnings = 1 semester suspension + fine. Honor roll credits can remove warnings.' },
];

export default function StudentHome({ navigate }) {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [studentData, setStudentData] = useState({
    overallGPA: null,
    semesterGPA: null,
    completedCourses: 0,
    warnings: 0,
    honorCount: 0,
    onHonorRoll: false,
    isTerminated: false,
    isGraduated: false,
    isSuspended: false,
    pendingInterview: false,
    currentEnrollments: [],
    academicHistory: [],
    currentPeriod: '',
    semesterNumber: 1
  });
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [honorMsg, setHonorMsg] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch all student data from backend
  const fetchStudentData = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);

      // Get current period and semester
      const periodRes = await fetch(`${API_BASE}/api/semester/period`);
      const periodData = await periodRes.json();

      // Get student dashboard data
      const dashboardRes = await fetch(`${API_BASE}/api/student/${currentUser.id}/dashboard`);
      const dashboardData = await dashboardRes.json();

      // Get current enrollments
      const enrollRes = await fetch(`${API_BASE}/api/student/${currentUser.id}/current-enrollments`);
      const enrollData = await enrollRes.json();

      // Get academic history
      const historyRes = await fetch(`${API_BASE}/api/student/${currentUser.id}/academic-history`);
      const historyData = await historyRes.json();

      setStudentData({
        overallGPA: dashboardData.overallGPA,
        semesterGPA: dashboardData.semesterGPA,
        completedCourses: dashboardData.completedCourses || 0,
        warnings: dashboardData.warnings || 0,
        honorCount: dashboardData.honorCount || 0,
        onHonorRoll: dashboardData.onHonorRoll || false,
        isTerminated: dashboardData.isTerminated || false,
        isGraduated: dashboardData.isGraduated || false,
        isSuspended: dashboardData.isSuspended || false,
        pendingInterview: dashboardData.pendingInterview || false,
        currentEnrollments: enrollData.enrollments || [],
        academicHistory: historyData.history || [],
        currentPeriod: periodData.period,
        semesterNumber: periodData.semester || 1
      });

      // Show tutorial for new students
      if (dashboardData.isNew && !localStorage.getItem('tutorial_shown')) {
        setShowTutorial(true);
        localStorage.setItem('tutorial_shown', 'true');
      }
    } catch (error) {
      console.error('Failed to fetch student data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentData();
  }, [currentUser, refreshTrigger]);

  const useHonor = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/student/use-honor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: currentUser.id })
      });

      const result = await response.json();

      if (result.success) {
        setHonorMsg(result.message || 'Warning removed using honor credit!');
        setRefreshTrigger(prev => prev + 1);
      } else {
        setHonorMsg(result.message || 'Failed to use honor credit');
      }

      setTimeout(() => setHonorMsg(''), 3000);
    } catch (error) {
      setHonorMsg('Failed to use honor credit');
      setTimeout(() => setHonorMsg(''), 3000);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div>Loading your dashboard...</div>
      </div>
    );
  }

  // Tutorial overlay
  if (showTutorial) {
    const step = TUTORIAL_STEPS[tutorialStep];
    return (
      <div style={{ maxWidth: '500px', margin: '4rem auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--accent)' }}>Welcome to College0!</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted)' }}>Quick orientation — step {tutorialStep + 1} of {TUTORIAL_STEPS.length}</div>
        </div>
        <Card style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{step.icon}</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', color: 'var(--accent)', marginBottom: '0.75rem' }}>{step.title}</h2>
          <p style={{ color: 'var(--muted)', lineHeight: 1.6, marginBottom: '1.5rem' }}>{step.desc}</p>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            {tutorialStep > 0 && <Btn onClick={() => setTutorialStep(s => s - 1)}>← Back</Btn>}
            {tutorialStep < TUTORIAL_STEPS.length - 1
              ? <Btn variant="primary" onClick={() => setTutorialStep(s => s + 1)}>Next →</Btn>
              : <Btn variant="primary" onClick={() => setShowTutorial(false)}>Get Started 🎓</Btn>
            }
          </div>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            {TUTORIAL_STEPS.map((_, i) => (
              <div key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: i === tutorialStep ? 'var(--accent)' : 'var(--border)', cursor: 'pointer' }} onClick={() => setTutorialStep(i)} />
            ))}
          </div>
        </Card>
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button style={{ background: 'none', border: 'none', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: '11px', cursor: 'pointer' }} onClick={() => setShowTutorial(false)}>
            Skip tutorial
          </button>
        </div>
      </div>
    );
  }

  const { overallGPA, semesterGPA, completedCourses, warnings, honorCount, onHonorRoll, isTerminated, isGraduated, isSuspended, pendingInterview, currentEnrollments, academicHistory, currentPeriod, semesterNumber } = studentData;

  return (
    <div>
      <PageTitle sub={`Student ID: ${currentUser.studentId}`}>{currentUser.name}</PageTitle>

      {isTerminated && !isGraduated && (
        <Alert type="danger">⛔ Your enrollment has been terminated. Contact the registrar.</Alert>
      )}
      {isGraduated && (
        <Alert type="success">🎓 Congratulations! You have graduated from CunyZero with a Bachelor's degree!</Alert>
      )}
      {isSuspended && (
        <Alert type="warn">⚠️ Your account is suspended for this semester. You may not register for courses.</Alert>
      )}
      {pendingInterview && (
        <Alert type="warn">📋 Your GPA is between 2.0–2.25. You must schedule an interview with the registrar.</Alert>
      )}
      {honorMsg && <Alert type="success">{honorMsg}</Alert>}

      <Grid cols={4}>
        {[
          { label: 'Overall GPA', value: overallGPA !== null ? overallGPA.toFixed(2) : '—', color: overallGPA >= 3.5 ? 'var(--success)' : overallGPA >= 2.0 ? 'var(--accent)' : 'var(--danger)' },
          { label: 'Semester GPA', value: semesterGPA !== null ? semesterGPA.toFixed(2) : '—', color: 'var(--accent2)' },
          { label: 'Courses Done', value: `${completedCourses}/8`, color: 'var(--muted)' },
          { label: 'Warnings', value: warnings, color: warnings > 0 ? 'var(--warn)' : 'var(--success)' },
        ].map(s => (
          <Card key={s.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontFamily: 'var(--font-mono)', color: s.color, fontWeight: 700 }}>{s.value}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase' }}>{s.label}</div>
          </Card>
        ))}
      </Grid>

      {/* Honor Roll & Warnings */}
      {(onHonorRoll || honorCount > 0) && (
        <Card style={{ marginTop: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <Tag color="var(--accent)">🏅 Honor Roll</Tag>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--muted)', marginLeft: '0.5rem' }}>{honorCount} honor credit(s) available</span>
          </div>
          {warnings > 0 && honorCount > 0 && (
            <Btn variant="ghost" onClick={useHonor}>Use Honor Credit to Remove Warning</Btn>
          )}
        </Card>
      )}

      {/* Current Courses */}
      <Card style={{ marginTop: '1.5rem' }}>
        <SectionTitle>Current Courses — Semester {semesterNumber}</SectionTitle>
        {currentEnrollments.length === 0 ? (
          <div>
            <p style={{ color: 'var(--muted)', marginBottom: '1rem' }}>You are not enrolled in any courses this semester.</p>
            {(currentPeriod === 'registration' || currentPeriod === 'running') && (
              <Btn variant="primary" onClick={() => navigate('register')}>Register for Courses →</Btn>
            )}
          </div>
        ) : (
          <Table
            headers={['Code', 'Course', 'Time', 'Instructor', 'Grade']}
            rows={currentEnrollments.map(e => [
              e.code || '?',
              e.name || '?',
              e.class_time || '?',
              e.instructorName || '?',
              e.grade ? <Tag key="g" color={e.grade === 'F' ? 'var(--danger)' : 'var(--success)'}>{e.grade}</Tag> : <Tag key="g" color="var(--muted)">In Progress</Tag>
            ])}
          />
        )}
      </Card>

      {/* Academic History */}
      <Card style={{ marginTop: '1.5rem' }}>
        <SectionTitle>Academic History</SectionTitle>
        <Table
          headers={['Semester', 'Code', 'Course', 'Grade', 'Points']}
          rows={academicHistory.map(e => [
            `Sem ${e.semester}`,
            e.code || '?',
            e.name || '?',
            <Tag key="g" color={e.grade === 'F' ? 'var(--danger)' : e.grade === 'A' ? 'var(--success)' : 'var(--muted)'}>{e.grade}</Tag>,
            e.points?.toFixed(1) || '?'
          ])}
          emptyMsg="No completed courses yet."
        />
      </Card>

      <AIChat />
    </div>
  );
}