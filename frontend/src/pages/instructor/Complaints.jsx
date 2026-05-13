import { useState, useEffect } from 'react';
import { useAuth } from '../../auth.jsx';
import { PageTitle, Card, Select, Textarea, Btn, Alert, Table, Tag, SectionTitle } from '../../components/UI.jsx';

const API_BASE = 'http://localhost:8000';

export default function InstructorComplaints({ navigate }) {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [myStudents, setMyStudents] = useState([]);
  const [myComplaints, setMyComplaints] = useState([]);
  const [againstId, setAgainstId] = useState('');
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch data from backend
  const fetchData = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);

      // Get instructor's classes and students
      const classesRes = await fetch(`${API_BASE}/api/instructor/${currentUser.id}/classes`);
      const classesData = await classesRes.json();

      // Extract unique students from all classes
      const studentsSet = new Map();
      for (const cls of classesData.classes || []) {
        for (const student of cls.students || []) {
          if (!studentsSet.has(student.id)) {
            studentsSet.set(student.id, {
              id: student.id,
              name: student.name,
              student_code: student.student_code
            });
          }
        }
      }
      setMyStudents(Array.from(studentsSet.values()));

      // Get instructor's complaints
      const complaintsRes = await fetch(`${API_BASE}/api/complaints/instructor/${String(currentUser.id)}`);
      const complaintsData = await complaintsRes.json();
      setMyComplaints(complaintsData.complaints || []);

    } catch (error) {
      console.error('Failed to fetch data:', error);
      setMsg('Failed to load data');
      setTimeout(() => setMsg(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser, refreshTrigger]);

  const submit = async () => {
    if (!againstId || !text.trim()) {
      setMsg('Please select a student and enter a description.');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${API_BASE}/api/complaint/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_id: String(currentUser.id),
          from_role: 'instructor',
          against_id: String(againstId),
          text: text
        })
      });

      const result = await response.json();

      if (result.success) {
        setMsg('Complaint filed. The registrar will review and take action.');
        setAgainstId('');
        setText('');
        setRefreshTrigger(prev => prev + 1);
      } else {
        setMsg(result.message || 'Failed to submit complaint');
      }
      setTimeout(() => setMsg(''), 3000);
    } catch (error) {
      console.error('Failed to submit complaint:', error);
      setMsg('Error submitting complaint');
      setTimeout(() => setMsg(''), 3000);
    } finally {
      setSubmitting(false);
    }
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
      <PageTitle sub="File complaints about students in your classes">Complaints</PageTitle>
      {msg && <Alert type={msg.startsWith('Please') ? 'danger' : 'success'}>{msg}</Alert>}

      <Card style={{ marginBottom: '1.5rem' }}>
        <SectionTitle>File a Complaint</SectionTitle>
        <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '1rem', lineHeight: 1.5 }}>
          You may file complaints about students in your classes. The registrar must take action: either punish the student or warn you for an unfounded complaint.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <Select
            label="Student"
            value={againstId}
            onChange={setAgainstId}
            options={[
              { value: '', label: '— Select Student —' },
              ...myStudents.map(s => ({ value: String(s.id), label: `${s.name} (${s.student_code})` }))
            ]}
          />
          <Textarea
            label="Description"
            value={text}
            onChange={setText}
            rows={4}
            placeholder="Describe the student's behavior or academic misconduct..."
          />
          <Btn variant="primary" onClick={submit} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Complaint'}
          </Btn>
        </div>
      </Card>

      <Card>
        <SectionTitle>My Filed Complaints</SectionTitle>
        <Table
          headers={['Against', 'Status', 'Resolution', 'Date']}
          rows={myComplaints.map(c => [
            c.against_name || '?',
            <Tag key="s" color={c.status === 'pending' ? 'var(--warn)' : 'var(--success)'}>{c.status}</Tag>,
            c.resolution || '—',
            new Date(c.created_at).toLocaleDateString()
          ])}
          emptyMsg="No complaints filed."
        />
      </Card>
    </div>
  );
}