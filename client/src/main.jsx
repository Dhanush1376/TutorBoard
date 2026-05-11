console.log('--- VITE_ID_9999 ---');
// SEC-LOG: Strip console.log in production to prevent leaking session/agent state
if (import.meta.env.MODE === 'production') {
  console.log = () => {};
  console.debug = () => {};
}

import.meta.env.DEV && console.log('[Main] Script started');
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthProvider';
import { ErrorBoundary as SentryErrorBoundary } from "@sentry/react";
import { initPostHog } from './utils/analytics';
import * as Sentry from "@sentry/react";
import './index.css';

// Initialize Analytics & Monitoring
initPostHog();

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

/**
 * Global Error Boundary for the entire application lifecycle.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[CRITICAL] Root error caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif', backgroundColor: '#f7f4ed', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h1 style={{ fontSize: '24px', color: '#1c1711', marginBottom: '16px' }}>Initialization Failed</h1>
          <p style={{ color: '#4f473a', marginBottom: '24px' }}>TutorBoard encountered a critical error during startup.</p>
          <button 
            onClick={() => { localStorage.clear(); window.location.reload(); }}
            style={{ padding: '12px 24px', backgroundColor: '#1c1711', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
          >
            Reset Session & Retry
          </button>
          <pre style={{ marginTop: '40px', padding: '20px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '8px', fontSize: '12px', textAlign: 'left', maxWidth: '80%', overflow: 'auto' }}>
            {this.state.error?.toString()}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
);
