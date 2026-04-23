import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AuthLanding from './pages/AuthLanding';
import Home from './pages/Home';
import MasteryDashboard from './components/dashboard/MasteryDashboard';
import Loader from './components/layout/Loader';
import ProtectedRoute from './components/auth/ProtectedRoute';
import MarketingLayout from './components/layout/MarketingLayout';
import HowItWorks from './pages/Marketing/HowItWorks';
import Features from './pages/Marketing/Features';
import Solutions from './pages/Marketing/Solutions';
import About from './pages/Marketing/About';
import { useAuth } from './context/AuthContext';
import GlobalStatusOverlay from './components/layout/GlobalStatusOverlay';
import ThemedPopup from './components/layout/ThemedPopup';
import IntroAnimation from './components/layout/IntroAnimation';
import useTutorStore from './store/tutorStore';
import GlobalOverlayManager from './components/common/GlobalOverlayManager';

function App() {
  const { loading: authLoading, apiError, connectionStatus, forceStopLoading } = useAuth();
  const { setGlobalOverlay } = useTutorStore();

  const [welcomeLoading, setWelcomeLoading] = useState(() => {
    try {
      const isGuest = sessionStorage.getItem('tb-is-guest') === 'true';
      if (isGuest) return false;
      return !sessionStorage.getItem('tb-welcome-played');
    } catch {
      return false;
    }
  });
  const [showSkip, setShowSkip] = useState(false);

  useEffect(() => {
    if (welcomeLoading) {
      const timer = setTimeout(() => {
        setWelcomeLoading(false);
        try {
          sessionStorage.setItem('tb-welcome-played', 'true');
        } catch {}
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [welcomeLoading]);

  useEffect(() => {
    if (welcomeLoading || authLoading) {
      const timer = setTimeout(() => setShowSkip(true), 6000);
      return () => clearTimeout(timer);
    } else {
      setShowSkip(false);
    }
  }, [welcomeLoading, authLoading]);

  useEffect(() => {
    const handleOffline = () => {
      setGlobalOverlay({ isActive: true, type: 'network', message: "You're currently offline. Please check your internet connection." });
    };
    const handleOnline = () => {
      const currentOverlayType = useTutorStore.getState().globalOverlay.type;
      if (currentOverlayType === 'network') {
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

  if (apiError === 'VITE_API_URL_MISSING') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[var(--bg-primary)] p-8 text-center text-[var(--text-primary)]">
        <h1 className="text-2xl font-normal mb-4 tracking-tight">Configuration Required</h1>
        <p className="max-w-md mb-8 text-[var(--text-tertiary)]">The VITE_API_URL environment variable is missing.</p>
        <button onClick={() => window.location.reload()} className="px-8 py-3 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-full font-normal shadow-lg">Check Again</button>
      </div>
    );
  }

  if (welcomeLoading) return <IntroAnimation />;

  if (authLoading) {
    const isGuest = sessionStorage.getItem('tb-is-guest') === 'true';
    return (
      <div className="relative h-screen w-full">
        <Loader fullScreen={true} glass={true} simple={isGuest} />
        {showSkip && (
          <div className="fixed bottom-12 left-0 right-0 flex flex-col items-center gap-4 z-[1000]">
            <button onClick={() => forceStopLoading()} className="px-6 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 rounded-full text-white/50 text-sm font-normal transition-all shadow-2xl">Enter Dashboard Anyway →</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app-root">
      <GlobalOverlayManager />
      <GlobalStatusOverlay />
      <ThemedPopup />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<AuthLanding />} />
          <Route path="/auth" element={<Navigate to="/" replace />} />
          
          <Route element={<MarketingLayout />}>
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/features" element={<Features />} />
            <Route path="/solutions" element={<Solutions />} />
            <Route path="/about" element={<About />} />
          </Route>

          <Route path="/dashboard" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/mastery" element={<ProtectedRoute><MasteryDashboard /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
