import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, X, CheckCircle, Info, AlertCircle, AlertTriangle } from 'lucide-react';
import useTutorStore from '../../store/tutorStore';

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
    badgeBg: 'bg-orange-500/10 dark:bg-orange-500/15',
    badgeBorder: 'border-orange-500/25',
    iconColor: 'text-orange-600 dark:text-orange-400',
  },
};

const Toast = ({ toast, index, total }) => {
  const { removeToast } = useTutorStore();
  const { id, message, type = 'info', duration = 5000, onUndo } = toast;
  
  const config = ICON_CONFIG[type] || ICON_CONFIG.info;
  const Icon = config.icon;

  // Visual stacking math
  const opacity = (index + 1) / total;
  const scale = 0.94 + ((index + 1) / total) * 0.06;
  const blur = (total - 1 - index) * 1.2;

  useEffect(() => {
    const timer = setTimeout(() => {
      removeToast(id);
    }, duration || 5000);
    return () => clearTimeout(timer);
  }, [id, duration, removeToast]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ 
        opacity, 
        y: 0, 
        scale,
        filter: blur > 0 ? `blur(${blur}px)` : 'none',
      }}
      exit={{ opacity: 0, scale: 0.94, y: 12, transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] } }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="relative group pointer-events-auto overflow-hidden rounded-full border border-[var(--border-color)] bg-[var(--bg-secondary)]/95 dark:bg-[#121211]/95 backdrop-blur-xl shadow-xl dark:shadow-[0_16px_40px_rgba(0,0,0,0.6)]"
      style={{
        minWidth: '280px',
        maxWidth: '440px',
        margin: '0',
        boxShadow: '0 12px 32px -4px rgba(0, 0, 0, 0.15), 0 1px 0 rgba(255, 255, 255, 0.08) inset',
      }}
    >
      {/* Subtle Micro-Progress Track */}
      <div className="absolute bottom-0 left-6 right-6 h-[1.5px] bg-black/[0.04] dark:bg-white/[0.06] rounded-full overflow-hidden">
        <motion.div
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: duration / 1000, ease: 'linear' }}
          className="h-full bg-[var(--text-primary)]/20"
          style={{ transformOrigin: 'left' }}
        />
      </div>

      <div className="flex items-center gap-3 pl-3.5 pr-3 py-2.5">
        {/* Crisp Professional Status Icon — No Blur/Glow */}
        <div 
          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border ${config.badgeBg} ${config.badgeBorder}`}
        >
          <Icon size={14} className={`${config.iconColor} stroke-[2.2]`} />
        </div>
        
        {/* Message Content */}
        <div className="flex-1 min-w-0 pr-1">
          <p 
            className="text-[12.5px] font-medium text-[var(--text-primary)] leading-snug select-none" 
            style={{ fontFamily: 'var(--font-sans, "Inter", sans-serif)' }}
          >
            {message || 'Notification'}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {onUndo && (
            <button
              type="button"
              onClick={() => { onUndo(); removeToast(id); }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-tertiary)] hover:bg-[var(--border-strong)] text-[var(--text-primary)] transition-all active:scale-95 border border-[var(--border-color)] shadow-xs cursor-pointer"
            >
              <RotateCcw size={11} className="stroke-[2.2]" />
              <span className="text-[10px] font-semibold tracking-wider uppercase">Undo</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => removeToast(id)}
            aria-label="Dismiss notification"
            className="w-6 h-6 flex items-center justify-center rounded-full text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={13} strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const ToastContainer = () => {
  const { toasts } = useTutorStore();

  if (toasts.length === 0) return null;

  return (
    <div 
      className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-3 pointer-events-none"
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
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default ToastContainer;
