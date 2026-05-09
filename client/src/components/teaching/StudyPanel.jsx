import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Trash2, BookMarked, X, Info, ChevronLeft, ChevronRight, Pin, Hash } from 'lucide-react';
import useTutorStore from '../../store/tutorStore';

const StudyPanel = ({ onClose }) => {
  const { takeaways, removeTakeaway, clearTakeaways } = useTutorStore();
  const [isMinimized, setIsMinimized] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -50, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -50, scale: 0.95 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="flex flex-col pointer-events-auto"
      style={{ 
        width: isMinimized ? '48px' : '300px', 
        height: isMinimized ? '48px' : 'auto',
        maxHeight: 'calc(100vh - 200px)',
        transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)' 
      }}
    >
      <div 
        className="liquid-glass flex flex-col h-full overflow-hidden" 
        style={{ 
          borderRadius: 24, 
          boxShadow: '0 24px 60px -12px rgba(0,0,0,0.3)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'rgba(var(--bg-primary-rgb), 0.8)'
        }}
      >
        {/* Header */}
        <div 
          className={`p-3 flex items-center justify-between cursor-pointer select-none transition-colors ${isMinimized ? 'h-full' : 'border-b border-white/5'}`} 
          style={{ background: 'rgba(255,255,255,0.02)' }}
          onClick={() => setIsMinimized(!isMinimized)}
        >
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${isMinimized ? 'bg-amber-500 text-white' : 'bg-amber-500/10 text-amber-500'}`}>
              <Pin size={14} className={isMinimized ? 'animate-bounce' : ''} />
            </div>
            {!isMinimized && (
              <div className="flex flex-col">
                <h3 className="text-[11px] font-bold tracking-[0.1em] uppercase text-[var(--text-primary)]">Key Insights</h3>
                <span className="text-[9px] font-medium text-amber-500/80">{takeaways.length} Moments Pinned</span>
              </div>
            )}
          </div>
          
          {!isMinimized && (
            <div className="flex items-center gap-1">
              <button 
                onClick={(e) => { e.stopPropagation(); setIsMinimized(true); }}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors text-[var(--text-tertiary)]"
              >
                <ChevronLeft size={14} />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/10 hover:text-red-400 transition-colors text-[var(--text-tertiary)]"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <AnimatePresence>
          {!isMinimized && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col flex-1 min-h-0"
            >
              <div className="overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {takeaways.length === 0 ? (
                  <div className="py-10 flex flex-col items-center text-center px-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/[0.03] flex items-center justify-center text-[var(--text-tertiary)] mb-4 border border-white/[0.05]">
                      <BookMarked size={20} />
                    </div>
                    <p className="text-[12px] text-[var(--text-secondary)] font-medium">Your study log is empty.</p>
                    <p className="text-[10px] text-[var(--text-tertiary)] mt-2 leading-relaxed opacity-60">
                      As you learn, pin important insights from the tutor to review them here later.
                    </p>
                  </div>
                ) : (
                  takeaways.map((item, i) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="group relative p-4 rounded-2xl bg-white/[0.03] border border-white/[0.05] hover:border-amber-500/30 hover:bg-white/[0.05] transition-all"
                    >
                      <div className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full bg-amber-500 opacity-40 group-hover:opacity-100 transition-opacity" />
                      
                      <div className="flex items-start gap-3">
                        <div className="mt-1 text-amber-500/40">
                          <Hash size={10} />
                        </div>
                        <p className="text-[12px] text-[var(--text-secondary)] leading-[1.6] group-hover:text-[var(--text-primary)] transition-colors">
                          {item.text}
                        </p>
                      </div>

                      <button
                        onClick={(e) => { e.stopPropagation(); removeTakeaway(item.id); }}
                        className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 p-1.5 rounded-full bg-red-500 text-white shadow-lg scale-75 hover:scale-100 transition-all"
                      >
                        <Trash2 size={12} />
                      </button>
                    </motion.div>
                  ))
                )}
              </div>

              {/* Footer */}
              {takeaways.length > 0 && (
                <div className="p-4 mt-auto border-t border-white/[0.05]" style={{ background: 'rgba(0,0,0,0.1)' }}>
                  <button
                    onClick={clearTakeaways}
                    className="w-full py-2.5 rounded-xl text-[9px] font-bold uppercase tracking-[0.2em] text-red-400/70 hover:text-red-400 hover:bg-red-500/5 transition-all border border-red-500/10"
                  >
                    Clear Collection
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Expand trigger when minimized */}
      <AnimatePresence>
        {isMinimized && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute left-full ml-2 top-0"
          >
             <div className="px-3 py-1.5 rounded-full bg-amber-500 text-white text-[10px] font-bold shadow-lg whitespace-nowrap">
               {takeaways.length} Insights
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default StudyPanel;
