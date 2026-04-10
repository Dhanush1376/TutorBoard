/**
 * AgentCanvasRenderer v3.0 — Cinematic SCENE GRAPH Renderer
 * 
 * This is the ACTUAL renderer used by TeachingSession.
 * It consumes the full SCENE GRAPH (elements, connections, timeline)
 * and renders a cinematic, camera-tracked animation.
 */

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GlowOrb, GlassRect, FlowArrow, DataBlock,
  FlowPointer, CodePanel, FloatingBadge,
  Comparator, SwapBridge, CinematicFilters
} from '../renderers/CinematicShapes.jsx';

const CW = 800;
const CH = 600;
const EASE_CINEMATIC = [0.16, 1, 0.3, 1];

/**
 * Compute attention levels and camera from the current timeline step.
 */
function useStepDirector(elements, connections, timelineSteps, currentStepIndex) {
  return useMemo(() => {
    const step = timelineSteps?.[currentStepIndex];
    if (!step || !elements?.length) {
      return {
        highlightIds: new Set(),
        fadeIds: new Set(),
        camera: { x: CW / 2, y: CH / 2, zoom: 1 },
      };
    }

    const highlightIds = new Set(step.highlight || step.highlightIds || []);
    const fadeIds = new Set(step.fade || step.fadeIds || []);

    // Camera: read from step.cameraFocus (normalized 0-1) and convert to pixels
    const cf = step.cameraFocus;
    const camera = {
      x: (cf?.x ?? 0.5) * CW,
      y: (cf?.y ?? 0.5) * CH,
      zoom: Math.min(1.4, Math.max(1.0, cf?.zoom ?? 1)),
    };

    return { highlightIds, fadeIds, camera };
  }, [elements, timelineSteps, currentStepIndex]);
}

/**
 * Shape dispatcher: routes each element to its cinematic component.
 */
function RenderShape({ obj, highlightIds, fadeIds }) {
  const isHighlighted = highlightIds.has(obj.id);
  const isFaded = fadeIds.has(obj.id);
  const attentionLevel = isHighlighted ? 2 : isFaded ? 0 : 1;

  const common = {
    key: obj.id,
    layoutId: obj.id,
    attentionLevel,
  };

  // Convert normalized 0-1 to pixel space
  const x = (obj.x ?? 0.5) * CW;
  const y = (obj.y ?? 0.5) * CH;
  const shape = (obj.shape || obj.type || 'circle').toLowerCase();

  switch (shape) {
    case 'circle':
    case 'orb':
    case 'node':
      return <GlowOrb {...common} cx={x} cy={y} r={(obj.scale || 1) * 40} color={obj.color} label={obj.label} />;
    case 'rect':
    case 'block':
    case 'rectangle':
    case 'box':
    case 'step_box': {
      const w = (obj.scale || 1) * 160;
      const h = (obj.scale || 1) * 60;
      return <GlassRect {...common} x={x - w / 2} y={y - h / 2} w={w} h={h} color={obj.color} label={obj.label} />;
    }
    case 'pointer':
      return <FlowPointer {...common} x={x} y={y} color={obj.color} label={obj.label} />;
    case 'array':
    case 'data_block':
    case 'datablock':
      return <DataBlock {...common} x={x} y={y} values={obj.values || []} label={obj.label} color={obj.color} />;
    case 'badge':
      return <FloatingBadge {...common} x={x} y={y} text={obj.label || ''} color={obj.color} />;
    case 'codeline':
      return <CodePanel {...common} x={x} y={y} code={obj.label || obj.code || ''} />;
    case 'comparator':
      return <Comparator {...common} x={x} y={y} leftVal={obj.leftVal} rightVal={obj.rightVal} operator={obj.operator} result={obj.result} color={obj.color} />;
    case 'swapbridge':
      return <SwapBridge {...common} x={x} y={y} color={obj.color} />;
    default:
      // Fallback: render as GlassRect
      return <GlassRect {...common} x={x - 80} y={y - 30} w={160} h={60} color={obj.color || 'blue'} label={obj.label} />;
  }
}

export default function AgentCanvasRenderer({ timeline, currentStepIndex }) {
  // Extract data from timeline, supporting both new and legacy keys
  const elements = timeline?.elements || timeline?.objects || [];
  const connections = timeline?.connections || [];
  const timelineSteps = timeline?.timeline || timeline?.steps || [];

  const { highlightIds, fadeIds, camera } = useStepDirector(
    elements, connections, timelineSteps, currentStepIndex
  );

  if (!elements.length) return null;

  // Camera transform
  const Z = camera.zoom;
  const tx = CW / 2 - camera.x * Z;
  const ty = CH / 2 - camera.y * Z;

  return (
    <div className="relative w-[800px] h-[600px] bg-transparent overflow-visible">
      <svg
        width="100%" height="100%"
        viewBox={`0 0 ${CW} ${CH}`}
        preserveAspectRatio="xMidYMid meet"
        className="block overflow-visible pointer-events-none"
      >
        <CinematicFilters />

        {/* Cinematic Camera Layer */}
        <motion.g
          animate={{ x: tx, y: ty, scale: Z }}
          transition={{ duration: 0.7, ease: EASE_CINEMATIC }}
        >
          {/* Layer 1: Connections (behind elements) */}
          <g className="connections-layer">
            {connections.map((conn, idx) => {
              const fromEl = elements.find(e => e.id === conn.from);
              const toEl = elements.find(e => e.id === conn.to);
              if (!fromEl || !toEl) return null;

              const isHighlighted = highlightIds.has(fromEl.id) || highlightIds.has(toEl.id);
              const isFaded = fadeIds.has(fromEl.id) && fadeIds.has(toEl.id);

              return (
                <FlowArrow
                  key={`conn-${conn.from}-${conn.to}-${idx}`}
                  layoutId={`conn-${conn.from}-${conn.to}`}
                  x1={(fromEl.x ?? 0.5) * CW}
                  y1={(fromEl.y ?? 0.5) * CH}
                  x2={(toEl.x ?? 0.5) * CW}
                  y2={(toEl.y ?? 0.5) * CH}
                  attentionLevel={isHighlighted ? 2 : isFaded ? 0 : 1}
                  label={conn.label}
                  color={fromEl.color}
                />
              );
            })}
          </g>

          {/* Layer 2: Elements */}
          <AnimatePresence mode="popLayout">
            {elements.map(obj => (
              <RenderShape
                key={obj.id}
                obj={obj}
                highlightIds={highlightIds}
                fadeIds={fadeIds}
              />
            ))}
          </AnimatePresence>
        </motion.g>
      </svg>
    </div>
  );
}
