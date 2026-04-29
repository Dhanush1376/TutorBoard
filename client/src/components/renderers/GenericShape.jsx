import React from 'react';
import { motion } from 'framer-motion';
import { resolve } from './shapes/ShapeUtils.js';

/**
 * GenericShape — Universal fallback for unrecognized shape types in specialized renderers.
 * Wraps basic SVG geometries in a positioned div for compatibility with 
 * PhysicsRenderer and NarrativeRenderer.
 */
export default function GenericShape({ obj, common, CW, CH }) {
  const type = obj.type?.toLowerCase() || 'orb';
  const c = resolve(obj.color || 'blue');
  
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
          <rect 
            x={20} y={20} width={w} height={h} rx={12}
            fill={c.glass} stroke={c.stroke} 
            strokeWidth={common.attentionLevel === 2 ? 3 : 1.5}
          />
        ) : (
          <circle 
            cx={(r * 2 + 40) / 2} cy={(r * 2 + 40) / 2} r={r} 
            fill={c.glass} stroke={c.stroke} 
            strokeWidth={common.attentionLevel === 2 ? 3 : 1.5}
          />
        )}
        {obj.label && (
          <text 
            x={isBlocky ? w/2 + 20 : (r * 2 + 40) / 2} 
            y={isBlocky ? h/2 + 20 : (r * 2 + 40) / 2}
            textAnchor="middle" dominantBaseline="middle" 
            fill={c.text} fontSize={12} fontWeight="600"
          >
            {obj.label}
          </text>
        )}
      </svg>
    </motion.div>
  );
}
