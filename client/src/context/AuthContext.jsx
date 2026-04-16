import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import useTutorStore from '../store/tutorStore';

const AuthContext = createContext(null);

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

if (import.meta.env.PROD && !import.meta.env.VITE_API_URL) {
  throw new Error('[Auth] CRITICAL: VITE_API_URL is missing in production environment. Authentication will fail.');
}

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
        // AI Automation: If there's a prompt in the URL, auto-login as guest
        const prompt = urlParams.get('prompt');
        if (prompt) {
          console.log('[Auth] Prompt detected in URL, auto-logging in as Guest...');
          localStorage.setItem('tb-token', 'guest');
          setUser({ name: 'Guest', email: 'guest@tutorboard.ai', isGuest: true });
          setToken('guest');
        }
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

      console.log('[Auth] Verifying session...');
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });

        if (res.ok) {
          const data = await res.json();
          console.log('[Auth] Session verified for:', data.user?.email);
          setUser(data.user);
          setToken(storedToken);

          // Hydrate settings
          if (data.user?.settings) {
            console.log('[Auth] Hydrating settings from backend');
            const { general, appearance, canvas, privacy } = data.user.settings;
            if (general) {
              if (general.nickname) localStorage.setItem('tb-nickname', general.nickname);
              if (general.role) localStorage.setItem('tb-role', general.role);
              if (general.preferences) localStorage.setItem('tb-ai-preferences', general.preferences);
              localStorage.setItem('tb-notif-completion', String(general.notifCompletion ?? true));
              localStorage.setItem('tb-notif-sound', String(general.notifSound ?? true));
            }
            if (appearance) {
              if (appearance.theme) {
                localStorage.setItem('tb-theme', appearance.theme);
                const root = document.documentElement;
                if (appearance.theme === 'dark') root.classList.add('dark');
                else if (appearance.theme === 'light') root.classList.remove('dark');
              }
              try {
                useTutorStore.setState({
                  showMinimap: appearance.showMinimap ?? true,
                  showGrid: appearance.showGrid ?? true,
                  layoutView: appearance.layoutView || 'left'
                });
              } catch (e) { console.warn('[Auth] Store hydration failed (appearance):', e); }
            }
            if (canvas) {
              try {
                useTutorStore.setState({
                  drawWidth: canvas.drawWidth || 4,
                  textToolSize: canvas.textToolSize || 24,
                  gridType: canvas.gridType || 'dots',
                  isSnapToGrid: canvas.isSnapToGrid || false,
                  noteColor: canvas.noteColor || '#fef9c3',
                  noteSize: canvas.noteSize || 'M'
                });
              } catch (e) { console.warn('[Auth] Store hydration failed (canvas):', e); }
            }
            if (privacy) {
              localStorage.setItem('tb-cloud-sync', String(privacy.cloudSync ?? true));
              localStorage.setItem('tb-local-history', String(privacy.localHistory ?? true));
            }
          }
        } else {
          console.warn('[Auth] Session invalid, status:', res.status);
          localStorage.removeItem('tb-token');
          setToken(null);
          setUser(null);
        }
      } catch (err) {
        console.error('[Auth] Token verification failed:', err);
        setUser(null);
      } finally {
        console.log('[Auth] Verification complete, clearing loader');
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
