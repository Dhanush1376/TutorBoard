import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useTutorStore from '../store/tutorStore';
import { useTheme } from './ThemeContext';
import { syncSocketAuth, disconnectSocket } from '../hooks/useSocket';

const AuthContext = createContext(null);

import { BASE_URL as API_URL } from '../services/api';
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

    // Stage 2: Hard fail after 30s
    const failTimer = setTimeout(() => {
      setLoading(loading => {
        if (loading) {
          console.error('[Auth] Hard timeout: High latency detected (30s). Force-resolving to prevent hang.');
          setConnectionStatus('timeout');
          return false;
        }
        return loading;
      });
    }, 30000);

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
                sessionStorage.setItem('tb-just-logged-in', 'true');
                console.log('[Auth] Exchange successful ✨');
              }
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
          setLoading(false);
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
            syncSocketAuth('guest'); // Ensure socket connects as guest
          } else {
            // No token and no prompt - stay in unauthenticated state but ensure socket is ready as guest
            syncSocketAuth('guest');
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
            sessionStorage.removeItem('tb-is-guest'); // Clear guest flag if real token verified
            setUser(data.user);
            setToken(storedToken);
            setDbOffline(false); // Reset if it was offline
            
            // BUG FIX: Immediately sync socket auth with verified token
            syncSocketAuth(storedToken);

            hydrateSettings(data.user, isHydrated);

            // Hydrate API Prefs from parallel fetch
            if (apiRes && apiRes.ok) {
              const apiData = await apiRes.json();
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
              setLoading(false);
              return;
            }

            // DB_OFFLINE detection
            const errorData = await meRes.json().catch(() => ({}));
            if (errorData.code === 'DB_OFFLINE') {
              console.error('[Auth] Database is offline. Entering Degraded Mode.');
              setDbOffline(true);
              setLoading(false);
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
          syncSocketAuth('guest');
          setUser(null); 
        } finally {
          console.log('[Auth] Verification logic finished');
          setLoading(false);
          setIsAuthResolved(true);
        }
      } catch (globalErr) {
        console.error('[Auth] CRITICAL Error in verifyToken:', globalErr);
        setLoading(false);
      }
    };

    // Fallback: If verification hangs for > 7s, resolve auth anyway to unblock socket (Guest mode)
    const fallbackTimer = setTimeout(() => {
      setIsAuthResolved(prev => {
        if (!prev) {
          console.warn('[Auth] Verification timed out after 7s, forcing socket unblock');
          syncSocketAuth(safeStorage.getItem('tb-token') || 'guest');
        }
        return true;
      });
    }, 7000);

    verifyToken();
    return () => {
      clearTimeout(slowTimer);
      clearTimeout(failTimer);
      clearTimeout(fallbackTimer);
    };
  }, []);

  // Trial Mode Refresh Protection
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      // SEC-14: If we are intentionally navigating away via internal 'logout', skip the dialog
      if (isExiting) return;

      if (user?.isGuest) {
        const msg = 'You are in Trial Mode. Your history and settings will not be saved. Are you sure you want to leave?';
        e.preventDefault();
        e.returnValue = msg;
        return msg;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [user, isExiting]);

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

    sessionStorage.removeItem('tb-is-guest'); // Promote to real user
    safeStorage.setItem('tb-token', data.token);
    setToken(data.token);
    setUser(data.user);
    
    // Immediate hydration after login
    hydrateSettings(data.user, false);

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

    sessionStorage.removeItem('tb-is-guest'); // Promote to real user
    safeStorage.setItem('tb-token', data.token);
    setToken(data.token);
    setUser(data.user);
    
    // Immediate hydration after signup
    hydrateSettings(data.user, false);

    // BUG FIX: Immediate socket sync after signup
    try { syncSocketAuth(data.token); } catch (e) { console.warn('[Auth] Socket sync failed after signup'); }

    return data;
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

  const logout = useCallback(() => {
    const performLogout = async () => {
      // SEC-15: Trigger an immediate cloud sync before clearing state to prevent data loss
      if (user && !user.isGuest) {
        useTutorStore.getState().triggerSync();
        // Brief grace period to allow the immediate sync fetch to initiate
        await new Promise(resolve => setTimeout(resolve, 600));
      }

      setIsExiting(true);
      // 1. Clear Auth Tokens
      safeStorage.removeItem('tb-token');
      
      // 2. Clear Session History & Cache
      localStorage.removeItem('tutorboard-history');
      localStorage.removeItem('tutorboard-active-chat');
      localStorage.removeItem('tutorboard-agent');
      
      // 3. Clear Zustand Persisted State to prevent canvas leak
      localStorage.removeItem('tutorboard-session');

      // 4. Update memory state
      sessionStorage.removeItem('tb-is-guest');
      sessionStorage.removeItem('tb-settings-hydrated');
      setToken(null);
      setUser(null);

      // 5. Cleanup Socket 
      try { disconnectSocket(); } catch (e) { console.warn('[Auth] Socket disconnect failed'); }

      // 6. Navigate away
      navigate('/');
    };

    if (user?.isGuest) {
      // Use the global showAlert for a premium experience
      useTutorStore.getState().showAlert({
        type: 'warning',
        title: 'End Trial Session',
        message: 'Your progress in this guest session will be permanently deleted. Are you sure you want to end your trial?',
        confirmLabel: 'End Trial',
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
