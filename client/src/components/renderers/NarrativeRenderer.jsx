/**
 * NarrativeRenderer v1.0 — Timelines, Histories & Cycles
 * 
 * Target concepts: History, Flowcharts, Cycles, Causation
 * Emphasizes sequential connections and narrative flow.
 */

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const CW = 800;
const CH = 600;

export default function NarrativeRenderer({ timeline, currentStepIndex, elements: extElements, connections: extConnections, steps: extSteps }) {
  const elements = extElements || timeline?.elements || [];
  const connections = extConnections || timeline?.connections || [];
  const steps = extSteps || timeline?.timeline || timeline?.steps || [];
  const currentStep = steps[currentStepIndex] || {};

  const { highlightIds, fadeIds, camera } = useMemo(() => {
    const hl = new Set(currentStep.highlight || []);
    const fd = new Set(currentStep.fade || []);
    const cam = currentStep.cameraFocus || { x: 0.5, y: 0.5, zoom: 1 };
    return { highlightIds: hl, fadeIds: fd, camera: cam };
  }, [currentStep]);

  const Z = Math.min(1.8, Math.max(0.5, camera.zoom || 1));
  const tx = CW / 2 - (camera.x || 0.5) * CW * Z;
  const ty = CH / 2 - (camera.y || 0.5) * CH * Z;

  const renderElement = (obj) => {
    const isHigh = highlightIds.has(obj.id);
    const isFade = fadeIds.has(obj.id);
    const opacity = isFade ? 0.3 : isHigh ? 1 : 0.8;
    const x = (obj.x ?? 0.5) * CW;
    const y = (obj.y ?? 0.5) * CH;
    const type = obj.type?.toLowerCase() || 'era_block';

    const common = {
      key: obj.id,
      layoutId: obj.id,
      initial: { opacity: 0, y: 20 },
      animate: { opacity, x, y },
      transition: { type: 'spring', bounce: 0.2 },
      style: { position: 'absolute', transform: 'translate(-50%, -50%)' }
    };

    switch(type) {
      case 'timeline_bar':
        return (
          <motion.div {...common} className="flex flex-col items-center pointer-events-none">
            <div className="w-1 h-32 bg-gradient-to-b from-transparent via-white/40 to-transparent" />
          </motion.div>
        );
      case 'era_block':
      case 'event':
      default:
        return (
          <motion.div {...common} className={`flex flex-col items-center pointer-events-none ${isHigh ? 'scale-110 z-10' : 'scale-100 z-0'} transition-transform`}>
            <div className="px-4 py-3 rounded-lg shadow-xl border border-white/20 flex flex-col items-center gap-1" style={{ backgroundColor: obj.color || '#475569' }}>
              <span className="text-xs font-bold text-white tracking-widest uppercase">{obj.label}</span>
            </div>
          </motion.div>
        );
    }
  };

  return (
    <div className="relative w-[800px] h-[600px] overflow-visible bg-gradient-to-b from-slate-900 to-black">
      <svg width="100%" height="100%" className="absolute inset-0 pointer-events-none overflow-visible">
        <motion.g animate={{ x: tx, y: ty, scale: Z }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>
          {/* Draw sequential paths between highlighted elements if requested, or just use connections */}
          {connections.map((conn, idx) => {
            const fromEl = elements.find(e => e.id === conn.from);
            const toEl = elements.find(e => e.id === conn.to);
            if (!fromEl || !toEl) return null;
            
            const x1 = (fromEl.x ?? 0.5) * CW;
            const y1 = (fromEl.y ?? 0.5) * CH;
            const x2 = (toEl.x ?? 0.5) * CW;
            const y2 = (toEl.y ?? 0.5) * CH;

            const isHigh = highlightIds.has(fromEl.id) || highlightIds.has(toEl.id);

            return (
              <motion.path
                key={idx}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                d={`M ${x1},${y1} L ${x2},${y2}`}
                fill="none"
                stroke={fromEl.color || '#fff'}
                strokeWidth={isHigh ? 3 : 1}
                strokeOpacity={isHigh ? 0.8 : 0.2}
                strokeDasharray={isHigh ? "none" : "4 4"}
              />
            );
          })}
        </motion.g>
      </svg>
      <motion.div className="absolute inset-0 origin-top-left" animate={{ x: tx, y: ty, scale: Z }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>
        <AnimatePresence mode="popLayout">
          {elements.map(renderElement)}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
