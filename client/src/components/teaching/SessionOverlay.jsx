/**
 * SessionOverlay — State-aware overlay screens for the teaching session
 * 
 * Shows different overlays based on machine state:
 *   GENERATING  → "Preparing your lesson..."
 *   RESPONDING  → "Thinking about your question..."
 *   RESUMING    → Brief flash "Continuing..."
 *   ERROR       → Error with retry
 *   COMPLETED   → Summary + celebration
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertTriangle, PartyPopper, RotateCcw, ArrowRight } from 'lucide-react';

const SessionOverlay = ({ 
  machineState, 
  error, 
  topic,
  totalSteps,
  doubtHistory,
  onRetry, 
  onNewTopic,
  onClose 
}) => {
  const isVisible = ['GENERATING', 'ERROR', 'COMPLETED'].includes(machineState);

  return (
    <AnimatePresence>
      {/* GENERATING */}
      {machineState === 'GENERATING' && (
        <motion.div
          key="generating"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 z-[100] flex items-center justify-center bg-[var(--bg-primary)]/80 backdrop-blur-xl"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center gap-6 max-w-md text-center px-8"
          >
            {/* Animated rings */}
            <div className="relative w-20 h-20">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0 rounded-full border-2 border-[var(--border-color)] border-t-[var(--text-primary)]"
              />
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-2 rounded-full border-2 border-[var(--border-color)] border-b-[var(--text-secondary)]"
              />
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-4 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center"
              >
                <span className="text-2xl">🎨</span>
              </motion.div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">
                Preparing your lesson
              </h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Creating a step-by-step visual explanation for
              </p>
              <p className="text-sm font-semibold text-[var(--text-primary)] mt-1">
                "{topic}"
              </p>
            </div>

            {/* Shimmer bar */}
            <div className="w-48 h-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
              <motion.div
                animate={{ x: [-200, 200] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                className="w-24 h-full bg-gradient-to-r from-transparent via-[var(--text-tertiary)] to-transparent rounded-full"
              />
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* ERROR */}
      {machineState === 'ERROR' && (
        <motion.div
          key="error"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-[100] flex items-center justify-center bg-[var(--bg-primary)]/80 backdrop-blur-xl"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-5 max-w-sm text-center px-8"
          >
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <AlertTriangle size={28} className="text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">Something went wrong</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                {error || 'Failed to generate the lesson. Please try again.'}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={onRetry}
                className="flex items-center gap-2 px-5 py-2.5 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-xl text-[12px] font-bold uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all"
              >
                <RotateCcw size={14} />
                Retry
              </button>
              <button
                onClick={onClose}
                className="px-5 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-secondary)] rounded-xl text-[12px] font-bold uppercase tracking-wider hover:text-[var(--text-primary)] active:scale-95 transition-all"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* COMPLETED */}
      {machineState === 'COMPLETED' && (
        <motion.div
          key="completed"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-[100] flex items-center justify-center bg-[var(--bg-primary)]/85 backdrop-blur-xl"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center gap-6 max-w-md text-center px-8"
          >
            <motion.div
              animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="text-5xl"
            >
              🎉
            </motion.div>

            <div>
              <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">
                Lesson Complete!
              </h3>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                You've completed the visual lesson on <strong>"{topic}"</strong>
              </p>
            </div>

            {/* Stats */}
            <div className="flex gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-[var(--text-primary)]">{totalSteps}</div>
                <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-bold">Steps</div>
              </div>
              <div className="w-px bg-[var(--border-color)]" />
              <div className="text-center">
                <div className="text-2xl font-bold text-[var(--text-primary)]">{doubtHistory?.length || 0}</div>
                <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-bold">Doubts</div>
              </div>
            </div>

            <div className="flex gap-3 mt-2">
              <button
                onClick={onNewTopic}
                className="flex items-center gap-2 px-5 py-2.5 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-xl text-[12px] font-bold uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all"
              >
                <ArrowRight size={14} />
                New Topic
              </button>
              <button
                onClick={onClose}
                className="px-5 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-secondary)] rounded-xl text-[12px] font-bold uppercase tracking-wider hover:text-[var(--text-primary)] active:scale-95 transition-all"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SessionOverlay;
