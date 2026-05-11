import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Info, AlertTriangle, AlertCircle } from 'lucide-react';
import useTutorStore from '../../store/tutorStore';

const ICON_MAP = {
  success: { icon: Check, color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  error:   { icon: AlertCircle, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  warning: { icon: AlertTriangle, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  info:    { icon: Info, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' }
};

const ThemedPopup = () => {
  const { globalAlert, closeAlert, setAlertPref, alertPrefs } = useTutorStore();
  const { isActive, type, title, message, confirmLabel, cancelLabel, onConfirm, onCancel, children, prefKey } = globalAlert;
  const modalRef = React.useRef(null);

  const config = ICON_MAP[type] || ICON_MAP.info;
  const IconComponent = config.icon;

  // Focus trap and initial focus
  React.useEffect(() => {
    if (isActive && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      // Initial focus on the primary action button
      const confirmBtn = Array.from(focusableElements).find(el => el.textContent === confirmLabel);
      if (confirmBtn) confirmBtn.focus();
      else if (firstElement) firstElement.focus();

      const handleTab = (e) => {
        if (e.key !== 'Tab') return;
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      };

      const handleEscape = (e) => {
        if (e.key === 'Escape') handleCancel();
      };

      window.addEventListener('keydown', handleTab);
      window.addEventListener('keydown', handleEscape);
      return () => {
        window.removeEventListener('keydown', handleTab);
        window.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isActive, confirmLabel]);

  const handleConfirm = () => {
    if (onConfirm) onConfirm();
    closeAlert();
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    closeAlert();
  };

  const togglePref = () => {
    if (prefKey) setAlertPref(prefKey, !alertPrefs[prefKey]);
  };

  const handlePrefKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      togglePref();
    }
  };

  return (
    <AnimatePresence>
      {isActive && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCancel}
            className="absolute inset-0 bg-black/40 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="popup-title"
            aria-describedby="popup-message"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-sm bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-[32px] shadow-[0_32px_80px_-16px_rgba(0,0,0,0.3)] overflow-hidden outline-none"
          >
            {/* Header / Icon */}
            <div className="p-8 flex flex-col items-center text-center">
              <div 
                className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
                style={{ background: config.bg }}
              >
                <IconComponent size={32} style={{ color: config.color }} />
              </div>

              <h2 id="popup-title" className="text-xl font-normal text-[var(--text-primary)] mb-2 tracking-tight font-syne">
                {title || 'Notice'}
              </h2>
              <p id="popup-message" className="text-[13px] leading-relaxed text-[var(--text-secondary)] font-normal">
                {message}
              </p>

              {children && (
                <div className="w-full mt-6 text-left">
                  {children}
                </div>
              )}

              {/* Don't show again checkbox */}
              {prefKey && (
                <div 
                  className="w-full mt-6 flex items-center justify-center gap-2 group cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-primary)] rounded-lg py-1"
                  role="checkbox"
                  aria-checked={alertPrefs[prefKey]}
                  tabIndex="0"
                  onClick={togglePref}
                  onKeyDown={handlePrefKeyDown}
                >
                  <div className={`w-4 h-4 rounded border transition-all flex items-center justify-center ${
                    alertPrefs[prefKey] 
                    ? 'bg-[var(--text-primary)] border-[var(--text-primary)]' 
                    : 'border-[var(--border-color)] group-hover:border-[var(--text-tertiary)]'
                  }`}>
                    {alertPrefs[prefKey] && <Check size={10} className="text-[var(--bg-primary)]" strokeWidth={4} />}
                  </div>
                  <span className="text-[11px] font-normal text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)] transition-colors uppercase tracking-wider">
                    Don't show again
                  </span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 p-6 pt-2">
              {onConfirm && (
                <button
                  onClick={handleCancel}
                  className="flex-1 py-3.5 px-2 rounded-[16px] text-[13px] font-normal text-[var(--text-secondary)] bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-primary)]"
                >
                  {cancelLabel}
                </button>
              )}
              <button
                onClick={handleConfirm}
                className={`flex-1 py-3.5 px-2 rounded-[16px] text-[13px] font-normal tracking-wide transition-all active:scale-95 shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-primary)] ${
                  onConfirm 
                    ? type === 'error' 
                      ? 'bg-red-500 text-white hover:bg-red-600 shadow-red-500/25' 
                      : 'bg-[var(--text-primary)] text-[var(--bg-primary)] shadow-black/10'
                    : 'bg-[var(--text-primary)] text-[var(--bg-primary)] w-full'
                }`}
              >
                {confirmLabel}
              </button>
            </div>

            {/* Subtle close button in corner */}
            {!onConfirm && (
              <button 
                onClick={closeAlert}
                aria-label="Close"
                className="absolute top-6 right-6 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-primary)] rounded-full p-1"
              >
                <X size={18} />
              </button>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ThemedPopup;
