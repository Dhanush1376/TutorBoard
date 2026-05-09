import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, X, ArrowRight, ArrowLeft, Keyboard, MessageSquare, LogOut } from 'lucide-react';

/**
 * ShortcutsHUD
 * A compact, Figma-inspired keyboard shortcuts overlay.
 */
const ShortcutsHUD = () => {
  const [isOpen, setIsOpen] = useState(false);

  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '?' && !e.target.matches('input, textarea')) {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const shortcuts = [
    { key: '→', label: 'Next step', icon: <ArrowRight size={12} /> },
    { key: '←', label: 'Previous step', icon: <ArrowLeft size={12} /> },
    { key: 'Space', label: 'Pause / Play', icon: <Keyboard size={12} /> },
    { key: 'Esc', label: 'Deselect / Exit', icon: <LogOut size={12} /> },
    { key: 'V', label: 'Select Tool', icon: <ArrowLeft size={12} className="-rotate-45" /> },
  ];

  return (
    <div className="fixed bottom-8 left-20 z-[10010] flex flex-col items-start gap-3">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="sf-glass shadow-premium rounded-2xl p-5 min-w-[240px]"
          >
            <div className="flex items-center justify-between mb-5 px-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-tertiary)] opacity-80">System Shortcuts</span>
              <button onClick={() => setIsOpen(false)} className="text-[var(--text-tertiary)] hover:text-red-400 transition-colors">
                <X size={14} />
              </button>
            </div>
            
            <div className="space-y-4">
              {shortcuts.map((s, i) => (
                <div key={i} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <span className="text-[var(--text-tertiary)] group-hover:text-indigo-400 transition-colors">
                      {s.icon}
                    </span>
                    <span className="text-[11px] font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                      {s.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-center min-w-[32px] h-6 px-2 rounded-lg bg-white/5 border border-white/10 shadow-inner">
                    <span className="text-[9px] font-bold text-[var(--text-primary)] tracking-tighter">{s.key}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-11 h-11 rounded-full flex items-center justify-center transition-all shadow-premium sf-glass border ${
          isOpen 
            ? 'bg-[var(--text-primary)] border-[var(--text-primary)] text-[var(--bg-primary)]' 
            : 'text-[var(--text-secondary)] hover:border-[var(--text-primary)] hover:text-[var(--text-primary)]'
        }`}
      >
        <HelpCircle size={20} />
      </button>
    </div>
  );
};

export default ShortcutsHUD;
