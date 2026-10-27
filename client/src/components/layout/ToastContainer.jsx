import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, X } from 'lucide-react';
import useTutorStore from '../../store/tutorStore';

// A small status dot instead of a coloured badge: info stays neutral, the rest keep a muted signal colour
const DOT = {
  info: 'bg-[var(--text-tertiary)]',
  success: 'bg-emerald-500/90',
  warning: 'bg-amber-500/90',
  error: 'bg-rose-500/90',
};

const EASE = [0.16, 1, 0.3, 1];

/**
 * Toast — one slim line at the top centre on every screen size, clear of the
 * playback bar, chat composer and canvas controls. Long messages end in "…"
 * (the full text shows on hover). Hovering pauses the auto-dismiss.
 */
const Toast = ({ toast }) => {
  const removeToast = useTutorStore((s) => s.removeToast);
  const { id, message, type = 'info', duration = 4000, onUndo, updatedAt } = toast;
  const [paused, setPaused] = useState(false);
  const remainingRef = useRef(duration || 4000);
  const startedRef = useRef(0);

  const displayMessage = typeof message === 'string' && message.trim() ? message.trim() : 'Notice';

  useEffect(() => {
    if (paused) return undefined;
    remainingRef.current = duration || 4000;
    startedRef.current = Date.now();
    const timer = setTimeout(() => removeToast(id), remainingRef.current);
    return () => {
      clearTimeout(timer);
      remainingRef.current = Math.max(800, remainingRef.current - (Date.now() - startedRef.current));
    };
  }, [id, paused, removeToast, updatedAt, duration]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.97, transition: { duration: 0.16, ease: EASE } }}
      transition={{ duration: 0.24, ease: EASE }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      role={type === 'error' ? 'alert' : 'status'}
      className="pointer-events-auto flex h-9 max-w-full items-center gap-2.5 rounded-full tb-dock-glass pl-3.5 pr-1.5 select-none"
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[type] || DOT.info}`} />

      <p className="m-0 min-w-0 truncate text-[12.5px] font-medium leading-none text-[var(--text-primary)]" title={displayMessage}>
        {displayMessage}
      </p>

      {onUndo && (
        <button
          type="button"
          onClick={() => { onUndo(); removeToast(id); }}
          className="flex h-6 shrink-0 cursor-pointer items-center gap-1 rounded-full border-0 bg-[var(--st-fill)] px-2.5 text-[11.5px] font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--st-fill-strong)] active:scale-95"
        >
          <RotateCcw size={11} strokeWidth={2.2} />
          Undo
        </button>
      )}

      <button
        type="button"
        onClick={() => removeToast(id)}
        aria-label="Dismiss notification"
        className="grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--st-fill)] hover:text-[var(--text-primary)]"
      >
        <X size={13} strokeWidth={2.2} />
      </button>
    </motion.div>
  );
};

const ToastContainer = () => {
  const toasts = useTutorStore((s) => s.toasts);

  if (!toasts || toasts.length === 0) return null;

  const content = (
    <div
      className="fixed inset-x-0 top-[max(14px,env(safe-area-inset-top))] z-[100050] mx-auto flex w-fit max-w-[min(calc(100vw-32px),560px)] flex-col items-center gap-2 pointer-events-none"
      aria-live="polite"
      aria-label="Notifications"
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} />
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
