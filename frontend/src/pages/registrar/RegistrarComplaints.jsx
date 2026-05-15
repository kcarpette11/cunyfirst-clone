import { useState, useEffect } from 'react';
import {
  PageTitle, Card, Table, Btn, Tag, Alert, SectionTitle
} from '../../components/UI.jsx';

const API_BASE = 'http://localhost:8000';

export default function RegistrarComplaints({ navigate }) {
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState([]);
  const [resolved, setResolved] = useState([]);
  const [pendingGrad, setPendingGrad] = useState([]);
  const [classes, setClasses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [msg, setMsg] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchData = async () => {
    try {
      setLoading(true);

      const complaintsRes = await fetch(`${API_BASE}/api/complaints/all`);
      const complaintsData = await complaintsRes.json();
      setPending(complaintsData.pending || []);
      setResolved(complaintsData.resolved || []);

      const gradRes = await fetch(`${API_BASE}/api/graduation/applications`);
      const gradData = await gradRes.json();
      setPendingGrad(gradData.pending || []);

      const classesRes = await fetch(`${API_BASE}/api/classes`);
      const classesData = await classesRes.json();
      setClasses(classesData.classes || []);

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

  // ===== Actions =================================================================

  const resolve = async (complaintId, action) => {
    try {
      const response = await fetch(`${API_BASE}/api/complaint/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ complaintId, action })
      });

      const result = await response.json();

      if (result.success) {
        setMsg(result.message || 'Complaint resolved.');
        setRefreshTrigger(prev => prev + 1);
      } else {
        setMsg(`Error: ${result.message}`);
      }

      setTimeout(() => setMsg(''), 4000);
    } catch (error) {
      console.error('Failed to resolve complaint:', error);
      setMsg('Failed to resolve complaint');
      setTimeout(() => setMsg(''), 4000);
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

      setTimeout(() => setMsg(''), 4000);
    } catch (error) {
      console.error('Failed to process graduation:', error);
      setMsg('Failed to process graduation');
      setTimeout(() => setMsg(''), 4000);
    }
  };

  // ===== Helpers =================================================================

  // Normalizes raw graduation application data into a consistent shape for the UI
  const getGraduationStatus = (g) => {
    return {
      completedCount: g.completed_count || 0,
      missingRequired: (g.missing_required || []).map(code => ({ code }))
    };
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '3rem' }}>Loading complaints...</div>;
  }

  return (
    <div>
      <PageTitle sub="Review and act on complaints and graduation applications">
        Complaints & Actions
      </PageTitle>

      {msg && <Alert type="success">{msg}</Alert>}

      {/* ── Graduation Applications ──────────────────────────────────────────── */}
      {/* Graduate button is disabled until 8 courses are done and no required courses are missing */}
      {pendingGrad.length > 0 && (
        <Card style={{ marginBottom: '1.5rem' }}>
          <SectionTitle>🎓 Graduation Applications</SectionTitle>
          {pendingGrad.map(g => {
            const { completedCount, missingRequired } = getGraduationStatus(g);
            return (
              <div key={g.id} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                {/* Student summary */}
                <div style={{ marginBottom: '0.75rem', padding: '0.75rem', borderRadius: '6px', background: 'var(--surface2)' }}>
                  <div style={{ fontWeight: 700, fontSize: '15px' }}>{g.student_name || g.name || `Student #${g.student_id}`}</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{g.email || ''}</div>
                  <div style={{ marginTop: '0.5rem', fontSize: '13px' }}>{completedCount} classes completed</div>
                </div>
                {/* Missing required courses — green check if all satisfied */}
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '0.75rem' }}>
                  Missing required:{' '}
                  {missingRequired.length === 0 ? (
                    <span style={{ color: 'var(--success)' }}>None ✓</span>
                  ) : (
                    missingRequired.map(c => c.code).join(', ')
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Btn
                    variant="success"
                    disabled={completedCount < 8 || missingRequired.length > 0}
                    onClick={() => handleGrad(g.id, true)}
                  >
                    Graduate ✓
                  </Btn>
                  <Btn variant="danger" onClick={() => handleGrad(g.id, false)}>Reject</Btn>
                </div>
                {completedCount < 8 && (
                  <div style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '0.5rem' }}>
                    Only {completedCount}/8 courses completed.
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}

      {/* ── Complaint Rules Banner ───────────────────────────────────────────── */}
      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.75rem 1rem', marginBottom: '1.5rem', fontSize: '12px', color: 'var(--muted)', lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--fg)' }}>Complaint Rules:</strong>{' '}
        Students may complain about other students or their instructors. Instructors may complain about students in their classes. The registrar must take action on every complaint.
        <br />
        <strong style={{ color: 'var(--fg)' }}>Actions:</strong> <em>Warn [person]</em> — issues 1 warning. Students reaching 3 warnings are suspended for 1 semester and must pay a fine before re-enrolling. Instructors reaching 3 warnings are also suspended. <em>De-register</em> — drops all current enrollments. <em>Warn Filer</em> — penalises the complainant for an unfounded complaint. <em>Dismiss</em> — closes with no action.
      </div>

      {/* ── Pending Complaints ───────────────────────────────────────────────── */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <SectionTitle>Pending Complaints ({pending.length})</SectionTitle>

        {pending.length === 0 && (
          <p style={{ color: 'var(--muted)', fontSize: '13px' }}>No pending complaints.</p>
        )}

        {pending.map(c => {
          // Normalize display names and capitalize role labels
          const filerName = c.from_name || `User #${c.from_id}`;
          const filerRole = c.from_role_display || c.from_role || 'unknown';
          const againstName = c.against_name || `User #${c.against_id}`;
          const againstRole = c.against_role_display || c.against_role || 'unknown';
          const filerRoleLabel = filerRole.charAt(0).toUpperCase() + filerRole.slice(1);
          const againstRoleLabel = againstRole.charAt(0).toUpperCase() + againstRole.slice(1);

          return (
            <div key={c.id} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
              {/* Filer → Against layout */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ padding: '0.75rem', borderRadius: '6px', background: 'var(--surface2)' }}>
                  <div style={{ fontWeight: 700 }}>{filerName}</div>
                  <div style={{ marginTop: '0.35rem' }}>
                    <Tag color="var(--accent2)">Filed By: {filerRoleLabel}</Tag>
                  </div>
                </div>

                <div style={{ fontWeight: 700, color: 'var(--muted)' }}>→</div>

                <div style={{ padding: '0.75rem', borderRadius: '6px', background: 'var(--surface2)' }}>
                  <div style={{ fontWeight: 700 }}>{againstName}</div>
                  <div style={{ marginTop: '0.35rem' }}>
                    <Tag color="var(--danger)">Against: {againstRoleLabel}</Tag>
                  </div>
                </div>
              </div>

              {/* Complaint text */}
              <div style={{ background: 'var(--surface2)', borderRadius: '6px', padding: '0.75rem', marginBottom: '1rem', fontStyle: 'italic' }}>
                "{c.text}"
              </div>

              {/* Action buttons — Warn Filer hidden for registrar-filed complaints; De-register only for students */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Btn variant="danger" onClick={() => resolve(c.id, 'warn_against')}>
                  Warn {againstName}
                </Btn>
                {filerRole !== 'registrar' && (
                  <Btn variant="ghost" onClick={() => resolve(c.id, 'warn_filer')}>
                    Warn {filerName}
                  </Btn>
                )}
                {againstRole === 'student' && (
                  <Btn onClick={() => resolve(c.id, 'deregister')}>
                    De-register Student
                  </Btn>
                )}
                <Btn onClick={() => resolve(c.id, 'dismissed')}>
                  Dismiss
                </Btn>
              </div>
            </div>
          );
        })}
      </Card>

      {/* ── Resolved Complaints Table ────────────────────────────────────────── */}
      <Card>
        <SectionTitle>Resolved Complaints</SectionTitle>
        <Table
          headers={['Filer', 'Against', 'Resolution', 'Date']}
          rows={resolved.map(c => [
            c.from_name || `User #${c.from_id}`,
            c.against_name || `User #${c.against_id}`,
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