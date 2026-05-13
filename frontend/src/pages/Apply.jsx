import { useState } from 'react';
import { Card, PageTitle, Input, Select, Textarea, Btn, Alert } from '../components/UI.jsx';

const API_BASE = 'http://localhost:8000';

export default function Apply({ navigate }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('student');
  const [incomingGpa, setIncomingGpa] = useState('');
  const [program, setProgram] = useState('');
  const [statement, setStatement] = useState('');
  const [submitted, setSubmitted] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!name || !statement) {
      setError('Name and statement are required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Prepare data based on role
      const applicationData = {
        applicant_type: role,
        name: name,
        email: email || null,
        statement: statement,
      };

      // Add student-specific fields
      if (role === 'student') {
        if (incomingGpa && (parseFloat(incomingGpa) < 0 || parseFloat(incomingGpa) > 4.0)) {
          setError('GPA must be between 0.0 and 4.0');
          setLoading(false);
          return;
        }
        applicationData.incoming_gpa = incomingGpa ? parseFloat(incomingGpa) : null;
        applicationData.program = program || null;
      }

      const response = await fetch(`${API_BASE}/api/application/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(applicationData)
      });

      const result = await response.json();

      if (result.success) {
        setSubmitted({
          id: result.applicationId,
          name: name,
          role: role
        });
      } else {
        setError(result.message || 'Failed to submit application');
      }
    } catch (error) {
      console.error('Failed to submit application:', error);
      setError('Failed to connect to server. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) return (
    <div style={{ maxWidth: '500px', margin: '4rem auto' }}>
      <Card>
        <div style={{ textAlign: 'center', padding: '1rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✉️</div>
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)', fontSize: '1.5rem' }}>Application Submitted</h2>
          <p style={{ color: 'var(--muted)', margin: '1rem 0', lineHeight: 1.6 }}>
            Thank you, <strong style={{ color: 'var(--text)' }}>{submitted.name}</strong>. Your application to join CunyZero as a <strong style={{ color: 'var(--text)' }}>{submitted.role}</strong> has been received.
          </p>
          <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '1.5rem' }}>
            The registrar will review your application. Accepted applicants will receive login credentials via email.
          </p>
          <Btn variant="ghost" onClick={() => navigate('dashboard')}>← Back to Home</Btn>
        </div>
      </Card>
    </div>
  );

  return (
    <div style={{ maxWidth: '500px', margin: '3rem auto' }}>
      <PageTitle sub="Apply to join CunyZero">Application</PageTitle>
      <Card>
        {error && <Alert type="danger">{error}</Alert>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Input label="Full Name" value={name} onChange={setName} required />
          <Input label="Email Address (optional)" type="email" value={email} onChange={setEmail} />
          <Select
            label="Applying as"
            value={role}
            onChange={(val) => {
              setRole(val);
              // Reset role-specific fields
              setIncomingGpa('');
              setProgram('');
            }}
            options={[
              { value: 'student', label: 'Student' },
              { value: 'instructor', label: 'Instructor' }
            ]}
          />

          {/* Student-specific fields */}
          {role === 'student' && (
            <>
              <Input
                label="Incoming GPA (0.0 - 4.0)"
                type="number"
                step="0.01"
                min="0"
                max="4"
                value={incomingGpa}
                onChange={setIncomingGpa}
                placeholder="e.g., 3.5"
              />
              <Input
                label="Program of Interest (optional)"
                value={program}
                onChange={setProgram}
                placeholder="e.g., Computer Science, Business, etc."
              />
            </>
          )}

          <Textarea
            label="Personal Statement / Motivation"
            value={statement}
            onChange={setStatement}
            rows={5}
            required
            placeholder={role === 'student'
              ? 'Tell us about your academic background, goals, and why you want to join...'
              : 'Tell us about your teaching experience, expertise, and why you want to teach at CunyZero...'
            }
          />

          <div style={{ background: 'var(--surface2)', borderRadius: '6px', padding: '0.75rem', fontSize: '12px', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
            {role === 'student'
              ? '📌 Note: Student applicants with GPA > 3.0 will be automatically accepted if program quota is not reached. The registrar may accept/reject based on justification.'
              : '📌 Note: Instructor applications are reviewed at registrar discretion. Accepted instructors will be assigned courses based on expertise.'}
          </div>

          <Btn variant="primary" onClick={submit} disabled={loading}>
            {loading ? 'Submitting...' : 'Submit Application'}
          </Btn>
        </div>
      </Card>
    </div>
  );
}