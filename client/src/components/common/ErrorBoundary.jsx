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
      return (
        <div className="fixed inset-0 z-[2147483647] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-lg relative"
          >
            {/* Background Glow */}
            <div className="absolute -inset-1 bg-gradient-to-r from-red-500/20 to-orange-500/20 blur-2xl rounded-[40px] opacity-50" />
            
            <div 
              className="relative bg-[#0d0d0d] border border-white/5 rounded-[36px] p-8 shadow-2xl overflow-hidden"
              style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
            >
              {/* Top Glass Highlight */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-8">
                  <div className="absolute inset-0 bg-red-500/20 blur-xl rounded-full animate-pulse" />
                  <div className="relative w-20 h-20 rounded-full bg-gradient-to-b from-red-500/10 to-red-500/5 flex items-center justify-center border border-red-500/20">
                    <AlertTriangle size={32} className="text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
                  </div>
                </div>

                <h2 className="text-2xl font-semibold text-white mb-3 tracking-tight">
                  System Exception
                </h2>
                
                <p className="text-[13px] text-zinc-400 leading-relaxed mb-8 max-w-sm px-4">
                  A critical error occurred while rendering the immersive engine. The dashboard remains unaffected, but this component requires a reset.
                </p>

                {/* Error Log Container */}
                <div className="w-full mb-8 group">
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <Terminal size={12} className="text-zinc-500" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">Error Stack Trace</span>
                  </div>
                  <div className="w-full bg-black/40 rounded-2xl p-4 border border-white/5 text-left transition-colors group-hover:border-white/10">
                    <code className="text-[11px] text-red-400/90 font-mono leading-relaxed break-all whitespace-pre-wrap">
                      {this.state.error?.name}: {this.state.error?.message || 'Unknown system error'}
                    </code>
                  </div>
                </div>

                <div className="flex w-full gap-4">
                  {this.props.onClose && (
                    <button
                      onClick={this.props.onClose}
                      className="flex-1 py-4 px-6 rounded-2xl bg-white/5 border border-white/5 text-zinc-400 hover:bg-white/10 hover:text-white transition-all text-sm font-medium"
                    >
                      Dismiss
                    </button>
                  )}
                  <button
                    onClick={this.handleRetry}
                    className="flex-[1.5] py-4 px-6 rounded-2xl bg-white text-black hover:bg-zinc-200 active:scale-[0.98] transition-all text-sm font-bold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.15)]"
                  >
                    <RotateCcw size={16} strokeWidth={2.5} />
                    Restore Engine
                  </button>
                </div>
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
