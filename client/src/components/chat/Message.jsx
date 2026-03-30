import React from 'react';
import { Bot, User } from 'lucide-react';
import { motion } from 'framer-motion';

const Message = ({ role, content }) => {
  const isAssistant = role === 'assistant';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`w-full py-3 flex flex-col ${isAssistant ? 'items-start' : 'items-end'}`}
    >
      <div 
        className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm shadow-xl backdrop-blur-md border border-[var(--border-color)] transition-colors duration-250 ${
          isAssistant ? 'rounded-tl-none' : 'rounded-tr-none'
        }`}
        style={{
          backgroundColor: isAssistant ? 'var(--ai-bubble-bg)' : 'var(--user-bubble-bg)',
          color: isAssistant ? 'var(--text-primary)' : 'var(--bg-primary)'
        }}
      >
        <div className="flex items-center gap-2 mb-1 opacity-40">
          {isAssistant ? <Bot size={12} /> : <User size={12} />}
          <span className="text-[9px] font-bold uppercase tracking-widest">
            {isAssistant ? 'TutorBoard' : 'You'}
          </span>
        </div>
        <div className="whitespace-pre-wrap leading-relaxed">
          {content}
        </div>
      </div>
    </motion.div>
  );
};

export default Message;
