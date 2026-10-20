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
import { ThemeProvider } from './context/ThemeProvider';
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

import RootErrorFallback from './components/common/RootErrorFallback';

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
      return <RootErrorFallback error={this.state.error} />;
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
