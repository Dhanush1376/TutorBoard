import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, X, ArrowRight, ArrowLeft, Keyboard, MessageSquare, LogOut } from 'lucide-react';

/**
 * ShortcutsHUD
 * A compact, Figma-inspired keyboard shortcuts overlay.
 */
const ShortcutsHUD = () => {
  const [isOpen, setIsOpen] = useState(false);

  const shortcuts = [
    { key: '→', label: 'Next step', icon: <ArrowRight size={12} /> },
    { key: '←', label: 'Previous step', icon: <ArrowLeft size={12} /> },
    { key: 'Space', label: 'Pause / Play', icon: <Keyboard size={12} /> },
    { key: 'Esc', label: 'Deselect / Exit', icon: <LogOut size={12} /> },
    { key: 'V', label: 'Select Tool', icon: <ArrowLeft size={12} className="-rotate-45" /> },
  ];

  return (
    <div className="fixed bottom-32 right-6 z-[10010] flex flex-col items-end gap-3">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="bg-[var(--bg-secondary)]/90 backdrop-blur-xl border border-[var(--border-strong)] rounded-2xl p-4 shadow-2xl min-w-[200px]"
          >
            <div className="flex items-center justify-between mb-4 px-1">
              <span className="text-[10px] font-normal uppercase tracking-widest text-[var(--text-tertiary)]">Shortcuts</span>
              <button onClick={() => setIsOpen(false)} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
                <X size={14} />
              </button>
            </div>
            
            <div className="space-y-3">
              {shortcuts.map((s, i) => (
                <div key={i} className="flex items-center justify-between group">
                  <span className="text-[11px] font-normal text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                    {s.label}
                  </span>
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--bg-tertiary)] border border-[var(--border-color)] shadow-sm">
                    <span className="text-[9px] font-normal text-[var(--text-primary)]">{s.key}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-xl backdrop-blur-xl border ${
          isOpen 
            ? 'bg-[var(--text-primary)] border-[var(--text-primary)] text-[var(--bg-primary)]' 
            : 'bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--text-primary)] hover:text-[var(--text-primary)]'
        }`}
      >
        <HelpCircle size={18} />
      </button>
    </div>
  );
};

export default ShortcutsHUD;
