import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AuthLanding from './pages/AuthLanding';
import Home from './pages/Home';
import Settings from './pages/Settings';
import Loader from './components/layout/Loader';
import ProtectedRoute from './components/auth/ProtectedRoute';
import MarketingLayout from './components/layout/MarketingLayout';
import HowItWorks from './pages/Marketing/HowItWorks';
import Features from './pages/Marketing/Features';
import Solutions from './pages/Marketing/Solutions';
import About from './pages/Marketing/About';
import { useAuth } from './context/AuthContext';

function App() {
  const { loading: authLoading, apiError, connectionStatus } = useAuth();
  const [welcomeLoading, setWelcomeLoading] = useState(() => {
    // Check if the welcome animation has already played in this session
    try {
      return !sessionStorage.getItem('tb-welcome-played');
    } catch {
      return false; // Skip loader if sessionStorage is unavailable (private browsing, SSR)
    }
  });
  const [showSkip, setShowSkip] = useState(false);

  useEffect(() => {
    if (welcomeLoading) {
      const timer = setTimeout(() => {
        setWelcomeLoading(false);
        try {
          sessionStorage.setItem('tb-welcome-played', 'true');
        } catch {
          // Silently ignore if sessionStorage is unavailable
        }
      }, 4000); // 4 seconds initial loader delay to match logo animation duration
      return () => clearTimeout(timer);
    }
  }, [welcomeLoading]);

  // Show skip button after 6 seconds of total loading
  useEffect(() => {
    if (welcomeLoading || authLoading) {
      const timer = setTimeout(() => setShowSkip(true), 6000);
      return () => clearTimeout(timer);
    } else {
      setShowSkip(false);
    }
  }, [welcomeLoading, authLoading]);

  if (apiError === 'VITE_API_URL_MISSING') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[var(--bg-primary)] p-8 text-center">
        <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mb-6 border border-red-500/30">
          <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-4 text-[var(--text-primary)] tracking-tight">Configuration Required</h1>
        <p className="max-w-md mb-8 text-[var(--text-tertiary)] leading-relaxed">
          The <span className="px-1.5 py-0.5 bg-[var(--bg-secondary)] rounded font-mono text-sm">VITE_API_URL</span> environment variable is missing. 
          Authentication and AI features will not function until this is set.
        </p>
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] p-5 rounded-xl shadow-sm max-w-sm mb-8">
          <p className="text-xs uppercase tracking-widest text-[var(--text-tertiary)] mb-2 font-semibold">Solution</p>
          <p className="text-sm text-[var(--text-secondary)]">Set the variable in Vercel settings and trigger a new deployment.</p>
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="px-8 py-3 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-full font-medium hover:scale-[1.02] active:scale-100 transition-all shadow-lg"
        >
          Check Again
        </button>
      </div>
    );
  }

  // Total application loading state
  const isAppLoading = welcomeLoading || authLoading;

  if (isAppLoading) {
    return (
      <div className="relative h-screen w-full">
        <Loader fullScreen={true} glass={!welcomeLoading} />
        {showSkip && (
          <div className="fixed bottom-12 left-0 right-0 flex flex-col items-center gap-4 z-[1000] animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <p className="text-white/30 text-xs tracking-widest uppercase font-medium">
              {connectionStatus === 'slow' ? 'Connectivity issue: Server is slow to respond...' : 'Taking longer than usual...'}
            </p>
            <button 
              onClick={() => {
                console.warn('[App] Manual loader bypass triggered by user');
                setWelcomeLoading(false);
                // We don't force authLoading here as it's owned by context, 
                // but setting welcomeLoading false might be enough if auth finish is close.
              }}
              className="px-6 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 rounded-full text-white/50 hover:text-white/80 text-sm font-medium transition-all shadow-2xl"
            >
              Enter Dashboard Anyway →
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app-root">
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

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
