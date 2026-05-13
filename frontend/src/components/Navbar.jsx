import { useAuth } from '../auth.jsx';
import { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:8000';

const s = {
  nav: {
    background: '#2563eb',
    borderBottom: 'none',
    padding: '0 2rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0',
    height: '64px',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  logo: {
    fontFamily: 'var(--font-display)',
    fontSize: '1.4rem',
    fontWeight: 700,
    color: '#ffffff',
    marginRight: '2rem',
    cursor: 'pointer',
    letterSpacing: '-0.01em',
  },
  links: {
    display: 'flex',
    gap: '0.25rem',
    flex: 1,
    alignItems: 'center'
  },
  link: {
    background: 'none',
    border: 'none',
    color: '#ffffff',
    fontFamily: 'var(--font-body)',
    fontSize: '14px',
    fontWeight: 500,
    padding: '0.5rem 1rem',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  activeLink: {
    color: '#ffffff',
    background: 'rgba(255,255,255,0.2)',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem'
  },
  notifBtn: {
    background: 'rgba(255,255,255,0.15)',
    border: 'none',
    color: '#ffffff',
    borderRadius: '8px',
    fontFamily: 'var(--font-body)',
    fontSize: '16px',
    padding: '0.5rem',
    cursor: 'pointer',
    position: 'relative',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    background: '#ef4444',
    color: '#fff',
    borderRadius: '999px',
    padding: '0 5px',
    fontSize: '10px',
    fontWeight: 600,
    position: 'absolute',
    top: '0px',
    right: '0px',
    fontFamily: 'var(--font-mono)',
    minWidth: '16px',
    height: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userChip: {
    fontFamily: 'var(--font-body)',
    fontSize: '13px',
    fontWeight: 500,
    color: '#ffffff',
    background: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '8px',
    padding: '0.4rem 0.9rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  logoutBtn: {
    background: 'none',
    border: '1px solid rgba(255,255,255,0.3)',
    color: '#ffffff',
    borderRadius: '8px',
    fontFamily: 'var(--font-body)',
    fontSize: '13px',
    fontWeight: 500,
    padding: '0.4rem 1rem',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  loginBtn: {
    background: '#fbbf24',
    border: 'none',
    color: '#1f2937',
    borderRadius: '8px',
    fontFamily: 'var(--font-body)',
    fontSize: '13px',
    fontWeight: 600,
    padding: '0.5rem 1.5rem',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  },
  dropdown: {
    position: 'absolute',
    top: '56px',
    right: '0',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    width: '360px',
    maxHeight: '480px',
    overflowY: 'auto',
    zIndex: 200,
    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
  },
  notifItem: {
    padding: '0.875rem 1rem',
    borderBottom: '1px solid var(--border)',
    fontSize: '13px',
    display: 'flex',
    gap: '0.75rem',
    transition: 'background 0.2s',
  },
};

const ROLE_LINKS = {
  registrar: [
    { label: 'Home', page: 'home' },
    { label: 'Applications', page: 'applications' },
    { label: 'Semester', page: 'semester' },
    { label: 'Classes', page: 'classes' },
    { label: 'Grades', page: 'grades' },
    { label: 'Complaints', page: 'complaints' },
    { label: 'Taboo Words', page: 'taboo' },
  ],
  instructor: [
    { label: 'Home', page: 'home' },
    { label: 'My Classes', page: 'myclasses' },
    { label: 'Grades', page: 'grades' },
    { label: 'Complaints', page: 'complaints' },
  ],
  student: [
    { label: 'Home', page: 'home' },
    { label: 'Register', page: 'register' },
    { label: 'Reviews', page: 'reviews' },
    { label: 'Complaints', page: 'complaints' },
    { label: 'Graduation', page: 'graduation' },
  ],
};

const NOTIF_COLORS = {
  danger: 'var(--danger)',
  warn: 'var(--warn)',
  success: 'var(--success)',
  info: 'var(--accent)'
};

export default function Navbar({ navigate, currentPage }) {
  const { currentUser, logout } = useAuth();
  const [showNotif, setShowNotif] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch notifications from backend
  const fetchNotifications = async () => {
    if (!currentUser) return;

    try {
      const response = await fetch(`${API_BASE}/api/notifications/${currentUser.id}`);
      const data = await response.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.notifications?.filter(n => !n.read).length || 0);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [currentUser, refreshTrigger]);

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    if (!currentUser) return;

    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const markAsRead = async (notificationId) => {
    try {
      await fetch(`${API_BASE}/api/notifications/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId })
      });
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch(`${API_BASE}/api/notifications/read-all/${currentUser.id}`, {
        method: 'POST'
      });
      setRefreshTrigger(prev => prev + 1);
      setShowNotif(false);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  // Get navigation links based on authentication status
  const getNavLinks = () => {
    if (!currentUser) {
      return [
        { label: 'Home', page: 'dashboard' },
        { label: 'Apply', page: 'apply' }
      ];
    }
    return ROLE_LINKS[currentUser.role] || [];
  };

  const navLinks = getNavLinks();
  const handleLogout = () => {
    logout();
    navigate('dashboard');
  };

  return (
    <nav style={s.nav}>
      <span style={s.logo} onClick={() => navigate('dashboard')}>
        CunyZero
      </span>

      <div style={s.links}>
        {navLinks.map(l => (
          <button
            key={l.page}
            style={{ ...s.link, ...(currentPage === l.page ? s.activeLink : {}) }}
            onClick={() => navigate(l.page)}
          >
            {l.label}
          </button>
        ))}
      </div>

      <div style={s.right}>
        {currentUser ? (
          <>
            <span style={s.userChip}>
              <span>👤</span>
              {currentUser.name || currentUser.username || 'User'}  {/* Fallback */}
              <span style={{
                color: 'rgba(255,255,255,0.7)',
                fontSize: '11px',
                marginLeft: '0.25rem'
              }}>
                [{currentUser.role.toUpperCase()}]
              </span>
              {currentUser.warnings > 0 && (
                <span style={{
                  color: '#fbbf24',
                  fontSize: '12px',
                  marginLeft: '0.25rem'
                }}>
                  ⚠{currentUser.warnings}
                </span>
              )}
            </span>

            <div style={{ position: 'relative' }}>
              <button
                style={s.notifBtn}
                onClick={() => setShowNotif(v => !v)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.25)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
                }}
              >
                🔔
                {unreadCount > 0 && <span style={s.badge}>{unreadCount}</span>}
              </button>

              {showNotif && (
                <div style={s.dropdown}>
                  <div style={{
                    padding: '0.75rem 1rem',
                    fontFamily: 'var(--font-body)',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text)',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    NOTIFICATIONS
                    {unreadCount > 0 && (
                      <button
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--accent)',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 500
                        }}
                        onClick={markAllAsRead}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  {notifications.length === 0 && (
                    <div style={{
                      padding: '2rem',
                      color: 'var(--muted)',
                      fontSize: '13px',
                      textAlign: 'center'
                    }}>
                      No notifications
                    </div>
                  )}

                  {notifications.map(n => (
                    <div
                      key={n.id}
                      style={{
                        ...s.notifItem,
                        opacity: n.read ? 0.6 : 1,
                        background: n.read ? 'transparent' : 'rgba(59,130,246,0.02)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--surface2)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(59,130,246,0.02)';
                      }}
                    >
                      <span style={{ color: NOTIF_COLORS[n.type] || 'var(--text)', fontSize: '16px' }}>
                        {n.type === 'danger' ? '⛔' : n.type === 'warn' ? '⚠️' : n.type === 'success' ? '✅' : 'ℹ️'}
                      </span>
                      <span style={{ flex: 1, color: 'var(--text)' }}>{n.message}</span>
                      {!n.read && (
                        <button
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--accent)',
                            cursor: 'pointer',
                            fontSize: '14px',
                            padding: '0 0.25rem'
                          }}
                          onClick={() => markAsRead(n.id)}
                        >
                          ✓
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              style={s.logoutBtn}
              onClick={handleLogout}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
              }}
            >
              Logout
            </button>
          </>
        ) : (
          <button
            style={s.loginBtn}
            onClick={() => navigate('login')}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f59e0b';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#fbbf24';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Login
          </button>
        )}
      </div>
    </nav>
  );
}