import React, { useRef, useEffect } from 'react';
import Message from './Message';
import { motion } from 'framer-motion';

const ChatWindow = ({ messages, isGenerating, onOpenCanvas }) => {
  const bottomRef = useRef(null);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, isGenerating]);

  return (
    <div className="flex-1 flex flex-col no-scrollbar pointer-events-auto">
      <div className="flex flex-col gap-1 w-full pb-6 pt-10">
        {messages.map((msg, index) => (
          <Message 
            key={msg.id || index}
            role={msg.role}
            content={msg.content}
            steps={msg.steps}
            stepTitle={msg.stepTitle}
            onOpenCanvas={onOpenCanvas}
          />
        ))}
        
        {isGenerating && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-1.5 px-4 py-2 mt-2"
          >
            <div className="flex gap-1 items-center">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                  className="w-1.5 h-1.5 rounded-full bg-[var(--text-tertiary)]"
                />
              ))}
            </div>
            <span className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider ml-1">
              Thinking...
            </span>
          </motion.div>
        )}

        <div ref={bottomRef} className="h-4" />
      </div>
    </div>
  );
};

export default ChatWindow;
