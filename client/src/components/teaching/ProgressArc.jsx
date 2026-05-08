import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import useTutorStore from '../../store/tutorStore';

/**
 * ProgressArc
 * A segmented SVG arc in the top-right corner visualizing lesson progress.
 */
const ProgressArc = () => {
  const { currentStepIndex, totalSteps } = useTutorStore();

  const radius = 20;
  const strokeWidth = 4;
  const size = 48;
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
    <div className="relative flex flex-col items-end">
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

      </div>
    </div>
  );
};

export default ProgressArc;
