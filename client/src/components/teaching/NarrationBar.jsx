import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useTutorStore from '../../store/tutorStore';

/**
 * Cinematic Narration Bar
 * Streams narration text word-by-word with a cursor blink.
 * Creates the "Manim quality" feel without GSAP.
 */
const NarrationBar = ({ text, isGenerating }) => {
  const [words, setWords] = useState([]);
  const [visibleCount, setVisibleCount] = useState(0);
  const { narrationTokens } = useTutorStore();
  const timerRef = useRef(null);

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
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="fixed bottom-[180px] left-1/2 -translate-x-1/2 z-[200] w-full max-w-4xl px-8 pointer-events-none"
        >
          <div className="relative bg-black/60 backdrop-blur-3xl border border-white/10 rounded-[32px] p-10 shadow-[0_40px_80px_-16px_rgba(0,0,0,0.7)] overflow-hidden">
            {/* Glossy overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />
            
            <div className="relative text-center">
              <div className="text-xl md:text-3xl font-normal leading-relaxed tracking-tight">
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
