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
import { X, List, MessageCircleQuestion, RotateCcw, Play, CheckCircle2, Binary, Sigma, Zap, FlaskConical, Leaf, Stethoscope, Briefcase, Scale, History, Settings, Brain, TrendingUp, Palette, Plane } from 'lucide-react';
import useTutorStore from '../../store/tutorStore';
import { DOMAIN_STYLES } from '../../lib/teaching';

// Icon mapping for domain badges
const DOMAIN_ICONS = {
  dsa: <Binary size={12} />,
  mathematics: <Sigma size={12} />,
  physics: <Zap size={12} />,
  chemistry: <FlaskConical size={12} />,
  biology: <Leaf size={12} />,
  medicine: <Stethoscope size={12} />,
  business: <Briefcase size={12} />,
  law: <Scale size={12} />,
  history: <History size={12} />,
  engineering: <Settings size={12} />,
  psychology: <Brain size={12} />,
  economics: <TrendingUp size={12} />,
  arts: <Palette size={12} />,
  aviation_maritime: <Plane size={12} />,
};

const FloatingSidebar = () => {
  const {
    showFloatingSidebar, closeFloatingSidebar,
    canvasSteps, currentStepIndex, totalSteps,
    doubtHistory, topic, timeline,
    goToStep, play,
  } = useTutorStore();

  const domain = timeline?.domain?.toLowerCase();
  const domainStyle = DOMAIN_STYLES[domain] || DOMAIN_STYLES.general;
  const domainIcon = DOMAIN_ICONS[domain];

  return (
    <AnimatePresence>
      {showFloatingSidebar && (
        <>
          {/* Sidebar panel */}
          <motion.div
            initial={{ x: -280, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -280, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-0 left-0 z-[10002] h-full w-[85vw] sm:w-[280px] flex flex-col glass"
            style={{
              background: 'var(--bg-secondary)',
              borderRight: '1px solid var(--glass-border)',
              boxShadow: 'var(--glass-shadow)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-2">
                <List size={16} className="text-[var(--text-tertiary)]" />
                <span className="text-[11px] font-normal uppercase tracking-[0.15em] text-[var(--text-tertiary)]">
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
              <div className="px-4 py-3 border-b border-[var(--border-color)]">
                <span className="text-[9px] font-normal uppercase tracking-[0.15em] text-[var(--text-tertiary)]">Topic</span>
                <p className="text-sm font-normal text-[var(--text-primary)] mt-1 leading-snug">
                  {timeline?.title || topic}
                </p>
                {timeline?.domain && (
                  <div className={`mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-normal uppercase tracking-wider ${domainStyle.bg} ${domainStyle.border} border`} style={{ color: domainStyle.color }}>
                    {domainIcon}
                    {timeline.domain}
                  </div>
                )}
              </div>
            )}

            {/* Step Navigation */}
            <div className="flex-1 overflow-y-auto no-scrollbar">
              {canvasSteps.length > 0 && (
                <div className="px-4 pt-4">
                  <span className="text-[9px] font-normal uppercase tracking-[0.15em] text-[var(--text-tertiary)] mb-3 block">
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
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-normal flex-shrink-0 transition-colors ${
                            isCurrent
                              ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]'
                              : isPast
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'
                          }`}
                          style={isCurrent ? { backgroundColor: domainStyle.color } : {}}>
                            {isPast ? <CheckCircle2 size={12} /> : i + 1}
                          </div>
                          <span className={`text-[12px] font-normal truncate ${isCurrent ? 'font-normal' : ''}`}>
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
                  <span className="text-[9px] font-normal uppercase tracking-[0.15em] text-[var(--text-tertiary)] mb-3 block">
                    <MessageCircleQuestion size={10} className="inline mr-1" />
                    Doubts ({doubtHistory.length})
                  </span>
                  <div className="space-y-1.5">
                    {doubtHistory.map((doubt, i) => (
                      <div
                        key={doubt.id}
                        className="px-3 py-2 rounded-xl bg-[var(--bg-tertiary)]/30 border border-[var(--border-color)] text-[11px] text-[var(--text-secondary)] leading-relaxed"
                      >
                        <span className="text-[var(--text-primary)] font-normal">{doubt.question}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="p-4 border-t border-[var(--border-color)] flex gap-2">
              <button
                onClick={() => { goToStep(0); }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[var(--text-secondary)] text-[11px] font-normal hover:bg-white/10 transition-all"
              >
                <RotateCcw size={12} />
                Replay
              </button>
              <button
                onClick={() => { play(); }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--text-primary)] text-[var(--bg-primary)] text-[11px] font-normal hover:opacity-90 transition-all"
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
