import React, { Component } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[TutorBoard] Caught error in component:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    // Reloading helps clear bad Zustand or socket state globally
    if (this.props.reloadOnRetry) {
      window.location.reload();
    }
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="fixed inset-0 z-[2147483647] bg-[var(--bg-primary)]/90 backdrop-blur-md flex flex-col items-center justify-center p-4">
          <div className="bg-[var(--bg-secondary)] border border-red-500/20 rounded-[32px] p-8 w-full max-w-lg shadow-[0_32px_64px_-16px_rgba(239,68,68,0.2)] flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-6 border border-red-500/20">
              <AlertTriangle size={32} />
            </div>
            
            <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2 tracking-tight">
              Component Error
            </h3>
            
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              A critical error occurred while rendering the immersive engine. The dashboard remains unaffected.
            </p>

            <div className="w-full bg-[var(--bg-tertiary)] rounded-2xl p-4 mb-6 border border-[var(--border-color)] overflow-x-auto text-left">
              <code className="text-[10px] text-red-400 font-mono whitespace-pre-wrap word-break">
                {this.state.error?.toString()}
              </code>
            </div>

            <div className="flex w-full gap-3">
              {this.props.onClose && (
                <button
                  onClick={this.props.onClose}
                  className="flex-1 py-3 px-4 rounded-xl border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] text-sm font-bold transition-all"
                >
                  Close Engine
                </button>
              )}
              <button
                onClick={this.handleRetry}
                className="flex-1 py-4 px-6 rounded-2xl bg-gradient-to-r from-red-500/20 to-red-600/20 text-red-100 hover:scale-[1.02] active:scale-[0.98] text-sm font-bold transition-all border border-red-500/30 flex items-center justify-center gap-2 shadow-lg shadow-red-500/10"
              >
                <RotateCcw size={16} />
                Restore Engine
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
