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
          {/* Sidebar backdrop (dismissible) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeFloatingSidebar}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[75] pointer-events-auto"
          />

          {/* Sidebar panel */}
          <motion.div
            initial={{ x: -380, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -380, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-24 left-6 bottom-32 w-[340px] flex flex-col bg-[#0d0d14]/80 backdrop-blur-3xl border border-white/10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[80] overflow-hidden pointer-events-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
              <div className="flex items-center gap-2">
                <List size={16} className="text-white/50" />
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/50">
                  Session
                </span>
              </div>
              <button
                onClick={closeFloatingSidebar}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 text-white/50 hover:text-white hover:bg-white/10 transition-all active:scale-95"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>

            {/* Topic */}
            {topic && (
              <div className="px-5 py-4 border-b border-white/10">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Topic</span>
                <p className="text-[15px] font-medium text-white/95 mt-1.5 leading-snug">
                  {timeline?.title || topic}
                </p>
                {timeline?.domain && (
                  <div className={`mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${domainStyle.bg} border`} style={{ color: domainStyle.text, borderColor: `${domainStyle.border}44` }}>
                    {domainIcon}
                    {timeline.domain}
                  </div>
                )}
              </div>
            )}

            {/* Step Navigation */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {canvasSteps.length > 0 && (
                <div className="p-5">
                  <span className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/50 font-bold mb-3 block">
                    Steps ({currentStepIndex + 1}/{totalSteps})
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {canvasSteps.map((step, i) => {
                      const isCurrent = i === currentStepIndex;
                      const isPast = i < currentStepIndex;
                      return (
                        <button
                          key={i}
                          onClick={() => goToStep(i)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all relative group ${
                            isCurrent
                              ? 'bg-white/10 text-white shadow-sm ring-1 ring-white/10'
                              : isPast
                              ? 'text-white/60 hover:bg-white/5'
                              : 'text-white/40 hover:bg-white/5'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 transition-colors ${
                            isCurrent
                              ? 'bg-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]'
                              : isPast
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-white/5 text-white/40'
                          }`}
                          style={isCurrent ? { backgroundColor: domainStyle.color || '#3b82f6', boxShadow: `0 0 10px ${domainStyle.color || '#3b82f6'}80` } : {}}>
                            {isPast ? <CheckCircle2 size={12} strokeWidth={3} /> : i + 1}
                          </div>
                          <span className={`text-[12px] truncate ${isCurrent ? 'font-medium' : 'font-normal'}`}>
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
                <div className="px-5 pb-5 pt-2">
                  <span className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/50 font-bold mb-3">
                    <MessageCircleQuestion size={13} className="text-blue-400" />
                    Doubts ({doubtHistory.length})
                  </span>
                  <div className="flex flex-col gap-2">
                    {doubtHistory.map((doubt, i) => (
                      <div
                        key={doubt.id}
                        className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/5 text-[11px] text-white/70 leading-relaxed"
                      >
                        <span className="text-white/95 font-medium">{doubt.question}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="p-4 border-t border-white/10 bg-black/20 flex gap-2">
              <button
                onClick={() => { goToStep(0); }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 text-[11px] font-bold uppercase tracking-wider hover:bg-white/10 transition-all active:scale-95"
              >
                <RotateCcw size={14} />
                Replay
              </button>
              <button
                onClick={() => { play(); }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-[11px] font-bold uppercase tracking-wider shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all active:scale-95"
              >
                <Play size={14} fill="currentColor" />
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
