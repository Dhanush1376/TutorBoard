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
      initial={{ opacity: 0, y: 30, scale: 0.9 }}
      animate={{ 
        opacity, 
        y: 0, 
        scale,
        filter: `blur(${blur}px)`,
      }}
      exit={{ opacity: 0, scale: 0.9, y: -20, transition: { duration: 0.2 } }}
      className="flex items-center gap-3 px-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.2)] pointer-events-auto w-fit mx-auto max-w-[calc(100%-24px)]"
      style={{
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div className="flex-shrink-0 flex items-center justify-center">
        <Icon size={16} style={{ color: config.color }} />
      </div>
      
      <p className="flex-1 truncate text-[13px] font-normal text-[var(--text-primary)] pr-2">
        {message}
      </p>

      {onUndo && (
        <button
          onClick={() => {
            onUndo();
            removeToast(id);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] transition-all active:scale-95 group border border-[var(--border-color)]"
        >
          <RotateCcw size={12} className="group-hover:-rotate-45 transition-transform" />
          <span className="text-[11px] font-medium uppercase tracking-tight">Undo</span>
        </button>
      )}

      <button
        onClick={() => removeToast(id)}
        className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors opacity-60 hover:opacity-100"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
};

const ToastContainer = () => {
  const { toasts } = useTutorStore();

  if (toasts.length === 0) return null;

  return (
    <div 
      className="absolute bottom-[100px] left-0 right-0 z-[5000] flex flex-col items-center gap-2 pointer-events-none origin-bottom"
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
