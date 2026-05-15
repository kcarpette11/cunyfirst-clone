import { useState } from 'react';
import { useAuth } from '../auth.jsx';
import { Card, PageTitle, Input, Btn, Alert } from '../components/UI.jsx';

const API_BASE = 'http://localhost:8000';

export default function Login({ navigate }) {
  const { login, currentUser } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [pwUser, setPwUser] = useState(null);

  const doLogin = async () => {
    setError('');
    setLoading(true);

    try {
      const user = await login(username, password);
      if (!user) {
        setError('Invalid username or password.');
        setLoading(false);
        return;
      }

      if (user.mustChangePassword) {
        setPwUser(user);
        setChangingPw(true);
        setLoading(false);
        return;
      }

      // Navigate based on role - all roles go to 'home' which will show their specific home page
      navigate('home');

    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
      setLoading(false);
    }
  };

  const doChangePw = async () => {
    if (newPw.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPw !== newPw2) {
      setError('Passwords do not match.');
      return;
    }

    try {
      // Call backend to change password
      const response = await fetch(`${API_BASE}/api/user/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: pwUser.id,
          newPassword: newPw
        })
      });

      const result = await response.json();

      if (result.success) {
        navigate('home');
      } else {
        setError(result.message || 'Failed to change password');
      }
    } catch (error) {
      setError('Failed to connect to server');
    }
  };

  const DEMO_ACCOUNTS = [
    { label: 'Registrar', u: 'dean', p: 'dean123' },
    { label: 'Instructor Chen', u: 'chen', p: 'chen123' },
    { label: 'Instructor Okafor', u: 'okafor', p: 'okafor123' },
    { label: 'Student Alice', u: 'alice', p: 'alice123' },
    { label: 'Student Ben', u: 'ben', p: 'ben123' },
    { label: 'Student Cora', u: 'cora', p: 'cora123' },
  ];

  if (changingPw) return (
    <div style={{ maxWidth: '400px', margin: '4rem auto' }}>
      <PageTitle sub="First login detected">Set New Password</PageTitle>
      <Card>
        <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '1rem' }}>Your account requires a password change before continuing.</p>
        {error && <Alert type="danger">{error}</Alert>}
        <Input label="New Password" type="password" value={newPw} onChange={setNewPw} style={{ marginBottom: '1rem' }} />
        <Input label="Confirm Password" type="password" value={newPw2} onChange={setNewPw2} style={{ marginBottom: '1.5rem' }} />
        <Btn variant="primary" onClick={doChangePw} style={{ width: '100%' }}>Set Password & Continue</Btn>
      </Card>
    </div>
  );

  // If user is already logged in, redirect to home
  return (
    <div style={{ maxWidth: '440px', margin: '4rem auto' }}>
      <PageTitle sub="Access your CunyZero account">Sign In</PageTitle>
      <Card>
        {error && <Alert type="danger">{error}</Alert>}
        <Input
          label="Username"
          value={username}
          onChange={setUsername}
          style={{ marginBottom: '1rem' }}
          onKeyDown={(e) => e.key === 'Enter' && doLogin()}
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          style={{ marginBottom: '1.5rem' }}
          onKeyDown={(e) => e.key === 'Enter' && doLogin()}
        />
        <Btn
          variant="primary"
          onClick={doLogin}
          style={{ width: '100%' }}
          disabled={loading}
        >
          {loading ? 'Logging in...' : 'Login'}
        </Btn>
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <button
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent2)',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              cursor: 'pointer'
            }}
            onClick={() => navigate('apply')}
          >
            Not a member? Apply →
          </button>
        </div>
      </Card>

      <Card style={{ marginTop: '1rem' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Demo Accounts
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {DEMO_ACCOUNTS.map(acc => (
            <button
              key={acc.u}
              onClick={() => {
                setUsername(acc.u);
                setPassword(acc.p);
                setError('');
              }}
              style={{
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                borderRadius: '4px',
                padding: '0.3rem 0.6rem',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--accent)';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--surface2)';
                e.currentTarget.style.color = 'var(--text)';
              }}
            >
              {acc.label}
            </button>
          ))}
        </div>
        <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '0.5rem', fontFamily: 'var(--font-mono)' }}>
          Click to fill credentials, then press Login.
        </p>
      </Card>
    </div>
  );
}