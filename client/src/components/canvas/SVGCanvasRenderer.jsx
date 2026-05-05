/**
 * SVGCanvasRenderer v5.0 — High-Fidelity SVG Orchestration
 * Extracted from AgentCanvasRenderer for Phase 2 Modularization.
 */
import React, { useMemo, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DOMPurify from 'dompurify';
import ErrorBoundary from '../common/ErrorBoundary.jsx';
import { resolve } from '../renderers/shapes/ShapeUtils.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../../constants/canvas';
import InlineEditor from './InlineEditor.jsx';
import PremiumTextBox from './PremiumTextBox.jsx';
import useTutorStore from '../../store/tutorStore.js';

const CW = CANVAS_WIDTH;
const CH = CANVAS_HEIGHT;
const EASE = [0.16, 1, 0.3, 1];

// ─── Minimal Fallback Shape ──────────────────────────────────────────────────
function FreeformShape({ type, x, y, w, h, color, label, attentionLevel, path, strokeWidth, animation }) {
  const c = resolve(color || 'blue');
  
  if (type === 'path' && path) {
    return (
      <g transform={`translate(${x * CANVAS_WIDTH}, ${y * CANVAS_HEIGHT})`}>
        <motion.path 
          d={path} fill="none" stroke={c.stroke} strokeWidth={strokeWidth || 2} 
          strokeLinecap="round" strokeLinejoin="round"
          initial={animation?.type === "draw" ? { pathLength: 0 } : {}}
          animate={animation?.type === "draw" ? { pathLength: 1 } : {}}
        />
      </g>
    );
  }

  return (
    <g transform={`translate(${x * CANVAS_WIDTH}, ${y * CANVAS_HEIGHT})`}>
      <rect 
        x={-w/2} y={-h/2} width={w} height={h} rx={8} 
        fill={c.glass} stroke={c.stroke} strokeWidth={attentionLevel === 2 ? 2 : 1.2} 
      />
      {label && <text textAnchor="middle" dominantBaseline="middle" fill={c.text} fontSize={12} fontWeight="600">{label}</text>}
    </g>
  );
}

// ─── Camera Director ──────────────────────────────────────────────────────────
function useStepDirector(elements, timelineSteps, currentStepIndex, deltaState = null) {
  return useMemo(() => {
    const step = timelineSteps?.[currentStepIndex];
    if (!step && !deltaState && !elements?.length) {
      return {
        highlightIds: new Set(),
        fadeIds: new Set(),
        camera: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, zoom: 1 },
      };
    }

    const highlightIds = new Set(step?.highlight || step?.highlightIds || []);
    const fadeIds      = new Set(step?.fade || step?.fadeIds || []);
    
    // ─── Phase 3: Delta Highlights ───
    if (deltaState?.actions) {
      deltaState.actions.forEach(action => {
        if (action.action === 'highlightNode' || action.type === 'highlightNode') {
          highlightIds.add(String(action.id || action.target));
        }
      });
    }

    const cf           = step?.cameraFocus;
    const camera = {
      x:    (cf?.x    ?? 0.5) * CANVAS_WIDTH,
      y:    (cf?.y    ?? 0.5) * CANVAS_HEIGHT,
      zoom: Math.min(1.8, Math.max(0.6, cf?.zoom ?? 1)),
    };

    return { highlightIds, fadeIds, camera };
  }, [elements, timelineSteps, currentStepIndex, deltaState]);
}

// ─── Shape Dispatcher ─────────────────────────────────────────────────────────
function RenderShape({ obj, highlightIds, fadeIds, animation, isSelected, onUpdate, onDelete, isPulsing, textAnnotation }) {
  const isHighlighted  = highlightIds.has(obj.id);
  const isFaded        = fadeIds.has(obj.id);
  const attentionLevel = isHighlighted ? 2 : isFaded ? 0 : 1;

  const isManual = (obj.id && String(obj.id).startsWith('manual-')) || obj.isPinned || obj.pinned;
  const opacity = isManual ? 1 : (highlightIds.has(obj.id) ? 1 : fadeIds.has(obj.id) ? 0.2 : 1);
  const finalAnimation = isManual ? { type: 'none' } : (obj.animation || animation);

  const common = {
    layoutId:     obj.id,
    attentionLevel,
    animation:    finalAnimation,
    content:      obj.content,
    styles:       obj.styles || {},
    isPulsing:    isPulsing || obj.isPulsing,
    textAnnotation: textAnnotation || obj.textAnnotation
  };
  
  // ALL objects in TutorBoard store normalized (0.0-1.0) x,y coordinates
  // and normalized (0.0-1.0) w,h dimensions.
  // We pass normalized x,y to the AW component (which handles viewport scaling internally)
  // and absolute pixel w,h to the shape components themselves.
  const x = obj.x ?? 0.5;
  const y = obj.y ?? 0.5;
  const w = (obj.w ?? 0.1) * CANVAS_WIDTH;
  const h = (obj.h ?? 0.1) * CANVAS_HEIGHT;

  const label = obj.label ? DOMPurify.sanitize(obj.label) : null;
  const shape = (obj.type || obj.shape || 'orb').toLowerCase();

  const props = { 
    ...common, 
    x, y, cx: x, cy: y, 
    w, h, width: w, height: h, 
    r: w/2, rx: w/2, ry: h/2,
    color: obj.color, 
    label, 
    isPinned: obj.isPinned 
  };

  const onUpdateBound = (updates) => onUpdate(obj.id, updates);
  const onDeleteBound = () => onDelete(obj.id);

  switch (shape) {
    case 'label':
    case 'text':
    case 'code':
    case 'equation':
      return <PremiumTextBox key={obj.id} obj={obj} isSelected={isSelected} onUpdate={onUpdateBound} onDelete={onDeleteBound} />;
    default:
      return <FreeformShape key={obj.id} {...props} type={shape} />;
  }
}

export default function SVGCanvasRenderer({ 
  timeline, currentStepIndex, 
  elements: extElements, objects: extObjects, 
  connections: extConnections, steps: extSteps,
  showNotes: propShowNotes,
  forceManualOnly = false,
  isD3 = false
}) {
  const { 
    showNotes: storeShowNotes = true, 
    selectedElementIds, setSelectedElements, 
    updateCanvasObject, deleteCanvasObject,
    editingObjectId, setEditingObjectId, activeTool,
    deltaState
  } = useTutorStore();
  
  const showNotes = propShowNotes !== undefined ? propShowNotes : storeShowNotes;

  // SVGCanvasRenderer handles static elements and manual annotations.
  // VisualScript animations are handled by the D3Renderer/AgentCanvasRenderer pipeline.
  

  const rawElements = useMemo(() => {
    // AgentCanvasRenderer already merged and deduplicated timeline + manual objects into extElements.
    // We should NOT merge them again here to avoid duplicate key errors.
    return extElements || extObjects || timeline?.elements || timeline?.objects || [];
  }, [extElements, extObjects, timeline]);

  const connections  = extConnections  || timeline?.connections || [];
  const timelineSteps= extSteps || timeline?.timeline    || timeline?.steps   || [];
  const currentStep  = timelineSteps?.[currentStepIndex] || {};

  const stepObjectIds = useMemo(() => {
    const ids = currentStep.objectIds || currentStep.elements || [];
    const baseSet = new Set(ids.map(id => String(id)));
    rawElements.forEach(el => {
      if (!el?.id) return;
      const sId = String(el.id);
      if (el.isPinned || el.pinned || sId.startsWith('manual-')) {
        baseSet.add(sId);
      }
    });
    return baseSet.size > 0 ? baseSet : new Set(rawElements.map(e => String(e?.id)));
  }, [currentStep, rawElements]);

  const elements = useMemo(() => {
    return rawElements
      .filter(el => {
        if (!el?.id) return false;
        const sId = String(el.id);
        const isManual = sId.startsWith('manual-') || el.isPinned || el.pinned || el.doubtDriven;
        const isTimeline = !sId.startsWith('manual-') && !el.doubtDriven;
        if (forceManualOnly && isTimeline) return false;
        return isManual || stepObjectIds.has(sId);
      })
      .map(el => {
        const mutation = (currentStep.mutations || []).find(m => m.id === el.id);
        const deltaPulse = deltaState?.actions?.find(a => (a.action === 'pulseElement' || a.type === 'pulseElement') && (a.id === el.id || a.target === el.id));
        const deltaAnnotate = deltaState?.actions?.find(a => (a.action === 'showTextOverlay' || a.type === 'showTextOverlay') && (a.id === el.id || a.target === el.id));

        return {
          ...el,
          ...(mutation ? mutation.props : {}),
          isPulsing: !!deltaPulse,
          textAnnotation: deltaAnnotate?.meta?.text || deltaAnnotate?.text || null
        };
      });
  }, [rawElements, stepObjectIds, currentStep.mutations, deltaState]);

  const worldElements = useMemo(() => {
    // World elements are anything NOT pinned
    return elements.filter(el => !el.isPinned && !el.pinned);
  }, [elements]);
  const pinnedElements = useMemo(() => {
    // Pinned elements are anything explicitly marked as pinned or isPinned
    return elements.filter(el => el.isPinned || el.pinned);
  }, [elements]);

  const { highlightIds, fadeIds, camera } = useStepDirector(worldElements, timelineSteps, currentStepIndex, deltaState);
  
  const Z  = camera.zoom;
  const tx = (CANVAS_WIDTH / 2 - camera.x * Z);
  const ty = (CANVAS_HEIGHT / 2 - camera.y * Z);

  // Step animations are handled by the specialized D3/AgentCanvasRenderer pipeline.

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      <svg
        width="100%" height="100%"
        viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
        className="block overflow-visible pointer-events-none"
      >
        <motion.g 
          animate={{ x: tx, y: ty, scale: Z }} 
          transition={{ duration: 0.75, ease: EASE }}
        >
            <g className="world-elements">
              {worldElements.map(obj => (
                <g 
                  key={obj.id} 
                  data-element-id={obj.id} 
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setSelectedElements([obj.id]);
                  }}
                  style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                >
                  <RenderShape 
                    obj={obj} 
                    highlightIds={highlightIds} 
                    fadeIds={fadeIds} 
                    isSelected={selectedElementIds.includes(obj.id)}
                    onUpdate={updateCanvasObject}
                    onDelete={deleteCanvasObject}
                    isPulsing={obj.isPulsing}
                    textAnnotation={obj.textAnnotation}
                  />
                </g>
              ))}
            </g>
        </motion.g>

        {/* Pinned Layer (Sticky Notes, etc that follow the viewport but stay on top) */}
        {pinnedElements.map(obj => (
          <g 
            key={`pinned-${obj.id}`} 
            data-element-id={obj.id} 
            onPointerDown={(e) => {
              e.stopPropagation();
              setSelectedElements([obj.id]);
            }}
            style={{ pointerEvents: 'auto', cursor: 'pointer' }}
          >
            <RenderShape 
              obj={obj} 
              highlightIds={new Set()} 
              fadeIds={new Set()} 
              isSelected={selectedElementIds.includes(obj.id)}
              onUpdate={updateCanvasObject}
              onDelete={deleteCanvasObject}
              isPulsing={obj.isPulsing}
              textAnnotation={obj.textAnnotation}
            />
          </g>
        ))}
      </svg>
      {editingObjectId && <InlineEditor elements={rawElements} editingObjectId={editingObjectId} Z={Z} tx={tx} ty={ty} />}
    </div>
  );
}