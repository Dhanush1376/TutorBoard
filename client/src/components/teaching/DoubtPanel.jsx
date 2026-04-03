/**
 * DoubtPanel — Real-time doubt interface for the teaching session
 * 
 * Starts collapsed as a single input bar.
 * Expands to show conversation thread on interaction.
 * Shows processing state while AI responds.
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp, Loader2, MessageCircleQuestion, X, CornerDownLeft } from 'lucide-react';

const DoubtPanel = ({ 
  onAskDoubt, 
  isProcessing, 
  doubtResponse,
  doubtHistory = [],
  currentStepTitle,
  disabled = false,
}) => {
  const [input, setInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [doubtHistory, doubtResponse, isProcessing]);

  // Expand when there's a response
  useEffect(() => {
    if (doubtResponse || doubtHistory.length > 0) {
      setIsExpanded(true);
    }
  }, [doubtResponse, doubtHistory.length]);

  const handleSubmit = () => {
    if (!input.trim() || isProcessing || disabled) return;
    const question = input.trim();
    setInput('');
    setIsExpanded(true);
    onAskDoubt(question);
  };

  const handleKeyDown = (e) => {
    e.stopPropagation(); // Prevent teaching session shortcuts
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      setIsExpanded(false);
      inputRef.current?.blur();
    }
  };

  return (
    <motion.div
      layout
      className="w-full max-w-2xl mx-auto"
    >
      {/* Collapsed: Just a button */}
      <AnimatePresence>
        {!isExpanded && doubtHistory.length === 0 && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            onClick={() => {
              setIsExpanded(true);
              setTimeout(() => inputRef.current?.focus(), 100);
            }}
            disabled={disabled}
            className="flex items-center gap-2 mx-auto px-5 py-2.5 bg-[var(--bg-secondary)]/80 backdrop-blur-xl border border-[var(--border-color)] rounded-full text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] hover:border-[var(--text-tertiary)] transition-all disabled:opacity-40"
          >
            <MessageCircleQuestion size={14} />
            Ask a doubt about this step
            <kbd className="ml-2 px-1.5 py-0.5 bg-[var(--bg-tertiary)] rounded text-[9px] font-bold text-[var(--text-tertiary)] border border-[var(--border-color)]">?</kbd>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Expanded: Full chat panel */}
      <AnimatePresence>
        {(isExpanded || doubtHistory.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="bg-[var(--bg-secondary)]/90 backdrop-blur-2xl border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-2">
                <MessageCircleQuestion size={14} className="text-[var(--text-tertiary)]" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">
                  Doubt Chat
                </span>
                {currentStepTitle && (
                  <span className="text-[9px] text-[var(--text-tertiary)] opacity-60 max-w-[200px] truncate">
                    — {currentStepTitle}
                  </span>
                )}
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all"
              >
                <X size={12} />
              </button>
            </div>

            {/* Messages Thread */}
            {doubtHistory.length > 0 && (
              <div
                ref={scrollRef}
                className="max-h-44 overflow-y-auto p-3 space-y-2.5 no-scrollbar"
              >
                {doubtHistory.map((entry, i) => (
                  <div key={i} className="space-y-2">
                    {/* User message */}
                    <div className="flex justify-end">
                      <div className="max-w-[80%] px-3.5 py-2.5 rounded-2xl rounded-tr-md bg-[var(--text-primary)] text-[var(--bg-primary)] text-xs leading-relaxed">
                        {entry.question}
                      </div>
                    </div>
                    {/* AI response */}
                    {entry.answer && (
                      <div className="flex justify-start">
                        <div className="max-w-[80%] px-3.5 py-2.5 rounded-2xl rounded-tl-md bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-xs leading-relaxed">
                          {entry.answer}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Processing indicator */}
                {isProcessing && (
                  <div className="flex justify-start">
                    <div className="px-4 py-3 rounded-2xl rounded-tl-md bg-[var(--bg-tertiary)]">
                      <div className="flex items-center gap-2">
                        <Loader2 size={12} className="animate-spin text-[var(--text-tertiary)]" />
                        <span className="text-[10px] text-[var(--text-tertiary)] font-medium">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Input */}
            <div className="flex items-center gap-2 p-2.5 border-t border-[var(--border-color)]">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsExpanded(true)}
                placeholder="Type your doubt about this step..."
                disabled={disabled}
                className="flex-1 bg-transparent text-[var(--text-primary)] placeholder-[var(--text-tertiary)] text-xs outline-none px-3 py-2 disabled:opacity-40"
              />
              <button
                onClick={handleSubmit}
                disabled={!input.trim() || isProcessing || disabled}
                className="p-2 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-xl disabled:opacity-20 hover:opacity-90 transition-all active:scale-90 flex-shrink-0"
                title="Send (Enter)"
              >
                <ArrowUp size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default DoubtPanel;
