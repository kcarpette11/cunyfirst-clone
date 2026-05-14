import { createContext, useContext, useState, useEffect } from 'react';

const API_BASE = 'http://localhost:8000';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [inactivityTimeout, setInactivityTimeout] = useState(null);

  // Auto logout after inactivity
  const AUTO_LOGOUT_TIME = 30 * 60 * 1000; // 30 minutes

  // Function to clear inactivity timer
  const clearInactivityTimer = () => {
    if (inactivityTimeout) {
      clearTimeout(inactivityTimeout);
      setInactivityTimeout(null);
    }
  };

  // Function to reset inactivity timer
  const resetInactivityTimer = () => {
    if (currentUser) {
      clearInactivityTimer();
      const newTimeout = setTimeout(() => {
        console.log('Auto-logging out due to inactivity');
        logout(true);
      }, AUTO_LOGOUT_TIME);
      setInactivityTimeout(newTimeout);
    }
  };

  // Set up activity listeners
  useEffect(() => {
    if (currentUser) {
      const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click'];

      const handleActivity = () => {
        resetInactivityTimer();
      };

      events.forEach(event => {
        window.addEventListener(event, handleActivity);
      });

      resetInactivityTimer();

      return () => {
        events.forEach(event => {
          window.removeEventListener(event, handleActivity);
        });
        clearInactivityTimer();
      };
    }
  }, [currentUser]);

  // Load user from sessionStorage on initial load and verify with backend
  useEffect(() => {
    const loadUser = async () => {
      const storedUser = sessionStorage.getItem('college0_user');
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          // Verify user still exists in backend
          const response = await fetch(`${API_BASE}/api/user/${user.id}`);
          if (response.ok) {
            const dbUser = await response.json();
            if (dbUser && !dbUser.terminated) {
              setCurrentUser(dbUser);
            } else {
              sessionStorage.removeItem('college0_user');
            }
          } else {
            sessionStorage.removeItem('college0_user');
          }
        } catch (error) {
          console.error('Error loading user from storage:', error);
          sessionStorage.removeItem('college0_user');
        }
      }
      setLoading(false);
    };

    loadUser();
  }, []);

  // Login function using backend API
  const login = async (username, password) => {
    try {
      const response = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Login failed');
      }

      const user = await response.json();

      if (user.terminated) {
        throw new Error('Account terminated. Please contact registrar.');
      }

      // Store user in sessionStorage (clears when browser/tab closes)
      const { password: _, ...userWithoutPassword } = user;
      sessionStorage.setItem('college0_user', JSON.stringify(userWithoutPassword));

      setCurrentUser(user);
      return user;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  // Logout function
  const logout = async (isAutoLogout = false) => {
    if (!isAutoLogout) {
      try {
        await fetch(`${API_BASE}/api/logout`, { method: 'POST' });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }

    sessionStorage.removeItem('college0_user');
    setCurrentUser(null);
    clearInactivityTimer();

    if (isAutoLogout) {
      console.log('Logged out due to inactivity');
    }
  };

  // Update current user data
  const updateCurrentUser = async (updatedData) => {
    if (currentUser) {
      try {
        const response = await fetch(`${API_BASE}/api/user/${currentUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedData)
        });

        if (response.ok) {
          const updatedUser = await response.json();
          const { password: _, ...userWithoutPassword } = updatedUser;
          sessionStorage.setItem('college0_user', JSON.stringify(userWithoutPassword));
          setCurrentUser(updatedUser);
        }
      } catch (error) {
        console.error('Failed to update user:', error);
      }
    }
  };

  const getRemainingTime = () => {
    return AUTO_LOGOUT_TIME / 1000;
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      login,
      logout,
      updateCurrentUser,
      loading,
      getRemainingTime
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
