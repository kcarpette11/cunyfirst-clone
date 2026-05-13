import { useState, useEffect } from 'react';
import { PageTitle, Card, Table, Btn, Tag, Alert, SectionTitle } from '../../components/UI.jsx';

const API_BASE = 'http://localhost:8000';

export default function RegistrarComplaints({ navigate }) {
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState([]);
  const [resolved, setResolved] = useState([]);
  const [pendingGrad, setPendingGrad] = useState([]);
  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [msg, setMsg] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch all data from backend
  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch complaints
      const complaintsRes = await fetch(`${API_BASE}/api/complaints/all`);
      const complaintsData = await complaintsRes.json();
      setPending(complaintsData.pending || []);
      setResolved(complaintsData.resolved || []);

      // Fetch graduation applications
      const gradRes = await fetch(`${API_BASE}/api/graduation/applications`);
      const gradData = await gradRes.json();
      setPendingGrad(gradData.pending || []);

      // Fetch users for name lookups
      const usersRes = await fetch(`${API_BASE}/api/users`);
      const usersData = await usersRes.json();
      setUsers(usersData.users || []);

      // Fetch classes for graduation checks
      const classesRes = await fetch(`${API_BASE}/api/classes`);
      const classesData = await classesRes.json();
      setClasses(classesData.classes || []);

      // Fetch enrollments for graduation checks
      const enrollRes = await fetch(`${API_BASE}/api/enrollments/all`);
      const enrollData = await enrollRes.json();
      setEnrollments(enrollData.enrollments || []);

    } catch (error) {
      console.error('Failed to fetch data:', error);
      setMsg('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [refreshTrigger]);

  const getUserName = (userId) => {
    const user = users.find(u => u.id == userId);
    return user?.name || userId;
  };

  const getUser = (userId) => {
    return users.find(u => u.id == userId);
  };

  const resolve = async (complaintId, action) => {
    try {
      const response = await fetch(`${API_BASE}/api/complaint/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ complaintId, action })
      });

      const result = await response.json();

      if (result.success) {
        setMsg('Complaint resolved.');
        setRefreshTrigger(prev => prev + 1);
      } else {
        setMsg(`Error: ${result.message}`);
      }

      setTimeout(() => setMsg(''), 2000);
    } catch (error) {
      console.error('Failed to resolve complaint:', error);
      setMsg('Failed to resolve complaint');
      setTimeout(() => setMsg(''), 2000);
    }
  };

  const handleGrad = async (applicationId, approve) => {
    try {
      const response = await fetch(`${API_BASE}/api/graduation/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId, approve })
      });

      const result = await response.json();

      if (result.success) {
        setMsg(approve ? 'Student graduated!' : 'Graduation rejected.');
        setRefreshTrigger(prev => prev + 1);
      } else {
        setMsg(`Error: ${result.message}`);
      }

      setTimeout(() => setMsg(''), 2000);
    } catch (error) {
      console.error('Failed to process graduation:', error);
      setMsg('Failed to process graduation');
      setTimeout(() => setMsg(''), 2000);
    }
  };

  // Helper to check graduation eligibility
  const getGraduationStatus = (studentId) => {
    const studentEnrollments = enrollments.filter(e => e.student_id == studentId && e.grade && e.grade !== 'F' && e.grade !== 'IP');
    const completedCount = studentEnrollments.length;
    const requiredClasses = classes.filter(c => c.required);
    const completedIds = studentEnrollments.map(e => e.class_id);
    const missingRequired = requiredClasses.filter(c => !completedIds.includes(c.id));
    return { completedCount, missingRequired };
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div>Loading complaints...</div>
      </div>
    );
  }

  return (
    <div>
      <PageTitle sub="Review and act on complaints and graduation applications">Complaints & Actions</PageTitle>
      {msg && <Alert type="success">{msg}</Alert>}

      {/* Graduation */}
      {pendingGrad.length > 0 && (
        <Card style={{ marginBottom: '1.5rem' }}>
          <SectionTitle>🎓 Graduation Applications</SectionTitle>
          {pendingGrad.map(g => {
            const stu = getUser(g.student_id);
            const { completedCount, missingRequired } = getGraduationStatus(g.student_id);
            return (
              <div key={g.id} style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '1rem', marginBottom: '0.75rem' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{stu?.name || g.student_id} — {completedCount} classes completed</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '0.5rem' }}>
                  Missing required: {missingRequired.length === 0 ? <span style={{ color: 'var(--success)' }}>None ✓</span> : missingRequired.map(c => c.code).join(', ')}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Btn
                    variant="success"
                    onClick={() => handleGrad(g.id, true)}
                    disabled={completedCount < 8 || missingRequired.length > 0}
                  >
                    Graduate ✓
                  </Btn>
                  <Btn variant="danger" onClick={() => handleGrad(g.id, false)}>Reject</Btn>
                </div>
                {completedCount < 8 && (
                  <div style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '0.4rem', fontFamily: 'var(--font-mono)' }}>
                    Only {completedCount}/8 courses completed.
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}

      {/* Pending Complaints */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <SectionTitle>Pending Complaints ({pending.length})</SectionTitle>
        {pending.length === 0 && <p style={{ color: 'var(--muted)', fontSize: '13px' }}>No pending complaints.</p>}
        {pending.map(c => {
          const filer = getUser(c.from_id);
          const against = getUser(c.against_id);
          return (
            <div key={c.id} style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '1rem', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <Tag color="var(--accent2)">{filer?.name || c.from_id} ({c.from_role})</Tag>
                <span style={{ color: 'var(--muted)', fontSize: '12px' }}>→ complained against →</span>
                <Tag color="var(--danger)">{against?.name || c.against_id} ({c.against_role})</Tag>
              </div>
              <div style={{ background: 'var(--surface2)', borderRadius: '4px', padding: '0.6rem', fontSize: '13px', color: 'var(--muted)', fontStyle: 'italic', marginBottom: '0.75rem' }}>
                "{c.text}"
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Btn variant="danger" onClick={() => resolve(c.id, 'warn_against')}>
                  Warn {against?.name?.split(' ')[0] || 'Against'}
                </Btn>
                <Btn variant="ghost" onClick={() => resolve(c.id, 'warn_filer')}>
                  Warn {filer?.name?.split(' ')[0] || 'Filer'} (unfounded)
                </Btn>
                {c.against_role === 'student' && (
                  <Btn onClick={() => resolve(c.id, 'deregister')}>De-register Student</Btn>
                )}
                <Btn onClick={() => resolve(c.id, 'dismissed')}>Dismiss</Btn>
              </div>
            </div>
          );
        })}
      </Card>

      {/* Resolved Complaints */}
      <Card>
        <SectionTitle>Resolved Complaints</SectionTitle>
        <Table
          headers={['Filer', 'Against', 'Resolution', 'Date']}
          rows={resolved.map(c => [
            getUserName(c.from_id),
            getUserName(c.against_id),
            <Tag key="r" color={c.resolution?.includes('warn') ? 'var(--warn)' : 'var(--muted)'}>
              {c.resolution || 'Resolved'}
            </Tag>,
            new Date(c.created_at).toLocaleDateString()
          ])}
          emptyMsg="No resolved complaints."
        />
      </Card>
    </div>
  );
}