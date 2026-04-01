import React from 'react';
import { Bot, User, Presentation } from 'lucide-react';
import { motion } from 'framer-motion';
import VisaiLogo from '../common/VisaiLogo';

const Message = ({ role, content, steps, stepTitle, domain, visualizationType, onOpenCanvas }) => {
  const isAssistant = role === 'assistant';
  const hasCanvas = isAssistant && steps && steps.length > 0;

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
          {isAssistant ? <VisaiLogo size="xs" className="w-3 h-3 text-[var(--text-primary)]" /> : <User size={12} />}
          <span className="text-[9px] font-bold uppercase tracking-widest">
            {isAssistant ? 'TutorBoard' : 'You'}
          </span>
        </div>
        <div className="whitespace-pre-wrap leading-relaxed">
          {content}
        </div>

        {/* Open Canvas Button — only on assistant messages with steps */}
        {hasCanvas && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.3 }}
            onClick={() => onOpenCanvas && onOpenCanvas(steps, stepTitle, domain, visualizationType)}
            className="mt-3 flex items-center gap-2 px-3.5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all
              bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)]
              hover:bg-[var(--bg-tertiary)] hover:border-[var(--text-tertiary)] hover:shadow-lg
              active:scale-95"
          >
            <Presentation size={14} className="opacity-70" />
            Open Canvas
          </motion.button>
        )}
      </div>
    </motion.div>
  );
};

export default Message;
