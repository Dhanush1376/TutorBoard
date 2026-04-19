import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import useTutorStore from '../store/tutorStore';
import { useTheme } from './ThemeContext';
import { syncSocketAuth, disconnectSocket } from '../hooks/useSocket';

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
  const [apiPrefs, setApiPrefs] = useState({ useCustomApi: false, activeProvider: null, activeLabel: null, activeId: null, allKeys: [], status: 'stable' });
  const [connectionStatus, setConnectionStatus] = useState('stable'); // stable, slow, timeout
  const { setMode, setCurrentThemeId } = useTheme();

  // Verify token on mount
  useEffect(() => {
    console.log('[Auth] Starting verification effect...');
    
    // Stage 1: Mark as slow after 8s
    const slowTimer = setTimeout(() => {
      setLoading(loading => {
        if (loading) {
          console.warn('[Auth] Connectivity warning: Server is slow to respond.');
          setConnectionStatus('slow');
        }
        return loading;
      });
    }, 8000);

    // Stage 2: Hard fail after 20s
    const failTimer = setTimeout(() => {
      setLoading(loading => {
        if (loading) {
          console.error('[Auth] Hard timeout: Server failed to respond in 20s.');
          setConnectionStatus('timeout');
          return false;
        }
        return loading;
      });
    }, 20000);

    const verifyToken = async () => {
      try {
        // Check for token in URL (Legacy Social Login direct)
        const urlParams = new URL(window.location.href).searchParams;
        const exchangeCode = urlParams.get('code');

        if (exchangeCode) {
          // Exchange one-time code for real JWT
          console.log('[Auth] Exchange code detected, trading for session...');
            // Simultaneous exchange
            const res = await fetchWithTimeout(`${API_URL}/api/auth/exchange?code=${exchangeCode}`, { timeout: 5000 });
            
            if (res.ok) {
              const data = await res.json();
              if (data.token) {
                safeStorage.setItem('tb-token', data.token);
                console.log('[Auth] Exchange successful ✨');
              }
            }
          // Clean up URL to prevent re-exchange
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        const storedToken = safeStorage.getItem('tb-token');
        const wasPreviouslyLoggedIn = !!storedToken;

        // Guest flow restoration (Must check before the storedToken early return)
        const isGuest = safeStorage.getItem('tb-is-guest') === 'true';
        if (isGuest && !storedToken) {
          console.log('[Auth] Restoring Guest session');
          setUser({ name: 'Guest', email: 'guest@tutorboard.ai', isGuest: true });
          setToken(null);
          setLoading(false);
          return;
        }

        if (!storedToken) {
          // AI Automation: If there's a prompt in the URL, auto-login as guest
          const prompt = urlParams.get('prompt');
          if (prompt) {
            console.log('[Auth] Prompt detected in URL, auto-logging in as Guest...');
            safeStorage.setItem('tb-is-guest', 'true');
            setUser({ name: 'Guest', email: 'guest@tutorboard.ai', isGuest: true });
            setToken(null);
          }
          setLoading(false);
          return;
        }

        console.log('[Auth] Verifying session with backend...');
        try {
          // Parallelize profile and API prefs fetch for high performance
          const [meRes, apiRes] = await Promise.all([
            fetchWithTimeout(`${API_URL}/api/auth/me`, {
              headers: { Authorization: `Bearer ${storedToken}` },
              timeout: 5000
            }),
            storedToken !== 'guest' ? fetchWithTimeout(`${API_URL}/api/apikeys`, { 
              headers: { Authorization: `Bearer ${storedToken}` },
              timeout: 3000
            }).catch(() => null) : Promise.resolve(null)
          ]);

          if (meRes && meRes.ok) {
            const data = await meRes.json();
            console.log('[Auth] Session verified for:', data.user?.email);
            setUser(data.user);
            setToken(storedToken);
            
            // BUG FIX: Immediately sync socket auth with verified token
            syncSocketAuth(storedToken);

            // Hydrate settings ONLY on fresh login 
            if (data.user?.settings && !wasPreviouslyLoggedIn) {
              console.log('[Auth] Fresh login detected: Hydrating settings from backend');
              const { general, appearance, canvas, privacy } = data.user.settings;
              if (general) {
                if (general.nickname) safeStorage.setItem('tb-nickname', general.nickname);
                if (general.role) safeStorage.setItem('tb-role', general.role);
                if (general.preferences) safeStorage.setItem('tb-ai-preferences', general.preferences);
                safeStorage.setItem('tb-notif-completion', String(general.notifCompletion ?? true));
                safeStorage.setItem('tb-notif-sound', String(general.notifSound ?? true));
              }
              if (appearance) {
                if (appearance.theme && typeof setMode === 'function') {
                  setMode(appearance.theme);
                }
                if (appearance.themeId && typeof setCurrentThemeId === 'function') {
                  setCurrentThemeId(appearance.themeId);
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
            }

            // Hydrate API Prefs from parallel fetch
            if (apiRes && apiRes.ok) {
              const apiData = await apiRes.json();
              const activeKey = apiData.keys?.find(k => k.isActive && k.isValid);
              const status = activeKey?.isExpired ? 'expired' : (activeKey?.isLowCredits ? 'low' : (activeKey?.isValid ? 'active' : 'stable'));
              setApiPrefs({
                useCustomApi: apiData.preferences?.useCustomApi && !!activeKey,
                activeProvider: activeKey?.provider,
                activeLabel: activeKey?.label,
                activeId: activeKey?.id || activeKey?._id || null,
                allKeys: apiData.keys || [],
                status
              });
            }
          } else if (meRes && (meRes.status === 401 || meRes.status === 403)) {
            console.warn('[Auth] Session invalidated by server:', meRes.status);
            safeStorage.removeItem('tb-token');
            setToken(null);
            setUser(null);
          } else {
            console.error('[Auth] Server error during verification');
            setUser(null);
          }
        } catch (err) {
          console.error('[Auth] Network error or timeout during verification:', err.name || err);
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
    return () => {
      clearTimeout(slowTimer);
      clearTimeout(failTimer);
    };
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

    // BUG FIX: Immediate socket sync after login
    try { syncSocketAuth(data.token); } catch (e) { console.warn('[Auth] Socket sync failed after login'); }

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

    // BUG FIX: Immediate socket sync after signup
    try { syncSocketAuth(data.token); } catch (e) { console.warn('[Auth] Socket sync failed after signup'); }

    return data;
  }, []);

  const loginGuest = useCallback(() => {
    safeStorage.removeItem('tb-token');
    safeStorage.setItem('tb-is-guest', 'true');
    setToken(null);
    setUser({ name: 'Guest', email: 'guest@tutorboard.ai', isGuest: true });

    // BUG FIX: Sync socket to Guest mode
    syncSocketAuth('guest');

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
    localStorage.removeItem('tutorboard-session');

    // 4. Update memory state
    safeStorage.removeItem('tb-is-guest');
    setToken(null);
    setUser(null);

    // 5. Cleanup Socket (Destroy singleton on logout for security)
    try { disconnectSocket(); } catch (e) { console.warn('[Auth] Socket disconnect failed'); }

    // 6. Force navigation to landing to ensure clean state
    window.location.href = '/';
  }, []);

  // Update user object in-memory (for immediate UI reflection after Settings changes)
  const updateUser = useCallback((updates) => {
    setUser(prev => prev ? { ...prev, ...updates } : prev);
  }, []);

  const refreshApiPrefs = useCallback(async () => {
    if (!token || user?.isGuest) return;
    try {
      const res = await fetch(`${API_URL}/api/apikeys`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        const activeKey = data.keys?.find(k => k.isActive && k.isValid);
        const status = activeKey?.isExpired ? 'expired' : (activeKey?.isLowCredits ? 'low' : (activeKey?.isValid ? 'active' : 'stable'));
        setApiPrefs({
          useCustomApi: data.preferences?.useCustomApi && !!activeKey,
          activeProvider: activeKey?.provider,
          activeLabel: activeKey?.label,
          activeId: activeKey?.id || activeKey?._id || null,
          allKeys: data.keys || [],
          status
        });
      }
    } catch (e) { /* silent */ }
  }, [token, user]);

  const switchApi = useCallback(async (keyId) => {
    if (!token || user?.isGuest) return;
    try {
      if (keyId === 'Universal') {
        const res = await fetch(`${API_URL}/api/apikeys/preferences`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ useCustomApi: false })
        });
        if (res.ok) refreshApiPrefs();
        return;
      }

      const res = await fetch(`${API_URL}/api/apikeys/${keyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ isActive: true })
      });
      
      if (res.ok) {
        await fetch(`${API_URL}/api/apikeys/preferences`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ useCustomApi: true })
        });
        refreshApiPrefs();
      }
    } catch (e) { /* silent */ }
  }, [token, user, refreshApiPrefs]);

  const isAuthenticated = !!user;

  const forceStopLoading = useCallback(() => {
    console.warn('[Auth] Manual loading bypass triggered');
    setLoading(false);
    setConnectionStatus('stable');
  }, []);

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
      refreshApiPrefs,
      switchApi,
      connectionStatus,
      forceStopLoading
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
