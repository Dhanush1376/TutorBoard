/**
 * AnimationRenderer v2.5 — Cinematic SCENE GRAPH Renderer (Brutal Debug Patch)
 *
 * This version applies the 'Brutal Debug' fixes:
 *   - Connection Rendering (Z-layer background)
 *   - Normalized -> Pixel Camera Calibration
 *   - motion.g layoutId Persistence
 *   - 3-Tier Attention System
 */

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  GlowOrb, GlassRect, FlowArrow, DataBlock, 
  FlowPointer, SwapBridge, Comparator, 
  CodePanel, FloatingBadge, CinematicFilters,
  FreeformShape, DataDot, CartesianAxes, GeometryPolygon, RawLine
} from './CinematicShapes';

// Virtual Canvas Dimensions
const CW = 800;
const CH = 600;

const EASE_CINEMATIC = [0.16, 1, 0.3, 1];

/**
 * Hook to compute step difference and attention levels
 */
function useStepDirector(elements, timeline, connections, currentStepIndex) {
  return useMemo(() => {
    if (!timeline?.length || !elements?.length) {
      return { elements: [], connectionMap: [], highlightIds: new Set(), fadeIds: new Set(), camera: { x: CW/2, y: CH/2, zoom: 1 }, stepKey: 'step-0' };
    }

    const step = timeline[Math.min(currentStepIndex, timeline.length - 1)];
    const highlightIds = new Set(step.highlight || []);
    const fadeIds = new Set(step.fade || []);
    
    // Normalized -> Pixel Camera Conversion (Fix #2)
    const camera = {
      x: (step.cameraFocus?.x ?? 0.5) * CW,
      y: (step.cameraFocus?.y ?? 0.5) * CH,
      zoom: step.cameraFocus?.zoom ?? 1
    };

    return {
      elements,
      connections: connections || [],
      highlightIds,
      fadeIds,
      camera,
      stepKey: `step-${currentStepIndex}`,
    };
  }, [elements, timeline, connections, currentStepIndex]);
}

/**
 * Shape Dispatcher with layoutId (Fix #3) and attentionLevel (Fix #4)
 */
function RenderShape({ obj, highlightIds, fadeIds, stepKey, index }) {
  const isHighlighted = highlightIds.has(obj.id);
  const isFaded = fadeIds.has(obj.id);
  const attentionLevel = isHighlighted ? 2 : isFaded ? 0 : 1;

  const common = {
    id: obj.id,
    layoutId: obj.id,
    attentionLevel,
    stepKey
  };

  const x = obj.x * CW;
  const y = obj.y * CH;
  const shapeType = String(obj.type || obj.shape || '').toLowerCase().trim();

  // Unique keys are assigned at the top level in the .map call.
  // We use shape-specific rendering based on AI 'type'.
  switch (shapeType) {
    case 'circle':
    case 'orb':
      return <GlowOrb {...common} cx={x} cy={y} r={(obj.scale || 1) * 40} color={obj.color} label={obj.label} />;
    case 'rect':
    case 'block':
      const w = (obj.scale || 1) * 160;
      const h = (obj.scale || 1) * 60;
      return <GlassRect {...common} layoutId={obj.id} x={x - w/2} y={y - h/2} w={w} h={h} color={obj.color} label={obj.label} />;
    case 'pointer':
      return <FlowPointer {...common} layoutId={obj.id} x={x} y={y} color={obj.color} label={obj.label} />;
    case 'array':
      return <DataBlock {...common} layoutId={obj.id} x={x} y={y} values={obj.values} label={obj.label} color={obj.color} />;
    case 'badge':
      return <FloatingBadge {...common} layoutId={obj.id} x={x} y={y} text={obj.label} color={obj.color} />;
    case 'codeline':
      return <CodePanel {...common} layoutId={obj.id} x={x} y={y} code={obj.label} />;
    case 'comparator':
      return <Comparator {...common} layoutId={obj.id} x={x} y={y} leftVal={obj.leftVal} rightVal={obj.rightVal} operator={obj.operator} result={obj.result} color={obj.color} />;
    case 'swapbridge':
      return <SwapBridge {...common} layoutId={obj.id} x={x} y={y} color={obj.color} />;
    case 'dot':
    case 'scatter':
      return <DataDot {...common} layoutId={obj.id} x={x} y={y} color={obj.color} label={obj.label} />;
    case 'axes':
    case 'plot':
      return <CartesianAxes {...common} x={x} y={y} color={obj.color} label={obj.label} />;
    case 'polygon':
    case 'math_shape':
      return <GeometryPolygon {...common} x={x} y={y} points={obj.points} color={obj.color} label={obj.label} />;
    default:
      return <FreeformShape {...common} x={x} y={y} label={obj.label} color={obj.color} type={shapeType || 'element'} />;
  }
}

const AnimationRenderer = ({ scene, elements = [], connections = [], timeline = [], currentStepIndex = 0 }) => {
  const { highlightIds, fadeIds, camera, stepKey } = useStepDirector(elements, timeline, connections, currentStepIndex);

  if (!elements.length) return null;

  // Camera Calculation (Fix #2)
  const Z = camera.zoom;
  const tx = 400 - (camera.x * Z);
  const ty = 300 - (camera.y * Z);

  return (
    <div className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none overflow-hidden bg-slate-950">
      <svg
        viewBox={`0 0 ${CW} ${CH}`}
        width="100%" height="100%"
        className="relative z-10"
        style={{ maxWidth: '1000px', maxHeight: '85vh', overflow: 'visible' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <CinematicFilters />
        {/* Cinematic Camera Layer */}
        <motion.g
          animate={{ x: tx, y: ty, scale: Z }}
          transition={{ duration: 0.7, ease: EASE_CINEMATIC }} // Fix #7
        >
          {/* Layer 1: Connections (The "Flow" fix #1, #6) */}
          <g className="connections-layer">
            {connections.map((conn, idx) => {
              const fromEl = elements.find(e => e.id === conn.from);
              const toEl = elements.find(e => e.id === conn.to);
              
              // CRITICAL: Skip if elements missing, but don't crash the whole layer
              if (!fromEl || !toEl) {
                console.warn(`[Renderer] Connection ${idx} missing endpoint: from=${conn.from}, to=${conn.to}`);
                return null;
              }

              const isHighlighted = highlightIds.has(conn.id) || highlightIds.has(fromEl.id) || highlightIds.has(toEl.id);
              const isFaded = fadeIds.has(conn.id) || (fadeIds.has(fromEl.id) && fadeIds.has(toEl.id));
              
              const connProps = {
                key: `conn-${conn.from}-${conn.to}-${idx}`,
                layoutId: `conn-${conn.from}-${conn.to}`,
                x1: fromEl.x * CW, y1: fromEl.y * CH,
                x2: toEl.x * CW, y2: toEl.y * CH,
                attentionLevel: isHighlighted ? 2 : isFaded ? 0 : 1,
                label: conn.label,
                color: fromEl.color,
                dashed: conn.dashed
              };

              if (conn.type === 'line') {
                return <RawLine {...connProps} />;
              }

              return <FlowArrow {...connProps} />;
            })}
          </g>

          {/* Layer 2: Elements */}
          <AnimatePresence mode="popLayout">
            {elements.map((obj, idx) => (
              <RenderShape 
                key={`${obj.id || 'el'}-${idx}`} 
                obj={obj} 
                highlightIds={highlightIds} 
                fadeIds={fadeIds} 
                stepKey={stepKey} 
                index={idx}
              />
            ))}
          </AnimatePresence>
        </motion.g>
      </svg>
    </div>
  );
};

export default AnimationRenderer;