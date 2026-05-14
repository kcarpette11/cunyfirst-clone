import { useState, useEffect } from 'react';
import { useAuth } from '../../auth.jsx';
import { PageTitle, Card, Btn, Tag, Alert, SectionTitle, Stars, Table } from '../../components/UI.jsx';

const API_BASE = 'http://localhost:8000';

export default function CourseRegistration({ navigate }) {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [enrolled, setEnrolled] = useState([]);
  const [waitlisted, setWaitlisted] = useState([]);
  const [availableClasses, setAvailableClasses] = useState([]);
  const [currentPeriod, setCurrentPeriod] = useState('');
  const [semesterNumber, setSemesterNumber] = useState(1);
  const [msg, setMsg] = useState({ text: '', type: 'info' });
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch all data from backend
  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch current period and semester
      const periodRes = await fetch(`${API_BASE}/api/semester/period`);
      const periodData = await periodRes.json();
      setCurrentPeriod(periodData.period);
      setSemesterNumber(periodData.semester || 1);

      // Fetch available classes
      const classesRes = await fetch(`${API_BASE}/api/classes?semester=${periodData.semester || 1}`);
      const classesData = await classesRes.json();
      setAvailableClasses(classesData.classes || []);

      // Fetch student's enrollments
      if (currentUser) {
        const enrollRes = await fetch(`${API_BASE}/api/student/${currentUser.id}/enrollments`);
        const enrollData = await enrollRes.json();

        setEnrolled(enrollData.enrolled || []);
        setWaitlisted(enrollData.waitlisted || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      setMsg({ text: 'Failed to connect to server', type: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser, refreshTrigger]);

  const canRegister = currentPeriod === 'registration' ||
    (currentPeriod === 'running' && currentUser && !currentUser.suspended);

  const enroll = async (classId) => {
    try {
      const response = await fetch(`${API_BASE}/api/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: currentUser.id,
          classId: classId,
          semester: semesterNumber
        })
      });

      const result = await response.json();

      setMsg({
        text: result.message,
        type: result.success ? (result.waitlist ? 'warn' : 'success') : 'danger'
      });

      if (result.success) {
        // Refresh data
        setRefreshTrigger(prev => prev + 1);
      }

      setTimeout(() => setMsg({ text: '', type: 'info' }), 3000);
    } catch (error) {
      setMsg({ text: 'Failed to enroll. Please try again.', type: 'danger' });
      setTimeout(() => setMsg({ text: '', type: 'info' }), 3000);
    }
  };

  const drop = async (enrollmentId, code) => {
    try {
      const response = await fetch(`${API_BASE}/api/enrollment/drop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollmentId })
      });

      const result = await response.json();

      if (result.success) {
        setMsg({ text: `Dropped ${code}.`, type: 'info' });
        setRefreshTrigger(prev => prev + 1);
      } else {
        setMsg({ text: result.message || 'Failed to drop course', type: 'danger' });
      }

      setTimeout(() => setMsg({ text: '', type: 'info' }), 2000);
    } catch (error) {
      setMsg({ text: 'Failed to drop course', type: 'danger' });
      setTimeout(() => setMsg({ text: '', type: 'info' }), 2000);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <PageTitle sub={`Period: ${currentPeriod} · Enrolled: ${enrolled.length}/4`}>
        Course Registration
      </PageTitle>

      {!canRegister && (
        <Alert type="warn">
          Registration is not currently open. Current period: <strong>{currentPeriod}</strong>.
        </Alert>
      )}
      {currentUser?.suspended && (
        <Alert type="danger">Your account is suspended. You cannot register for courses.</Alert>
      )}
      {msg.text && <Alert type={msg.type}>{msg.text}</Alert>}

      {/* My Enrollments */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <SectionTitle>My Enrollments ({enrolled.length}/4)</SectionTitle>
        {enrolled.length === 0 && (
          <p style={{ color: 'var(--muted)', fontSize: '13px' }}>
            Not enrolled in any courses.
          </p>
        )}
        {enrolled.length > 0 && (
          <Table
            headers={['Code', 'Course', 'Time', 'Instructor', 'Action']}
            rows={enrolled.map(e => [
              e.code,
              e.name,
              e.class_time,
              e.instructor_name || '?',
              canRegister ? (
                <Btn key="d" variant="danger" onClick={() => drop(e.enrollmentId, e.code)}>
                  Drop
                </Btn>
              ) : '—'
            ])}
          />
        )}

        {waitlisted.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--muted)',
              marginBottom: '0.5rem',
              textTransform: 'uppercase'
            }}>
              Waitlisted
            </div>
            {waitlisted.map(e => (
              <div key={e.enrollmentId} style={{
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'center',
                marginBottom: '0.3rem'
              }}>
                <Tag color="var(--warn)">Waitlist</Tag>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                  {e.code} — {e.name}
                </span>
                <Btn
                  onClick={() => drop(e.enrollmentId, e.code)}
                  style={{ fontSize: '11px', padding: '0.2rem 0.5rem' }}
                >
                  Remove
                </Btn>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Available Classes */}
      <SectionTitle>Available Classes</SectionTitle>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '1rem'
      }}>
        {availableClasses.map(cls => {
          const alreadyEnrolled = enrolled.some(e => e.classId === cls.id);
          const onWaitlist = waitlisted.some(e => e.classId === cls.id);
          const isFull = cls.enrolledCount >= cls.capacity;
          const avgRating = cls.avgRating;

          return (
            <div key={cls.id} style={{
              background: 'var(--surface)',
              border: `1px solid ${alreadyEnrolled ? 'var(--success)' : onWaitlist ? 'var(--warn)' : 'var(--border)'}`,
              borderRadius: '8px',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)' }}>
                  {cls.code}
                </div>
                {cls.required && <Tag color="var(--accent2)">Required</Tag>}
              </div>
              <div style={{ fontWeight: 600 }}>{cls.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{cls.class_time}</div>
              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                Instructor: {cls.instructorName}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: isFull ? 'var(--danger)' : 'var(--success)'
                }}>
                  {cls.enrolledCount || 0}/{cls.capacity} {isFull ? '(Full)' : 'spots'}
                </span>
                {avgRating !== null && avgRating > 0 && (
                  <Stars value={Math.round(avgRating)} />
                )}
              </div>
              <div style={{ marginTop: 'auto' }}>
                {alreadyEnrolled ? (
                  <Tag color="var(--success)">✓ Enrolled</Tag>
                ) : onWaitlist ? (
                  <Tag color="var(--warn)">On Waitlist</Tag>
                ) : (
                  <Btn
                    variant={isFull ? 'default' : 'primary'}
                    onClick={() => enroll(cls.id)}
                    disabled={!canRegister || currentUser?.suspended || enrolled.length >= 4}
                    style={{ width: '100%' }}
                  >
                    {isFull ? 'Join Waitlist' : 'Enroll'}
                  </Btn>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}