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
              whileHover={{ scale: 1.1, y: -2 }}
              whileTap={{ scale: 0.9 }}
              className={`
                w-10 h-10 rounded-xl flex items-center justify-center text-[11px] font-medium transition-all duration-300
              `}
              style={isCurrent
                ? { background: 'var(--text-primary)', color: 'var(--bg-primary)' }
                : isCompleted
                ? { background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' }
                : { background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)', border: '1px solid var(--border-color)' }
              }
            >
              {isCompleted ? <Check size={16} strokeWidth={3} /> : index + 1}
              
              {/* Current Step Active Glow */}
              {isCurrent && (
                <motion.div
                  layoutId="step-glow"
                  className="absolute -inset-1.5 rounded-[18px]"
                  style={{ border: '2px solid var(--text-primary)', opacity: 0.2 }}
                  animate={{ opacity: [0.2, 0.5, 0.2] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
            </motion.div>

            {/* Tooltip on hover */}
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-[10010] scale-90 group-hover:scale-100 translate-y-2 group-hover:translate-y-0">
              <div className="px-3 py-1.5 rounded-lg text-[10px] font-medium uppercase tracking-widest whitespace-nowrap shadow-xl"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', backdropFilter: 'blur(12px)' }}>
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
