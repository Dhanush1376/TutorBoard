import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * AnimationRenderer — Fault-tolerant visual animation renderer.
 * Renders elements with smooth entrance animations and connection lines.
 * NEVER crashes — all props are safely defaulted.
 */
const AnimationRenderer = ({ data }) => {
  const safeData = data || {};
  const elements = Array.isArray(safeData.elements) ? safeData.elements : [];
  const motionConfigs = Array.isArray(safeData.motion) ? safeData.motion : [];
  const sequence = Array.isArray(safeData.sequence) ? safeData.sequence : [];
  const connections = Array.isArray(safeData.connections) ? safeData.connections : [];
  
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  // Nothing to render — return null (Board will fallback to ProcessRenderer)
  if (elements.length === 0 && sequence.length === 0) return null;

  // Auto-advance sequence
  useEffect(() => {
    if (!isPlaying || sequence.length === 0) return;
    const interval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= sequence.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [isPlaying, sequence.length]);

  // Calculate grid layout positions for elements that don't have initialPos
  const getElementPosition = (el, index) => {
    if (el.initialPos && (el.initialPos.x !== 0 || el.initialPos.y !== 0)) {
      return { x: el.initialPos.x, y: el.initialPos.y };
    }
    // Auto-layout: distribute elements in a horizontal row
    const cols = Math.min(elements.length, 4);
    const spacing = 180;
    const row = Math.floor(index / cols);
    const col = index % cols;
    const offsetX = -(cols - 1) * spacing / 2;
    return { x: offsetX + col * spacing, y: row * 120 };
  };

  const currentActions = sequence[currentStep]?.actions || [];

  return (
    <div className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none overflow-hidden">
      <div className="relative w-full h-full max-w-5xl max-h-[80vh] flex items-center justify-center">
        
        {/* Connection Lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
          <defs>
            <marker id="anim-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--text-tertiary)" opacity="0.4" />
            </marker>
          </defs>
          {connections.map((conn, i) => {
            const fromEl = elements.find(e => e.id === conn?.from);
            const toEl = elements.find(e => e.id === conn?.to);
            if (!fromEl || !toEl) return null;
            const fromIdx = elements.indexOf(fromEl);
            const toIdx = elements.indexOf(toEl);
            const fromPos = getElementPosition(fromEl, fromIdx);
            const toPos = getElementPosition(toEl, toIdx);
            // Convert to percentage-based coords centered on container
            const cx = 50, cy = 50;
            return (
              <motion.line 
                key={i}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.3 }}
                transition={{ duration: 1, delay: 0.5 + i * 0.2 }}
                x1={`${cx + fromPos.x / 10}%`} y1={`${cy + fromPos.y / 10}%`}
                x2={`${cx + toPos.x / 10}%`} y2={`${cy + toPos.y / 10}%`}
                stroke="var(--text-tertiary)" strokeWidth="2" strokeDasharray="6,4"
                markerEnd="url(#anim-arrow)"
              />
            );
          })}
        </svg>

        {/* Elements */}
        <div className="relative flex items-center justify-center gap-6 flex-wrap p-8">
          <AnimatePresence>
            {elements.map((el, i) => {
              const pos = getElementPosition(el, i);
              const safeLabel = el?.label || `Element ${i + 1}`;
              const safeIcon = el?.icon || '✦';
              const safeId = el?.id || `e${i}`;
              const isVisible = currentStep === 0 || currentActions.some(a => a?.includes?.(safeId)) || i <= currentStep;

              return (
                <motion.div
                  key={safeId}
                  initial={{ opacity: 0, scale: 0.5, y: 30 }}
                  animate={{ 
                    opacity: isVisible ? 1 : 0.3, 
                    scale: isVisible ? 1 : 0.8,
                    y: 0
                  }}
                  transition={{ 
                    duration: 0.8, 
                    delay: i * 0.15,
                    ease: [0.16, 1, 0.3, 1]
                  }}
                  className="relative p-6 rounded-[2rem] bg-[var(--bg-secondary)]/80 backdrop-blur-3xl border border-[var(--border-color)] shadow-2xl flex flex-col items-center gap-3 transition-colors duration-500"
                  style={{ width: '150px', minHeight: '100px' }}
                >
                  <span className="text-3xl filter drop-shadow-lg">{safeIcon}</span>
                  <span className="text-[11px] font-black uppercase tracking-widest text-[var(--text-primary)] text-center leading-tight">
                    {safeLabel}
                  </span>
                  {isVisible && (
                    <motion.div 
                      layoutId="element-glow"
                      className="absolute inset-0 rounded-[2rem] bg-[var(--text-primary)]/5 blur-xl -z-10"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    />
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Step Description Overlay */}
        {sequence.length > 0 && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 pointer-events-auto">
            <div className="px-4 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-full text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
              Step {currentStep + 1} / {sequence.length}
            </div>
            <AnimatePresence mode="wait">
              <motion.p 
                key={currentStep}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-base font-medium text-[var(--text-primary)] text-center max-w-lg leading-relaxed px-6 py-3 bg-[var(--bg-secondary)]/60 backdrop-blur-xl rounded-2xl border border-[var(--border-color)]"
              >
                {sequence[currentStep]?.description || "Animating..."}
              </motion.p>
            </AnimatePresence>
          </div>
        )}

      </div>
    </div>
  );
};

export default AnimationRenderer;
