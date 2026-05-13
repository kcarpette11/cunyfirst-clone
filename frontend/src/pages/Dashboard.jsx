import { useState, useEffect } from 'react';
import { Card, PageTitle, SectionTitle, Stars, Grid, Tag, Btn } from '../components/UI.jsx';
import AIChat from '../components/AIChat.jsx';

const API_BASE = 'http://localhost:8000';

export default function Dashboard({ navigate }) {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState({
    topRated: [],
    lowRated: [],
    topStudents: [],
    classes: [],
    currentPeriod: 'registration',
    semesterNumber: 1,
    periodLabels: { setup: 'Class Set-Up', registration: 'Course Registration', running: 'Class Running', grading: 'Grading', closed: 'Semester Closed' },
  });

  // Fetch all dashboard data from backend
  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Get current period and semester
      const periodRes = await fetch(`${API_BASE}/api/semester/period`);
      const periodData = await periodRes.json();

      // Get top rated classes
      const topRatedRes = await fetch(`${API_BASE}/api/classes/top-rated?limit=3`);
      const topRatedData = await topRatedRes.json();

      // Get lowest rated classes
      const lowRatedRes = await fetch(`${API_BASE}/api/classes/lowest-rated?limit=3`);
      const lowRatedData = await lowRatedRes.json();

      // Get top GPA students
      const topStudentsRes = await fetch(`${API_BASE}/api/students/top-gpa?limit=3`);
      const topStudentsData = await topStudentsRes.json();

      // Get all classes for current semester
      const classesRes = await fetch(`${API_BASE}/api/classes?semester=${periodData.semester || 1}`);
      const classesData = await classesRes.json();

      setDashboardData({
        topRated: topRatedData.classes || [],
        lowRated: lowRatedData.classes || [],
        topStudents: topStudentsData.students || [],
        classes: classesData.classes || [],
        currentPeriod: periodData.period || 'registration',
        semesterNumber: periodData.semester || 1,
        periodLabels: {
          setup: 'Class Set-Up',
          registration: 'Course Registration',
          running: 'Class Running',
          grading: 'Grading',
          closed: 'Semester Closed'
        },
      });
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const periodLabels = dashboardData.periodLabels;
  const periodColors = {
    setup: 'var(--accent2)',
    registration: 'var(--success)',
    running: 'var(--accent)',
    grading: 'var(--warn)',
    closed: 'var(--muted)'
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div>Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, var(--surface) 0%, var(--surface2) 100%)',
        border: '1px solid var(--border)', borderRadius: '12px',
        padding: '3rem 2rem', marginBottom: '2rem', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: '300px', height: '300px', background: 'var(--accent)', opacity: 0.04, borderRadius: '50%', transform: 'translate(100px, -100px)' }} />
        <div style={{ position: 'absolute', bottom: 0, left: '40%', width: '200px', height: '200px', background: 'var(--accent2)', opacity: 0.05, borderRadius: '50%', transform: 'translateY(50%)' }} />
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>WELCOME TO</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '3.5rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
          College<span style={{ color: 'var(--accent)' }}>0</span>
        </h1>
        <p style={{ color: 'var(--muted)', marginTop: '1rem', maxWidth: '500px', lineHeight: 1.6, fontSize: '14px' }}>
          An AI-enabled graduate college management system. Manage courses, track academic progress, and connect with an intelligent assistant — all in one place.
        </p>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
          <Btn variant="primary" onClick={() => navigate('login')}>Student / Faculty Login</Btn>
          <Btn variant="ghost" onClick={() => navigate('apply')}>Apply to CunyZero</Btn>
        </div>
        <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Tag color={periodColors[dashboardData.currentPeriod]}>Semester {dashboardData.semesterNumber}</Tag>
          <Tag color={periodColors[dashboardData.currentPeriod]}>{periodLabels[dashboardData.currentPeriod]} Period</Tag>
        </div>
      </div>

      <Grid cols={3}>
        {/* Top Rated */}
        <Card>
          <SectionTitle>⭐ Highest Rated Classes</SectionTitle>
          {dashboardData.topRated.length === 0 && <p style={{ color: 'var(--muted)', fontSize: '13px' }}>No ratings yet.</p>}
          {dashboardData.topRated.map(cls => (
            <div key={cls.id} style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)' }}>{cls.code}</div>
              <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{cls.name}</div>
              <Stars value={Math.round(cls.avg_rating || 0)} />
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted)' }}>{(cls.avg_rating || 0).toFixed(1)} / 5.0</div>
            </div>
          ))}
        </Card>

        {/* Lowest Rated */}
        <Card>
          <SectionTitle>📉 Lowest Rated Classes</SectionTitle>
          {dashboardData.lowRated.length === 0 && <p style={{ color: 'var(--muted)', fontSize: '13px' }}>No ratings yet.</p>}
          {dashboardData.lowRated.filter(c => !dashboardData.topRated.find(t => t.id === c.id) || dashboardData.topRated.length < 3).map(cls => (
            <div key={cls.id} style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--danger)' }}>{cls.code}</div>
              <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{cls.name}</div>
              <Stars value={Math.round(cls.avg_rating || 0)} />
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted)' }}>{(cls.avg_rating || 0).toFixed(1)} / 5.0</div>
            </div>
          ))}
          {dashboardData.lowRated.length === 0 && dashboardData.topRated.length === 0 && <p style={{ color: 'var(--muted)', fontSize: '13px' }}>No ratings yet.</p>}
        </Card>

        {/* Top GPA */}
        <Card>
          <SectionTitle>🎓 Top GPA Students</SectionTitle>
          {dashboardData.topStudents.length === 0 && <p style={{ color: 'var(--muted)', fontSize: '13px' }}>No graded students yet.</p>}
          {dashboardData.topStudents.map((stu, i) => (
            <div key={stu.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: i === 0 ? 'var(--accent)' : i === 1 ? 'var(--accent2)' : 'var(--surface2)',
                color: i < 2 ? '#0a0a0f' : 'var(--text)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700,
              }}>{i + 1}</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>{stu.name}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)' }}>GPA {stu.gpa?.toFixed(2)}</div>
              </div>
              {stu.honor_roll && <Tag color="var(--accent)">Honor</Tag>}
            </div>
          ))}
        </Card>
      </Grid>

      {/* All Classes */}
      <Card style={{ marginTop: '1.5rem' }}>
        <SectionTitle>📚 Available Classes — Semester {dashboardData.semesterNumber}</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
          {dashboardData.classes.filter(c => c.semester === dashboardData.semesterNumber).map(cls => (
            <div key={cls.id} style={{
              background: 'var(--surface2)', border: `1px solid ${cls.cancelled ? 'var(--danger)' : 'var(--border)'}`,
              borderRadius: '6px', padding: '1rem',
            }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: cls.cancelled ? 'var(--danger)' : 'var(--accent)' }}>
                {cls.code} {cls.cancelled && '— CANCELLED'}
              </div>
              <div style={{ fontWeight: 600, marginBottom: '0.3rem' }}>{cls.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{cls.class_time}</div>
              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Instructor: {cls.instructor_name || 'TBD'}</div>
              {cls.avg_rating && <Stars value={Math.round(cls.avg_rating)} />}
            </div>
          ))}
        </div>
      </Card>

      <AIChat />
    </div>
  );
}