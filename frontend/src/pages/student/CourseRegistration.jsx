import { useState, useEffect } from 'react';
import { useAuth } from '../../auth.jsx';
import { PageTitle, Card, Btn, Tag, Alert, SectionTitle, Stars, Table } from '../../components/UI.jsx';

const API_BASE = 'http://localhost:8000';
const MAX_COURSES = 6;

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
  const [isProcessing, setIsProcessing] = useState(false);


  const fetchData = async () => {
    try {
      setLoading(true);
      console.log('Fetching data...');

      // Fetch current semester period and number
      const periodRes = await fetch(`${API_BASE}/api/semester/period`);
      const periodData = await periodRes.json();
      setCurrentPeriod(periodData.period);
      setSemesterNumber(periodData.semester || 1);

      // Fetch all classes available for this semester
      const classesRes = await fetch(`${API_BASE}/api/classes?semester=${periodData.semester || 1}`);
      const classesData = await classesRes.json();
      setAvailableClasses(classesData.classes || []);

      // Fetch the student's current enrollments and waitlist entries
      if (currentUser) {
        const studentId = currentUser.user_id || currentUser.id;
        console.log('Fetching enrollments for student:', studentId);

        const enrollRes = await fetch(`${API_BASE}/api/student/${studentId}/enrollments`);

        if (!enrollRes.ok) {
          console.error('Failed to fetch enrollments:', enrollRes.status);
          setEnrolled([]);
          setWaitlisted([]);
          return;
        }

        const enrollData = await enrollRes.json();
        console.log('Enrollment data received:', enrollData);
        console.log('Enrolled courses:', enrollData.enrolled);
        console.log('Waitlisted courses:', enrollData.waitlisted);
        console.log('RAW enrollment data:', JSON.stringify(enrollData, null, 2));
        console.log('Enrolled array:', enrollData.enrolled);
        console.log('First enrolled item structure:', enrollData.enrolled[0]);

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

  // ===== Derived State ================================================================

  // Registration is allowed during the registration period, or while running if not suspended
  const canRegister = currentPeriod === 'registration' ||
    (currentPeriod === 'running' && currentUser && !currentUser.suspended);

  // ===== Actions =================================================================

  const drop = async (enrollment_id, code) => {
    console.log('Dropping enrollment_id:', enrollment_id);
    if (isProcessing) return;
    setIsProcessing(true);

    console.log('Dropping enrollment:', enrollment_id);
    try {
      const response = await fetch(`${API_BASE}/api/enrollment/drop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollment_id })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Drop error response:', errorText);
        setMsg({
          text: `Failed to drop: ${response.status}`,
          type: 'danger'
        });
        setTimeout(() => setMsg({ text: '', type: 'info' }), 3000);
        return;
      }

      const result = await response.json();
      console.log('Drop result:', result);

      if (result && result.success) {
        setMsg({ text: `Dropped ${code}.`, type: 'info' });
        // Force a complete refresh by incrementing refreshTrigger
        setRefreshTrigger(prev => prev + 1);
      } else {
        setMsg({ text: result?.message || 'Failed to drop course', type: 'danger' });
      }

      setTimeout(() => setMsg({ text: '', type: 'info' }), 2000);
    } catch (error) {
      console.error('Drop error:', error);
      setMsg({ text: 'Failed to drop course', type: 'danger' });
      setTimeout(() => setMsg({ text: '', type: 'info' }), 2000);
    } finally {
      setIsProcessing(false);
    }
  };

  const enroll = async (classId) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      const studentId = currentUser.user_id || currentUser.id;

      const payload = {
        studentId: String(studentId),
        classId: String(classId),
        semester: semesterNumber
      };

      console.log('Enroll payload:', payload);

      const response = await fetch(`${API_BASE}/api/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      console.log('Response status:', response.status);

      // Parse error details from non-OK responses
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);

        let errorMessage = `Error ${response.status}`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.detail || errorData.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }

        setMsg({
          text: errorMessage,
          type: 'danger'
        });
        setTimeout(() => setMsg({ text: '', type: 'info' }), 3000);
        return;
      }

      const result = await response.json();
      console.log('Enroll result:', result);

      // Warn if placed on waitlist rather than directly enrolled
      if (result && result.success) {
        setMsg({
          text: result.message,
          type: result.waitlist ? 'warn' : 'success'
        });
        setRefreshTrigger(prev => prev + 1);
      } else {
        setMsg({
          text: result?.message || 'Enrollment failed',
          type: 'danger'
        });
      }

      setTimeout(() => setMsg({ text: '', type: 'info' }), 3000);
    } catch (error) {
      console.error('Enrollment error:', error);
      setMsg({ text: 'Network error. Please check if server is running.', type: 'danger' });
      setTimeout(() => setMsg({ text: '', type: 'info' }), 3000);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handles edge case where a non-registered enrollment record already exists —
  // drops it first, then re-enrolls cleanly after a short delay
  const fixStuckEnrollment = async (classId, className) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      const studentId = currentUser.user_id || currentUser.id;
      console.log(`Fixing enrollment for ${className}...`);

      const enrollRes = await fetch(`${API_BASE}/api/student/${studentId}/enrollments`);
      if (!enrollRes.ok) {
        console.error('Failed to fetch enrollments');
        await enroll(classId);
        return;
      }

      const data = await enrollRes.json();
      const allEnrollments = [...(data.enrolled || []), ...(data.waitlisted || [])];
      const existingEnrollment = allEnrollments.find(e => e.class_id === classId);

      if (existingEnrollment && existingEnrollment.status !== 'registered') {
        console.log(`Found ${existingEnrollment.status} enrollment, dropping it first...`);
        await drop(existingEnrollment.enrollment_id, className);
        // Wait a bit then enroll
        setTimeout(async () => {
          await enroll(classId);
        }, 1000);
      } else {
        await enroll(classId);
      }
    } catch (error) {
      console.error('Fix enrollment error:', error);
      setMsg({ text: 'Failed to fix enrollment', type: 'danger' });
      setTimeout(() => setMsg({ text: '', type: 'info' }), 3000);
    } finally {
      setIsProcessing(false);
    }
  };

  const manualRefresh = () => {
    console.log('Manual refresh triggered');
    setRefreshTrigger(prev => prev + 1);
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
      <PageTitle sub={`Period: ${currentPeriod} · Enrolled: ${enrolled.length}/${MAX_COURSES}`}>
        Course Registration
      </PageTitle>

      {/* Refresh button — top-right above all cards */}
      <div style={{ marginBottom: '1rem', textAlign: 'right', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <Btn variant="default" onClick={manualRefresh} disabled={isProcessing} style={{ fontSize: '12px' }}>
          🔄 Refresh
        </Btn>
      </div>

      {/* Global status alerts: registration window, suspension, action feedback */}
      {!canRegister && (
        <Alert type="warn">
          Registration is not currently open. Current period: <strong>{currentPeriod}</strong>.
        </Alert>
      )}
      {currentUser?.suspended && (
        <Alert type="danger">Your account is suspended. You cannot register for courses.</Alert>
      )}
      {msg.text && <Alert type={msg.type}>{msg.text}</Alert>}

      {/* ── My Enrollments Card ──────────────────────────────────────────────── */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <SectionTitle>My Enrollments ({enrolled.length}/{MAX_COURSES})</SectionTitle>

        {enrolled.length === 0 && (
          <p style={{ color: 'var(--muted)', fontSize: '13px' }}>
            Not enrolled in any courses.
          </p>
        )}

        {/* Active enrollments table with drop action */}
        {enrolled.length > 0 && (
          <Table
            headers={['Code', 'Course', 'Time', 'Instructor', 'Action']}
            rows={enrolled.map(e => [
              e.code,
              e.name,
              e.class_time,
              e.instructor_name || 'TBA',
              canRegister ? (
                <Btn key="d" variant="danger" onClick={() => drop(e.enrollment_id, e.code)} disabled={isProcessing}>
                  Drop
                </Btn>
              ) : '—'
            ])}
          />
        )}

        {/* Waitlisted courses — shown below the enrollments table when present */}
        {waitlisted.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--muted)',
              marginBottom: '0.5rem',
              textTransform: 'uppercase'
            }}>
              Waitlisted ({waitlisted.length})
            </div>
            {waitlisted.map(e => (
              <div key={e.enrollment_id} style={{
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
                  onClick={() => drop(e.enrollment_id, e.code)}
                  disabled={isProcessing}
                  style={{ fontSize: '11px', padding: '0.2rem 0.5rem' }}
                >
                  Remove
                </Btn>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Available Classes Grid ───────────────────────────────────────────── */}
      <SectionTitle>Available Classes</SectionTitle>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '1rem'
      }}>
        {availableClasses.map(cls => {
          // Per-card derived flags
          const alreadyEnrolled = enrolled.some(e => e.class_id === cls.id);
          const onWaitlist = waitlisted.some(e => e.class_id === cls.id);
          const isFull = (cls.enrolled_count || 0) >= cls.capacity;
          const avgRating = cls.avg_rating;
          const isAtMaxCourses = enrolled.length >= MAX_COURSES;

          return (
            <div key={cls.id} style={{
              background: 'var(--surface)',
              // Border color reflects enrollment state: enrolled → green, waitlist → yellow, default → border
              border: `1px solid ${alreadyEnrolled ? 'var(--success)' : onWaitlist ? 'var(--warn)' : 'var(--border)'}`,
              borderRadius: '8px',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}>
              {/* Course code + required badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)' }}>
                  {cls.code}
                </div>
                {cls.required && <Tag color="var(--accent2)">Required</Tag>}
              </div>

              {/* Course name, time, and instructor */}
              <div style={{ fontWeight: 600 }}>{cls.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{cls.class_time}</div>
              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                Instructor: {cls.instructor_name || 'TBA'}
              </div>

              {/* Capacity indicator and star rating */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: isFull ? 'var(--danger)' : 'var(--success)'
                }}>
                  {cls.enrolled_count || 0}/{cls.capacity} {isFull ? '(Full)' : 'spots'}
                </span>
                {avgRating !== null && avgRating > 0 && (
                  <Stars value={Math.round(avgRating)} />
                )}
              </div>

              {/* CTA: tag if already enrolled/waitlisted, enroll/waitlist button otherwise */}
              <div style={{ marginTop: 'auto' }}>
                {alreadyEnrolled ? (
                  <Tag color="var(--success)">✓ Enrolled</Tag>
                ) : onWaitlist ? (
                  <Tag color="var(--warn)">On Waitlist</Tag>
                ) : (
                  <Btn
                    variant={isFull ? 'default' : 'primary'}
                    onClick={() => fixStuckEnrollment(cls.id, cls.name)}
                    disabled={!canRegister || currentUser?.suspended || isAtMaxCourses || isProcessing}
                    style={{ width: '100%' }}
                  >
                    {isProcessing ? 'Processing...' : (isFull ? 'Join Waitlist' : 'Enroll')}
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