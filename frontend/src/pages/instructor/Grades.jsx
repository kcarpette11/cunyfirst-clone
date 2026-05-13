import { useState, useEffect } from 'react';
import { useAuth } from '../../auth.jsx';
import { PageTitle, Card, Table, Select, Btn, Tag, Alert, SectionTitle, Textarea } from '../../components/UI.jsx';

const API_BASE = 'http://localhost:8000';

export default function Grades({ navigate }) {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [myClasses, setMyClasses] = useState([]);
  const [grades, setGrades] = useState({});
  const [justifications, setJustifications] = useState({});
  const [currentPeriod, setCurrentPeriod] = useState('');
  const [msg, setMsg] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch data from backend
  const fetchData = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);

      // Get current period
      const periodRes = await fetch(`${API_BASE}/api/semester/period`);
      const periodData = await periodRes.json();
      setCurrentPeriod(periodData.period);

      // Get instructor's classes
      const classesRes = await fetch(`${API_BASE}/api/instructor/${currentUser.id}/classes`);
      const classesData = await classesRes.json();

      // Filter to only active (not cancelled) classes
      const activeClasses = (classesData.classes || []).filter(c => !c.cancelled);
      setMyClasses(activeClasses);

    } catch (error) {
      console.error('Failed to fetch data:', error);
      setMsg('Failed to load grade data');
      setTimeout(() => setMsg(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser, refreshTrigger]);

  const saveGrades = async (classId, classCode) => {
    try {
      const cls = myClasses.find(c => c.id === classId);
      const students = cls?.students || [];

      // Post each grade
      for (const student of students) {
        const gradeValue = grades[student.enrollment_id];
        if (gradeValue && gradeValue !== student.grade) {
          await fetch(`${API_BASE}/api/grade/post`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              enrollmentId: student.enrollment_id,
              grade: gradeValue
            })
          });
        }
      }

      setMsg(`Grades saved for ${classCode}.`);
      setRefreshTrigger(prev => prev + 1);
      setTimeout(() => setMsg(''), 2000);
    } catch (error) {
      console.error('Failed to save grades:', error);
      setMsg('Error saving grades');
      setTimeout(() => setMsg(''), 2000);
    }
  };

  const submitJustification = async (classId) => {
    const j = justifications[classId];
    if (!j?.trim()) {
      setMsg('Please enter a justification.');
      setTimeout(() => setMsg(''), 2000);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/grade-justification/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructorId: currentUser.id,
          classId: classId,
          justification: j
        })
      });

      const result = await response.json();

      if (result.success) {
        setMsg('Justification submitted to registrar.');
        setJustifications(j => ({ ...j, [classId]: '' }));
        setRefreshTrigger(prev => prev + 1);
      } else {
        setMsg(result.message || 'Failed to submit justification');
      }
      setTimeout(() => setMsg(''), 2000);
    } catch (error) {
      console.error('Failed to submit justification:', error);
      setMsg('Error submitting justification');
      setTimeout(() => setMsg(''), 2000);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div>Loading grade management...</div>
      </div>
    );
  }

  const canGrade = currentPeriod === 'grading';

  return (
    <div>
      <PageTitle sub={canGrade ? 'Assign final grades' : 'Grades (grading period not active)'}>Grade Management</PageTitle>
      {!canGrade && (
        <div style={{ background: 'var(--warn)18', border: '1px solid var(--warn)', borderRadius: '6px', padding: '0.75rem 1rem', marginBottom: '1rem', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--warn)' }}>
          ⚠ The grading period is not currently active. You can preview but grades are locked.
        </div>
      )}
      {msg && <Alert type="success">{msg}</Alert>}

      {myClasses.length === 0 && <Card><p style={{ color: 'var(--muted)' }}>No active classes to grade.</p></Card>}

      {myClasses.map(cls => {
        const students = cls.students || [];
        const classGpa = cls.class_gpa;
        const flagged = classGpa !== null && (classGpa > 3.5 || classGpa < 2.5);
        const hasJustification = cls.has_justification || false;

        return (
          <Card key={cls.id} style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)' }}>{cls.code}</span>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 600 }}>{cls.name}</h3>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {classGpa !== null && (
                  <Tag color={flagged ? (classGpa > 3.5 ? 'var(--accent)' : 'var(--danger)') : 'var(--success)'}>
                    Class GPA: {classGpa.toFixed(2)}
                  </Tag>
                )}
                {flagged && <Tag color="var(--warn)">⚠ Flagged</Tag>}
              </div>
            </div>

            {flagged && (
              <div style={{ background: 'var(--warn)18', border: '1px solid var(--warn)', borderRadius: '4px', padding: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--warn)', marginBottom: '0.5rem' }}>
                  Class GPA is {classGpa > 3.5 ? 'above 3.5 (possible grade inflation)' : 'below 2.5 (possible excessive failing)'}. Submit a justification to the registrar.
                </div>
                {hasJustification ? (
                  <Tag color="var(--success)">Justification submitted ✓</Tag>
                ) : (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                    <Textarea
                      label="Justification"
                      value={justifications[cls.id] || ''}
                      onChange={v => setJustifications(j => ({ ...j, [cls.id]: v }))}
                      rows={2}
                      placeholder="Explain the grade distribution..."
                      style={{ flex: 1 }}
                    />
                    <Btn variant="ghost" onClick={() => submitJustification(cls.id)}>Submit</Btn>
                  </div>
                )}
              </div>
            )}

            <Table
              headers={['Student', 'ID', 'Current Grade', 'Assign Grade']}
              rows={students.map(s => [
                s.name || '?',
                s.student_code || '?',
                s.grade ? <Tag key="g" color="var(--success)">{s.grade}</Tag> : <Tag key="g" color="var(--muted)">IP</Tag>,
                <Select
                  key="s"
                  value={grades[s.enrollment_id] || s.grade || ''}
                  onChange={v => setGrades(g => ({ ...g, [s.enrollment_id]: v }))}
                  options={[
                    { value: '', label: '— Select —' },
                    { value: 'A', label: 'A (4.0)' },
                    { value: 'B', label: 'B (3.0)' },
                    { value: 'C', label: 'C (2.0)' },
                    { value: 'D', label: 'D (1.0)' },
                    { value: 'F', label: 'F (0.0)' },
                  ]}
                  style={{ minWidth: '120px' }}
                />
              ])}
              emptyMsg="No enrolled students."
            />

            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <Btn variant="primary" disabled={!canGrade} onClick={() => saveGrades(cls.id, cls.code)}>
                Save All Grades for {cls.code}
              </Btn>
            </div>
          </Card>
        );
      })}
    </div>
  );
}