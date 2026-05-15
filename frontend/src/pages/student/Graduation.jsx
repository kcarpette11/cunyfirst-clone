import { useState, useEffect } from 'react';
import { useAuth } from '../../auth.jsx';
import { PageTitle, Card, Btn, Tag, Alert, SectionTitle, Table } from '../../components/UI.jsx';

const API_BASE = 'http://localhost:8000';

export default function Graduation({ navigate }) {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [graduationData, setGraduationData] = useState({
    completedCount: 0,
    completedCourses: [],
    failedCourses: [],
    requiredCourses: [],
    completedRequired: [],
    missingRequired: [],
    existingApp: null,
    canApply: false,
    isGraduated: false
  });
  const [msg, setMsg] = useState({ text: '', type: 'info' });
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchGraduationData = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);

      const response = await fetch(`${API_BASE}/api/student/${currentUser.id}/graduation-status`);
      const data = await response.json();

      setGraduationData({
        completedCount: data.completedCount || 0,
        completedCourses: data.completedCourses || [],
        failedCourses: data.failedCourses || [],
        requiredCourses: data.requiredCourses || [],
        completedRequired: data.completedRequired || [],
        missingRequired: data.missingRequired || [],
        existingApp: data.existingApp,
        canApply: data.canApply || false,
        isGraduated: data.isGraduated || false
      });
    } catch (error) {
      console.error('Failed to fetch graduation data:', error);
      setMsg({ text: 'Failed to load graduation data', type: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraduationData();
  }, [currentUser, refreshTrigger]);

  // ===== Actions =================================================================

  const applyForGraduation = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/graduation/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: currentUser.id
        })
      });

      const result = await response.json();

      if (result.success) {
        setMsg({ text: 'Graduation application submitted! Awaiting registrar review.', type: 'success' });
        setRefreshTrigger(prev => prev + 1);
      } else {
        setMsg({ text: result.message || 'Failed to submit application', type: 'danger' });
      }

      setTimeout(() => setMsg({ text: '', type: 'info' }), 4000);
    } catch (error) {
      setMsg({ text: 'Failed to submit graduation application', type: 'danger' });
      setTimeout(() => setMsg({ text: '', type: 'info' }), 4000);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div>Loading graduation data...</div>
      </div>
    );
  }

  const { completedCount, completedCourses, failedCourses, requiredCourses, completedRequired, missingRequired, existingApp, canApply, isGraduated } = graduationData;
  const requiredCount = requiredCourses.length;

  return (
    <div style={{ maxWidth: '700px' }}>
      <PageTitle sub="Apply for graduation when you complete your program">Graduation</PageTitle>

      {/* Congratulatory banner — shown only after graduation is confirmed */}
      {isGraduated && (
        <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--surface)', border: '2px solid var(--accent)', borderRadius: '12px', marginBottom: '2rem' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎓</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--accent)', marginBottom: '0.5rem' }}>Congratulations, Graduate!</h2>
          <p style={{ color: 'var(--muted)' }}>You have earned your Bachelor's degree from CunyZero.</p>
        </div>
      )}

      {msg.text && <Alert type={msg.type}>{msg.text}</Alert>}

      {/* ── Progress Card ────────────────────────────────────────────────────── */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <SectionTitle>Graduation Progress</SectionTitle>

        {/* Course completion progress bar */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--muted)' }}>Courses Completed</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: completedCount >= 8 ? 'var(--success)' : 'var(--text)' }}>{completedCount} / 8</span>
          </div>
          <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, (completedCount / 8) * 100)}%`,
              background: completedCount >= 8 ? 'var(--success)' : 'var(--accent)',
              borderRadius: '3px',
              transition: 'width 0.4s'
            }} />
          </div>
        </div>

        {/* Summary tags: course count, required courses, warnings */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <Tag color={completedCount >= 8 ? 'var(--success)' : 'var(--warn)'}>{completedCount}/8 Courses ✓</Tag>
          <Tag color={missingRequired.length === 0 ? 'var(--success)' : 'var(--danger)'}>
            {completedRequired.length}/{requiredCount} Required Courses
          </Tag>
          {currentUser?.warnings > 0 && <Tag color="var(--warn)">{currentUser.warnings} Warning(s)</Tag>}
        </div>

        {/* List of required courses the student has not yet completed */}
        {missingRequired.length > 0 && (
          <div style={{ background: 'var(--danger)18', border: '1px solid var(--danger)', borderRadius: '4px', padding: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--danger)', marginBottom: '0.4rem' }}>MISSING REQUIRED COURSES:</div>
            {missingRequired.map(c => (
              <div key={c.id} style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text)' }}>
                • {c.code} — {c.name}
              </div>
            ))}
          </div>
        )}

        {/* Application status alert — pending / approved / rejected */}
        {existingApp && (
          <Alert type={existingApp.status === 'pending' ? 'warn' : existingApp.status === 'approved' ? 'success' : 'danger'}>
            {existingApp.status === 'pending' && '⏳ Your graduation application is pending registrar review.'}
            {existingApp.status === 'approved' && '🎓 Your graduation has been approved!'}
            {existingApp.status === 'rejected' && '⛔ Your graduation application was rejected. A warning has been issued.'}
          </Alert>
        )}

        {/* Apply button — disabled until all requirements are met */}
        {!existingApp && !isGraduated && (
          <Btn
            variant={canApply ? 'primary' : 'default'}
            disabled={!canApply}
            onClick={applyForGraduation}
          >
            {canApply ? 'Apply for Graduation 🎓' : `Complete requirements to apply (${completedCount}/8 courses, ${completedRequired.length}/${requiredCount} required)`}
          </Btn>
        )}
      </Card>

      {/* ── Completed Courses Table ──────────────────────────────────────────── */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <SectionTitle>Completed Courses ({completedCount})</SectionTitle>
        <Table
          headers={['Code', 'Course', 'Grade', 'Required']}
          rows={completedCourses.map(e => [
            e.code || '?',
            e.name || '?',
            <Tag key="g" color={e.grade === 'A' ? 'var(--success)' : 'var(--muted)'}>{e.grade}</Tag>,
            e.required ? <Tag key="r" color="var(--accent2)">Required</Tag> : '—'
          ])}
          emptyMsg="No completed courses yet."
        />
      </Card>

      {/* ── Failed Courses Table (shown only when applicable) ───────────────── */}
      {failedCourses.length > 0 && (
        <Card>
          <SectionTitle>Failed Courses (eligible for retake)</SectionTitle>
          <Table
            headers={['Code', 'Course', 'Semester']}
            rows={failedCourses.map(e => [e.code || '?', e.name || '?', `Sem ${e.semester}`])}
          />
        </Card>
      )}
    </div>
  );
}