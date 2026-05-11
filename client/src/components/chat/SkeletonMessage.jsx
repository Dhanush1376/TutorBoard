import React from 'react';
import { motion } from 'framer-motion';

/**
 * SkeletonMessage
 * Premium loading state for chat messages to prevent layout shift.
 */
const SkeletonMessage = ({ role = 'assistant' }) => {
  const isUser = role === 'user';

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`flex flex-col w-full py-6 px-4 gap-4 ${isUser ? 'items-end' : 'items-start'}`}
    >
      {/* Role Indicator - Minimalist Dot */}
      <div className="flex items-center gap-3">
        <div className={`w-1.5 h-1.5 rounded-full skeleton-pulse bg-[var(--text-primary)]/10`} />
        <div className="w-16 h-2 rounded-full skeleton opacity-5" />
      </div>

      {/* Content Lines - Fluid & Elegant */}
      <div className={`flex flex-col gap-3.5 w-full max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className="w-full h-1.5 rounded-full skeleton opacity-[0.15]" />
        <div className={`h-1.5 rounded-full skeleton opacity-10 ${isUser ? 'w-[85%]' : 'w-[92%]'}`} />
        <div className={`h-1.5 rounded-full skeleton opacity-5 ${isUser ? 'w-[60%]' : 'w-[75%]'}`} />
      </div>

      {/* Footer - Subtle Pulse */}
      <div className={`flex gap-3 mt-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className="w-6 h-1.5 rounded-full skeleton opacity-[0.03]" />
        <div className="w-10 h-1.5 rounded-full skeleton opacity-[0.02]" />
      </div>
    </motion.div>
  );
};

export default SkeletonMessage;
