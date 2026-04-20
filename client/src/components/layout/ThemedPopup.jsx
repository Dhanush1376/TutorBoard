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
  const { globalAlert, closeAlert } = useTutorStore();
  const { isActive, type, title, message, confirmLabel, cancelLabel, onConfirm, onCancel, children } = globalAlert;

  const config = ICON_MAP[type] || ICON_MAP.info;
  const IconComponent = config.icon;

  const handleConfirm = () => {
    if (onConfirm) onConfirm();
    closeAlert();
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    closeAlert();
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
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-sm bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-[32px] shadow-[0_32px_80px_-16px_rgba(0,0,0,0.3)] overflow-hidden"
          >
            {/* Header / Icon */}
            <div className="p-8 flex flex-col items-center text-center">
              <div 
                className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
                style={{ background: config.bg }}
              >
                <IconComponent size={32} style={{ color: config.color }} />
              </div>

              <h2 className="text-xl font-black text-[var(--text-primary)] mb-2 tracking-tight font-syne">
                {title || 'Notice'}
              </h2>
              <p className="text-[13px] leading-relaxed text-[var(--text-secondary)] font-medium">
                {message}
              </p>

              {children && (
                <div className="w-full mt-6 text-left">
                  {children}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 p-6 pt-2">
              {onConfirm && (
                <button
                  onClick={handleCancel}
                  className="flex-1 py-3.5 px-2 rounded-[16px] text-[13px] font-bold text-[var(--text-secondary)] bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all active:scale-95"
                >
                  {cancelLabel}
                </button>
              )}
              <button
                onClick={handleConfirm}
                className={`flex-1 py-3.5 px-2 rounded-[16px] text-[13px] font-bold tracking-wide transition-all active:scale-95 shadow-lg ${
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
                className="absolute top-6 right-6 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
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
