import React, { Component } from 'react';
import { AlertTriangle, RotateCcw, XCircle, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(this.state.error);
      }
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="fixed inset-0 z-[2147483647] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-[420px] relative mx-auto"
          >
            {/* Background Glow */}
            <div className="absolute -inset-1 bg-red-500/10 blur-2xl rounded-[32px] opacity-40 animate-pulse" />

            <div
              className="relative bg-[var(--bg-primary)] border border-red-500/15 rounded-2xl p-6 text-center shadow-2xl flex flex-col items-center"
              style={{ background: 'rgba(239,68,68,0.05)', boxShadow: '0 8px 32px rgba(239,68,68,0.03)' }}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors"
                style={{ background: 'rgba(239,68,68,0.12)' }}>
                <AlertTriangle size={22} style={{ color: '#ef4444' }} />
              </div>

              <h2 className="text-[16px] font-semibold mb-1 tracking-tight" style={{ color: 'var(--text-primary)' }}>
                System Exception
              </h2>

              <p className="text-[12px] leading-relaxed mb-4 px-2" style={{ color: 'var(--text-tertiary)' }}>
                A runtime exception interrupted component rendering. The underlying core layout remains preserved.
              </p>

              {/* Error Log Container */}
              <div className="w-full mb-5 group">
                <div className="flex items-center justify-center gap-1.5 mb-1.5">
                  <Terminal size={11} className="text-zinc-500" />
                  <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-500">Stack Trace</span>
                </div>
                <div className="w-full bg-black/30 rounded-xl p-3 border border-white/5 text-center transition-colors group-hover:border-white/10 overflow-hidden">
                  <code className="text-[11px] text-red-400/80 font-mono leading-normal break-all whitespace-pre-wrap block max-h-24 overflow-y-auto thin-scrollbar">
                    {this.state.error?.name}: {this.state.error?.message || 'Unknown exception'}
                  </code>
                </div>
              </div>

              <div className="flex w-full gap-3 justify-center">
                {this.props.onClose && (
                  <button
                    onClick={this.props.onClose}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-white/5 border border-white/5 text-[var(--text-tertiary)] hover:bg-white/10 hover:text-[var(--text-primary)] transition-all text-[11.5px] font-medium"
                  >
                    Dismiss
                  </button>
                )}
                <button
                  onClick={this.handleRetry}
                  className="flex-1 py-2.5 px-4 rounded-xl text-[#ffffff] font-semibold transition-all active:scale-95 shadow-md hover:opacity-90 flex items-center justify-center gap-2"
                  style={{ background: '#ef4444' }}
                >
                  <RotateCcw size={13} strokeWidth={2.5} />
                  <span className="text-[11.5px]">Restore Engine</span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
