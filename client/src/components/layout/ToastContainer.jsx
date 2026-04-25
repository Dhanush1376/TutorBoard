import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, X, CheckCircle, Info, AlertCircle } from 'lucide-react';
import useTutorStore from '../../store/tutorStore';

const ICON_MAP = {
  success: { icon: CheckCircle, color: '#10b981' },
  error:   { icon: AlertCircle, color: '#ef4444' },
  info:    { icon: Info, color: '#3b82f6' }
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
      initial={{ opacity: 0, y: 20, scale: 0.92 }}
      animate={{ 
        opacity, 
        y: 0, 
        scale,
        filter: `blur(${blur}px)`,
      }}
      exit={{ opacity: 0, scale: 0.88, y: -16, transition: { duration: 0.18 } }}
      style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--glass-border)',
        borderLeft: `3px solid ${config.color}`,
        boxShadow: '0 8px 32px rgba(0,0,0,0.2), 0 2px 8px rgba(0,0,0,0.1)',
        borderRadius: '14px',
        overflow: 'hidden',
        pointerEvents: 'auto',
        width: 'fit-content',
        maxWidth: 'calc(100% - 24px)',
        margin: '0 auto',
      }}
    >
      {/* Progress drain bar */}
      <motion.div
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: (duration || 5000) / 1000, ease: 'linear' }}
        style={{
          height: '2px',
          background: config.color,
          transformOrigin: 'left',
          opacity: 0.4,
        }}
      />

      <div className="flex items-center gap-3 px-4 py-2.5">
        <div className="flex-shrink-0">
          <Icon size={15} style={{ color: config.color }} />
        </div>
        
        <p className="flex-1 truncate text-[12px] font-normal text-[var(--text-primary)] pr-1" style={{ letterSpacing: '-0.01em' }}>
          {message}
        </p>

        {onUndo && (
          <button
            onClick={() => { onUndo(); removeToast(id); }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] transition-all active:scale-95 group border border-[var(--border-color)]"
          >
            <RotateCcw size={11} className="group-hover:-rotate-45 transition-transform" />
            <span className="text-[10px] font-normal uppercase tracking-wider">Undo</span>
          </button>
        )}

        <button
          onClick={() => removeToast(id)}
          className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors opacity-50 hover:opacity-100 rounded-lg hover:bg-[var(--bg-tertiary)]"
        >
          <X size={13} />
        </button>
      </div>
    </motion.div>
  );
};

const ToastContainer = () => {
  const { toasts } = useTutorStore();

  if (toasts.length === 0) return null;

  return (
    <div 
      className="fixed top-6 right-6 z-[9999] flex flex-col items-end gap-3 pointer-events-none"
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {toasts.slice().reverse().map((toast, idx) => (
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
