/**
 * DoubtTimeline — Vertical hover indicator on right edge
 * 
 * Shows a minimal "⋮⋮⋮⋮" indicator that expands on hover
 * to show doubt timeline dots. Click to jump to canvas state.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useTutorStore from '../../store/tutorStore';

const DoubtTimeline = () => {
  const {
    doubtHistory, activeDoubtId,
    jumpToDoubt, openDoubtThread,
  } = useTutorStore();

  const [isHovered, setIsHovered] = useState(false);

  if (doubtHistory.length === 0) return null;

  return (
    <div
      className="fixed right-0 top-1/2 -translate-y-1/2 z-[10000] flex items-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <AnimatePresence mode="wait">
        {!isHovered ? (
          /* Collapsed: Dots indicator */
          <motion.div
            key="collapsed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-1 px-1.5 py-3 cursor-pointer"
            onClick={openDoubtThread}
          >
            {doubtHistory.map((_, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  doubtHistory[i]?.id === activeDoubtId
                    ? 'bg-[var(--text-primary)]'
                    : 'bg-[var(--text-tertiary)] opacity-40'
                }`}
              />
            ))}
          </motion.div>
        ) : (
          /* Expanded: Mini timeline */
          <motion.div
            key="expanded"
            initial={{ opacity: 0, x: 10, width: 0 }}
            animate={{ opacity: 1, x: 0, width: 'auto' }}
            exit={{ opacity: 0, x: 10, width: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-stretch mr-2 overflow-hidden glass"
            style={{
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderRadius: '14px',
              border: '1px solid var(--glass-border)',
              boxShadow: 'var(--glass-shadow)',
            }}
          >
            <div className="px-3 py-2 border-b border-white/5">
              <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
                Doubts
              </span>
            </div>
            <div className="py-1.5 max-h-[300px] overflow-y-auto no-scrollbar">
              {doubtHistory.map((doubt, i) => {
                const isActive = doubt.id === activeDoubtId;
                return (
                  <button
                    key={doubt.id}
                    onClick={() => jumpToDoubt(doubt.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-all hover:bg-white/5 ${
                      isActive ? 'bg-white/[0.06]' : ''
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      isActive ? 'bg-[var(--text-primary)]' : 'bg-[var(--text-tertiary)] opacity-40'
                    }`} />
                    <span className="text-[10px] text-[var(--text-secondary)] truncate max-w-[140px]">
                      {doubt.question}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={openDoubtThread}
              className="px-3 py-2 border-t border-white/5 text-[9px] font-bold text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all text-center uppercase tracking-wider"
            >
              Open Full Thread →
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DoubtTimeline;
