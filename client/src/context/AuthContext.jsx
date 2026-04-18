import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import useTutorStore from '../store/tutorStore';

const AuthContext = createContext(null);

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const IS_API_MISSING = import.meta.env.PROD && !import.meta.env.VITE_API_URL;

if (IS_API_MISSING) {
  console.error('[Auth] CRITICAL: VITE_API_URL is missing in production environment. Authentication will fail. Ensure VITE_API_URL is set in your Vercel project settings.');
}

// Safe storage helper to prevent crashes in restrictive browser environments (Private Mode)
const safeStorage = {
  getItem: (key) => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('[Auth] Storage set failed:', e);
    }
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('[Auth] Storage remove failed:', e);
    }
  }
};

// Fetch with AbortController timeout to prevent permanent hangs
const fetchWithTimeout = async (resource, options = {}) => {
  const { timeout = 8000 } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => safeStorage.getItem('tb-token'));
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(IS_API_MISSING ? 'VITE_API_URL_MISSING' : null);
  const [apiPrefs, setApiPrefs] = useState({ useCustomApi: false, activeProvider: null });

  // Verify token on mount
  useEffect(() => {
    console.log('[Auth] Starting verification effect...');
    
    // Safety Net: Force clear loader after 8 seconds no matter what happens in verifyToken
    const forcedClearId = setTimeout(() => {
      setLoading(prev => {
        if (prev) {
          console.warn('[Auth] Forced loading clearance triggered after 8s hang.');
          return false;
        }
        return prev;
      });
    }, 8000);

    const verifyToken = async () => {
      try {
        // Check for token in URL (Legacy Social Login direct)
        const urlParams = new URL(window.location.href).searchParams;
        const urlToken = urlParams.get('token');
        const exchangeCode = urlParams.get('code');

        if (urlToken) {
          safeStorage.setItem('tb-token', urlToken);
          window.history.replaceState({}, document.title, window.location.pathname);
        } else if (exchangeCode) {
          // Exchange one-time code for real JWT
          console.log('[Auth] Exchange code detected, trading for session...');
          try {
            // Simultaneous exchange and cinematic delay
            const [res] = await Promise.all([
              fetchWithTimeout(`${API_URL}/api/auth/exchange?code=${exchangeCode}`, { timeout: 5000 }),
              new Promise(resolve => setTimeout(resolve, 1500)) // Guarantee animation visibility
            ]);
            
            if (res.ok) {
              const data = await res.json();
              if (data.token) {
                safeStorage.setItem('tb-token', data.token);
                console.log('[Auth] Exchange successful ✨');
              }
            }
          } catch (e) {
            console.error('[Auth] Code exchange failed:', e);
          }
          // Clean up URL to prevent re-exchange
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        const storedToken = safeStorage.getItem('tb-token');
        if (!storedToken) {
          // AI Automation: If there's a prompt in the URL, auto-login as guest
          const prompt = urlParams.get('prompt');
          if (prompt) {
            console.log('[Auth] Prompt detected in URL, auto-logging in as Guest...');
            safeStorage.setItem('tb-token', 'guest');
            setUser({ name: 'Guest', email: 'guest@tutorboard.ai', isGuest: true });
            setToken('guest');
          }
          setLoading(false);
          return;
        }

        // Guest flow bypass
        if (storedToken === 'guest') {
          console.log('[Auth] Restoring Guest session');
          setUser({ name: 'Guest', email: 'guest@tutorboard.ai', isGuest: true });
          setToken('guest');
          setLoading(false);
          return;
        }

        console.log('[Auth] Verifying session with backend...');
        try {
          const res = await fetchWithTimeout(`${API_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${storedToken}` },
            timeout: 5000
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
                if (general.nickname) safeStorage.setItem('tb-nickname', general.nickname);
                if (general.role) safeStorage.setItem('tb-role', general.role);
                if (general.preferences) safeStorage.setItem('tb-ai-preferences', general.preferences);
                safeStorage.setItem('tb-notif-completion', String(general.notifCompletion ?? true));
                safeStorage.setItem('tb-notif-sound', String(general.notifSound ?? true));
              }
              if (appearance) {
                if (appearance.theme) {
                  safeStorage.setItem('tb-theme', appearance.theme);
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
                safeStorage.setItem('tb-cloud-sync', String(privacy.cloudSync ?? true));
                safeStorage.setItem('tb-local-history', String(privacy.localHistory ?? true));
              }

              // Centralized API Prefs Fetch
              if (storedToken !== 'guest') {
                try {
                  const apiRes = await fetchWithTimeout(`${API_URL}/api/apikeys`, { 
                    headers: { Authorization: `Bearer ${storedToken}` },
                    timeout: 3000
                  });
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
            safeStorage.removeItem('tb-token');
            setToken(null);
            setUser(null);
          }
        } catch (err) {
          console.error('[Auth] Token verification fetch failed:', err);
          setUser(null);
        } finally {
          console.log('[Auth] Verification logic finished, clearing loader');
          setLoading(false);
        }
      } catch (globalErr) {
        console.error('[Auth] CRITICAL Error in verifyToken:', globalErr);
        setLoading(false);
      }
    };

    verifyToken();
    return () => clearTimeout(forcedClearId);
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
    // 1. Clear Auth Tokens
    localStorage.removeItem('tb-token');
    
    // 2. Clear Session History & Cache
    localStorage.removeItem('tutorboard-history');
    localStorage.removeItem('tutorboard-active-chat');
    localStorage.removeItem('tutorboard-agent');
    
    // 3. Clear Zustand Persisted State to prevent canvas leak
    localStorage.removeItem('zustand-tutor-store');

    // 4. Update memory state
    setToken(null);
    setUser(null);

    // 5. Force navigation to landing to ensure clean state
    window.location.href = '/';
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
      apiError,
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
