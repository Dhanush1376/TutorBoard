import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, PlayCircle } from 'lucide-react';
import useTutorStore from '../../store/tutorStore';

/**
 * SessionResumeOverlay
 * A cinematic "Welcome back" overlay when resuming a session.
 */
const SessionResumeOverlay = () => {
  const { resumeContext, setResumeContext } = useTutorStore();

  useEffect(() => {
    if (resumeContext) {
      const timer = setTimeout(() => {
        setResumeContext(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [resumeContext, setResumeContext]);

  return (
    <AnimatePresence>
      {resumeContext && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-md pointer-events-none"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 1.1, opacity: 0 }}
            className="bg-[var(--bg-secondary)] border border-[var(--border-strong)] rounded-[32px] p-8 shadow-2xl flex flex-col items-center gap-4 max-w-sm text-center"
          >
            <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-2">
              <History size={32} className="text-blue-400" />
            </div>
            
            <div>
              <h2 className="text-[18px] font-normal text-[var(--text-primary)] mb-1">Welcome Back</h2>
              <p className="text-[13px] text-[var(--text-tertiary)] font-normal leading-relaxed">
                Continuing your lesson on <br />
                <span className="text-[var(--text-primary)] font-normal">"{resumeContext.topic}"</span>
              </p>
            </div>

            <div className="px-4 py-2 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] flex items-center gap-2">
              <PlayCircle size={14} className="text-[var(--text-tertiary)]" />
              <span className="text-[11px] font-normal text-[var(--text-secondary)] uppercase tracking-wider">
                Step {resumeContext.stepIndex + 1}
              </span>
            </div>

            <p className="text-[10px] text-[var(--text-tertiary)] opacity-60 uppercase tracking-widest font-normal mt-2">
              Ready to learn
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SessionResumeOverlay;
