import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AuthLanding from './pages/AuthLanding';
import Home from './pages/Home';
import Loader from './components/Loader';
import ProtectedRoute from './components/auth/ProtectedRoute';
import MarketingLayout from './components/layout/MarketingLayout';
import HowItWorks from './pages/Marketing/HowItWorks';
import Features from './pages/Marketing/Features';
import Solutions from './pages/Marketing/Solutions';
import About from './pages/Marketing/About';
import { useAuth } from './context/AuthContext';

function App() {
  const { loading: authLoading } = useAuth();
  const [welcomeLoading, setWelcomeLoading] = useState(() => {
    // Check if the welcome animation has already played in this session
    try {
      return !sessionStorage.getItem('tb-welcome-played');
    } catch {
      return false; // Skip loader if sessionStorage is unavailable (private browsing, SSR)
    }
  });

  useEffect(() => {
    if (welcomeLoading) {
      const timer = setTimeout(() => {
        setWelcomeLoading(false);
        try {
          sessionStorage.setItem('tb-welcome-played', 'true');
        } catch {
          // Silently ignore if sessionStorage is unavailable
        }
      }, 2000); // 2 seconds initial loader delay
      return () => clearTimeout(timer);
    }
  }, [welcomeLoading]);

  // Total application loading state
  const isAppLoading = welcomeLoading || authLoading;

  if (isAppLoading) {
    return <Loader fullScreen={true} glass={!welcomeLoading} />;
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
