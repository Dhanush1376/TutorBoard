/**
 * FloatingSidebar — Glassmorphism floating sidebar for teaching sessions
 * 
 * Toggleable, never blocks canvas. Provides:
 *   - Lesson step navigation
 *   - Doubt history timeline
 *   - Session info
 *   - Resume/replay controls
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, List, MessageCircleQuestion, RotateCcw, Play, CheckCircle2 } from 'lucide-react';
import useTutorStore from '../../store/tutorStore';

const FloatingSidebar = () => {
  const {
    showFloatingSidebar, closeFloatingSidebar,
    canvasSteps, currentStepIndex, totalSteps,
    doubtHistory, topic, timeline,
    goToStep, play,
  } = useTutorStore();

  return (
    <AnimatePresence>
      {showFloatingSidebar && (
        <>
          {/* Backdrop (subtle) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeFloatingSidebar}
            className="fixed inset-0 z-[10001] bg-black/10"
          />

          {/* Sidebar panel */}
          <motion.div
            initial={{ x: -320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -320, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-0 left-0 z-[10002] h-full w-[280px] flex flex-col"
            style={{
              background: 'rgba(var(--bg-secondary-rgb, 22, 22, 20), 0.75)',
              backdropFilter: 'blur(24px) saturate(1.6)',
              WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
              borderRight: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <List size={16} className="text-[var(--text-tertiary)]" />
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--text-tertiary)]">
                  Session
                </span>
              </div>
              <button
                onClick={closeFloatingSidebar}
                className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-all"
              >
                <X size={14} />
              </button>
            </div>

            {/* Topic */}
            {topic && (
              <div className="px-4 py-3 border-b border-white/5">
                <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-[var(--text-tertiary)]">Topic</span>
                <p className="text-sm font-semibold text-[var(--text-primary)] mt-1 leading-snug">
                  {timeline?.title || topic}
                </p>
                {timeline?.domain && (
                  <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-white/5 border border-white/10 text-[var(--text-tertiary)]">
                    {timeline.domain}
                  </span>
                )}
              </div>
            )}

            {/* Step Navigation */}
            <div className="flex-1 overflow-y-auto no-scrollbar">
              {canvasSteps.length > 0 && (
                <div className="px-4 pt-4">
                  <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-[var(--text-tertiary)] mb-3 block">
                    Steps ({currentStepIndex + 1}/{totalSteps})
                  </span>
                  <div className="space-y-1">
                    {canvasSteps.map((step, i) => {
                      const isCurrent = i === currentStepIndex;
                      const isPast = i < currentStepIndex;
                      return (
                        <button
                          key={i}
                          onClick={() => goToStep(i)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all group ${
                            isCurrent
                              ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]'
                              : isPast
                              ? 'text-[var(--text-secondary)] hover:bg-white/5'
                              : 'text-[var(--text-tertiary)] hover:bg-white/5 hover:text-[var(--text-secondary)]'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                            isCurrent
                              ? 'bg-[var(--bg-primary)] text-[var(--text-primary)]'
                              : isPast
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-white/5 text-[var(--text-tertiary)]'
                          }`}>
                            {isPast ? <CheckCircle2 size={12} /> : i + 1}
                          </div>
                          <span className="text-[12px] font-medium truncate">
                            {step.title || step.label || `Step ${i + 1}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Doubt Summary */}
              {doubtHistory.length > 0 && (
                <div className="px-4 pt-6">
                  <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-[var(--text-tertiary)] mb-3 block">
                    <MessageCircleQuestion size={10} className="inline mr-1" />
                    Doubts ({doubtHistory.length})
                  </span>
                  <div className="space-y-1.5">
                    {doubtHistory.map((doubt, i) => (
                      <div
                        key={doubt.id}
                        className="px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] text-[var(--text-secondary)] leading-relaxed"
                      >
                        <span className="text-[var(--text-primary)] font-medium">{doubt.question}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="p-4 border-t border-white/5 flex gap-2">
              <button
                onClick={() => { goToStep(0); closeFloatingSidebar(); }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[var(--text-secondary)] text-[11px] font-medium hover:bg-white/10 transition-all"
              >
                <RotateCcw size={12} />
                Replay
              </button>
              <button
                onClick={() => { play(); closeFloatingSidebar(); }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--text-primary)] text-[var(--bg-primary)] text-[11px] font-bold hover:opacity-90 transition-all"
              >
                <Play size={12} />
                Resume
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default FloatingSidebar;
