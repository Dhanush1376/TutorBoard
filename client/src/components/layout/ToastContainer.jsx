import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, X, CheckCircle, Info, AlertCircle, AlertTriangle } from 'lucide-react';
import useTutorStore from '../../store/tutorStore';
import useWindowSize from '../../hooks/useWindowSize';

const ICON_CONFIG = {
  success: {
    icon: CheckCircle,
    badgeBg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    badgeBorder: 'border-emerald-500/25',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  error: {
    icon: AlertCircle,
    badgeBg: 'bg-rose-500/10 dark:bg-rose-500/15',
    badgeBorder: 'border-rose-500/25',
    iconColor: 'text-rose-600 dark:text-rose-400',
  },
  warning: {
    icon: AlertTriangle,
    badgeBg: 'bg-amber-500/10 dark:bg-amber-500/15',
    badgeBorder: 'border-amber-500/25',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  info: {
    icon: Info,
    badgeBg: 'bg-sky-500/10 dark:bg-sky-500/15',
    badgeBorder: 'border-sky-500/25',
    iconColor: 'text-sky-600 dark:text-sky-400',
  },
};

const Toast = ({ toast, index, total, isMobile }) => {
  const { removeToast } = useTutorStore();
  const { id, message, type = 'info', duration = 4000, onUndo } = toast;
  
  const config = ICON_CONFIG[type] || ICON_CONFIG.info;
  const Icon = config.icon;
  const displayMessage = typeof message === 'string' && message.trim()
    ? message.trim()
    : (typeof toast === 'string' && toast.trim() ? toast.trim() : 'Notice');

  // Visual stacking math
  const opacity = (index + 1) / total;
  const scale = 0.95 + ((index + 1) / total) * 0.05;

  useEffect(() => {
    const timer = setTimeout(() => {
      removeToast(id);
    }, duration || 4000);
    return () => clearTimeout(timer);
  }, [id, duration, removeToast]);

  return (
    <motion.div
      layout
      initial={isMobile ? { opacity: 0, y: -20, scale: 0.95 } : { opacity: 0, y: 16, scale: 0.95 }}
      animate={{ 
        opacity, 
        y: 0, 
        scale,
      }}
      exit={isMobile 
        ? { opacity: 0, y: -16, scale: 0.94, transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] } }
        : { opacity: 0, y: 12, scale: 0.94, transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] } }
      }
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      className="relative group pointer-events-auto overflow-hidden rounded-full border border-[var(--st-line-strong)] bg-[var(--bg-primary)]/95 dark:bg-[#151515]/95 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.14)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.65)] select-none"
      style={{
        maxWidth: isMobile ? 'min(calc(100vw - 32px), 420px)' : '440px',
        minWidth: isMobile ? 'auto' : '250px',
      }}
    >
      {/* Subtle Micro-Progress Track */}
      <div className="absolute bottom-0 left-5 right-5 h-[1.5px] bg-black/[0.04] dark:bg-white/[0.06] rounded-full overflow-hidden">
        <motion.div
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: (duration || 4000) / 1000, ease: 'linear' }}
          className="h-full bg-[var(--text-primary)]/20"
          style={{ transformOrigin: 'left' }}
        />
      </div>

      <div className="flex items-center gap-2.5 pl-3 pr-2.5 py-2">
        {/* Crisp Status Icon Badge */}
        <div 
          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border ${config.badgeBg} ${config.badgeBorder}`}
        >
          <Icon size={13} className={`${config.iconColor} stroke-[2.2]`} />
        </div>
        
        {/* Message Content */}
        <div className="flex-1 min-w-0 pr-1">
          <p 
            className="text-[12px] sm:text-[12.5px] font-medium text-[var(--text-primary)] leading-snug truncate" 
            title={displayMessage}
          >
            {displayMessage}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {onUndo && (
            <button
              type="button"
              onClick={() => { onUndo(); removeToast(id); }}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--st-fill)] hover:bg-[var(--st-fill-strong)] text-[var(--text-primary)] transition-all active:scale-95 border border-[var(--st-line)] shadow-xs cursor-pointer"
            >
              <RotateCcw size={10} className="stroke-[2.2]" />
              <span className="text-[9.5px] font-semibold tracking-wider uppercase">Undo</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => removeToast(id)}
            aria-label="Dismiss notification"
            className="w-5 h-5 flex items-center justify-center rounded-full text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={12} strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const ToastContainer = () => {
  const { toasts } = useTutorStore();
  const { isMobile } = useWindowSize();

  if (!toasts || toasts.length === 0) return null;

  const content = (
    <div 
      className={`fixed z-[100050] pointer-events-none flex flex-col gap-2 transition-all ${
        isMobile
          ? 'top-[max(12px,env(safe-area-inset-top))] inset-x-0 mx-auto items-center px-4'
          : 'bottom-6 right-6 items-end'
      }`}
      role="status"
      aria-live="polite"
      aria-label="Notifications"
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {toasts.map((toast, idx) => (
          <Toast 
            key={toast.id} 
            toast={toast} 
            index={idx} 
            total={toasts.length} 
            isMobile={isMobile}
          />
        ))}
      </AnimatePresence>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(content, document.body);
  }

  return content;
};

export default ToastContainer;
