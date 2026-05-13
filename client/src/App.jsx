import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
const AuthLanding = React.lazy(() => import('./pages/AuthLanding'));
const Home = React.lazy(() => import('./pages/Home'));

import Loader from './components/layout/Loader';
import ProtectedRoute from './components/auth/ProtectedRoute';
import MarketingLayout from './components/layout/MarketingLayout';
const HowItWorks = React.lazy(() => import('./pages/Marketing/HowItWorks'));
const Features = React.lazy(() => import('./pages/Marketing/Features'));
const Solutions = React.lazy(() => import('./pages/Marketing/Solutions'));
const About = React.lazy(() => import('./pages/Marketing/About'));
import { useAuth } from './hooks/useAuth';
import GlobalStatusOverlay from './components/layout/GlobalStatusOverlay';
import ThemedPopup from './components/layout/ThemedPopup';
import IntroAnimation from './components/layout/IntroAnimation';
import useTutorStore from './store/tutorStore';
import GlobalOverlayManager from './components/common/GlobalOverlayManager';
import useKeyboardShortcuts from './hooks/useKeyboardShortcuts';
import ToastContainer from './components/layout/ToastContainer';
import TrialLimitOverlay from './components/common/TrialLimitOverlay';

function App() {
  useKeyboardShortcuts();
  const { loading: authLoading, apiError, connectionStatus, forceStopLoading, dbOffline } = useAuth();
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
    hydrate();
  }, []); // Run ONCE on mount

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
  const [showSkip, setShowSkip] = useState(false);

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

  useEffect(() => {
    if (welcomeLoading || authLoading) {
      // UX-01: Show skip immediately to improve perceived performance
      setShowSkip(true);
    } else {
      setShowSkip(false);
    }
  }, [welcomeLoading, authLoading]);

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
      <div className="flex flex-col items-center justify-center h-screen bg-[var(--bg-primary)] p-8 text-center text-[var(--text-primary)]">
        <h1 className="text-2xl font-normal mb-4 tracking-tight">Configuration Required</h1>
        <p className="max-w-md mb-8 text-[var(--text-tertiary)]">The VITE_API_BASE_URL environment variable is missing.</p>
        <button onClick={() => window.location.reload()} className="px-8 py-3 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-full font-normal shadow-lg">Check Again</button>
      </div>
    );
  }

  if (dbOffline) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[var(--bg-primary)] p-8 text-center text-[var(--text-primary)]">
        <div className="mb-6 text-6xl">📡</div>
        <h1 className="text-2xl font-normal mb-2 tracking-tight">Database Offline</h1>
        <p className="max-w-md mb-8 text-[var(--text-tertiary)] text-sm leading-relaxed">
          The TutorBoard server is currently in <span className="text-[var(--text-primary)]">Degraded Mode</span>.
          Please ensure your IP is whitelisted in MongoDB Atlas or check your connection string.
        </p>
        <div className="flex gap-4">
          <button onClick={() => window.location.reload()} className="px-8 py-3 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-full text-sm font-medium transition-transform hover:scale-105 active:scale-95 shadow-xl">
            Retry Connection
          </button>
        </div>
      </div>
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
                <p className="text-white/30 text-[10px] uppercase tracking-[0.2em]">
                  Render.com cold start in progress
                </p>
              </motion.div>
            )}
            {showSkip && (
              <div className="fixed bottom-12 left-0 right-0 flex flex-col items-center gap-4 z-[10000]">
                <button
                  onClick={() => forceStopLoading()}
                  className="px-6 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 rounded-full text-white/50 text-sm font-normal transition-all shadow-2xl"
                >
                  Enter Dashboard Anyway →
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <GlobalOverlayManager />
      <ToastContainer />
      
      {/* UX-05: Focus Trap for Trial Limit Overlay using inert attribute */}
      <div 
        className="app-content-wrapper" 
        inert={guestTrialStatus?.isLimitReached ? true : undefined}
        style={{ display: 'contents' }}
      >

        <main id="main-content" className="app-main" role="main">
          <React.Suspense fallback={<Loader fullScreen={true} glass={true} />}>
          <Routes>
            <Route path="/" element={<AuthLanding />} />
            <Route path="/login" element={<AuthLanding />} />
            <Route path="/auth" element={<Navigate to="/" replace />} />

            <Route element={<MarketingLayout />}>
              <Route path="/how-it-works" element={<HowItWorks />} />
              <Route path="/features" element={<Features />} />
              <Route path="/solutions" element={<Solutions />} />
              <Route path="/about" element={<About />} />
            </Route>

            <Route path="/session" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </React.Suspense>
      </main>
      </div>
    </div>
  );
}

export default App;
 
