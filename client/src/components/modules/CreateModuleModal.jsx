import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const CreateModuleModal = ({ isOpen, onClose, onCreate }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    onCreate({
      id: `mod-${Date.now()}`,
      title,
      description,
      createdAt: new Date().toISOString(),
      data: { steps: [] } // Mock empty steps for initial creation
    });
    
    setTitle('');
    setDescription('');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-2xl bg-[var(--bg-primary)] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-[var(--border-color)]"
        >
          <div className="px-8 py-8 flex flex-col">
            <h2 className="text-[28px] font-serif font-medium text-[var(--text-primary)] mb-6 tracking-tight">Create a personal module</h2>
            
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl p-6 mb-8 text-[14px] text-[var(--text-secondary)] leading-relaxed">
              <p className="font-semibold text-[var(--text-primary)] mb-2">How to use modules</p>
              <p className="mb-4">
                Modules help organize your work and leverage knowledge across multiple conversations. Upload docs, code, and files to create themed collections that the AI can reference again and again.
              </p>
              <p>
                Start by creating a memorable title and description to organize your module. You can always edit it later.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-semibold text-[var(--text-secondary)]">What are you working on?</label>
                <input 
                  type="text"
                  placeholder="Name your module"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[15px] text-[var(--text-primary)] outline-none focus:border-blue-500 shadow-sm transition-colors"
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-semibold text-[var(--text-secondary)]">What are you trying to achieve?</label>
                <textarea 
                  placeholder="Describe your module, goals, subject, etc..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[15px] text-[var(--text-primary)] min-h-[120px] outline-none focus:border-blue-500 shadow-sm transition-colors resize-y"
                />
              </div>

              <div className="flex items-center justify-end gap-3 mt-4 pt-6 border-t border-[var(--border-color)]">
                <button 
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-full border border-[var(--border-color)] bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={!title.trim()}
                  className="px-6 py-2.5 rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] text-sm font-bold opacity-100 hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  Create module
                </button>
              </div>
            </form>

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default CreateModuleModal;
