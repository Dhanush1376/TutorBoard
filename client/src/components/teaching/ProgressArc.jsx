import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import useTutorStore from '../../store/tutorStore';

/**
 * ProgressArc
 * A segmented SVG arc in the top-right corner visualizing lesson progress.
 */
const ProgressArc = () => {
  const { currentStepIndex, totalSteps } = useTutorStore();

  const radius = 40;
  const strokeWidth = 4;
  const size = (radius + strokeWidth) * 2;
  const center = size / 2;
  
  // Arc parameters (90 degree arc in top right)
  // We'll draw from 0 degrees (right) to -90 degrees (top)
  const startAngle = 0;
  const endAngle = -90;
  
  const segments = useMemo(() => {
    if (totalSteps <= 0) return [];
    
    const arcLength = Math.abs(endAngle - startAngle);
    const gap = totalSteps > 1 ? 2 : 0; // degrees
    const segmentAngle = (arcLength - (gap * (totalSteps - 1))) / totalSteps;
    
    return Array.from({ length: totalSteps }).map((_, i) => {
      const sAngle = startAngle - i * (segmentAngle + gap);
      const eAngle = sAngle - segmentAngle;
      
      // Convert to radians
      const sRad = (sAngle * Math.PI) / 180;
      const eRad = (eAngle * Math.PI) / 180;
      
      const x1 = center + radius * Math.cos(sRad);
      const y1 = center + radius * Math.sin(sRad);
      const x2 = center + radius * Math.cos(eRad);
      const y2 = center + radius * Math.sin(eRad);
      
      const path = `M ${x1} ${y1} A ${radius} ${radius} 0 0 0 ${x2} ${y2}`;
      return { path, index: i };
    });
  }, [totalSteps, center, radius]);

  const isComplete = totalSteps > 0 && currentStepIndex === totalSteps - 1;

  return (
    <div className="fixed top-24 right-8 z-[100] flex flex-col items-end pointer-events-none">
      <div className="relative">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-lg">
          {segments.map((seg, i) => {
            const isActive = i <= currentStepIndex;
            return (
              <motion.path
                key={i}
                d={seg.path}
                fill="none"
                stroke={isActive ? (isComplete ? 'var(--text-primary)' : 'var(--text-primary)') : 'var(--bg-tertiary)'}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                initial={false}
                animate={{
                  stroke: isActive ? (isComplete ? 'var(--text-primary)' : 'var(--text-primary)') : 'var(--bg-tertiary)',
                  opacity: isActive ? 1 : 0.3,
                  scale: isActive ? 1.02 : 1,
                }}
                transition={{ duration: 0.4 }}
              />
            );
          })}
          
          {/* Gold Flash at 100% */}
          {isComplete && (
            <motion.circle
              cx={center} cy={center} r={radius}
              fill="none"
              stroke="var(--text-primary)"
              strokeWidth={strokeWidth + 2}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: [0, 1, 0], scale: [0.8, 1.2, 1.4] }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          )}
        </svg>

        {/* Floating Counter Label */}
        <div className="absolute bottom-0 right-0 transform translate-y-full mt-2 text-right">
          <motion.div
            key={currentStepIndex}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-end"
          >
            <span className="text-[14px] font-normal text-[var(--text-primary)] tracking-tighter">
              {currentStepIndex + 1}<span className="text-[10px] text-[var(--text-tertiary)] ml-0.5">/ {totalSteps}</span>
            </span>
            <span className="text-[7px] font-normal uppercase tracking-[0.2em] text-[var(--text-tertiary)] -mt-1">
              {isComplete ? 'Lesson Complete' : 'Progress'}
            </span>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default ProgressArc;
