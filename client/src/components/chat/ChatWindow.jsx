import React, { useRef, useEffect } from 'react';
import Message from './Message';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, MessageSquare } from 'lucide-react';

// ── Empty state shown when no messages yet ──
const EmptyState = () => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    className="flex-1 flex flex-col items-center justify-center gap-4 px-4 py-12 text-center"
  >
    <div className="w-12 h-12 rounded-2xl bg-[var(--text-primary)] flex items-center justify-center shadow-lg">
      <Sparkles size={20} className="text-[var(--bg-primary)]" />
    </div>
    <div>
      <p className="text-[13px] font-bold text-[var(--text-primary)] mb-1">
        Ask me anything
      </p>
      <p className="text-[11px] text-[var(--text-tertiary)] leading-relaxed max-w-[180px]">
        I'll explain it visually with interactive diagrams
      </p>
    </div>

    {/* Suggestion chips */}
    <div className="flex flex-col gap-1.5 w-full mt-2">
      {[
        'How does quicksort work?',
        'Explain Newton\'s laws',
        'What is photosynthesis?',
      ].map((suggestion) => (
        <motion.div
          key={suggestion}
          whileHover={{ x: 2 }}
          className="px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/50 text-left text-[11px] text-[var(--text-secondary)] font-medium cursor-default flex items-center gap-2"
        >
          <MessageSquare size={10} className="text-[var(--text-tertiary)] flex-shrink-0" />
          {suggestion}
        </motion.div>
      ))}
    </div>
  </motion.div>
);

// ── Typing indicator ──
const ThinkingIndicator = () => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 4 }}
    transition={{ duration: 0.25 }}
    className="flex items-center gap-2 px-4 pt-1 pb-3"
  >
    <div className="w-5 h-5 rounded-full bg-[var(--text-primary)] flex items-center justify-center flex-shrink-0">
      <Sparkles size={10} className="text-[var(--bg-primary)]" />
    </div>
    <div
      className="flex items-center gap-1.5 px-3 py-2 rounded-2xl rounded-tl-md text-[11px]"
      style={{
        backgroundColor: 'var(--ai-bubble-bg)',
        border: '1px solid var(--border-color)',
      }}
    >
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
          className="w-1.5 h-1.5 rounded-full bg-[var(--text-tertiary)]"
        />
      ))}
    </div>
  </motion.div>
);

const ChatWindow = ({ messages, isGenerating, onOpenCanvas, onDeleteMessage, onEditMessage }) => {
  const bottomRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isGenerating]);

  const isEmpty = messages.length === 0 && !isGenerating;

  return (
    <div ref={containerRef} className="flex-1 flex flex-col min-h-0">
      <AnimatePresence mode="wait">
        {isEmpty ? (
          <EmptyState key="empty" />
        ) : (
          <motion.div
            key="messages"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col py-2"
          >
            {messages.map((msg, index) => (
              <Message
                key={msg.id || index}
                role={msg.role}
                content={msg.content}
                steps={msg.steps}
                stepTitle={msg.stepTitle}
                domain={msg.domain}
                visualizationType={msg.visualizationType}
                onOpenCanvas={onOpenCanvas}
                onDeleteMessage={onDeleteMessage}
                onEditMessage={onEditMessage}
                messageId={msg.id}
                elements={msg.elements}
                motion={msg.motion}
                connections={msg.connections}
                sequence={msg.sequence}
                objects={msg.objects}
                hasCanvas={msg.hasCanvas}
              />
            ))}

            {/* Typing indicator */}
            <AnimatePresence>
              {isGenerating && <ThinkingIndicator key="thinking" />}
            </AnimatePresence>

            <div ref={bottomRef} className="h-2" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChatWindow;
