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
import { X, List, MessageCircleQuestion, RotateCcw, Play, CheckCircle2, FlaskConical, Binary, Sigma, Zap, Leaf, Stethoscope, Briefcase, Scale, History, Settings, Brain, TrendingUp, Palette, Plane } from 'lucide-react';
import useTutorStore from '../../store/tutorStore';

const DOMAIN_STYLES = {
  'DSA': { color: '#10b981', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: <Binary size={12} /> },
  'Mathematics': { color: '#6366f1', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', icon: <Sigma size={12} /> },
  'Physics': { color: '#3b82f6', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: <Zap size={12} /> },
  'Chemistry': { color: '#ef4444', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: <FlaskConical size={12} /> },
  'Biology': { color: '#22c55e', bg: 'bg-green-500/10', border: 'border-green-500/20', icon: <Leaf size={12} /> },
  'Medicine': { color: '#ec4899', bg: 'bg-pink-500/10', border: 'border-pink-500/20', icon: <Stethoscope size={12} /> },
  'Business': { color: '#14b8a6', bg: 'bg-teal-500/10', border: 'border-teal-500/20', icon: <Briefcase size={12} /> },
  'Law': { color: '#f59e0b', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: <Scale size={12} /> },
  'History': { color: '#d97706', bg: 'bg-orange-600/10', border: 'border-orange-600/20', icon: <History size={12} /> },
  'Engineering': { color: '#f97316', bg: 'bg-orange-500/10', border: 'border-orange-500/20', icon: <Settings size={12} /> },
  'Psychology': { color: '#a855f7', bg: 'bg-purple-500/10', border: 'border-purple-500/20', icon: <Brain size={12} /> },
  'Economics': { color: '#4ade80', bg: 'bg-green-400/10', border: 'border-green-400/20', icon: <TrendingUp size={12} /> },
  'Arts': { color: '#f43f5e', bg: 'bg-rose-500/10', border: 'border-rose-500/20', icon: <Palette size={12} /> },
  'Aviation': { color: '#38bdf8', bg: 'bg-sky-400/10', border: 'border-sky-400/20', icon: <Plane size={12} /> },
};

const FloatingSidebar = () => {
  const {
    showFloatingSidebar, closeFloatingSidebar,
    canvasSteps, currentStepIndex, totalSteps,
    doubtHistory, topic, timeline,
    goToStep, play,
  } = useTutorStore();

  const domainStyle = DOMAIN_STYLES[timeline?.domain] || { color: '#94a3b8', bg: 'bg-white/5', border: 'border-white/10' };

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
                  <div className={`mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${domainStyle.bg} ${domainStyle.border} border`} style={{ color: domainStyle.color }}>
                    {domainStyle.icon}
                    {timeline.domain}
                  </div>
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
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-300 relative group ${
                            isCurrent
                              ? 'bg-white/10 text-[var(--text-primary)] shadow-[0_0_20px_rgba(255,255,255,0.02)]'
                              : isPast
                              ? 'text-[var(--text-secondary)] hover:bg-white/5'
                              : 'text-[var(--text-tertiary)] hover:bg-white/5 hover:text-[var(--text-secondary)]'
                          }`}
                        >
                          {isCurrent && (
                            <motion.div
                              layoutId="active-step-indicator"
                              className="absolute left-0 w-1 h-5 rounded-full"
                              style={{ backgroundColor: domainStyle.color }}
                            />
                          )}
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 transition-colors ${
                            isCurrent
                              ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]'
                              : isPast
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-white/5 text-[var(--text-tertiary)]'
                          }`}
                          style={isCurrent ? { backgroundColor: domainStyle.color } : {}}>
                            {isPast ? <CheckCircle2 size={12} /> : i + 1}
                          </div>
                          <span className={`text-[12px] font-medium truncate ${isCurrent ? 'font-bold' : ''}`}>
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
