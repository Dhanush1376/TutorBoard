import React from 'react';
import { motion } from 'framer-motion';
import { GlowOrb, GlassRect } from './CinematicShapes.jsx';

/**
 * GenericShape — Universal fallback for unrecognized shape types in specialized renderers.
 * Wraps cinematic SVG components in a positioned div for compatibility with 
 * PhysicsRenderer and NarrativeRenderer.
 */
export default function GenericShape({ obj, common, CW, CH }) {
  const type = obj.type?.toLowerCase() || 'orb';
  
  // Decide which base geometry to use for the unknown type
  const isBlocky = ['block', 'rect', 'array', 'data', 'container', 'box', 'step'].some(k => type.includes(k));
  
  const w = obj.w ? (obj.w <= 1 ? obj.w * CW : obj.w) : (obj.scale || 1) * 120;
  const h = obj.h ? (obj.h <= 1 ? obj.h * CH : obj.h) : (obj.scale || 1) * 60;
  const r = (obj.scale || 1) * 40;

  return (
    <motion.div 
      {...common} 
      className="flex items-center justify-center pointer-events-none" 
      style={{ transform: 'translate(-50%, -50%)', position: 'absolute' }}
    >
      <svg 
        width={isBlocky ? w + 40 : r * 2 + 40} 
        height={isBlocky ? h + 40 : r * 2 + 40} 
        viewBox={`0 0 ${isBlocky ? w + 40 : r * 2 + 40} ${isBlocky ? h + 40 : r * 2 + 40}`}
        style={{ overflow: 'visible' }}
      >
        {isBlocky ? (
          <GlassRect 
            x={20} y={20} w={w} h={h} 
            color={obj.color} label={obj.label} 
            attentionLevel={common.attentionLevel || 1}
          />
        ) : (
          <GlowOrb 
            cx={(r * 2 + 40) / 2} cy={(r * 2 + 40) / 2} r={r} 
            color={obj.color} label={obj.label} 
            attentionLevel={common.attentionLevel || 1}
          />
        )}
      </svg>
    </motion.div>
  );
}
