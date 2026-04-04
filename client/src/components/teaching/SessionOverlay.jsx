/**
 * SessionOverlay — State-aware overlay screens for the teaching session
 * 
 * NEXT-GEN: Interactive lesson completion with replay, rewind, practice, 
 * difficulty change, and session save options.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Loader, AlertTriangle, RotateCcw, ArrowRight, 
  Rewind, Play, Dumbbell, Gauge, Bookmark,
  MessageCircleQuestion, Sparkles
} from 'lucide-react';
import useTutorStore from '../../store/tutorStore';

const SessionOverlay = ({ 
  machineState, 
  error, 
  topic,
  totalSteps,
  doubtHistory,
  onRetry, 
  onNewTopic,
  onClose,
  onReplay,
}) => {
  const { goToStep, play } = useTutorStore();
  const [showActions, setShowActions] = useState(true);

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
                Building your visual lesson
              </h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Creating an interactive animated explanation for
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

            {/* Tips */}
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2 }}
              className="text-[11px] text-[var(--text-tertiary)] italic"
            >
              💡 Tip: Use ? to ask doubts during the lesson
            </motion.p>
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

      {/* ─── COMPLETED (INTERACTIVE) ─── */}
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
            className="flex flex-col items-center gap-6 max-w-lg w-full text-center px-8"
          >
            {/* Celebration */}
            <motion.div
              animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="text-5xl"
            >
              🎓
            </motion.div>

            <div>
              <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">
                Lesson Complete!
              </h3>
              <p className="text-sm text-[var(--text-secondary)]">
                You've explored <strong>"{topic}"</strong> through {totalSteps} visual steps
              </p>
            </div>

            {/* Stats */}
            <div className="flex gap-8">
              <div className="text-center">
                <div className="text-3xl font-bold text-[var(--text-primary)]">{totalSteps}</div>
                <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-bold">Steps</div>
              </div>
              <div className="w-px bg-[var(--border-color)]" />
              <div className="text-center">
                <div className="text-3xl font-bold text-[var(--text-primary)]">{doubtHistory?.length || 0}</div>
                <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-bold">Doubts</div>
              </div>
            </div>

            {/* ─── INTERACTIVE OPTIONS GRID ─── */}
            <div className="w-full grid grid-cols-2 gap-2 mt-2">
              {/* Replay Lesson */}
              <button
                onClick={() => { if (onReplay) onReplay(); }}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/60 backdrop-blur-sm text-left hover:bg-[var(--bg-tertiary)] hover:border-[var(--text-tertiary)] transition-all group"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <RotateCcw size={16} className="text-blue-400" />
                </div>
                <div>
                  <span className="text-[12px] font-bold text-[var(--text-primary)] block">Replay</span>
                  <span className="text-[10px] text-[var(--text-tertiary)]">Watch again</span>
                </div>
              </button>

              {/* Step-by-step Rewind */}
              <button
                onClick={() => { goToStep(0); }}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/60 backdrop-blur-sm text-left hover:bg-[var(--bg-tertiary)] hover:border-[var(--text-tertiary)] transition-all group"
              >
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <Rewind size={16} className="text-purple-400" />
                </div>
                <div>
                  <span className="text-[12px] font-bold text-[var(--text-primary)] block">Rewind</span>
                  <span className="text-[10px] text-[var(--text-tertiary)]">Step by step</span>
                </div>
              </button>

              {/* Ask Doubt */}
              <button
                onClick={() => {
                  // Focus the doubt input
                  const el = document.querySelector('[data-doubt-input]') || document.querySelector('input[placeholder*="doubt"]');
                  if (el) el.focus();
                }}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/60 backdrop-blur-sm text-left hover:bg-[var(--bg-tertiary)] hover:border-[var(--text-tertiary)] transition-all group"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <MessageCircleQuestion size={16} className="text-emerald-400" />
                </div>
                <div>
                  <span className="text-[12px] font-bold text-[var(--text-primary)] block">Ask Doubt</span>
                  <span className="text-[10px] text-[var(--text-tertiary)]">Clarify concepts</span>
                </div>
              </button>

              {/* New Topic */}
              <button
                onClick={onNewTopic}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/60 backdrop-blur-sm text-left hover:bg-[var(--bg-tertiary)] hover:border-[var(--text-tertiary)] transition-all group"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <Sparkles size={16} className="text-amber-400" />
                </div>
                <div>
                  <span className="text-[12px] font-bold text-[var(--text-primary)] block">New Topic</span>
                  <span className="text-[10px] text-[var(--text-tertiary)]">Learn more</span>
                </div>
              </button>
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="mt-2 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Close session
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SessionOverlay;
