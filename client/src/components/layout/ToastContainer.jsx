import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, X, CheckCircle, Info, AlertCircle } from 'lucide-react';
import useTutorStore from '../../store/tutorStore';

const ICON_MAP = {
  success: { icon: CheckCircle, color: '#10b981', glow: 'rgba(16, 185, 129, 0.2)' },
  error:   { icon: AlertCircle, color: '#ef4444', glow: 'rgba(239, 68, 68, 0.2)' },
  info:    { icon: Info, color: '#3b82f6', glow: 'rgba(59, 130, 246, 0.2)' }
};

const Toast = ({ toast, index, total }) => {
  const { removeToast } = useTutorStore();
  const { id, message, type, duration, onUndo } = toast;
  
  const config = ICON_MAP[type] || ICON_MAP.info;
  const Icon = config.icon;

  // Visual stacking math
  const opacity = (index + 1) / total;
  const scale = 0.92 + ((index + 1) / total) * 0.08;
  const blur = (total - 1 - index) * 1.5;

  useEffect(() => {
    const timer = setTimeout(() => {
      removeToast(id);
    }, duration || 5000);
    return () => clearTimeout(timer);
  }, [id, duration, removeToast]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={{ 
        opacity, 
        y: 0, 
        scale,
        filter: `blur(${blur}px)`,
      }}
      exit={{ opacity: 0, scale: 0.9, y: 20, transition: { duration: 0.2 } }}
      className="relative group pointer-events-auto"
      style={{
        background: 'var(--bg-secondary)',
        backdropFilter: 'blur(16px) saturate(180%)',
        WebkitBackdropFilter: 'blur(16px) saturate(180%)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-xl)',
        borderRadius: '20px',
        minWidth: '280px',
        maxWidth: '400px',
        margin: '0',
      }}
    >
      {/* Premium Progress Strip */}
      <div className="absolute top-0 left-4 right-4 h-[2px] bg-white/[0.05] rounded-full overflow-hidden">
        <motion.div
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: (duration || 5000) / 1000, ease: 'linear' }}
          className="h-full"
          style={{
            background: `linear-gradient(90deg, transparent, ${config.color})`,
            transformOrigin: 'left',
          }}
        />
      </div>

      <div className="flex items-center gap-4 px-5 py-4">
        {/* Status Indicator with Glow */}
        <div className="relative flex-shrink-0">
          <div 
            className="absolute inset-0 rounded-full blur-md opacity-40 animate-pulse"
            style={{ backgroundColor: config.color }}
          />
          <div 
            className="relative w-8 h-8 rounded-full flex items-center justify-center bg-white/[0.03] border border-white/10"
          >
            <Icon size={14} style={{ color: config.color }} strokeWidth={2.5} />
          </div>
        </div>
        
        <div className="flex-1">
          <p 
            className="text-[13px] font-medium text-[var(--text-primary)] leading-tight" 
            style={{ fontFamily: 'Outfit, sans-serif', letterSpacing: '0.01em' }}
          >
            {message || 'Notification'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onUndo && (
            <button
              onClick={() => { onUndo(); removeToast(id); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--brand-muted)] hover:bg-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all active:scale-95 group border border-[var(--border-color)] shadow-sm"
            >
              <RotateCcw size={12} className="group-hover:-rotate-90 transition-transform duration-500" />
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ fontFamily: 'Outfit, sans-serif' }}>Undo</span>
            </button>
          )}

          <button
            onClick={() => removeToast(id)}
            className="w-7 h-7 flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all rounded-full hover:bg-[var(--brand-muted)]"
          >
            <X size={14} strokeWidth={2.5} />
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
