import { useState, useEffect } from 'react';
import { useAuth } from '../../auth.jsx';
import { PageTitle, Card, Select, Textarea, Btn, Alert, Table, Tag, SectionTitle } from '../../components/UI.jsx';

const API_BASE = 'http://localhost:8000';

export default function StudentComplaints({ navigate }) {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [againstId, setAgainstId] = useState('');
  const [text, setText] = useState('');
  const [msg, setMsg] = useState({ text: '', type: 'info' });
  const [complaints, setComplaints] = useState([]);
  const [targets, setTargets] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch complaints and targets from backend
  const fetchData = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);

      // Get student's complaints
      const complaintsRes = await fetch(`${API_BASE}/api/complaints/student/${String(currentUser.id)}`);
      const complaintsData = await complaintsRes.json();
      setComplaints(complaintsData.complaints || []);

      // Get available targets (students and instructors)
      const targetsRes = await fetch(`${API_BASE}/api/complaints/targets/${String(currentUser.id)}`);
      const targetsData = await targetsRes.json();

      const targetOptions = [
        { value: '', label: '— Select person to complain about —' },
        ...(targetsData.students || []).map(s => ({
          value: s.id,
          label: `[Student] ${s.name} (${s.student_code})`
        })),
        ...(targetsData.instructors || []).map(i => ({
          value: i.id,
          label: `[Instructor] ${i.name}`
        })),
      ];
      setTargets(targetOptions);
    } catch (error) {
      console.error('Failed to fetch complaints:', error);
      setMsg({ text: 'Failed to load complaints', type: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser, refreshTrigger]);

  const submit = async () => {
    if (!againstId) {
      setMsg({ text: 'Please select who you are complaining about.', type: 'danger' });
      return;
    }
    if (!text.trim()) {
      setMsg({ text: 'Please describe the issue.', type: 'danger' });
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${API_BASE}/api/complaint/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_id: String(currentUser.id),
          from_role: 'student',
          against_id: String(againstId),
          text: text
        })
      });

      const result = await response.json();

      if (result.success) {
        setAgainstId('');
        setText('');
        setMsg({ text: 'Complaint filed. The registrar will review and take action.', type: 'success' });
        setRefreshTrigger(prev => prev + 1);
      } else {
        setMsg({ text: result.message || 'Failed to submit complaint', type: 'danger' });
      }
    } catch (error) {
      console.error('Failed to submit complaint:', error);
      setMsg({ text: 'Failed to submit complaint', type: 'danger' });
    } finally {
      setSubmitting(false);
      setTimeout(() => setMsg({ text: '', type: 'info' }), 3000);
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
      <PageTitle sub="File complaints with the registrar">Complaints</PageTitle>

      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.75rem 1rem', marginBottom: '1.5rem', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted)' }}>
        ℹ You can complain about any student or an instructor in your current classes. The registrar must investigate and take action. Unfounded complaints may result in a warning for you.
      </div>

      {msg.text && <Alert type={msg.type}>{msg.text}</Alert>}

      <Card style={{ marginBottom: '1.5rem' }}>
        <SectionTitle>File a Complaint</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <Select label="Complain About" value={againstId} onChange={setAgainstId} options={targets} />
          <Textarea
            label="Description of Issue"
            value={text}
            onChange={setText}
            rows={4}
            placeholder="Describe the incident or behavior in detail..."
          />
          <Btn variant="primary" onClick={submit} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Complaint'}
          </Btn>
        </div>
      </Card>

      <Card>
        <SectionTitle>My Filed Complaints</SectionTitle>
        <Table
          headers={['Against', 'Role', 'Status', 'Resolution', 'Date']}
          rows={complaints.map(c => [
            c.against_name || '?',
            c.against_role || '?',
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