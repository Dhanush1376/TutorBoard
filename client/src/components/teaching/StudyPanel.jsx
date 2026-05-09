import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Trash2, BookMarked, X, Info } from 'lucide-react';
import useTutorStore from '../../store/tutorStore';

const StudyPanel = ({ isOpen, onClose }) => {
  const { takeaways, removeTakeaway, clearTakeaways } = useTutorStore();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, x: 20 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.9, x: 20 }}
          className="fixed top-24 right-6 z-[100] w-80 max-h-[70vh] flex flex-col"
        >
          <div className="liquid-glass flex flex-col" style={{ borderRadius: 24, overflow: 'hidden', boxShadow: '0 20px 60px -12px rgba(0,0,0,0.2)' }}>
            {/* Header */}
            <div className="p-5 border-b border-[var(--border-color)] flex items-center justify-between" style={{ background: 'var(--bg-tertiary)', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 className="text-[13px] font-bold tracking-tight text-[var(--text-primary)]">Key Takeaways</h3>
                  <p className="text-[9px] uppercase tracking-widest text-[var(--text-tertiary)] font-medium">Study Insights</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--bg-tertiary)] transition-colors text-[var(--text-tertiary)]"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar" style={{ maxHeight: '50vh' }}>
              {takeaways.length === 0 ? (
                <div className="py-12 flex flex-col items-center text-center px-6">
                  <div className="w-12 h-12 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--text-tertiary)] mb-4">
                    <BookMarked size={20} />
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] font-medium">No insights pinned yet.</p>
                  <p className="text-[10px] text-[var(--text-tertiary)] mt-2 leading-relaxed">
                    Add important points from the chat to build your revision list.
                  </p>
                </div>
              ) : (
                takeaways.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="group relative p-3.5 rounded-2xl bg-[var(--bg-tertiary)]/50 border border-[var(--border-color)] hover:border-amber-500/30 transition-all"
                  >
                    <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed pr-6">
                      {item.text}
                    </p>
                    <button
                      onClick={() => removeTakeaway(item.id)}
                      className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </motion.div>
                ))
              )}
            </div>

            {/* Footer */}
            {takeaways.length > 0 && (
              <div className="p-4 border-t border-[var(--border-color)]" style={{ background: 'var(--bg-tertiary)' }}>
                <button
                  onClick={clearTakeaways}
                  className="w-full py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest text-red-400 hover:bg-red-500/5 transition-all border border-red-500/10"
                >
                  Clear All Insights
                </button>
              </div>
            )}
            
            <div className="px-4 py-2 bg-amber-500/5 flex items-center gap-2">
               <Info size={10} className="text-amber-500" />
               <span className="text-[9px] text-amber-500/80 font-medium">Insights are saved to your session history.</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StudyPanel;
