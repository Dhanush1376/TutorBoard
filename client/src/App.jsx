import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AuthLanding from './pages/AuthLanding';
import Home from './pages/Home';
import Loader from './components/Loader';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { useAuth } from './context/AuthContext';

function App() {
  const { loading: authLoading } = useAuth();
  const [welcomeLoading, setWelcomeLoading] = useState(() => {
    // Check if the welcome animation has already played in this session
    return !sessionStorage.getItem('tb-welcome-played');
  });

  useEffect(() => {
    if (welcomeLoading) {
      const timer = setTimeout(() => {
        setWelcomeLoading(false);
        sessionStorage.setItem('tb-welcome-played', 'true');
      }, 4000); // 4 seconds initial loader delay
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
