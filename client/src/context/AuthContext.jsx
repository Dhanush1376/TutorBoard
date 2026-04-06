import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('tb-token'));
  const [loading, setLoading] = useState(true);

  // Verify token on mount
  useEffect(() => {
    const verifyToken = async () => {
      // Check for token in URL (Social Login redirect)
      const urlParams = new URL(window.location.href).searchParams;
      const urlToken = urlParams.get('token');
      
      if (urlToken) {
        localStorage.setItem('tb-token', urlToken);
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      const storedToken = localStorage.getItem('tb-token');
      if (!storedToken) {
        setLoading(false);
        return;
      }

      // Guest flow bypass
      if (storedToken === 'guest') {
        setUser({ name: 'Guest', email: 'guest@tutorboard.ai', isGuest: true });
        setToken('guest');
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });

        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          setToken(storedToken);
        } else {
          // Token invalid — clear it
          localStorage.removeItem('tb-token');
          setToken(null);
          setUser(null);
        }
      } catch (err) {
        console.error('Token verification failed:', err);
        // Keep token if it's just a network error (server might be down)
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await fetch(`${API_URL}/api/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
    }

    localStorage.setItem('tb-token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data;
  }, []);

  const signup = useCallback(async (name, email, password, confirmPassword) => {
    const res = await fetch(`${API_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, confirmPassword }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Signup failed');
    }

    localStorage.setItem('tb-token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data;
  }, []);

  const loginGuest = useCallback(() => {
    localStorage.setItem('tb-token', 'guest');
    setToken('guest');
    setUser({ name: 'Guest', email: 'guest@tutorboard.ai', isGuest: true });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('tb-token');
    setToken(null);
    setUser(null);
  }, []);

  const isAuthenticated = !!user && !!token;

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      login,
      signup,
      loginGuest,
      logout,
      isAuthenticated,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
