/**
 * DoubtThread — Right-side floating thread panel for doubt history
 * 
 * Each doubt is a timeline node. Click to jump back to that canvas state.
 * Visual timeline with connector lines and timestamps.
 */

import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageCircleQuestion, ArrowUpRight, Eye, FlaskConical, Binary, Sigma, Zap, Leaf, Stethoscope, Briefcase, Scale, History, Settings, Brain, TrendingUp, Palette, Plane, BookOpen } from 'lucide-react';
import useTutorStore from '../../store/tutorStore';
import TeachingGuide from './TeachingGuide';

const DOMAIN_STYLES = {
  'DSA': { color: '#10b981' },
  'Mathematics': { color: '#6366f1' },
  'Physics': { color: '#3b82f6' },
  'Chemistry': { color: '#ef4444' },
  'Biology': { color: '#22c55e' },
  'Medicine': { color: '#ec4899' },
  'Business': { color: '#14b8a6' },
  'Law': { color: '#f59e0b' },
  'History': { color: '#d97706' },
  'Engineering': { color: '#f97316' },
  'Psychology': { color: '#a855f7' },
  'Economics': { color: '#4ade80' },
  'Arts': { color: '#f43f5e' },
  'Aviation': { color: '#38bdf8' },
};

const DoubtThread = () => {
  const {
    showDoubtThread, closeDoubtThread,
    doubtHistory, activeDoubtId,
    jumpToDoubt, setActiveDoubt,
    pinDoubtToCanvas,
    timeline,
  } = useTutorStore();

  const domainStyle = DOMAIN_STYLES[timeline?.domain] || { color: '#94a3b8' };

  const [showGuide, setShowGuide] = React.useState(false);
  const scrollRef = useRef(null);

  // Auto-scroll to latest doubt
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [doubtHistory.length]);

  const formatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <AnimatePresence>
      {showDoubtThread && (
        <motion.div
          initial={{ x: 360, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 360, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="fixed top-0 right-0 z-[10002] h-full w-[340px] flex flex-col glass"
          style={{
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(24px) saturate(1.6)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
            borderLeft: '1px solid var(--glass-border)',
            boxShadow: 'var(--glass-shadow)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
            <div className="flex items-center gap-2">
              <MessageCircleQuestion size={16} className="text-[var(--text-tertiary)]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--text-tertiary)]">
                Doubt Thread
              </span>
              <span className="px-1.5 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[9px] font-bold text-[var(--text-tertiary)]">
                {doubtHistory.length}
              </span>
            </div>

            <button 
              onClick={() => setShowGuide(true)}
              className="px-2 py-1 rounded-md bg-blue-500/10 border border-blue-500/20 text-[8px] font-bold text-blue-400 uppercase tracking-widest hover:bg-blue-500/20 transition-all ml-4 mr-auto flex items-center gap-1.5"
            >
              <BookOpen size={10} />
              Guide
            </button>

            <button
              onClick={closeDoubtThread}
              className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-all"
            >
              <X size={14} />
            </button>
          </div>

          {/* Thread timeline */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar p-4">
            {doubtHistory.length > 0 ? (
              <div className="relative">
                {/* Vertical connector line */}
                <div className="absolute left-[11px] top-4 bottom-4 w-px" style={{ background: `linear-gradient(to bottom, ${domainStyle.color}40, ${domainStyle.color}10, transparent)` }} />

                <div className="space-y-4">
                  {doubtHistory.map((doubt, i) => {
                    const isActive = doubt.id === activeDoubtId;
                    return (
                      <motion.div
                        key={doubt.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05, duration: 0.4 }}
                        className="relative pl-8"
                      >
                        {/* Timeline dot */}
                        <div className={`absolute left-0 top-2 w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center transition-all ${
                          isActive
                            ? 'text-[var(--bg-primary)]'
                            : 'border-white/15 bg-[var(--bg-primary)]/50 text-[var(--text-tertiary)]'
                        }`}
                        style={isActive ? { borderColor: domainStyle.color, backgroundColor: domainStyle.color } : {}}>
                          <span className="text-[8px] font-bold">{i + 1}</span>
                        </div>

                        {/* Doubt card */}
                        <div className={`rounded-2xl border transition-all ${
                          isActive
                            ? 'bg-[var(--bg-secondary)] border-[var(--border-strong)] shadow-lg'
                            : 'bg-[var(--bg-tertiary)]/30 border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]/50'
                        }`}>
                          {/* Question */}
                          <div className="p-3 pb-2">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
                                Question
                              </span>
                              <span className="text-[9px] text-[var(--text-tertiary)] opacity-60">
                                {formatTime(doubt.timestamp)}
                              </span>
                            </div>
                            <p className="text-[12px] font-medium text-[var(--text-primary)] leading-relaxed">
                              {doubt.question}
                            </p>
                          </div>

                          {/* Answer */}
                          {doubt.answer && (
                            <div className="px-3 pb-2">
                              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                                {doubt.answer}
                              </p>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex items-center gap-1.5 px-3 pb-2.5">
                            <button
                              onClick={() => jumpToDoubt(doubt.id)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-[10px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/10 transition-all"
                            >
                              <Eye size={10} />
                              View State
                            </button>
                            {doubt.answer && (
                              <button
                                onClick={() => pinDoubtToCanvas(doubt.id)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] font-medium text-amber-400 hover:bg-amber-500/20 transition-all"
                              >
                                <Zap size={10} />
                                Pin to Canvas
                              </button>
                            )}
                            {doubt.hasVisuals && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                                Visuals
                              </span>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center opacity-40 text-center px-6">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4">
                  <MessageCircleQuestion size={20} className="text-[var(--text-tertiary)]" />
                </div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-tertiary)] mb-2">No Doubts Yet</p>
                <p className="text-[10px] text-[var(--text-tertiary)] leading-relaxed">
                  Your questions and AI responses will appear here in a beautiful timeline.
                </p>
              </div>
            )}
          </div>
        </motion.div>
      )}
      {/* Advanced Teaching Guide Overlay */}
      <TeachingGuide isOpen={showGuide} onClose={() => setShowGuide(false)} />
    </AnimatePresence>
  );
};

export default DoubtThread;
