import { useState, useEffect } from 'react';
import { useAuth } from '../../auth.jsx';
import { PageTitle, Card, Grid, SectionTitle, Tag, Table, Stars } from '../../components/UI.jsx';
import AIChat from '../../components/AIChat.jsx';

const API_BASE = 'http://localhost:8000';

export default function InstructorHome({ navigate }) {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [myClasses, setMyClasses] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const fetchInstructorData = async () => {
      if (!currentUser) return;

      try {
        setLoading(true);
        const response = await fetch(`${API_BASE}/api/instructor/${currentUser.id}/classes`);
        const data = await response.json();
        setMyClasses(data.classes || []);
      } catch (error) {
        console.error('Failed to fetch instructor data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInstructorData();
  }, [currentUser, refreshTrigger]);

  // Calculate totals from the actual data
  const totalClasses = myClasses.length;
  const totalStudents = myClasses.reduce((sum, cls) => sum + (cls.students?.length || 0), 0);
  const totalWarnings = currentUser?.warnings || 0;

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div>Loading dashboard...</div>
      </div>
    );
  }

  if (!currentUser) return null;

  return (
    <div>
      <PageTitle sub={`Welcome back, ${currentUser.name || currentUser.username}`}>Instructor Dashboard</PageTitle>

      {currentUser.suspended && (
        <div style={{ background: 'var(--danger)18', border: '1px solid var(--danger)', borderRadius: '6px', padding: '1rem', marginBottom: '1rem' }}>
          ⛔ Your account is suspended. Contact the registrar.
        </div>
      )}

      <Grid cols={3}>
        <Card style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 700 }}>{totalClasses}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase' }}>CLASSES</div>
        </Card>
        <Card style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontFamily: 'var(--font-mono)', color: 'var(--success)', fontWeight: 700 }}>{totalStudents}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase' }}>STUDENTS</div>
        </Card>
        <Card style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontFamily: 'var(--font-mono)', color: totalWarnings > 0 ? 'var(--warn)' : 'var(--muted)', fontWeight: 700 }}>{totalWarnings}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase' }}>WARNINGS</div>
        </Card>
      </Grid>

      {myClasses.length === 0 && (
        <Card style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--muted)' }}>No classes assigned to you for this semester.</p>
        </Card>
      )}

      {myClasses.map(cls => {
        const students = cls.students || [];
        const enrolledCount = students.length;
        const capacity = cls.capacity || 0;
        const avgRating = cls.avg_rating;

        return (
          <Card key={cls.id} style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)' }}>{cls.code}</span>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 600 }}>{cls.name}</h3>
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{cls.class_time} · {enrolledCount}/{capacity} students</div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {cls.cancelled && <Tag color="var(--danger)">Cancelled</Tag>}
                {avgRating !== null && avgRating > 0 && (
                  <div style={{ textAlign: 'right' }}>
                    <Stars value={Math.round(avgRating)} />
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: avgRating < 2 ? 'var(--danger)' : 'var(--muted)' }}>{avgRating.toFixed(1)} avg</div>
                  </div>
                )}
              </div>
            </div>

            {/* Student List */}
            <Table
              headers={['Student', 'ID', 'Overall GPA', 'Grade']}
              rows={students.map(s => [
                s.name || '?',
                s.student_code || '?',
                s.gpa !== null ? s.gpa.toFixed(2) : '—',
                s.grade || <Tag key="g" color="var(--muted)">Pending</Tag>
              ])}
              emptyMsg="No students enrolled in this class."
            />
          </Card>
        );
      })}

      <AIChat />
    </div>
  );
}