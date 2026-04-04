import React, { useState } from 'react';
import { Bot, User, Presentation, Copy, Edit2, Trash2, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import VisaiLogo from '../common/VisaiLogo';

const Message = ({ role, content, steps, stepTitle, domain, visualizationType, onOpenCanvas, onDeleteMessage, onEditMessage, messageId, elements, motion: motionData, connections, sequence, objects }) => {
  const isAssistant = role === 'assistant';
  const hasCanvas = isAssistant && ((steps && steps.length > 0) || (objects && objects.length > 0));
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`w-full py-3 flex flex-col group/msg ${isAssistant ? 'items-start' : 'items-end'}`}
    >
      <div 
        className={`relative max-w-[85%] px-4 py-2.5 rounded-2xl text-sm shadow-xl backdrop-blur-md border border-[var(--border-color)] transition-all duration-250 ${
          isAssistant ? 'rounded-tl-none' : 'rounded-tr-none'
        }`}
        style={{
          backgroundColor: isAssistant ? 'var(--ai-bubble-bg)' : 'var(--user-bubble-bg)',
          color: isAssistant ? 'var(--text-primary)' : 'var(--bg-primary)'
        }}
      >
        {/* Message Header */}
        <div className="flex items-center justify-between gap-4 mb-2 opacity-50">
          <div className="flex items-center gap-2">
            {isAssistant ? <VisaiLogo size="xs" className="w-3 h-3 text-[var(--text-primary)]" /> : <User size={12} />}
            <span className="text-[9px] font-bold uppercase tracking-widest">
              {isAssistant ? 'TutorBoard' : 'You'}
            </span>
          </div>
          
          {/* Action Bar — visible on hover */}
          <div className="flex items-center gap-2.5 opacity-0 group-hover/msg:opacity-100 transition-all duration-200">
            <button 
              onClick={handleCopy} 
              className="hover:text-[var(--text-primary)] transition-colors p-0.5" 
              title="Copy message"
            >
              {copied ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
            </button>
            {!isAssistant && onEditMessage && (
               <button 
                 onClick={() => onEditMessage(messageId, content)} 
                 className="hover:text-[var(--text-primary)] transition-colors p-0.5" 
                 title="Edit message"
               >
                 <Edit2 size={11} />
               </button>
            )}
            {onDeleteMessage && (
               <button 
                 onClick={() => onDeleteMessage(messageId)} 
                 className="hover:text-red-500 transition-colors p-0.5" 
                 title="Delete message"
               >
                 <Trash2 size={11} />
               </button>
            )}
          </div>
        </div>

        <div className="whitespace-pre-wrap leading-relaxed">
          {content}
        </div>

        {/* Open Canvas Button — premium glassmorphism treatment */}
        {hasCanvas && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.3 }}
            onClick={() => onOpenCanvas && onOpenCanvas(steps, stepTitle, domain, visualizationType, { elements, motion: motionData, connections, sequence, objects }, messageId)}
            className="mt-3 flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all
              bg-[var(--text-primary)]/10 dark:bg-white/10 backdrop-blur-md border border-[var(--text-primary)]/20 dark:border-white/20 text-[var(--text-primary)]
              hover:bg-[var(--text-primary)]/20 dark:hover:bg-white/20 hover:border-[var(--text-primary)]/30 dark:hover:border-white/40 hover:shadow-[0_0_20px_-5px_rgba(0,0,0,0.1)]
              active:scale-95 group"
          >
            <Presentation size={14} className="opacity-70 group-hover:opacity-100 transition-opacity" />
            <span>Open Visual Canvas</span>
          </motion.button>
        )}
      </div>
    </motion.div>
  );
};

export default Message;
