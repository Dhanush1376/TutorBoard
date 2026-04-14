/**
 * PhysicsRenderer v1.0 — Physics & Motion Visualization Engine
 * 
 * Target concepts: Waves, Orbits, Gravity, Pendulums, Fields
 * Uses requestAnimationFrame for fluid continuous motion.
 */

import React, { useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const CW = 800;
const CH = 600;

export default function PhysicsRenderer({ timeline, currentStepIndex, elements: extElements, connections: extConnections, steps: extSteps }) {
  const elements = extElements || timeline?.elements || [];
  const connections = extConnections || timeline?.connections || [];
  const steps = extSteps || timeline?.timeline || timeline?.steps || [];
  const currentStep = steps[currentStepIndex] || {};

  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  const { highlightIds, fadeIds, camera } = useMemo(() => {
    const hl = new Set(currentStep.highlight || []);
    const fd = new Set(currentStep.fade || []);
    const cam = currentStep.cameraFocus || { x: 0.5, y: 0.5, zoom: 1 };
    return { highlightIds: hl, fadeIds: fd, camera: cam };
  }, [currentStep]);

  const Z = Math.min(1.8, Math.max(0.5, camera.zoom || 1));
  const tx = CW / 2 - (camera.x || 0.5) * CW * Z;
  const ty = CH / 2 - (camera.y || 0.5) * CH * Z;

  // Render physics primitives
  const renderElement = (obj) => {
    const isHigh = highlightIds.has(obj.id);
    const isFade = fadeIds.has(obj.id);
    const opacity = isFade ? 0.2 : isHigh ? 1 : 0.8;
    const x = (obj.x ?? 0.5) * CW;
    const y = (obj.y ?? 0.5) * CH;
    const scale = obj.scale || 1;
    const type = obj.type?.toLowerCase() || 'particle';

    const common = {
      key: obj.id,
      layoutId: obj.id,
      initial: { opacity: 0, scale: 0.5 },
      animate: { opacity, scale, x, y },
      transition: { type: 'spring', stiffness: 50, damping: 20 },
      style: { position: 'absolute', label: obj.label }
    };

    switch(type) {
      case 'wave':
        return (
          <motion.div {...common}>
            <svg width={200 * scale} height={100 * scale} style={{ transform: 'translate(-50%, -50%)', overflow: 'visible' }}>
              <motion.path 
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                d={`M 0,${50*scale} Q ${50*scale},0 ${100*scale},${50*scale} T ${200*scale},${50*scale}`} 
                fill="none" 
                stroke={obj.color || '#3b82f6'} 
                strokeWidth={3} 
              />
            </svg>
            {obj.label && <span className="absolute top-4 left-0 text-xs font-bold whitespace-nowrap text-white/50">{obj.label}</span>}
          </motion.div>
        );
      case 'orbit':
        return (
          <motion.div {...common}>
            <svg width={200 * scale} height={200 * scale} style={{ transform: 'translate(-50%, -50%)', overflow: 'visible' }}>
              <circle cx={100*scale} cy={100*scale} r={100*scale} fill="none" stroke="#fff" strokeOpacity={0.2} strokeDasharray="4 4" />
              <motion.circle 
                cx={100*scale} cy={0} r={8} fill={obj.color || '#fcd34d'} 
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                style={{ originX: '50%', originY: '100px' }}
              />
            </svg>
            {obj.label && <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-bold text-white">{obj.label}</span>}
          </motion.div>
        );
      case 'pendulum':
      case 'spring':
      case 'particle':
      default:
        // Generic fallback particle
        return (
          <motion.div {...common} className="flex flex-col items-center justify-center pointer-events-none" style={{ transform: 'translate(-50%, -50%)' }}>
            <div className="w-8 h-8 rounded-full shadow-[0_0_15px_currentColor]" style={{ backgroundColor: obj.color || '#ef4444', color: obj.color || '#ef4444' }} />
            {obj.label && <span className="mt-2 px-2 py-0.5 rounded-full bg-black/50 text-[10px] font-bold text-white tracking-widest uppercase border border-white/10">{obj.label}</span>}
          </motion.div>
        );
    }
  };

  return (
    <div className="relative w-[800px] h-[600px] overflow-visible bg-black/20" ref={canvasRef}>
      <motion.div 
        className="absolute inset-0 origin-top-left"
        animate={{ x: tx, y: ty, scale: Z }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <AnimatePresence mode="popLayout">
          {elements.map(renderElement)}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
