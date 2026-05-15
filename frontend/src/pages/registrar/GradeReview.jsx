import { useState, useEffect } from 'react';
import { PageTitle, Card, Table, Btn, Tag, Alert, SectionTitle } from '../../components/UI.jsx';

const API_BASE = 'http://localhost:8000';

export default function GradeReview({ navigate }) {
  const [loading, setLoading] = useState(true);
  const [flaggedClasses, setFlaggedClasses] = useState([]);
  const [allClasses, setAllClasses] = useState([]);
  const [justifications, setJustifications] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [semesterNumber, setSemesterNumber] = useState(1);
  const [msg, setMsg] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Get semester info
      const periodRes = await fetch(`${API_BASE}/api/semester/period`);
      const periodData = await periodRes.json();
      setSemesterNumber(periodData.semester || 1);

      // Get all classes with GPAs
      const classesRes = await fetch(`${API_BASE}/api/classes/gpa-review?semester=${periodData.semester || 1}`);
      const classesData = await classesRes.json();
      setFlaggedClasses(classesData.flagged || []);
      setAllClasses(classesData.all || []);

      // Get justifications
      const justRes = await fetch(`${API_BASE}/api/grade-justifications`);
      const justData = await justRes.json();
      setJustifications(justData.justifications || []);

      // Get instructors
      const instructorsRes = await fetch(`${API_BASE}/api/instructors/all`);
      const instructorsData = await instructorsRes.json();
      setInstructors(instructorsData.instructors || []);

    } catch (error) {
      console.error('Failed to fetch data:', error);
      setMsg('Failed to load grade review data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [refreshTrigger]);

  // ===== Actions =================================================================

  // Issues a warning to the instructor, which is recorded in the database but does not affect their employment status

  const warn = async (instructorId, name) => {
    try {
      const response = await fetch(`${API_BASE}/api/instructor/warn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructorId })
      });

      const result = await response.json();

      if (result.success) {
        setMsg(`Warning issued to ${name}.`);
        setRefreshTrigger(prev => prev + 1);
      } else {
        setMsg(`Error: ${result.message}`);
      }

      setTimeout(() => setMsg(''), 2000);
    } catch (error) {
      console.error('Failed to issue warning:', error);
      setMsg('Failed to issue warning');
      setTimeout(() => setMsg(''), 2000);
    }
  };

  const fire = async (instructorId, name) => {
    try {
      const response = await fetch(`${API_BASE}/api/instructor/fire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructorId })
      });

      const result = await response.json();

      if (result.success) {
        setMsg(`${name} has been fired.`);
        setRefreshTrigger(prev => prev + 1);
      } else {
        setMsg(`Error: ${result.message}`);
      }

      setTimeout(() => setMsg(''), 2000);
    } catch (error) {
      console.error('Failed to fire instructor:', error);
      setMsg('Failed to fire instructor');
      setTimeout(() => setMsg(''), 2000);
    }
  };

  // Clears the flag on a class without penalizing the instructor
  const acceptJustification = async (classId, instructorId) => {
    try {
      console.log('Accepting justification for class:', classId, 'instructor:', instructorId);

      const response = await fetch(`${API_BASE}/api/grade-justification/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId, instructorId })
      });

      const result = await response.json();
      console.log('Response:', result);

      if (result.success) {
        setMsg('Justification accepted.');
        console.log('Refreshing data...');
        setRefreshTrigger(prev => {
          console.log('Refresh trigger from', prev, 'to', prev + 1);
          return prev + 1;
        });
      } else {
        setMsg(`Error: ${result.message}`);
      }

      setTimeout(() => setMsg(''), 2000);
    } catch (error) {
      console.error('Failed to accept justification:', error);
      setMsg('Failed to accept justification');
      setTimeout(() => setMsg(''), 2000);
    }
  };

  // ===== Helpers ==================================================================

  const getInstructorName = (instructorId) => {
    const instructor = instructors.find(i => i.id === instructorId);
    return instructor?.name || 'Unknown';
  };

  // Returns the justification record for a class, or undefined if none submitted
  const getJustification = (classId) => {
    return justifications.find(j => j.class_id === classId);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div>Loading grade review data...</div>
      </div>
    );
  }

  return (
    <div>
      <PageTitle sub="Review courses with outlier GPAs">Grade Review</PageTitle>
      {msg && <Alert type="warn">{msg}</Alert>}

      {/* ── Flagged Classes Card ─────────────────────────────────────────────── */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <SectionTitle>⚠️ Flagged Classes (GPA outside 2.5–3.5)</SectionTitle>
        {flaggedClasses.length === 0 && (
          <p style={{ color: 'var(--muted)', fontSize: '13px' }}>
            No flagged classes. All GPAs are within normal range.
          </p>
        )}
        {flaggedClasses.map(cls => {
          const justification = getJustification(cls.id);
          // High GPA uses accent color; low GPA uses danger color throughout the card
          const isHighGPA = cls.class_gpa > 3.5;

          return (
            <div
              key={cls.id}
              style={{
                border: `1px solid ${isHighGPA ? 'var(--accent)' : 'var(--danger)'}`,
                borderRadius: '6px',
                padding: '1rem',
                marginBottom: '0.75rem'
              }}
            >
              {/* Class header: code + GPA tag, name, instructor */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <Tag color={isHighGPA ? 'var(--accent)' : 'var(--danger)'}>
                  {cls.code} — GPA {cls.class_gpa.toFixed(2)}
                </Tag>
                <span style={{ color: 'var(--text)', fontWeight: 600 }}>{cls.name}</span>
                <span style={{ color: 'var(--muted)', fontSize: '12px' }}>
                  Instructor: {getInstructorName(cls.instructor_id)}
                </span>
              </div>

              {/* Human-readable explanation of why this class was flagged */}
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '0.75rem' }}>
                {isHighGPA
                  ? 'Class GPA is unusually HIGH (> 3.5). Possible grade inflation.'
                  : 'Class GPA is unusually LOW (< 2.5). Possible excessive failing.'}
              </div>

              {/* Justification block — shows submitted text or a missing warning */}
              {justification ? (
                <div style={{ background: 'var(--surface2)', borderRadius: '4px', padding: '0.6rem', fontSize: '13px', marginBottom: '0.75rem' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--success)' }}>
                    INSTRUCTOR JUSTIFICATION:
                  </span>
                  {justification.justification}
                </div>
              ) : (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--warn)', marginBottom: '0.75rem' }}>
                  No justification submitted yet.
                </div>
              )}

              {/* Action buttons: accept justification, warn, or fire the instructor */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Btn variant="ghost" onClick={() => acceptJustification(cls.id, cls.instructor_id)}>
                  Accept Justification
                </Btn>
                <Btn variant="danger" onClick={() => warn(cls.instructor_id, getInstructorName(cls.instructor_id))}>
                  Issue Warning
                </Btn>
                <Btn
                  onClick={() => fire(cls.instructor_id, getInstructorName(cls.instructor_id))}
                  style={{ background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.5rem 1rem', fontFamily: 'var(--font-mono)', fontSize: '12px', cursor: 'pointer' }}
                >
                  Fire Instructor
                </Btn>
              </div>
            </div>
          );
        })}
      </Card>

      {/* ── All Class GPAs Table ─────────────────────────────────────────────── */}
      <Card>
        <SectionTitle>All Class GPAs — Semester {semesterNumber}</SectionTitle>
        <Table
          headers={['Code', 'Name', 'Instructor', 'Class GPA', 'Status']}
          rows={allClasses.map(c => {
            // Flag if GPA exists and falls outside the 2.5–3.5 normal range
            const isFlagged = c.class_gpa !== null && (c.class_gpa > 3.5 || c.class_gpa < 2.5);
            return [
              c.code,
              c.name,
              getInstructorName(c.instructor_id),
              c.class_gpa !== null ? c.class_gpa.toFixed(2) : 'No grades',
              isFlagged ? (
                <Tag key="f" color={c.class_gpa > 3.5 ? 'var(--accent)' : 'var(--danger)'}>Flagged</Tag>
              ) : (
                <Tag key="f" color="var(--success)">Normal</Tag>
              )
            ];
          })}
          emptyMsg="No classes found for this semester."
        />
      </Card>
    </div>
  );
}