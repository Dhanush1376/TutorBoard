import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useTutorStore from '../store/tutorStore';
import { useTheme } from './ThemeContext';
import API, { BASE_URL as API_URL } from '../services/api';
import { syncSocketAuth, disconnectSocket } from '../hooks/useSocket';

const AuthContext = createContext(null);

const IS_API_MISSING = import.meta.env.PROD && !import.meta.env.VITE_API_BASE_URL;

if (IS_API_MISSING) {
  console.error('[Auth] CRITICAL: VITE_API_BASE_URL is missing in production environment. Authentication will fail. Ensure VITE_API_BASE_URL is set in your Vercel project settings.');
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

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => safeStorage.getItem('tb-token'));
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(IS_API_MISSING ? 'VITE_API_BASE_URL_MISSING' : null);
  const [dbOffline, setDbOffline] = useState(false);
  const [apiPrefs, setApiPrefs] = useState({ useCustomApi: false, activeProvider: null, activeLabel: null, activeIds: [], allKeys: [], status: 'stable' });
  const [connectionStatus, setConnectionStatus] = useState('stable'); // stable, slow, timeout
  const [isExiting, setIsExiting] = useState(false);
  const [isAuthResolved, setIsAuthResolved] = useState(false);
  const navigate = useNavigate();
  const { setMode, setCurrentThemeId } = useTheme();

  const hydrateSettings = useCallback((userData, isHydratedFlag) => {
    try {
      if (userData?.settings && !isHydratedFlag) {
        console.log('[Auth] Hydrating settings for user:', userData.email);
        const { general, appearance, canvas, privacy } = userData.settings;
        
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
          useTutorStore.setState({
            showMinimap: appearance.showMinimap ?? true,
            showGrid: appearance.showGrid ?? true,
            layoutView: appearance.layoutView || 'left'
          });
        }
        
        if (canvas) {
          useTutorStore.setState({
            drawWidth: canvas.drawWidth || 4,
            textToolSize: canvas.textToolSize || 24,
            gridType: canvas.gridType || 'dots',
            isSnapToGrid: canvas.isSnapToGrid || false,
            noteColor: canvas.noteColor || '#fef9c3',
            noteSize: canvas.noteSize || 'M'
          });
        }
        
        if (privacy) {
          safeStorage.setItem('tb-cloud-sync', String(privacy.cloudSync ?? true));
          safeStorage.setItem('tb-local-history', String(privacy.localHistory ?? true));
        }

        sessionStorage.setItem('tb-settings-hydrated', 'true');
      }
    } catch (err) {
      console.warn('[Auth] Hydration failed:', err);
    }
  }, [setMode, setCurrentThemeId]);

  // Verify token on mount
  useEffect(() => {
    console.log('[Auth] Starting verification effect...');
    
    // SEC-13: Migration/Cleanup — Ensure old guest flag is purged from localStorage
    if (localStorage.getItem('tb-is-guest')) {
      console.log('[Auth] Legacy guest flag detected in localStorage, purging for session-only mode.');
      localStorage.removeItem('tb-is-guest');
    }

    // Stage 1: Mark as slow after 12s (Account for local MongoDB cold starts)
    const slowTimer = setTimeout(() => {
      setLoading(loading => {
        if (loading) {
          console.warn('[Auth] Connectivity warning: Server is taking longer than 12s to respond.');
          setConnectionStatus('slow');
        }
        return loading;
      });
    }, 12000);

    // Stage 2: Mark as warming after 30s (Render.com cold starts)
    const warmingTimer = setTimeout(() => {
      setLoading(loading => {
        if (loading) {
          console.warn('[Auth] Warming up: Server is taking longer than 30s to respond.');
          setConnectionStatus('warming');
        }
        return loading;
      });
    }, 30000);

    // Stage 3: Hard fail after 90s
    const failTimer = setTimeout(() => {
      setLoading(loading => {
        if (loading) {
          console.error('[Auth] Hard timeout: High latency detected (90s). Force-resolving to prevent hang.');
          setConnectionStatus('timeout');
          return false;
        }
        return loading;
      });
    }, 90000);

    const verifyToken = async () => {
      try {
        // Wake up the server if it's cold (BUG FIX for Render.com/Heroku)
        API.get('/health').catch(() => {/* fire and forget */});

        // Check for token in URL (Legacy Social Login direct)
        const urlParams = new URL(window.location.href).searchParams;
        const exchangeCode = urlParams.get('code');

        if (exchangeCode) {
          // Exchange one-time code for real JWT
          console.log('[Auth] Exchange code detected, trading for session...');
            const res = await API.get(`/api/auth/exchange?code=${exchangeCode}`);
            
            if (res.data?.token) {
              safeStorage.setItem('tb-token', res.data.token);
              sessionStorage.setItem('tb-just-logged-in', 'true');
              console.log('[Auth] Exchange successful ✨');
            }
          // Clean up URL to prevent re-exchange
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        const storedToken = safeStorage.getItem('tb-token');
        const isHydrated = sessionStorage.getItem('tb-settings-hydrated') === 'true';

        // Guest flow restoration (Must check before the storedToken early return)
        const isGuest = sessionStorage.getItem('tb-is-guest') === 'true';
        if (isGuest && !storedToken) {
          console.log('[Auth] Restoring Guest session');
          setUser({ name: 'Guest', email: 'guest@tutorboard.ai', isGuest: true });
          setToken(null);
          return;
        }

        if (!storedToken) {
          // AI Automation: If there's a prompt in the URL, auto-login as guest
          const prompt = urlParams.get('prompt');
          if (prompt) {
            console.log('[Auth] Prompt detected in URL, auto-logging in as Guest...');
            sessionStorage.setItem('tb-is-guest', 'true');
            setUser({ name: 'Guest', email: 'guest@tutorboard.ai', isGuest: true });
            setToken(null);
          }
          return;
        }

        console.log('[Auth] Verifying session with backend...');
        try {
          // Parallelize profile and API prefs fetch for high performance
          const [meRes, apiRes] = await Promise.all([
            API.get('/api/auth/me').catch(e => e.response),
            storedToken !== 'guest' ? API.get('/api/apikeys').catch(() => null) : Promise.resolve(null)
          ]);

          if (meRes && meRes.data) {
            const data = meRes.data;
            console.log('[Auth] Session verified for:', data.user?.email);
            sessionStorage.removeItem('tb-is-guest'); // Clear guest flag if real token verified
            setUser(data.user);
            setToken(storedToken);
            setDbOffline(false); // Reset if it was offline
            
            hydrateSettings(data.user, isHydrated);

            // Hydrate API Prefs
            if (apiRes && apiRes.data) {
              const apiData = apiRes.data;
              const activeKeys = (apiData.keys || []).filter(k => k.isActive && k.isValid);
              const firstActive = activeKeys[0];
              const status = firstActive?.isExpired ? 'expired' : (firstActive?.isLowCredits ? 'low' : (firstActive?.isValid ? 'active' : 'stable'));
              setApiPrefs({
                useCustomApi: apiData.preferences?.useCustomApi && activeKeys.length > 0,
                activeProvider: firstActive?.provider,
                activeLabel: firstActive?.label,
                activeIds: activeKeys.map(k => k.id || k._id),
                allKeys: apiData.keys || [],
                status
              });
            }
          } else {
            // BUG FIX: Handle 429 Too Many Requests gracefully
            if (meRes?.status === 429) {
              console.warn('[Auth] Rate limit reached. Retaining current session state to prevent lock-out.');
              return;
            }

            // DB_OFFLINE detection
            const errorData = await meRes.json().catch(() => ({}));
            if (errorData.code === 'DB_OFFLINE') {
              console.error('[Auth] Database is offline. Entering Degraded Mode.');
              setDbOffline(true);
              return; // Do NOT clear token, just stop loading
            }

            console.warn('[Auth] Session invalid or expired.');
            safeStorage.removeItem('tb-token');
            setToken(null);
            setUser(null);
            setApiPrefs({ useCustomApi: false, activeProvider: null, activeLabel: null, activeId: null, allKeys: [], status: 'stable' });
          }
        } catch (err) {
          console.error('[Auth] Network error or timeout during verification:', err.name || err);
          setUser(null); 
        }
      } catch (globalErr) {
        console.error('[Auth] CRITICAL Error in verifyToken:', globalErr);
      } finally {
        console.log('[Auth] Verification logic finished, resolving state...');
        setLoading(false);
        setIsAuthResolved(true);
      }
    };

    verifyToken();
    return () => {
      clearTimeout(slowTimer);
      clearTimeout(warmingTimer);
      clearTimeout(failTimer);
    };
  }, []);

  // BUG FIX: Centralized Socket Auth Sync
  // Ensures we only connect to the socket once identity is definitively resolved,
  // preventing "Guest" status for logged-in users on slow server cold starts.
  useEffect(() => {
    if (isAuthResolved) {
      const activeToken = safeStorage.getItem('tb-token');
      console.log(`[Auth] Resolving socket identity: ${activeToken ? 'User (Token)' : 'Guest'}`);
      syncSocketAuth(activeToken || 'guest');
    }
  }, [isAuthResolved]);


  const login = useCallback(async (email, password) => {
    try {
      const res = await API.post('/api/auth/signin', { email, password });
      const data = res.data;

      sessionStorage.removeItem('tb-is-guest'); // Promote to real user
      safeStorage.setItem('tb-token', data.token);
      setToken(data.token);
      setUser(data.user);
      
      // Immediate hydration after login
      hydrateSettings(data.user, false);

      // BUG FIX: Immediate socket sync after login
      try { syncSocketAuth(data.token); } catch (e) { console.warn('[Auth] Socket sync failed after login'); }

      return data;
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Login failed');
    }
  }, []);

  const signup = useCallback(async (name, email, password, confirmPassword) => {
    try {
      const res = await API.post('/api/auth/signup', { name, email, password, confirmPassword });
      const data = res.data;

      sessionStorage.removeItem('tb-is-guest'); // Promote to real user
      safeStorage.setItem('tb-token', data.token);
      setToken(data.token);
      setUser(data.user);
      
      // Immediate hydration after signup
      hydrateSettings(data.user, false);

      // BUG FIX: Immediate socket sync after signup
      try { syncSocketAuth(data.token); } catch (e) { console.warn('[Auth] Socket sync failed after signup'); }

      return data;
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Signup failed');
    }
  }, []);

  const loginGuest = useCallback(() => {
    safeStorage.removeItem('tb-token');
    sessionStorage.setItem('tb-is-guest', 'true');
    setToken(null);
    setUser({ name: 'Guest', email: 'guest@tutorboard.ai', isGuest: true });

    // BUG FIX: Sync socket to Guest mode
    syncSocketAuth('guest');

    // Force default layout to Standard (Left) for guests
    useTutorStore.getState().setLayoutView('left');
  }, []);

  const logout = useCallback((skipConfirm = false) => {
    const performLogout = async () => {
      // SEC-15: Trigger an immediate cloud sync before clearing state to prevent data loss
      if (user && !user.isGuest) {
        useTutorStore.getState().triggerSync();
        // Brief grace period to allow the immediate sync fetch to initiate
        await new Promise(resolve => setTimeout(resolve, 600));
      }

      setIsExiting(true);
      
      // BUG FIX: Revoke token server-side before clearing client state
      // Using the API instance ensures headers are correctly set
      if (safeStorage.getItem('tb-token')) {
        API.post('/api/auth/logout').catch(err => console.warn('[Auth] Server-side logout failed:', err));
      }
      // 1. Clear Auth Tokens
      safeStorage.removeItem('tb-token');
      
      // 2. Clear Session History & Cache
      localStorage.removeItem('tutorboard-history');
      localStorage.removeItem('tutorboard-active-chat');
      localStorage.removeItem('tutorboard-agent');
      
      // 3. Clear Zustand Persisted State to prevent canvas leak
      localStorage.removeItem('tutorboard-session');

      // 5. Cleanup Zustand Trial State
      const store = useTutorStore.getState();
      if (typeof store.resetTeaching === 'function') store.resetTeaching();
      if (typeof store.setGuestTrialStatus === 'function') {
        store.setGuestTrialStatus({ count: 0, warning: false, isLimitReached: false });
      }
      if (typeof store.setLearnerProfile === 'function') {
        store.setLearnerProfile({ level: 'beginner', pace: 'normal', confusionIndex: 0, topicsMastery: {} });
      }

      // 6. Cleanup memory state
      sessionStorage.removeItem('tb-is-guest');
      sessionStorage.removeItem('tb-settings-hydrated');
      setToken(null);
      setUser(null);

      // 7. Cleanup Socket 
      try { disconnectSocket(); } catch (e) { console.warn('[Auth] Socket disconnect failed'); }

      // 8. Navigate away
      navigate('/');
    };

    if (user?.isGuest && !skipConfirm) {
      // Use the global showAlert for a premium experience
      useTutorStore.getState().showAlert({
        type: 'warning',
        title: 'End Session',
        message: 'Your progress in this session will be cleared. Are you sure you want to log out?',
        confirmLabel: 'Log Out',
        onConfirm: performLogout
      });
    } else {
      performLogout();
    }
  }, [user, navigate]);

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
        const activeKeys = (data.keys || []).filter(k => k.isActive && k.isValid);
        const firstActive = activeKeys[0];
        const status = firstActive?.isExpired ? 'expired' : (firstActive?.isLowCredits ? 'low' : (firstActive?.isValid ? 'active' : 'stable'));
        setApiPrefs({
          useCustomApi: data.preferences?.useCustomApi && activeKeys.length > 0,
          activeProvider: firstActive?.provider,
          activeLabel: firstActive?.label,
          activeIds: activeKeys.map(k => k.id || k._id),
          allKeys: data.keys || [],
          status
        });
      }
    } catch (e) { /* silent */ }
  }, [token, user]);

  // SEC-18: Cross-device preference bridge — Listen for socket connect events to refresh keys
  useEffect(() => {
    const handleRefreshRequest = () => {
      console.log('[Auth] External refresh request detected (Socket Connect), refreshing API Prefs...');
      refreshApiPrefs();
    };

    window.addEventListener('tb-refresh-api-prefs', handleRefreshRequest);
    return () => window.removeEventListener('tb-refresh-api-prefs', handleRefreshRequest);
  }, [refreshApiPrefs]);

  const switchApi = useCallback(async (keyId, forceState = null) => {
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

      // Find current state to toggle it
      const key = apiPrefs.allKeys.find(k => (k.id || k._id) === keyId);
      const newState = forceState !== null ? forceState : !key?.isActive;

      const res = await fetch(`${API_URL}/api/apikeys/${keyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ isActive: newState })
      });
      
      if (res.ok) {
        if (newState) {
          await fetch(`${API_URL}/api/apikeys/preferences`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ useCustomApi: true })
          });
        }
        refreshApiPrefs();
      }
    } catch (e) { /* silent */ }
  }, [token, user, refreshApiPrefs, apiPrefs.allKeys]);

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
      forceStopLoading,
      isAuthResolved,
      dbOffline
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
