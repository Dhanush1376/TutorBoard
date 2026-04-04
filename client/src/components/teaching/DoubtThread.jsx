/**
 * DoubtThread — Right-side floating thread panel for doubt history
 * 
 * Each doubt is a timeline node. Click to jump back to that canvas state.
 * Visual timeline with connector lines and timestamps.
 */

import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageCircleQuestion, ArrowUpRight, Eye } from 'lucide-react';
import useTutorStore from '../../store/tutorStore';

const DoubtThread = () => {
  const {
    showDoubtThread, closeDoubtThread,
    doubtHistory, activeDoubtId,
    jumpToDoubt, setActiveDoubt,
  } = useTutorStore();

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
      {showDoubtThread && doubtHistory.length > 0 && (
        <motion.div
          initial={{ x: 360, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 360, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="fixed top-0 right-0 z-[10002] h-full w-[340px] flex flex-col"
          style={{
            background: 'rgba(var(--bg-secondary-rgb, 22, 22, 20), 0.8)',
            backdropFilter: 'blur(24px) saturate(1.6)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
            borderLeft: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/5">
            <div className="flex items-center gap-2">
              <MessageCircleQuestion size={16} className="text-[var(--text-tertiary)]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--text-tertiary)]">
                Doubt Thread
              </span>
              <span className="px-1.5 py-0.5 rounded-full bg-white/5 text-[9px] font-bold text-[var(--text-tertiary)]">
                {doubtHistory.length}
              </span>
            </div>
            <button
              onClick={closeDoubtThread}
              className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-all"
            >
              <X size={14} />
            </button>
          </div>

          {/* Thread timeline */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar p-4">
            <div className="relative">
              {/* Vertical connector line */}
              <div className="absolute left-[11px] top-4 bottom-4 w-px bg-gradient-to-b from-white/10 via-white/5 to-transparent" />

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
                          ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-primary)]'
                          : 'border-white/15 bg-[var(--bg-primary)]/50 text-[var(--text-tertiary)]'
                      }`}>
                        <span className="text-[8px] font-bold">{i + 1}</span>
                      </div>

                      {/* Doubt card */}
                      <div className={`rounded-2xl border transition-all ${
                        isActive
                          ? 'bg-white/[0.06] border-white/10 shadow-lg'
                          : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'
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
                          {doubt.hasVisuals && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold text-emerald-400">
                              Visual
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DoubtThread;
