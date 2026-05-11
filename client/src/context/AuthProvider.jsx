import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useTutorStore from '../store/tutorStore';
import { useTheme } from './ThemeContext';
import API, { BASE_URL as API_URL, fetchCsrfToken } from '../services/api';
import { syncSocketAuth, disconnectSocket } from '../hooks/useSocket';
import { AuthContext } from './AuthContext';

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
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(IS_API_MISSING ? 'VITE_API_BASE_URL_MISSING' : null);
  const [dbOffline, setDbOffline] = useState(false);
  const [apiPrefs, setApiPrefs] = useState({ useCustomApi: false, activeProvider: null, activeLabel: null, activeIds: [], allKeys: [], status: 'stable' });
  const [connectionStatus, setConnectionStatus] = useState('stable'); 
  const [isAuthResolved, setIsAuthResolved] = useState(false);
  const navigate = useNavigate();
  const { setMode, setCurrentThemeId } = useTheme();

  const hydrateSettings = useCallback((userData, isHydratedFlag) => {
    try {
      if (userData?.settings && !isHydratedFlag) {
        import.meta.env.DEV && console.log('[Auth] Hydrating settings for user:', userData.email);
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

  useEffect(() => {
    import.meta.env.DEV && console.log('[Auth] Starting verification effect...');
    
    if (localStorage.getItem('tb-is-guest')) {
      localStorage.removeItem('tb-is-guest');
    }

    const slowTimer = setTimeout(() => {
      setLoading(loading => {
        if (loading) {
          setConnectionStatus('slow');
        }
        return loading;
      });
    }, 12000);

    const warmingTimer = setTimeout(() => {
      setLoading(loading => {
        if (loading) {
          setConnectionStatus('warming');
        }
        return loading;
      });
    }, 30000);

    const failTimer = setTimeout(() => {
      setLoading(loading => {
        if (loading) {
          setConnectionStatus('timeout');
          return false;
        }
        return loading;
      });
    }, 90000);

    const verifyToken = async () => {
      try {
        try {
          await fetchCsrfToken();
        } catch (e) {
          console.warn('[Auth] Failed to pre-fetch CSRF token:', e);
        }

        API.get('/health').catch(() => {});

        const urlParams = new URL(window.location.href).searchParams;
        const exchangeCode = urlParams.get('code');

        if (exchangeCode) {
          const res = await API.post('/api/auth/exchange', { code: exchangeCode });
          if (res.data?.success) {
            sessionStorage.setItem('tb-just-logged-in', 'true');
          }
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        const isHydrated = sessionStorage.getItem('tb-settings-hydrated') === 'true';
        const isGuest = sessionStorage.getItem('tb-is-guest') === 'true';
        
        if (isGuest) {
          setUser({ name: 'Guest', email: 'guest@tutorboard.ai', isGuest: true });
          setToken(null);
          setLoading(false);
          setIsAuthResolved(true);
          return;
        }

        const prompt = urlParams.get('prompt');
        if (prompt && !user) {
          sessionStorage.setItem('tb-is-guest', 'true');
          setUser({ name: 'Guest', email: 'guest@tutorboard.ai', isGuest: true });
          setToken(null);
          setLoading(false);
          setIsAuthResolved(true);
          return;
        }

        try {
          const [meRes, apiRes] = await Promise.all([
            API.get('/api/auth/me').catch(e => {
              console.warn('[Auth] /api/auth/me failed:', e.response?.status, e.message);
              return e.response;
            }),
            API.get('/api/apikeys').catch(() => null)
          ]);

          console.log('[Auth] meRes status:', meRes?.status, 'hasUser:', !!meRes?.data?.user);
          const isValidAuth = meRes && meRes.status >= 200 && meRes.status < 300 && meRes.data?.user;

          if (isValidAuth) {
            const data = meRes.data;
            sessionStorage.removeItem('tb-is-guest');
            setUser(data.user);
            setToken('verified');
            setDbOffline(false);
            hydrateSettings(data.user, isHydrated);

            if (apiRes && apiRes.status >= 200 && apiRes.status < 300 && apiRes.data) {
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
            if (meRes?.status === 429) return;
            const errorData = meRes?.data || {};
            if (errorData.code === 'DB_OFFLINE') {
              setDbOffline(true);
              return;
            }
            setToken(null);
            setUser(null);
          }
        } catch (err) {
          console.error('[Auth] Verification sub-block failed:', err.message);
          setUser(null); 
        }
      } catch (globalErr) {
        console.error('[Auth] CRITICAL Error in verifyToken:', globalErr);
      } finally {
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

  useEffect(() => {
    if (isAuthResolved) {
      syncSocketAuth(user && !user.isGuest ? 'verified' : 'guest');
    }
  }, [isAuthResolved, user]);

  const login = useCallback(async (email, password) => {
    try {
      const res = await API.post('/api/auth/signin', { email, password });
      const data = res.data;
      sessionStorage.removeItem('tb-is-guest');
      setToken('verified');
      setUser(data.user);
      hydrateSettings(data.user, false);
      try { syncSocketAuth('verified'); } catch (e) {}
      return data;
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Login failed');
    }
  }, [hydrateSettings]);

  const signup = useCallback(async (name, email, password, confirmPassword) => {
    try {
      const res = await API.post('/api/auth/signup', { name, email, password, confirmPassword });
      const data = res.data;
      sessionStorage.removeItem('tb-is-guest');
      setToken('verified');
      setUser(data.user);
      hydrateSettings(data.user, false);
      try { syncSocketAuth('verified'); } catch (e) {}
      return data;
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Signup failed');
    }
  }, [hydrateSettings]);

  const loginGuest = useCallback(() => {
    sessionStorage.setItem('tb-is-guest', 'true');
    setToken(null);
    setUser({ name: 'Guest', email: 'guest@tutorboard.ai', isGuest: true });
    syncSocketAuth('guest');
    useTutorStore.getState().setLayoutView('left');
  }, []);

  const logout = useCallback((skipConfirm = false) => {
    const performLogout = async () => {
      if (user && !user.isGuest) {
        useTutorStore.getState().triggerSync();
        await new Promise(resolve => setTimeout(resolve, 600));
      }
      API.post('/api/auth/logout').catch(() => {});
      localStorage.removeItem('tutorboard-history');
      localStorage.removeItem('tutorboard-active-chat');
      localStorage.removeItem('tutorboard-agent');
      localStorage.removeItem('tutorboard-session');
      const store = useTutorStore.getState();
      if (typeof store.resetTeaching === 'function') store.resetTeaching();
      // PERSISTENCE FIX: Clear conversation and chat history in-memory state
      if (typeof store.clearConversation === 'function') store.clearConversation();
      if (typeof store.setChatHistory === 'function') store.setChatHistory([]);
      if (typeof store.setChatSessionId === 'function') store.setChatSessionId(null);
      if (typeof store.setSessionId === 'function') store.setSessionId(null);
      sessionStorage.removeItem('tb-is-guest');
      sessionStorage.removeItem('tb-settings-hydrated');
      setToken(null);
      setUser(null);
      try { disconnectSocket(); } catch (e) {}
      navigate('/');
    };

    if (user?.isGuest && !skipConfirm) {
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

  const updateUser = useCallback((updates) => {
    setUser(prev => prev ? { ...prev, ...updates } : prev);
  }, []);

  const refreshApiPrefs = useCallback(async () => {
    if (user?.isGuest) return;
    try {
      const res = await API.get('/api/apikeys');
      if (res.status === 200) {
        const data = res.data;
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
    } catch (e) {}
  }, [user]);

  useEffect(() => {
    const handleRefreshRequest = () => refreshApiPrefs();
    window.addEventListener('tb-refresh-api-prefs', handleRefreshRequest);
    return () => window.removeEventListener('tb-refresh-api-prefs', handleRefreshRequest);
  }, [refreshApiPrefs]);

  const switchApi = useCallback(async (keyId, forceState = null) => {
    if (user?.isGuest) return;
    try {
      if (keyId === 'Universal') {
        const res = await API.put('/api/apikeys/preferences', { useCustomApi: false });
        if (res.status === 200) refreshApiPrefs();
        return;
      }
      const key = apiPrefs.allKeys.find(k => (k.id || k._id) === keyId);
      const newState = forceState !== null ? forceState : !key?.isActive;
      const res = await API.put(`/api/apikeys/${keyId}`, { isActive: newState });
      if (res.status === 200) {
        if (newState) await API.put('/api/apikeys/preferences', { useCustomApi: true });
        refreshApiPrefs();
      }
    } catch (e) {}
  }, [user, refreshApiPrefs, apiPrefs.allKeys]);

  const forceStopLoading = useCallback(() => {
    setLoading(false);
    setConnectionStatus('stable');
  }, []);

  return (
    <AuthContext.Provider value={{
      user, token, loading, apiError, login, signup, loginGuest, logout, updateUser,
      isAuthenticated: !!user, apiPrefs, refreshApiPrefs, switchApi, connectionStatus,
      forceStopLoading, isAuthResolved, dbOffline
    }}>
      {children}
    </AuthContext.Provider>
  );
};
