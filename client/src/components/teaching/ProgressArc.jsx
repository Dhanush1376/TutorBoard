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

  const isComplete = totalSteps > 0 && currentStepIndex === totalSteps - 1;
  const progress = totalSteps > 0 ? ((currentStepIndex + 1) / totalSteps) * 100 : 0;

  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Gradient definitions */}
        <defs>
          <linearGradient id="arc-active-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
          <linearGradient id="arc-complete-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
          <filter id="arc-glow">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {segments.map((seg, i) => {
          const isActive = i <= currentStepIndex;
          const isCurrent = i === currentStepIndex;
          return (
            <motion.path
              key={i}
              d={seg.path}
              fill="none"
              strokeWidth={isCurrent ? strokeWidth + 0.5 : strokeWidth}
              strokeLinecap="round"
              initial={false}
              animate={{
                stroke: isActive 
                  ? (isComplete ? 'url(#arc-complete-gradient)' : 'url(#arc-active-gradient)')
                  : 'var(--bg-tertiary)',
                opacity: isActive ? 1 : 0.25,
              }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              filter={isCurrent ? 'url(#arc-glow)' : undefined}
            />
          );
        })}
        
        {/* Center step indicator */}
        <text
          x={center}
          y={center - 1}
          textAnchor="middle"
          dominantBaseline="central"
          style={{
            fontSize: '10px',
            fontWeight: 600,
            fill: 'var(--text-primary)',
            fontFamily: 'var(--font-mono, monospace)',
          }}
        >
          {currentStepIndex + 1}
        </text>
        <text
          x={center}
          y={center + 10}
          textAnchor="middle"
          dominantBaseline="central"
          style={{
            fontSize: '6px',
            fontWeight: 500,
            fill: 'var(--text-tertiary)',
            fontFamily: 'var(--font-sans, sans-serif)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          / {totalSteps}
        </text>

        {/* Completion flash */}
        {isComplete && (
          <motion.circle
            cx={center} cy={center} r={radius + 3}
            fill="none"
            stroke="url(#arc-complete-gradient)"
            strokeWidth={1.5}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: [0, 0.6, 0], scale: [0.85, 1.15, 1.3] }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        )}
      </svg>
    </div>
  );
};

export default ProgressArc;
