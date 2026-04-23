import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, X, CheckCircle, Info, AlertCircle } from 'lucide-react';
import useTutorStore from '../../store/tutorStore';

const ICON_MAP = {
  success: { icon: CheckCircle, color: '#10b981' },
  error:   { icon: AlertCircle, color: '#ef4444' },
  info:    { icon: Info, color: '#3b82f6' }
};

const Toast = ({ toast }) => {
  const { removeToast } = useTutorStore();
  const { id, message, type, duration, onUndo } = toast;
  
  const config = ICON_MAP[type] || ICON_MAP.info;
  const Icon = config.icon;

  useEffect(() => {
    const timer = setTimeout(() => {
      removeToast(id);
    }, duration || 5000);
    return () => clearTimeout(timer);
  }, [id, duration, removeToast]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
      className="flex items-center gap-3 px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.1)] pointer-events-auto w-fit mx-auto"
      style={{
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <div className="flex-shrink-0 flex items-center justify-center">
        <Icon size={14} style={{ color: config.color }} />
      </div>
      
      <p className="whitespace-nowrap text-[12px] font-normal text-[var(--text-primary)] pr-1">
        {message}
      </p>

      {onUndo && (
        <button
          onClick={() => {
            onUndo();
            removeToast(id);
          }}
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] transition-all active:scale-95 group border border-[var(--border-color)]"
        >
          <RotateCcw size={10} className="group-hover:-rotate-45 transition-transform" />
          <span className="text-[10px] font-medium uppercase tracking-tight">Undo</span>
        </button>
      )}

      <button
        onClick={() => removeToast(id)}
        className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors opacity-60 hover:opacity-100"
      >
        <X size={12} />
      </button>
    </motion.div>
  );
};

const ToastContainer = () => {
  const { toasts } = useTutorStore();

  return (
    <div className="absolute bottom-24 left-4 right-4 z-[50] flex flex-col items-stretch gap-3 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map(toast => (
          <Toast key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default ToastContainer;
