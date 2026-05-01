import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useTutorStore from '../../store/tutorStore';

/**
 * Cinematic Narration Bar
 * Streams narration text word-by-word with a cursor blink.
 * Creates the "Manim quality" feel without GSAP.
 */
const NarrationBar = ({ text: propText, isGenerating }) => {
  const [words, setWords] = useState([]);
  const [visibleCount, setVisibleCount] = useState(0);
  const { narrationTokens, d3Narration } = useTutorStore();
  const timerRef = useRef(null);

  // If d3Narration exists (from D3Executor), we prioritize it over propText
  const text = d3Narration || propText;

  // 40 words per second is ~25ms per word
  const WORD_INTERVAL = 25;

  useEffect(() => {
    if (isGenerating) {
      // In generation mode, we use the streaming tokens from the store
      // Filter out empty tokens to prevent empty bar from showing
      const allWords = (Array.isArray(narrationTokens) ? narrationTokens : (narrationTokens || '').split(' '))
        .filter(w => w.trim().length > 0);
      
      setWords(allWords);
      setVisibleCount(allWords.length);
      return;
    }

    if (!text || text.trim().length === 0) {
      setWords([]);
      setVisibleCount(0);
      return;
    }

    // Split text into words and filter out empty ones
    const allWords = text.split(' ').filter(w => w.trim().length > 0);
    setWords(allWords);
    setVisibleCount(0);

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setVisibleCount(prev => {
        if (prev < allWords.length) {
          return prev + 1;
        }
        clearInterval(timerRef.current);
        return prev;
      });
    }, WORD_INTERVAL);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [text, isGenerating, narrationTokens]);

  const renderWord = (word, index) => {
    // Basic highlight logic: **word** or important-looking terms
    const isHighlighted = word.startsWith('**') && word.endsWith('**');
    const cleanWord = isHighlighted ? word.slice(2, -2) : word;
    
    return (
      <motion.span
        key={index}
        initial={{ opacity: 0, y: 5, filter: 'blur(4px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={`inline-block mr-[0.25em] ${
          isHighlighted 
            ? 'text-amber-400 font-normal drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]' 
            : 'text-white/90'
        }`}
      >
        {cleanWord}
      </motion.span>
    );
  };

  return (
    <AnimatePresence>
      {words.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          className="absolute top-[100px] md:top-[120px] left-1/2 -translate-x-1/2 z-[90] w-full max-w-3xl px-4 pointer-events-none"
        >
          <div className="relative bg-black/50 backdrop-blur-2xl border border-white/10 rounded-2xl px-6 py-4 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)] overflow-hidden text-center">
            {/* Subtle glow edge */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-500/10 to-transparent pointer-events-none" />
            
            <div className="relative inline-block">
              <div className="text-base md:text-lg font-light leading-relaxed tracking-wide text-white/95">
                {words.slice(0, visibleCount).map((word, i) => renderWord(word, i))}
                
                {visibleCount < words.length && (
                  <motion.span
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: "steps(2)" }}
                    className="inline-block w-[3px] h-[1em] bg-amber-400 ml-1 align-middle shadow-[0_0_8px_rgba(251,191,36,0.6)]"
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
