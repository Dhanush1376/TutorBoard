import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import './index.css';
import './styles/animations.css';
import useTutorStore from './store/tutorStore';


// Hydration is handled automatically by Zustand persist middleware
// No manual hydrate call needed anymore

// Simple Error Boundary for Top-Level Crashes
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) { console.error('[Fatal] App Crash Caught:', error, errorInfo); }
  handleReset = () => {
    localStorage.clear();
    window.location.href = '/';
  };
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif', backgroundColor: '#f7f4ed', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h1 style={{ color: '#1c1711' }}>Something went wrong.</h1>
          <p style={{ color: '#4f473a', maxWidth: '400px', lineHeight: 1.5 }}>The application encountered an unexpected error. This usually happens due to corrupted session data or a brief connection glitch.</p>
          <button onClick={this.handleReset} style={{ padding: '12px 24px', borderRadius: '12px', background: '#1c1711', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
            Reset Application
          </button>
          <pre style={{ marginTop: '32px', textAlign: 'left', background: '#f0ece2', padding: '16px', borderRadius: '8px', fontSize: '11px', overflow: 'auto', maxWidth: '90vw' }}>
            {this.state.error?.toString()}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
