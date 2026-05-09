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
    <div className="flex items-center justify-center gap-1 py-3 px-4 overflow-x-auto no-scrollbar max-w-full">
      {steps.map((step, index) => {
        const isCurrent = index === currentStepIndex;
        const isCompleted = index < currentStepIndex;

        return (
          <React.Fragment key={step.id || index}>
            {/* Connector line */}
            {index > 0 && (
              <div 
                className="w-3 h-px flex-shrink-0 transition-colors duration-300"
                style={{ 
                  background: index <= currentStepIndex ? 'var(--text-primary)' : 'var(--border-color)',
                  opacity: index <= currentStepIndex ? 0.4 : 0.3,
                }}
              />
            )}
            <button
              onClick={() => goToStep(index)}
              className="relative flex-shrink-0 group"
            >
              <motion.div
                whileHover={{ scale: 1.12, y: -2 }}
                whileTap={{ scale: 0.88 }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-semibold transition-all duration-300"
                style={isCurrent
                  ? { background: 'var(--text-primary)', color: 'var(--bg-primary)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }
                  : isCompleted
                  ? { background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }
                  : { background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)', border: '1px solid var(--border-color)' }
                }
              >
                {isCompleted ? <Check size={13} strokeWidth={3} /> : index + 1}
                
                {/* Current Step Active Glow */}
                {isCurrent && (
                  <motion.div
                    layoutId="step-glow"
                    className="absolute -inset-1 rounded-[12px]"
                    style={{ border: '1.5px solid var(--text-primary)', opacity: 0.15 }}
                    animate={{ opacity: [0.15, 0.35, 0.15] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}
              </motion.div>

              {/* Tooltip on hover */}
              <div className="absolute -top-9 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-[200] scale-90 group-hover:scale-100 translate-y-1 group-hover:translate-y-0">
                <div className="px-2.5 py-1 rounded-lg text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap liquid-glass"
                  style={{ color: 'var(--text-primary)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                  {step.title || `Step ${index + 1}`}
                </div>
              </div>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default StepFilmstrip;
