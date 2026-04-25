import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

/**
 * Lesson Step Filmstrip
 * Shows all lesson steps as small numbered tiles at the top of the canvas.
 * Clicking a tile jumps to that step.
 */
const StepFilmstrip = ({ steps, currentStepIndex, goToStep }) => {
  if (!steps || steps.length === 0) return null;

  return (
    <div className="flex items-center justify-center gap-2 py-4 px-6 overflow-x-auto no-scrollbar max-w-full">
      {steps.map((step, index) => {
        const isCurrent = index === currentStepIndex;
        const isCompleted = index < currentStepIndex;

        return (
          <button
            key={step.id || index}
            onClick={() => goToStep(index)}
            className="relative flex-shrink-0 group"
          >
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`
                w-9 h-9 rounded-xl flex items-center justify-center text-[10px] font-bold transition-all duration-300
                ${isCurrent 
                  ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] shadow-[0_8px_24px_rgba(0,0,0,0.2)]' 
                  : isCompleted
                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-tertiary)] border border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                }
              `}
            >
              {isCompleted ? <Check size={14} strokeWidth={3} /> : index + 1}
              
              {/* Current Step Active Glow */}
              {isCurrent && (
                <motion.div
                  layoutId="step-glow"
                  className="absolute -inset-1 rounded-2xl border-2 border-[var(--text-primary)]/20"
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
            </motion.div>

            {/* Tooltip on hover */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[100]">
              <div className="bg-black/80 backdrop-blur-md border border-white/10 px-2 py-1 rounded text-[10px] text-white whitespace-nowrap">
                {step.title || `Step ${index + 1}`}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default StepFilmstrip;
