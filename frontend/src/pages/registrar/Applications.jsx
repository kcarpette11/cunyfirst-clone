import { useState, useEffect } from 'react';
import { PageTitle, Card, Table, Btn, Textarea, Tag, Alert } from '../../components/UI.jsx';

const API_BASE = 'http://localhost:8000';

export default function Applications({ navigate }) {
  const [loading, setLoading] = useState(true);
  const [pendingApps, setPendingApps] = useState([]);
  const [processedApps, setProcessedApps] = useState([]);
  const [justification, setJustification] = useState({});
  const [msg, setMsg] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch applications from backend
  const fetchApplications = async () => {
    try {
      setLoading(true);

      const response = await fetch(`${API_BASE}/api/applications`);
      const data = await response.json();
      const all = data.applications || [];

      setPendingApps(all.filter(a => a.status === 'pending'));
      setProcessedApps(all.filter(a => a.status !== 'pending'));
    } catch (error) {
      console.error('Failed to fetch applications:', error);
      setMsg('Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, [refreshTrigger]);

  const handle = async (appId, decision) => {
    const j = justification[appId] || '';

    try {
      const response = await fetch(`${API_BASE}/api/application/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: appId,
          decision: decision,
          justification: j
        })
      });

      const result = await response.json();

      if (result.success) {
        setMsg(`Application ${decision}. ${result.message || ''}`);
        setRefreshTrigger(prev => prev + 1);
        // Clear justification for this app
        setJustification(j => {
          const newJ = { ...j };
          delete newJ[appId];
          return newJ;
        });
      } else {
        setMsg(`Error: ${result.message}`);
      }

      setTimeout(() => setMsg(''), 3000);
    } catch (error) {
      console.error('Failed to process application:', error);
      setMsg('Failed to process application');
      setTimeout(() => setMsg(''), 3000);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div>Loading applications...</div>
      </div>
    );
  }

  return (
    <div>
      <PageTitle sub="Review and process applicant submissions">Applications</PageTitle>
      {msg && <Alert type={msg.startsWith('Error') ? 'danger' : 'success'}>{msg}</Alert>}

      <Card>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--text)', marginBottom: '1rem' }}>
          Pending ({pendingApps.length})
        </div>
        {pendingApps.length === 0 && <p style={{ color: 'var(--muted)' }}>No pending applications.</p>}
        {pendingApps.map(app => (
          <div key={app.id} style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '1rem' }}>{app.name}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted)' }}>{app.email}</div>
                <Tag color={app.applicant_type === 'student' ? 'var(--accent2)' : 'var(--accent)'}>
                  {app.applicant_type}
                </Tag>
                {app.incoming_gpa && (
                  <Tag color="var(--muted)" style={{ marginLeft: '0.5rem' }}>
                    GPA: {app.incoming_gpa}
                  </Tag>
                )}
                {app.program && (
                  <Tag color="var(--muted)" style={{ marginLeft: '0.5rem' }}>
                    Program: {app.program}
                  </Tag>
                )}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                {new Date(app.created_at).toLocaleDateString()}
              </div>
            </div>
            <div style={{ background: 'var(--surface2)', borderRadius: '4px', padding: '0.75rem', marginBottom: '0.75rem', fontSize: '13px', color: 'var(--muted)', fontStyle: 'italic' }}>
              "{app.statement}"
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <Textarea
                  label="Justification (required if rejecting a student who should qualify)"
                  value={justification[app.id] || ''}
                  onChange={v => setJustification(j => ({ ...j, [app.id]: v }))}
                  rows={2}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Btn variant="success" onClick={() => handle(app.id, 'accepted')}>Accept</Btn>
                <Btn variant="danger" onClick={() => handle(app.id, 'rejected')}>Reject</Btn>
              </div>
            </div>
          </div>
        ))}
      </Card>

      <Card style={{ marginTop: '1.5rem' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--text)', marginBottom: '1rem' }}>
          Processed ({processedApps.length})
        </div>
        <Table
          headers={['Name', 'Role', 'Decision', 'Credentials', 'Date']}
          rows={processedApps.map(app => [
            app.name,
            app.applicant_type,
            <Tag key="d" color={app.status === 'accepted' ? 'var(--success)' : 'var(--danger)'}>
              {app.status}
            </Tag>,
            app.assigned_username ? (
              <span key="c" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                user: {app.assigned_username} / pw: {app.assigned_password}
              </span>
            ) : '—',
            new Date(app.created_at).toLocaleDateString()
          ])}
        />
      </Card>
    </div>
  );
}