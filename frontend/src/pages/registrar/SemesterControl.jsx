import { useState, useEffect } from 'react';
import { PageTitle, Card, Btn, Tag, Alert, SectionTitle } from '../../components/UI.jsx';

const API_BASE = 'http://localhost:8000';

const PERIOD_INFO = {
  setup: { label: 'Class Set-Up', desc: 'Registrars create classes, assign instructors, and set class sizes.', color: 'var(--accent2)', next: 'registration' },
  registration: { label: 'Course Registration', desc: 'Students register for 2–4 courses. Waitlists are active.', color: 'var(--success)', next: 'running' },
  running: { label: 'Class Running', desc: 'Classes are in session. Cancelled courses trigger special registration.', color: 'var(--accent)', next: 'grading' },
  grading: { label: 'Grading Period', desc: 'Instructors assign final grades. GPA outliers are flagged.', color: 'var(--warn)', next: 'closed' },
  closed: { label: 'Semester Closed', desc: 'End-of-semester processing: terminations, honor roll, suspensions.', color: 'var(--muted)', next: 'setup' },
};

const PERIODS = ['setup', 'registration', 'running', 'grading', 'closed'];

export default function SemesterControl({ navigate }) {
  const [loading, setLoading] = useState(true);
  const [semesterData, setSemesterData] = useState({
    currentPeriod: 'registration',
    semesterNumber: 1
  });
  const [msg, setMsg] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch current semester data from backend
  const fetchSemesterData = async () => {
    try {
      setLoading(true);

      const response = await fetch(`${API_BASE}/api/semester/period`);
      const data = await response.json();

      setSemesterData({
        currentPeriod: data.period || 'registration',
        semesterNumber: data.semester || 1
      });

    } catch (error) {
      console.error('Failed to fetch semester data:', error);
      setMsg('Failed to load semester data');
      setTimeout(() => setMsg(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSemesterData();
  }, [refreshTrigger]);

  const advancePeriod = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/semester/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();

      if (result.success) {
        const curInfo = PERIOD_INFO[result.newPeriod];
        setMsg(`Advanced to: ${curInfo?.label}`);
        setRefreshTrigger(prev => prev + 1);
      } else {
        setMsg(`Error: ${result.message}`);
      }

      setTimeout(() => setMsg(''), 3000);
    } catch (error) {
      console.error('Failed to advance period:', error);
      setMsg('Failed to advance period');
      setTimeout(() => setMsg(''), 3000);
    }
  };

  const setPeriod = async (period) => {
    try {
      const response = await fetch(`${API_BASE}/api/semester/set-period`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period })
      });

      const result = await response.json();

      if (result.success) {
        setMsg(`Period set to: ${PERIOD_INFO[period]?.label}`);
        setRefreshTrigger(prev => prev + 1);
      } else {
        setMsg(`Error: ${result.message}`);
      }

      setTimeout(() => setMsg(''), 3000);
    } catch (error) {
      console.error('Failed to set period:', error);
      setMsg('Failed to set period');
      setTimeout(() => setMsg(''), 3000);
    }
  };

  const startNewSemester = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/semester/new`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();

      if (result.success) {
        setMsg('New semester started!');
        setRefreshTrigger(prev => prev + 1);
      } else {
        setMsg(`Error: ${result.message}`);
      }

      setTimeout(() => setMsg(''), 3000);
    } catch (error) {
      console.error('Failed to start new semester:', error);
      setMsg('Failed to start new semester');
      setTimeout(() => setMsg(''), 3000);
    }
  };

  const { currentPeriod, semesterNumber } = semesterData;
  const cur = PERIOD_INFO[currentPeriod];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div>Loading semester controls...</div>
      </div>
    );
  }

  return (
    <div>
      <PageTitle sub="Control the academic calendar">Semester Management</PageTitle>
      {msg && <Alert type="success">{msg}</Alert>}

      <Card style={{ marginBottom: '1.5rem' }}>
        <SectionTitle>Current Status</SectionTitle>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <Tag color={cur?.color}>Semester {semesterNumber}</Tag>
          <Tag color={cur?.color}>{cur?.label}</Tag>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '1.5rem', lineHeight: 1.6 }}>{cur?.desc}</p>
        <Btn variant="primary" onClick={advancePeriod} disabled={currentPeriod === 'closed'}>
          Advance to Next Period →
        </Btn>
        {currentPeriod === 'closed' && (
          <Btn variant="ghost" onClick={startNewSemester} style={{ marginLeft: '0.5rem' }}>
            Start New Semester
          </Btn>
        )}
      </Card>

      <Card>
        <SectionTitle>Period Overview</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {PERIODS.map((p, i) => {
            const info = PERIOD_INFO[p];
            const isCurrent = p === currentPeriod;
            const isPast = PERIODS.indexOf(currentPeriod) > i;
            return (
              <div key={p} style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                padding: '0.75rem', borderRadius: '6px',
                background: isCurrent ? info.color + '18' : 'transparent',
                border: `1px solid ${isCurrent ? info.color : 'var(--border)'}`,
              }}>
                <div style={{
                  width: '24px', height: '24px', borderRadius: '50%',
                  background: isPast ? 'var(--success)' : isCurrent ? info.color : 'var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', flexShrink: 0,
                }}>
                  {isPast ? '✓' : i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: isCurrent ? info.color : 'var(--text)' }}>{info.label}</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{info.desc}</div>
                </div>
                {!isCurrent && (
                  <Btn onClick={() => setPeriod(p)} style={{ fontSize: '11px', padding: '0.25rem 0.5rem' }}>Jump</Btn>
                )}
                {isCurrent && <Tag color={info.color}>CURRENT</Tag>}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}