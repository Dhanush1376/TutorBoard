import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useTutorStore from '../../store/tutorStore';

/**
 * NarrationBar — Word-by-word subtitle rendered inside .teaching-narration-overlay.
 * All colors via CSS variables. No hardcoded white/black/amber.
 */
const NarrationBar = ({ text: propText, isGenerating, onCancel }) => {
  const [words, setWords] = useState([]);
  const [visibleCount, setVisibleCount] = useState(0);
  const { narrationTokens, d3Narration, generationProgress } = useTutorStore();
  const timerRef = useRef(null);

  const text = d3Narration || propText;
  const INTERVAL = 25;

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (isGenerating) {
      const w = (Array.isArray(narrationTokens) ? narrationTokens : (narrationTokens || '').split(' ')).filter(w => w.trim());
      setWords(w);
      setVisibleCount(w.length);
      return;
    }
    if (!text || !text.trim()) { setWords([]); setVisibleCount(0); return; }

    const w = text.split(' ').filter(w => w.trim());
    setWords(w);
    setVisibleCount(0);

    timerRef.current = setInterval(() => {
      setVisibleCount(p => {
        if (p < w.length) return p + 1;
        clearInterval(timerRef.current);
        return p;
      });
    }, INTERVAL);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [text, isGenerating, narrationTokens]);

  const renderWord = (word, i) => {
    const hl = word.startsWith('**') && word.endsWith('**');
    const clean = hl ? word.slice(2, -2) : word;
    return (
      <motion.span key={i}
        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className="inline-block mr-[0.25em]"
        style={{ color: hl ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: hl ? 500 : 300 }}>
        {clean}
      </motion.span>
    );
  };

  return (
    <AnimatePresence>
      {words.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
          className="w-full">
          <div className="relative rounded-[24px] px-6 py-4 text-center overflow-hidden liquid-glass"
            style={{
            }}>
            
            {/* Progress Bar (GitHub Style) */}
            {isGenerating && generationProgress && (
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-[var(--bg-tertiary)] overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(generationProgress.stage / (generationProgress.totalStages || 6)) * 100}%` }}
                  className="h-full bg-[var(--text-primary)]"
                  transition={{ duration: 0.5 }}
                />
              </div>
            )}

            <div className="relative flex flex-col gap-1 items-center">
              {/* Stage Label + Cancel Button */}
              {isGenerating && (
                <div className="w-full flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--text-primary)] animate-pulse" />
                    <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[var(--text-secondary)]">
                      {generationProgress?.label || 'Initializing Agent Pipeline...'}
                    </span>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onCancel?.();
                    }}
                    className="text-[9px] uppercase tracking-widest font-bold text-red-400 hover:text-red-500 transition-colors px-2 py-1 rounded-md hover:bg-red-500/10 active:scale-95"
                  >
                    Cancel
                  </button>
                </div>
              )}

              <div className="text-sm md:text-base leading-relaxed tracking-wide">
                {words.slice(0, visibleCount).map((w, i) => renderWord(w, i))}
                {visibleCount < words.length && (
                  <motion.span
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'steps(2)' }}
                    className="inline-block w-[2px] h-[0.9em] ml-1 align-middle rounded-full"
                    style={{ background: 'var(--text-tertiary)' }}
                  />
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NarrationBar;
