/**
 * DoubtThread — Right-side floating thread panel for doubt history
 * 
 * Each doubt is a timeline node. Click to jump back to that canvas state.
 * Visual timeline with connector lines and timestamps.
 */

import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageCircleQuestion, ArrowUpRight, Eye, FlaskConical, Binary, Sigma, Zap, Leaf, Stethoscope, Briefcase, Scale, History, Settings, Brain, TrendingUp, Palette, Plane, BookOpen, ChevronLeft } from 'lucide-react';
import useTutorStore from '../../store/tutorStore';
import { DOMAIN_STYLES } from '../../lib/teaching';

const DoubtThread = () => {
  const {
    showDoubtThread, closeDoubtThread,
    doubtHistory, activeDoubtId,
    jumpToDoubt, setActiveDoubt,
    pinDoubtToCanvas,
    timeline,
  } = useTutorStore();

  const domain = timeline?.domain?.toLowerCase();
  const domainStyle = DOMAIN_STYLES[domain] || DOMAIN_STYLES.general;

  const [expandedIds, setExpandedIds] = React.useState(new Set());
  const scrollRef = useRef(null);

  const toggleExpand = (id) => {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedIds(next);
  };

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
        <>
          {/* Thread backdrop (dismissible) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeDoubtThread}
            className="fixed inset-0 z-[75] pointer-events-auto"
            style={{ background: 'rgba(0,0,0,0.1)', backdropFilter: 'blur(2px)' }}
          />

          <motion.div
            initial={{ x: 360, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 360, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-0 right-0 z-[80] h-full w-[85vw] sm:w-[340px] flex flex-col glass backdrop-blur-3xl"
          style={{
            background: 'var(--glass-bg)',
            borderLeft: '1px solid var(--glass-border)',
            boxShadow: 'var(--glass-shadow)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
            <div className="flex items-center gap-2">
              <MessageCircleQuestion size={16} className="text-[var(--text-tertiary)]" />
              <span className="text-[11px] font-normal uppercase tracking-[0.15em] text-[var(--text-tertiary)]">
                Doubt Thread
              </span>
              <span className="px-1.5 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[9px] font-normal text-[var(--text-tertiary)]">
                {doubtHistory.length}
              </span>
            </div>



            <button
              onClick={closeDoubtThread}
              className="p-1.5 rounded-lg transition-all"
              style={{ color: 'var(--text-tertiary)' }}
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
                        {/* Timeline dot with Pulsing Effect */}
                        <div className={`absolute left-0 top-3 w-6 h-6 rounded-lg flex items-center justify-center transition-all shadow-lg ${isActive
                            ? 'scale-110'
                            : 'bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-tertiary)] opacity-40'
                          }`}
                          style={isActive ? { backgroundColor: domainStyle.color, color: 'var(--bg-primary)', boxShadow: `0 0 15px ${domainStyle.color}40` } : {}}>
                          <span className="text-[10px] font-bold">{i + 1}</span>
                        </div>

                        {/* Doubt card */}
                        <div className={`rounded-2xl border transition-all cursor-pointer ${isActive
                            ? 'bg-[var(--bg-secondary)] border-[var(--border-strong)] shadow-lg'
                            : 'bg-[var(--bg-tertiary)]/30 border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]/50'
                          }`}
                          onClick={() => toggleExpand(doubt.id)}>
                          {/* Question Bubble */}
                          <div className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-md bg-[var(--text-primary)]/10 flex items-center justify-center">
                                  <MessageCircleQuestion size={10} className="text-[var(--text-primary)]" />
                                </div>
                                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-[var(--text-tertiary)] opacity-60">
                                  User Inquiry
                                </span>
                              </div>
                              <span className="text-[8px] font-medium text-[var(--text-tertiary)] opacity-40 tabular-nums">
                                {formatTime(doubt.timestamp)}
                              </span>
                            </div>
                            <p className="text-[12px] font-medium text-[var(--text-primary)] leading-relaxed">
                              {doubt.question}
                            </p>
                          </div>

                          {/* Answer (Collapsible) */}
                          <AnimatePresence>
                            {expandedIds.has(doubt.id) && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                {doubt.answer && (
                                  <div className="px-4 pb-4">
                                    <div className="relative p-4 rounded-2xl bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-tertiary)] border border-[var(--border-color)] shadow-inner overflow-hidden">
                                      {/* AI Glow Effect */}
                                      <div className="absolute -top-10 -right-10 w-24 h-24 bg-[var(--text-primary)]/5 blur-3xl rounded-full pointer-events-none" />
                                      
                                      <div className="flex items-center gap-2 mb-3">
                                        <div className="w-5 h-5 rounded-md bg-[var(--text-primary)] flex items-center justify-center">
                                          <Brain size={10} className="text-[var(--bg-primary)]" />
                                        </div>
                                        <span className="text-[8px] font-black uppercase tracking-[0.2em] text-[var(--text-primary)]">
                                          Tutor Analysis
                                        </span>
                                      </div>

                                      <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed relative z-10">
                                        {doubt.answer}
                                      </p>
                                      
                                      {doubt.followUp && (
                                        <div className="mt-4 p-3 rounded-xl bg-[var(--text-primary)]/5 border border-[var(--text-primary)]/10 text-[10px] text-[var(--text-secondary)] relative z-10 overflow-hidden">
                                          <div className="absolute top-0 left-0 w-1 h-full bg-[var(--text-primary)] opacity-20" />
                                          <span className="block font-black text-[7px] uppercase tracking-widest opacity-40 mb-1">Deep Dive Integration:</span>
                                          <span className="italic">"{doubt.followUp}"</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Actions */}
                                <div className="flex items-center gap-1.5 px-3 pb-2.5" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => jumpToDoubt(doubt.id)}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-normal transition-all"
                                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                                  >
                                    <Eye size={10} />
                                    View State
                                  </button>
                                  {doubt.answer && (
                                    <button
                                      onClick={() => pinDoubtToCanvas(doubt.id)}
                                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-normal transition-all"
                                      style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b' }}
                                    >
                                      <Zap size={10} />
                                      Pin to Canvas
                                    </button>
                                  )}
                                  {doubt.hasVisuals && (
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-normal text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                                      Visuals
                                    </span>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
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
                <p className="text-[11px] font-normal uppercase tracking-widest text-[var(--text-tertiary)] mb-2">No Doubts Yet</p>
                <p className="text-[10px] text-[var(--text-tertiary)] leading-relaxed">
                  Your questions and AI responses will appear here in a beautiful timeline.
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </>
    )}

    </AnimatePresence>
  );
};

export default DoubtThread;
