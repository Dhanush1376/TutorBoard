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
  const [apiPrefs, setApiPrefs] = useState({ useCustomApi: false, activeProvider: null });

  // Verify token on mount
  useEffect(() => {
    const verifyToken = async () => {
      // Check for token in URL (Legacy Social Login direct)
      const urlParams = new URL(window.location.href).searchParams;
      const urlToken = urlParams.get('token');
      const exchangeCode = urlParams.get('code');

      if (urlToken) {
        localStorage.setItem('tb-token', urlToken);
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (exchangeCode) {
        // Exchange one-time code for real JWT
        console.log('[Auth] Exchange code detected, trading for session...');
        try {
          // Simultaneous exchange and cinematic delay
          const [res] = await Promise.all([
            fetch(`${API_URL}/api/auth/exchange?code=${exchangeCode}`),
            new Promise(resolve => setTimeout(resolve, 1500)) // Guarantee animation visibility
          ]);
          
          if (res.ok) {
            const data = await res.json();
            if (data.token) {
              localStorage.setItem('tb-token', data.token);
              console.log('[Auth] Exchange successful ✨');
            }
          }
        } catch (e) {
          console.error('[Auth] Code exchange failed:', e);
        }
        // Clean up URL to prevent re-exchange
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

            // Centralized API Prefs Fetch
            if (storedToken !== 'guest') {
              try {
                const apiRes = await fetch(`${API_URL}/api/apikeys`, { headers: { Authorization: `Bearer ${storedToken}` } });
                if (apiRes.ok) {
                  const apiData = await apiRes.json();
                  const activeKey = apiData.keys?.find(k => k.isActive && k.isValid);
                  setApiPrefs({
                    useCustomApi: apiData.preferences?.useCustomApi && !!activeKey,
                    activeProvider: activeKey?.provider
                  });
                }
              } catch (e) { console.warn('[Auth] Failed to pre-fetch API prefs'); }
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

  // Trial Mode Refresh Protection
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (user?.isGuest) {
        const msg = 'You are in Trial Mode. Your history and settings will not be saved. Are you sure you want to leave?';
        e.preventDefault();
        e.returnValue = msg;
        return msg;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [user]);

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
    // Force default layout to Standard (Left) for guests
    useTutorStore.getState().setLayoutView('left');
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('tb-token');
    setToken(null);
    setUser(null);
  }, []);

  // Update user object in-memory (for immediate UI reflection after Settings changes)
  const updateUser = useCallback((updates) => {
    setUser(prev => prev ? { ...prev, ...updates } : prev);
  }, []);

  const refreshApiPrefs = useCallback(async () => {
    if (!token || token === 'guest') return;
    try {
      const res = await fetch(`${API_URL}/api/apikeys`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        const activeKey = data.keys?.find(k => k.isActive && k.isValid);
        setApiPrefs({
          useCustomApi: data.preferences?.useCustomApi && !!activeKey,
          activeProvider: activeKey?.provider
        });
      }
    } catch (e) { /* silent */ }
  }, [token]);

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
      updateUser,
      isAuthenticated,
      apiPrefs,
      refreshApiPrefs
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
