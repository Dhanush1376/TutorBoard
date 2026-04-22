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
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className={`
                w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold transition-all duration-300
                ${isCurrent 
                  ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.4)] border-2 border-white' 
                  : isCompleted
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10 hover:text-white/60'
                }
              `}
            >
              {isCompleted ? <Check size={14} /> : index + 1}
              
              {/* Current Step Glow Ring */}
              {isCurrent && (
                <motion.div
                  layoutId="glow-ring"
                  className="absolute -inset-1 rounded-2xl border-2 border-white/30"
                  animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.05, 1] }}
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
