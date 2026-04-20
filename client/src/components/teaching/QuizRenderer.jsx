import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

/**
 * QuizRenderer
 *
 * Handles interactive Knowledge Check quizzes.
 * This component was moved from Board.jsx and is intended
 * to be rendered by the teaching engine sessions.
 */
const QuizRenderer = ({ stepData }) => {
  const { question, options, correctAnswer, explanation } = stepData?.quizData || {};
  const [selectedOption, setSelectedOption] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);

  useEffect(() => {
    setSelectedOption(null);
    setShowFeedback(false);
  }, [question]);

  if (!question) return null;

  const handleOptionClick = (option) => {
    if (showFeedback) return;
    setSelectedOption(option);
    setShowFeedback(true);
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center p-6 pointer-events-none">
      <motion.div
        drag
        dragMomentum={false}
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[2.5rem] p-10 max-w-xl w-[500px] shadow-2xl pointer-events-auto cursor-grab active:cursor-grabbing"
      >
        <div className="flex justify-center mb-6 drag-handle">
           <span className="px-4 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-full text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)] flex items-center gap-2">
             <span className="w-2 h-2 rounded-full bg-[var(--text-tertiary)] animate-pulse" />
             Knowledge Check
           </span>
        </div>
        <h3 className="text-2xl font-serif text-[var(--text-primary)] mb-8 text-center leading-snug">
          {question}
        </h3>
        <div className="grid grid-cols-1 gap-3">
          {options?.map((option, i) => {
            const isSelected = selectedOption === option;
            const isCorrect = option === correctAnswer;
            const isIncorrect = isSelected && !isCorrect;
            return (
              <motion.button
                key={i}
                whileTap={!showFeedback ? { scale: 0.98 } : {}}
                onClick={() => handleOptionClick(option)}
                disabled={showFeedback}
                className={`
                  group w-full p-5 rounded-2xl border text-left transition-all duration-300 flex items-center justify-between
                  ${!showFeedback ? 'hover:bg-[var(--bg-tertiary)] border-[var(--border-color)] bg-[var(--bg-primary)]/40 cursor-pointer' : 'cursor-default'}
                  ${showFeedback && isCorrect ? 'border-green-500/50 bg-green-500/10' : ''}
                  ${showFeedback && isIncorrect ? 'border-red-500/50 bg-red-500/10' : ''}
                `}
              >
                <div className="flex items-center gap-4">
                   <div className={`w-9 h-9 flex items-center justify-center rounded-xl text-[12px] font-bold ${showFeedback && isCorrect ? 'bg-green-500 text-white' : (showFeedback && isIncorrect ? 'bg-red-500 text-white' : 'bg-[var(--bg-tertiary)]')}`}>
                     {String.fromCharCode(65 + i)}
                   </div>
                   <span className="text-[15px] font-medium">{option}</span>
                </div>
              </motion.button>
            );
          })}
        </div>
        {showFeedback && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-6 p-5 bg-[var(--bg-tertiary)]/50 rounded-2xl border border-[var(--border-color)]">
            <p className="text-[14px] text-[var(--text-secondary)] italic opacity-90">{explanation}</p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default QuizRenderer;
