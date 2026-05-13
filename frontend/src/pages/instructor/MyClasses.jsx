import { useState, useEffect } from 'react';
import { useAuth } from '../../auth.jsx';
import { PageTitle, Card, Table, Btn, Tag, SectionTitle, Alert } from '../../components/UI.jsx';

const API_BASE = 'http://localhost:8000';

export default function MyClasses({ navigate }) {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [myClasses, setMyClasses] = useState([]);
  const [msg, setMsg] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch instructor's classes from backend
  const fetchClasses = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/instructor/${currentUser.id}/classes`);
      const data = await response.json();
      console.log('API Response:', data);  // Add this

      // Log first class students
      if (data.classes && data.classes[0]) {
        console.log('First class students:', data.classes[0].students);
      }

      setMyClasses(data.classes || []);
    } catch (error) {
      console.error('Failed to fetch classes:', error);
      setMsg('Failed to load classes');
      setTimeout(() => setMsg(''), 2000);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, [currentUser, refreshTrigger]);

  const admitFromWaitlist = async (enrollmentId, studentName, classId) => {
    try {
      const response = await fetch(`${API_BASE}/api/waitlist/admit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollmentId })
      });

      const result = await response.json();

      if (result.success) {
        setMsg(`${studentName} admitted from waitlist.`);
        setRefreshTrigger(prev => prev + 1);
      } else {
        setMsg(result.message || 'Failed to admit student');
      }
      setTimeout(() => setMsg(''), 2000);
    } catch (error) {
      console.error('Failed to admit student:', error);
      setMsg('Error admitting student');
      setTimeout(() => setMsg(''), 2000);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div>Loading your classes...</div>
      </div>
    );
  }

  return (
    <div>
      <PageTitle sub="Manage enrollment and waitlists">My Classes</PageTitle>
      {msg && <Alert type="success">{msg}</Alert>}

      {myClasses.length === 0 && (
        <Card><p style={{ color: 'var(--muted)' }}>You have no classes assigned this semester.</p></Card>
      )}

      {myClasses.map(cls => {
        const enrolledCount = cls.enrolled_count || 0;
        const waitlistedCount = cls.waitlisted_count || 0;
        const spotsLeft = cls.capacity - enrolledCount;
        const students = cls.students || [];
        const enrolled = students.filter(s => s.status === 'registered');
        const waitlist = students.filter(s => s.status === 'waitlisted');

        return (
          <Card key={cls.id} style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)' }}>{cls.code}</span>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 600 }}>{cls.name}</h3>
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{cls.class_time}</div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <Tag color={cls.cancelled ? 'var(--danger)' : 'var(--success)'}>{cls.cancelled ? 'Cancelled' : 'Active'}</Tag>
                <Tag color={spotsLeft > 0 ? 'var(--success)' : 'var(--warn)'}>{enrolledCount}/{cls.capacity} enrolled</Tag>
              </div>
            </div>

            <SectionTitle>Enrolled Students</SectionTitle>
            <Table
              headers={['Name', 'Student ID', 'Email', 'Grade']}
              rows={enrolled.map(s => [
                s.name || '?',
                s.student_code || s.studentId || '?',
                s.email || 'Not provided',
                s.grade || 'IP'
              ])}
              emptyMsg="No enrolled students."
            />

            {waitlist.length > 0 && (
              <>
                <SectionTitle style={{ marginTop: '1rem' }}>Waitlist ({waitlist.length})</SectionTitle>
                <Table
                  headers={['Name', 'Student ID', 'Action']}
                  rows={waitlist.map(s => [
                    s.name || '?',
                    s.student_code || s.studentId || '?',
                    <Btn
                      key="a"
                      variant="success"
                      disabled={spotsLeft <= 0}
                      onClick={() => admitFromWaitlist(s.enrollment_id, s.name, cls.id)}>
                      {spotsLeft > 0 ? 'Admit' : 'Class Full'}
                    </Btn>
                  ])}
                />
              </>
            )}
          </Card>
        );
      })}
    </div>
  );
}