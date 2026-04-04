import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen, Zap, MessageCircleQuestion, Layers, MousePointer2, Info } from 'lucide-react';

const TeachingGuide = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const sections = [
    {
      icon: <Layers size={18} className="text-blue-400" />,
      title: "Infinite Canvas",
      description: "TutorBoard uses a 2D infinite workspace. You can pan (drag) and zoom (scroll) freely to see different parts of the explanation."
    },
    {
      icon: <Zap size={18} className="text-amber-400" />,
      title: "Pinning Doubts",
      description: "Found a great explanation? Click 'Pin to Canvas' in the Doubt Thread to create a permanent visual note on the board."
    },
    {
      icon: <MessageCircleQuestion size={18} className="text-emerald-400" />,
      title: "Real-time Doubts",
      description: "Ask anything about the current step. The Professor will respond and can even update the canvas visuals for you."
    },
    {
      icon: <MousePointer2 size={18} className="text-purple-400" />,
      title: "Interactivity",
      description: "Click on elements to highlight them. Controls at the bottom allow you to jump between steps or change playback speed."
    }
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[10010] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
        <motion.div
           initial={{ opacity: 0, scale: 0.9, y: 20 }}
           animate={{ opacity: 1, scale: 1, y: 0 }}
           exit={{ opacity: 0, scale: 0.9, y: 20 }}
           className="w-full max-w-lg bg-[var(--bg-secondary)]/95 backdrop-blur-2xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <BookOpen size={20} />
              </div>
              <div>
                <h2 className="text-lg font-serif text-[var(--text-primary)]">TutorBoard System Guide</h2>
                <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-widest font-bold mt-0.5">Advanced Immersive Interface</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5 text-[var(--text-tertiary)] transition-all">
              <X size={18} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto no-scrollbar">
            <div className="grid grid-cols-1 gap-4">
              {sections.map((sec, i) => (
                <div key={i} className="flex gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
                  <div className="mt-1">{sec.icon}</div>
                  <div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)] mb-1">{sec.title}</h3>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{sec.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 flex items-start gap-3">
               <Info size={16} className="text-emerald-400 mt-0.5" />
               <p className="text-[11px] text-emerald-300/80 leading-relaxed italic">
                 "Referencing other pages: You can always go back to the dashboard to see your previous chats, or explore pre-made modules for structured learning."
               </p>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 pt-0 flex justify-end">
             <button 
               onClick={onClose}
               className="px-6 py-2.5 rounded-xl bg-[var(--text-primary)] text-[var(--bg-primary)] text-xs font-bold hover:opacity-90 transition-all active:scale-95"
             >
               Got it, thanks!
             </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default TeachingGuide;
