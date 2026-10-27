import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
const AuthLanding = React.lazy(() => import('./pages/AuthLanding'));
const Home = React.lazy(() => import('./pages/Home'));
const AdminPortal = React.lazy(() => import('./pages/AdminPortal'));
const SettingsLanding = React.lazy(() => import('./components/auth/SettingsLanding'));

import Loader from './components/layout/Loader';
import ProtectedRoute from './components/auth/ProtectedRoute';
import MarketingLayout from './components/layout/MarketingLayout';
const Landing = React.lazy(() => import('./pages/Marketing/Landing'));

const AUTH_RETURN_PARAMS = ['code', 'error', 'reset'];

/**
 * The home page is the marketing landing. The server still returns OAuth and
 * password-reset results to "/?code=…" etc., so those visits go on to /login,
 * query intact, where the auth screen finishes the hand-off.
 */
function HomeRoute() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  if (AUTH_RETURN_PARAMS.some((k) => params.has(k))) return <Navigate to={`/login${search}`} replace />;
  return <Landing />;
}
import { useAuth } from './hooks/useAuth';
import GlobalStatusOverlay from './components/layout/GlobalStatusOverlay';
import ThemedPopup from './components/layout/ThemedPopup';
import IntroAnimation from './components/layout/IntroAnimation';
import useTutorStore from './store/tutorStore';
import GlobalOverlayManager from './components/common/GlobalOverlayManager';
import useKeyboardShortcuts from './hooks/useKeyboardShortcuts';
import ToastContainer from './components/layout/ToastContainer';
import TrialLimitOverlay from './components/common/TrialLimitOverlay';
import RootErrorFallback from './components/common/RootErrorFallback';
import GlobalTooltip from './components/common/GlobalTooltip';

function App() {
  useKeyboardShortcuts();
  const { loading: authLoading, apiError, connectionStatus, dbOffline } = useAuth();
  const { 
    setGlobalOverlay, hydrate, setSidebarOpen, 
    globalOverlay, activeOverlay, guestTrialStatus
  } = useTutorStore(useShallow(s => ({
    setGlobalOverlay: s.setGlobalOverlay,
    hydrate: s.hydrate,
    setSidebarOpen: s.setSidebarOpen,
    globalOverlay: s.globalOverlay,
    activeOverlay: s.activeOverlay,
    guestTrialStatus: s.guestTrialStatus
  })));


  // SEC-02 & FO-03: Initialize store from client environment and listen for resize
  useEffect(() => {
    document.body.style.border = '';
    hydrate();
  }, []); // Run ONCE on mount

  // Server-wide conditions (maintenance, unverified email, disabled account) from services/api.js
  useEffect(() => {
    const onNotice = (e) => {
      const { code, message } = e.detail || {};
      const store = useTutorStore.getState();
      store.showToast({ message, type: code === 'MAINTENANCE' ? 'info' : 'error' });
      if (code === 'EMAIL_VERIFICATION_REQUIRED') {
        store.setSettingsActiveSection?.('account');
        store.setOverlay?.('settings');
      }
    };
    window.addEventListener('tb-api-notice', onNotice);
    return () => window.removeEventListener('tb-api-notice', onNotice);
  }, []);

  useEffect(() => {
    let lastIsMobile = window.innerWidth < 768;

    const handleResize = () => {
      const currentIsMobile = window.innerWidth < 768;
      // Only auto-adjust if we cross the mobile/desktop boundary
      if (currentIsMobile !== lastIsMobile) {
        setSidebarOpen(!currentIsMobile);
        lastIsMobile = currentIsMobile;
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setSidebarOpen]);

  const [welcomeLoading, setWelcomeLoading] = useState(() => {
    try {
      // UI-11: Check for return visit to skip intro entirely
      const hasSeenIntro = localStorage.getItem('tb-intro-seen') === '1';
      if (hasSeenIntro) return false;
      
      // Also check sessionStorage for the current session lifecycle
      return !sessionStorage.getItem('tb-welcome-played-v10');
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (welcomeLoading) {
      const timer = setTimeout(() => {
        setWelcomeLoading(false);
      }, 2000); // Optimized duration
      
      try {
        localStorage.setItem('tb-intro-seen', '1');
        sessionStorage.setItem('tb-welcome-played-v10', 'true');
      } catch { }
      
      return () => clearTimeout(timer);
    }
  }, [welcomeLoading]);

  // SEC-36: Use a ref to track globalOverlay type to avoid re-triggering effect on every overlay change
  const globalOverlayRef = useRef(globalOverlay);
  useEffect(() => {
    globalOverlayRef.current = globalOverlay;
  }, [globalOverlay]);

  useEffect(() => {
    const handleOffline = () => {
      setGlobalOverlay({ isActive: true, type: 'network', message: "You're currently offline. Please check your internet connection." });
    };
    const handleOnline = () => {
      if (globalOverlayRef.current?.type === 'network') {
        setGlobalOverlay({ isActive: false });
      }
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    if (!navigator.onLine) handleOffline();
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [setGlobalOverlay]);

  useEffect(() => {
    if (connectionStatus === 'timeout') {
      setGlobalOverlay({ isActive: true, type: 'error', message: "The TutorBoard engine is taking too long to respond." });
    }
  }, [connectionStatus, setGlobalOverlay]);

  if (apiError === 'VITE_API_BASE_URL_MISSING') {
    return (
      <RootErrorFallback 
        error={{
          name: 'Configuration Error',
          message: 'The VITE_API_BASE_URL environment variable is missing from your environment configuration.',
          stack: 'VITE_API_BASE_URL is undefined.\nPlease configure your client/.env file with VITE_API_BASE_URL=http://localhost:5000'
        }} 
      />
    );
  }

  if (dbOffline) {
    return (
      <RootErrorFallback 
        error={{
          name: 'Database Offline',
          message: 'The TutorBoard server is currently operating in Degraded Mode because MongoDB is unreachable.',
          stack: 'MongoNetworkError: failed to connect to server\nPlease ensure your local IP address is whitelisted in MongoDB Atlas Network Access rules.'
        }} 
      />
    );
  }

  if (welcomeLoading) return <IntroAnimation />;

  return (
    <div className="app-root">
      {/* ACC-1: Skip-to-content link for keyboard navigation */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[99999] focus:px-4 focus:py-2 focus:bg-[var(--text-primary)] focus:text-[var(--bg-primary)] focus:rounded-xl focus:text-sm focus:font-semibold focus:shadow-xl focus:outline-none"
      >
        Skip to content
      </a>
      {/* ── GLOBAL OVERLAYS ── */}
      <AnimatePresence>
        {authLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999]"
          >
            <Loader fullScreen={true} glass={true} />
            {connectionStatus === 'warming' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="fixed bottom-32 left-0 right-0 flex flex-col items-center gap-2 z-[10000]"
              >
                <p className="text-white/60 text-sm font-light tracking-wide animate-pulse">
                  Warming up the engine...
                </p>
                <p className="text-white/40 text-xs font-medium">
                  Render.com cold start in progress
                </p>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <GlobalOverlayManager />
      <ToastContainer />
      <GlobalTooltip />
      
      {/* UX-05: Focus Trap for Trial Limit Overlay using inert attribute */}
      <main 
        id="main-content" 
        className="app-main" 
        role="main"
        inert={guestTrialStatus?.isLimitReached ? true : undefined}
      >
        <React.Suspense fallback={<Loader fullScreen={true} glass={true} />}>
          <Routes>
            <Route path="/login" element={<AuthLanding />} />
            <Route path="/auth" element={<Navigate to="/login" replace />} />

            <Route element={<MarketingLayout />}>
              {/* One landing page; each path opens it at that section. */}
              <Route path="/" element={<HomeRoute />} />
              {['/how-it-works', '/features', '/solutions', '/about'].map((path) => (
                <Route key={path} path={path} element={<Landing />} />
              ))}
            </Route>

            <Route path="/session" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/settings" element={<SettingsLanding />} />
            <Route path="/admin/*" element={<ProtectedRoute guestAllowed={false}><AdminPortal /></ProtectedRoute>} />
            <Route 
              path="/error" 
              element={
                <RootErrorFallback 
                  error={{
                    name: 'ReferenceError',
                    message: 'sparkRef is not defined',
                    stack: 'ReferenceError: sparkRef is not defined\n    at BorderGlow (d:/PROJECTS/TUTORBOARD/client/src/components/ui/BorderGlow.jsx:215:11)\n    at renderWithHooks (react-dom.development.js:15486:18)\n    at mountIndeterminateComponent (react-dom.development.js:20180:13)\n    at beginWork (react-dom.development.js:21607:16)'
                  }} 
                />
              } 
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </React.Suspense>
      </main>
    </div>
  );
}

export default App;
 
