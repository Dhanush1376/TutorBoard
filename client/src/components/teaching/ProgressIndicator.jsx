import React from 'react';

const ProgressIndicator = ({ totalSteps, currentStep, onStepClick }) => {
  if (totalSteps <= 0) return null;

  return (
    <div className="flex items-center gap-2 w-full max-w-lg mx-auto">
      
      {/* Step Label */}
      <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest whitespace-nowrap">
        Step {currentStep + 1} / {totalSteps}
      </span>

      {/* Segmented Bar */}
      <div className="flex-1 flex items-center gap-1">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <button
            key={i}
            onClick={() => onStepClick(i)}
            className={`flex-1 h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
              i <= currentStep 
                ? 'bg-[var(--text-primary)] shadow-sm' 
                : 'bg-[var(--border-color)] hover:bg-[var(--text-tertiary)]'
            } ${i === currentStep ? 'scale-y-150' : ''}`}
            title={`Go to step ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

export default ProgressIndicator;
