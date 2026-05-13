import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import useTutorStore from '../../store/tutorStore';

/**
 * ProgressArc
 * A segmented SVG arc visualizing lesson progress with gradient and glow effects.
 */
const ProgressArc = () => {
  const { currentStepIndex, totalSteps } = useTutorStore();

  const radius = 18;
  const strokeWidth = 3;
  const size = 44;
  const center = size / 2;
  
  const segments = useMemo(() => {
    if (totalSteps <= 0) return [];
    
    const totalAngle = 280; // degrees of arc coverage
    const startAngle = 130; // start from bottom-left
    const gap = totalSteps > 1 ? 3 : 0;
    const segmentAngle = (totalAngle - (gap * (totalSteps - 1))) / totalSteps;
    
    return Array.from({ length: totalSteps }).map((_, i) => {
      const sAngle = startAngle + i * (segmentAngle + gap);
      const eAngle = sAngle + segmentAngle;
      
      const sRad = (sAngle * Math.PI) / 180;
      const eRad = (eAngle * Math.PI) / 180;
      
      const x1 = center + radius * Math.cos(sRad);
      const y1 = center + radius * Math.sin(sRad);
      const x2 = center + radius * Math.cos(eRad);
      const y2 = center + radius * Math.sin(eRad);
      
      const largeArc = segmentAngle > 180 ? 1 : 0;
      const path = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
      return { path, index: i };
    });
  }, [totalSteps, center, radius]);

  const fullArcPath = useMemo(() => {
    const totalAngle = 280;
    const startAngle = 130;
    const endAngle = startAngle + totalAngle;
    
    const sRad = (startAngle * Math.PI) / 180;
    const eRad = (endAngle * Math.PI) / 180;
    
    const x1 = center + radius * Math.cos(sRad);
    const y1 = center + radius * Math.sin(sRad);
    const x2 = center + radius * Math.cos(eRad);
    const y2 = center + radius * Math.sin(eRad);
    
    return `M ${x1} ${y1} A ${radius} ${radius} 0 1 1 ${x2} ${y2}`;
  }, [center, radius]);

  const isComplete = totalSteps > 0 && currentStepIndex === totalSteps - 1;

  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="arc-active-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
          <linearGradient id="arc-complete-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>

        {/* Background Track - More visible */}
        <path
          d={fullArcPath}
          fill="none"
          stroke="var(--text-primary)"
          strokeWidth={strokeWidth - 1}
          strokeLinecap="round"
          opacity={0.15}
        />

        {totalSteps > 0 ? (
          segments.map((seg, i) => {
            const isActive = i <= currentStepIndex;
            const isCurrent = i === currentStepIndex;
            return (
              <motion.path
                key={i}
                d={seg.path}
                fill="none"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                initial={false}
                animate={{
                  stroke: isActive 
                    ? (isComplete ? 'url(#arc-complete-gradient)' : 'url(#arc-active-gradient)')
                    : 'transparent',
                  opacity: isActive ? 1 : 0,
                  scale: isCurrent ? 1.05 : 1,
                }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              />
            );
          })
        ) : (
          /* Pulse effect when no steps are loaded yet */
          <motion.path
            d={fullArcPath}
            fill="none"
            stroke="url(#arc-active-gradient)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            animate={{ opacity: [0.1, 0.3, 0.1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
        
        {/* Minimal current step indicator - Always show at least '1' */}
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="central"
          style={{
            fontSize: '11px',
            fontWeight: 800,
            fill: 'var(--text-primary)',
            fontFamily: 'var(--font-mono, monospace)',
            opacity: 0.8
          }}
        >
          {currentStepIndex + 1}
        </text>

        {isComplete && (
          <motion.circle
            cx={center} cy={center} r={radius + 2}
            fill="none"
            stroke="url(#arc-complete-gradient)"
            strokeWidth={1}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: [0, 0.4, 0], scale: [0.8, 1.2] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
      </svg>
    </div>
  );
};

export default ProgressArc;
