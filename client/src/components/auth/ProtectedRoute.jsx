import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Loader from '../layout/Loader';

const ProtectedRoute = ({ children, guestAllowed = true }) => {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-full bg-[var(--bg-primary)] text-[var(--text-primary)] flex items-center justify-center overflow-hidden font-sans transition-colors duration-250">
        <Loader autoFade={false} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  // Handle guest restriction for sensitive routes (e.g. settings)
  if (user?.isGuest && !guestAllowed) {
    console.warn('[ProtectedRoute] Guest tried to access restricted route, redirecting to dashboard');
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;
