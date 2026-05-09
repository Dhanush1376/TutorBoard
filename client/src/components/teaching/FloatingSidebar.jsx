/**
 * FloatingSidebar — Session navigation drawer.
 * Slides in from left. All colors via CSS variables.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, List, MessageCircleQuestion, RotateCcw, Play, CheckCircle2, Binary, Sigma, Zap, FlaskConical, Leaf, Stethoscope, Briefcase, Scale, History, Settings, Brain, TrendingUp, Palette, Plane } from 'lucide-react';
import useTutorStore from '../../store/tutorStore';
import { DOMAIN_STYLES, formatTopicTitle } from '../../lib/teaching';

const DOMAIN_ICONS = {
  dsa: <Binary size={12} />, mathematics: <Sigma size={12} />, physics: <Zap size={12} />,
  chemistry: <FlaskConical size={12} />, biology: <Leaf size={12} />, medicine: <Stethoscope size={12} />,
  business: <Briefcase size={12} />, law: <Scale size={12} />, history: <History size={12} />,
  engineering: <Settings size={12} />, psychology: <Brain size={12} />, economics: <TrendingUp size={12} />,
  arts: <Palette size={12} />, aviation_maritime: <Plane size={12} />,
};

const FloatingSidebar = () => {
  const {
    showFloatingSidebar, closeFloatingSidebar,
    canvasSteps, currentStepIndex, totalSteps,
    doubtHistory, topic, timeline,
    goToStep, play,
  } = useTutorStore();

  const domain = timeline?.domain?.toLowerCase();
  const ds = DOMAIN_STYLES[domain] || DOMAIN_STYLES.general;
  const icon = DOMAIN_ICONS[domain];

  return (
    <AnimatePresence>
      {showFloatingSidebar && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={closeFloatingSidebar}
            className="absolute inset-0 z-[75]"
            style={{ background: 'rgba(0,0,0,0.15)', backdropFilter: 'blur(2px)' }}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: -340, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -340, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-4 left-4 bottom-4 w-[300px] flex flex-col rounded-2xl overflow-hidden z-[80] liquid-glass"
            style={{ boxShadow: '0 20px 60px -12px rgba(0,0,0,0.25), 0 8px 24px -8px rgba(0,0,0,0.15)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <div className="flex items-center gap-2">
                <List size={15} style={{ color: 'var(--text-tertiary)' }} />
                <span className="text-[11px] font-medium uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>Session</span>
              </div>
              <button onClick={closeFloatingSidebar}
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-all active:scale-90 hover:bg-red-500/10 hover:text-red-400"
                style={{ color: 'var(--text-tertiary)', border: '1px solid var(--border-color)' }}>
                <X size={13} />
              </button>
            </div>

            {/* Topic */}
            {topic && (
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-color)' }}>
                <span className="text-[9px] font-medium uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>Topic</span>
                <p className="text-[14px] font-medium mt-1 leading-snug" style={{ color: 'var(--text-primary)' }}>
                  {formatTopicTitle(timeline?.title || topic)}
                </p>
                {timeline?.domain && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-medium uppercase tracking-wider mt-2"
                    style={{ color: ds.text, background: `${ds.bg}15`, border: `1px solid ${ds.border}30` }}>
                    {icon} {timeline.domain}
                  </span>
                )}
              </div>
            )}

            {/* Steps */}
            <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--border-color) transparent' }}>
              {canvasSteps.length > 0 && (
                <div className="p-4">
                  <span className="text-[9px] font-medium uppercase tracking-widest mb-2 block"
                    style={{ color: 'var(--text-tertiary)' }}>
                    Steps ({currentStepIndex + 1}/{totalSteps})
                  </span>
                  <div className="flex flex-col gap-1">
                    {canvasSteps.map((step, i) => {
                      const cur = i === currentStepIndex;
                      const past = i < currentStepIndex;
                      return (
                        <button key={i} onClick={() => goToStep(i)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all text-[11px] hover:translate-x-0.5 active:scale-[0.98]"
                          style={{
                            background: cur ? 'var(--bg-tertiary)' : 'transparent',
                            color: cur ? 'var(--text-primary)' : past ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                            border: cur ? '1px solid var(--border-color)' : '1px solid transparent',
                            boxShadow: cur ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                            cursor: 'pointer',
                          }}>
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] shrink-0 transition-colors"
                            style={cur ? { background: ds.color || 'var(--text-primary)', color: 'var(--bg-primary)' }
                              : past ? { background: 'rgba(16,185,129,0.15)', color: '#10b981' }
                              : { background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>
                            {past ? <CheckCircle2 size={11} /> : i + 1}
                          </div>
                          <span className="truncate">{step.title || step.label || `Step ${i + 1}`}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="flex gap-2 p-3" style={{ borderTop: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}>
              <button onClick={() => goToStep(0)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-medium uppercase tracking-wider transition-all active:scale-95"
                style={{ border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <RotateCcw size={12} /> Replay
              </button>
              <button onClick={() => play()}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-medium uppercase tracking-wider transition-all active:scale-95"
                style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}>
                <Play size={12} fill="currentColor" /> Resume
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default FloatingSidebar;
