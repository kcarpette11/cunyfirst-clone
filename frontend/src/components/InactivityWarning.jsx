import { useState, useEffect } from 'react';
import { useAuth } from '../auth.jsx';

export default function InactivityWarning() {
    const { logout } = useAuth();
    const [showWarning, setShowWarning] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);

    useEffect(() => {
        let warningTimeout;
        let countdownInterval;

        // Time settings (match with your auth.jsx)
        const AUTO_LOGOUT_TIME = 30 * 60 * 1000; // 30 minutes
        const WARNING_TIME = 29 * 60 * 1000; // Show warning at 29 minutes
        const WARNING_DURATION = 60; // 60 seconds warning countdown

        const clearAllTimers = () => {
            if (warningTimeout) clearTimeout(warningTimeout);
            if (countdownInterval) clearInterval(countdownInterval);
        };

        const showWarningWithCountdown = () => {
            setShowWarning(true);
            setTimeLeft(WARNING_DURATION);

            countdownInterval = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        clearInterval(countdownInterval);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        };

        const startTimers = () => {
            clearAllTimers();
            warningTimeout = setTimeout(() => {
                showWarningWithCountdown();
            }, WARNING_TIME);
        };

        const resetTimers = () => {
            if (showWarning) setShowWarning(false);
            clearAllTimers();
            startTimers();
        };

        // Set up event listeners
        const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click', 'mousemove'];
        events.forEach(event => {
            window.addEventListener(event, resetTimers);
        });

        startTimers();

        // Check when countdown reaches 0
        const checkWarningInterval = setInterval(() => {
            if (showWarning && timeLeft <= 0) {
                logout(true);
                setShowWarning(false);
                clearAllTimers();
            }
        }, 1000);

        return () => {
            events.forEach(event => {
                window.removeEventListener(event, resetTimers);
            });
            clearAllTimers();
            clearInterval(checkWarningInterval);
        };
    }, [logout, showWarning, timeLeft]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (!showWarning) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            background: 'var(--surface)',
            border: '2px solid var(--warn)',
            borderRadius: '12px',
            padding: '1.25rem',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            zIndex: 1000,
            minWidth: '320px',
            animation: 'slideIn 0.3s ease-out'
        }}>
            <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '24px' }}>⚠️</span>
                <div style={{ fontWeight: 600, color: 'var(--warn)', fontSize: '16px' }}>
                    Session Expiring Soon
                </div>
            </div>

            <div style={{ fontSize: '14px', color: 'var(--text)', marginBottom: '1rem', lineHeight: '1.5' }}>
                You'll be automatically logged out in{' '}
                <strong style={{
                    color: 'var(--danger)',
                    fontSize: '18px',
                    animation: timeLeft <= 10 ? 'pulse 1s infinite' : 'none'
                }}>
                    {formatTime(timeLeft)}
                </strong>{' '}
                due to inactivity.
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                    onClick={() => {
                        setShowWarning(false);
                        window.dispatchEvent(new Event('mousedown'));
                    }}
                    style={{
                        background: 'var(--accent)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '0.6rem 1rem',
                        cursor: 'pointer',
                        flex: 1,
                        fontSize: '14px',
                        fontWeight: 600,
                        transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#2563eb';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--accent)';
                        e.currentTarget.style.transform = 'translateY(0)';
                    }}
                >
                    Stay Logged In
                </button>

                <button
                    onClick={() => {
                        logout(false);
                    }}
                    style={{
                        background: 'none',
                        color: 'var(--text)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        padding: '0.6rem 1rem',
                        cursor: 'pointer',
                        flex: 1,
                        fontSize: '14px',
                        fontWeight: 500,
                        transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--surface2)';
                        e.currentTarget.style.borderColor = 'var(--danger)';
                        e.currentTarget.style.color = 'var(--danger)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'none';
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.color = 'var(--text)';
                    }}
                >
                    Logout Now
                </button>
            </div>
        </div>
    );
}