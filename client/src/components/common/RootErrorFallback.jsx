import React, { useState, useEffect } from 'react';
import { 
  RotateCcw, 
  RefreshCw, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Terminal, 
  ArrowLeft,
  ShieldAlert
} from 'lucide-react';
import BorderGlow from '../ui/BorderGlow';

/**
 * RootErrorFallback - Ultra-premium, themed error fallback screen.
 * Resilient to React Context failure: works with pure DOM + CSS variables.
 */
const RootErrorFallback = ({ error }) => {
  const [copied, setCopied] = React.useState(false);
  const [showTrace, setShowTrace] = React.useState(false);
  const [isDark, setIsDark] = React.useState(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark') || 
             localStorage.getItem('tb-mode') === 'dark';
    }
    return false;
  });

  // Keep HTML class in sync with theme
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (isDark) {
      document.documentElement.classList.add('dark');
      try { localStorage.setItem('tb-mode', 'dark'); } catch (e) {}
    } else {
      document.documentElement.classList.remove('dark');
      try { localStorage.setItem('tb-mode', 'light'); } catch (e) {}
    }
  }, [isDark]);


  const handleCopy = () => {
    if (!error) return;
    const text = `TutorBoard System Diagnostic:\n` +
                 `Error: ${error.name || 'Error'}: ${error.message || ''}\n` +
                 `Timestamp: ${new Date().toISOString()}\n` +
                 `URL: ${typeof window !== 'undefined' ? window.location.href : 'unknown'}\n\n` +
                 `Stack Trace:\n${error.stack || 'No stack trace available'}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleHardReset = () => {
    try {
      sessionStorage.clear();
      localStorage.removeItem('tb-active-session');
      localStorage.removeItem('tb-welcome-played');
      localStorage.removeItem('tb-welcome-played-v10');
      localStorage.removeItem('tb-intro-seen');
    } catch (e) {}
    window.location.href = '/login';
  };

  const handleQuickRetry = () => {
    window.location.reload();
  };

  const errorName = error?.name || 'Runtime Exception';
  const errorMessage = error?.message || (typeof error === 'string' ? error : 'An unexpected exception halted the engine initialization.');
  const errorStack = error?.stack || String(error || 'No stack trace available');

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-[var(--bg-primary)] font-sans relative overflow-x-hidden selection:bg-[var(--text-primary)] selection:text-[var(--bg-primary)] transition-colors duration-300">
      {/* ── Architectural Background Grid ── */}
      <div 
        className="fixed inset-0 pointer-events-none overflow-hidden" 
        aria-hidden="true"
      >
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(to right, var(--border-color) 1px, transparent 1px),
              linear-gradient(to bottom, var(--border-color) 1px, transparent 1px)
            `,
            backgroundSize: '36px 36px',
            backgroundPosition: 'center center',
            opacity: 0.55,
            maskImage: 'radial-gradient(ellipse 85% 85% at 50% 50%, black 40%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 85% 85% at 50% 50%, black 40%, transparent 100%)',
          }}
        />

        {/* Atmospheric ambient radiant glow orbs */}
        <div 
          className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[540px] h-[340px] rounded-full blur-[140px] pointer-events-none opacity-40 dark:opacity-30"
          style={{
            background: 'radial-gradient(circle, rgba(244,63,94,0.18) 0%, rgba(192,132,252,0.12) 50%, transparent 70%)'
          }}
        />
        <div 
          className="absolute bottom-10 right-1/4 w-[420px] h-[280px] rounded-full blur-[130px] pointer-events-none opacity-30 dark:opacity-20"
          style={{
            background: 'radial-gradient(circle, rgba(56,189,248,0.15) 0%, transparent 70%)'
          }}
        />
      </div>

      {/* ── Center Error Card ── */}
      <main className="w-full max-w-[500px] relative z-10 py-6">
        <BorderGlow
          borderRadius={32}
          glowRadius={30}
          glowIntensity={isDark ? 0.65 : 0.45}
          coneSpread={28}
          colors={['#f43f5e', '#c084fc', '#38bdf8']}
          backgroundColor="var(--bg-primary)"
          className="w-full shadow-2xl backdrop-blur-xl"
        >
          <div className="p-6 sm:p-9 flex flex-col items-center text-center relative">
            {/* System Status Pill Badge */}


            {/* Glowing Icon Container */}
            <div className="relative mb-4">
              <div 
                className="absolute inset-0 rounded-2xl blur-xl opacity-40 bg-rose-500" 
                aria-hidden="true" 
              />
              <div className="relative w-14 h-14 rounded-2xl bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/25 text-rose-500 dark:text-rose-400 flex items-center justify-center shadow-inner">
                <ShieldAlert className="w-7 h-7 stroke-[2]" />
              </div>
            </div>

            {/* Heading */}
            <h1 
              className="text-[23px] sm:text-[25px] font-heading font-semibold text-[var(--text-primary)] tracking-tight mb-2"
              style={{ fontFamily: 'var(--font-heading, "Outfit", sans-serif)' }}
            >
              Initialization Interrupted
            </h1>

            {/* Subtitle */}
<br></br>

            {/* Diagnostic Box: Error pill + message */}
            <div className="w-full mb-6 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl p-3.5 text-left transition-all">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  {errorName}
                </span>

                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-[11px] font-mono text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer px-2 py-1 rounded-md hover:bg-[var(--bg-tertiary)]"
                  title="Copy diagnostic error information"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-500 font-medium">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 opacity-70" />
                      <span>Copy log</span>
                    </>
                  )}
                </button>
              </div>

              {/* Error Message */}
              <div className="font-mono text-[12px] text-rose-600 dark:text-rose-400 font-medium break-all leading-relaxed bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-3 py-2.5 shadow-2xs">
                {errorMessage}
              </div>

              {/* Stack Trace Accordion */}
              <div className="mt-2.5 pt-2 border-t border-[var(--border-color)]/60">
                <button
                  type="button"
                  onClick={() => setShowTrace(!showTrace)}
                  className="w-full flex items-center justify-between text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer py-0.5"
                >
                  <span className="flex items-center gap-1.5 font-mono">
                    <Terminal className="w-3.5 h-3.5 opacity-60" />
                    {showTrace ? 'Hide stack trace' : 'View full stack trace'}
                  </span>
                  {showTrace ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showTrace && (
                  <div className="mt-2 p-2.5 bg-black/5 dark:bg-black/40 border border-[var(--border-color)] rounded-xl overflow-hidden text-left">
                    <pre className="text-[10px] font-mono text-[var(--text-secondary)] leading-relaxed overflow-x-auto max-h-44 thin-scrollbar whitespace-pre-wrap break-all">
                      {errorStack}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons with BorderGlow */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full">
              <BorderGlow
                hoverGlow
                borderRadius={9999}
                glowRadius={16}
                glowIntensity={0.65}
                coneSpread={22}
                colors={['#f43f5e', '#c084fc', '#38bdf8']}
                className="border-glow-btn w-full sm:flex-1"
              >
                <button
                  type="button"
                  onClick={handleHardReset}
                  className="w-full py-2.5 px-5 rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] font-semibold text-[12px] hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer border-0 shadow-sm"
                  style={{ borderRadius: '9999px' }}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Session & Reload</span>
                </button>
              </BorderGlow>

              <button
                type="button"
                onClick={handleQuickRetry}
                className="w-full sm:w-auto py-2.5 px-4 rounded-full text-[12px] font-medium text-[var(--text-primary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-color)] transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
                style={{ borderRadius: '9999px' }}
              >
                <RefreshCw className="w-3.5 h-3.5 opacity-60" />
                <span>Retry</span>
              </button>
            </div>

            {/* Secondary navigation link */}
            <div className="mt-5 pt-4 border-t border-[var(--border-color)] w-full flex items-center justify-center gap-4 text-[11.5px] text-[var(--text-tertiary)]">
              <a 
                href="/login" 
                onClick={(e) => { e.preventDefault(); handleHardReset(); }}
                className="hover:text-[var(--text-primary)] transition-colors flex items-center gap-1 cursor-pointer font-medium"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Return to Sign In</span>
              </a>
              <span>•</span>
              <a 
                href="mailto:support@tutorboard.ai" 
                className="hover:text-[var(--text-primary)] transition-colors font-medium"
              >
                Report Issue
              </a>
            </div>
          </div>
        </BorderGlow>
      </main>
    </div>
  );
};

export default RootErrorFallback;
