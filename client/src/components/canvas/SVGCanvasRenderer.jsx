/**
 * SVGCanvasRenderer v5.0 — High-Fidelity SVG Orchestration
 * Extracted from AgentCanvasRenderer for Phase 2 Modularization.
 */
import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DOMPurify from 'dompurify';
import ErrorBoundary from '../common/ErrorBoundary.jsx';
import {
  GlowOrb, GlassRect, GlassEllipse, FlowArrow, DataBlock,
  FlowPointer, CodePanel, FloatingBadge,
  Comparator, SwapBridge, CinematicFilters, FreeformShape,
  DataDot, CartesianAxes, GeometryPolygon, RawLine,
  EquationBlock, TreeNode, BarShape, VennCircle,
  FlowStep, MoleculeNode, LabelText, StickyNoteShape,
  EllipseShape, DiamondShape, StarShape, HexagonShape, CalloutShape, CloudShape
} from '../renderers/CinematicShapes.jsx';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../../constants/canvas';
import InlineEditor from './InlineEditor.jsx';
import PremiumTextBox from './PremiumTextBox.jsx';
import useTutorStore from '../../store/tutorStore.js';
import VisualScriptInterpreter from '../../engine/VisualScriptInterpreter.jsx';

const CW = CANVAS_WIDTH;
const CH = CANVAS_HEIGHT;
const EASE = [0.16, 1, 0.3, 1];

// ─── Camera Director ──────────────────────────────────────────────────────────
function useStepDirector(elements, timelineSteps, currentStepIndex) {
  return useMemo(() => {
    const step = timelineSteps?.[currentStepIndex];
    if (!step || !elements?.length) {
      return {
        highlightIds: new Set(),
        fadeIds: new Set(),
        camera: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, zoom: 1 },
      };
    }

    const highlightIds = new Set(step.highlight || step.highlightIds || []);
    const fadeIds      = new Set(step.fade || step.fadeIds || []);
    const cf           = step.cameraFocus;
    const camera = {
      x:    (cf?.x    ?? 0.5) * CANVAS_WIDTH,
      y:    (cf?.y    ?? 0.5) * CANVAS_HEIGHT,
      zoom: Math.min(1.8, Math.max(0.6, cf?.zoom ?? 1)),
    };

    return { highlightIds, fadeIds, camera };
  }, [elements, timelineSteps, currentStepIndex]);
}

// ─── Shape Dispatcher ─────────────────────────────────────────────────────────
function RenderShape({ obj, highlightIds, fadeIds, animation, isSelected, onUpdate, onDelete }) {
  const isHighlighted  = highlightIds.has(obj.id);
  const isFaded        = fadeIds.has(obj.id);
  const attentionLevel = isHighlighted ? 2 : isFaded ? 0 : 1;

  const common = {
    layoutId:     obj.id,
    attentionLevel,
    animation,
    content:      obj.content,
    styles:       obj.styles || {},
  };

  const x = (obj.x ?? 0.5) * CANVAS_WIDTH;
  const y = (obj.y ?? 0.5) * CANVAS_HEIGHT;
  const label = obj.label ? DOMPurify.sanitize(obj.label) : null;
  const shape = (obj.type || obj.shape || 'orb').toLowerCase();

  const props = { ...common, x, y, color: obj.color, label };

  switch (shape) {
    case 'orb':
    case 'circle':
      return <GlowOrb key={obj.id} {...props} />;
    case 'rect':
    case 'box':
      return <GlassRect key={obj.id} {...props} w={obj.w * CANVAS_WIDTH || 120} h={obj.h * CANVAS_HEIGHT || 80} />;
    case 'ellipse':
      return <EllipseShape key={obj.id} {...props} w={obj.w * CANVAS_WIDTH || 120} h={obj.h * CANVAS_HEIGHT || 80} />;
    case 'diamond':
      return <DiamondShape key={obj.id} {...props} w={obj.w * CANVAS_WIDTH || 100} h={obj.h * CANVAS_HEIGHT || 100} />;
    case 'star':
      return <StarShape key={obj.id} {...props} w={obj.w * CANVAS_WIDTH || 100} h={obj.h * CANVAS_HEIGHT || 100} />;
    case 'hexagon':
      return <HexagonShape key={obj.id} {...props} w={obj.w * CANVAS_WIDTH || 100} h={obj.h * CANVAS_HEIGHT || 100} />;
    case 'callout':
    case 'speech':
      return <CalloutShape key={obj.id} {...props} w={obj.w * CANVAS_WIDTH || 160} h={obj.h * CANVAS_HEIGHT || 100} />;
    case 'cloud':
      return <CloudShape key={obj.id} {...props} w={obj.w * CANVAS_WIDTH || 180} h={obj.h * CANVAS_HEIGHT || 120} />;
    case 'sticky':
      return <StickyNoteShape key={obj.id} {...props} w={obj.w * CANVAS_WIDTH || 120} h={obj.h * CANVAS_HEIGHT || 120} onUpdate={onUpdate} onDelete={onDelete} isSelected={isSelected} />;
    case 'path':
      return <FreeformShape key={obj.id} {...props} type="path" path={obj.path} strokeWidth={obj.strokeWidth} />;
    case 'label':
    case 'text':
    case 'code':
    case 'equation':
      return <PremiumTextBox key={obj.id} obj={obj} isSelected={isSelected} onUpdate={onUpdate} onDelete={onDelete} />;
    default:
      return <FreeformShape key={obj.id} {...props} type={shape} />;
  }
}

export default function SVGCanvasRenderer({ 
  timeline, currentStepIndex, 
  elements: extElements, objects: extObjects, 
  connections: extConnections, steps: extSteps,
  showNotes: propShowNotes 
}) {
  const { 
    showNotes: storeShowNotes = true, 
    selectedElementIds, setSelectedElements, 
    updateCanvasObject, deleteCanvasObject,
    editingObjectId, setEditingObjectId, activeTool
  } = useTutorStore();
  
  const showNotes = propShowNotes !== undefined ? propShowNotes : storeShowNotes;

  const rawElements = useMemo(() => {
    const timelineEls = timeline?.elements || timeline?.objects || [];
    return [...(extElements || extObjects || []), ...timelineEls];
  }, [extElements, extObjects, timeline]);

  const connections  = extConnections  || timeline?.connections || [];
  const timelineSteps= extSteps || timeline?.timeline    || timeline?.steps   || [];
  const currentStep  = timelineSteps?.[currentStepIndex] || {};

  const stepObjectIds = useMemo(() => {
    const ids = currentStep.objectIds || currentStep.elements || [];
    const baseSet = new Set(ids);
    rawElements.forEach(el => {
      if (el?.isPinned || el?.id?.startsWith?.('manual-')) baseSet.add(el.id);
    });
    return baseSet.size > 0 ? baseSet : new Set(rawElements.map(e => e?.id));
  }, [currentStep, rawElements]);

  const elements = useMemo(() => {
    return rawElements
      .filter(el => el?.id && (el.id.startsWith('manual-') || stepObjectIds.has(el.id)))
      .map(el => {
        const mutation = (currentStep.mutations || []).find(m => m.id === el.id);
        return mutation ? { ...el, ...mutation.props } : el;
      });
  }, [rawElements, stepObjectIds, currentStep.mutations]);

  const worldElements = useMemo(() => elements.filter(el => !el.isPinned), [elements]);
  const pinnedElements = useMemo(() => elements.filter(el => el.isPinned), [elements]);

  const { highlightIds, fadeIds, camera } = useStepDirector(worldElements, timelineSteps, currentStepIndex);
  
  const Z  = camera.zoom;
  const tx = CW / 2 - camera.x * Z;
  const ty = CH / 2 - camera.y * Z;

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      <svg
        width="100%" height="100%"
        viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
        className="block overflow-visible pointer-events-none"
      >
        <CinematicFilters />
        <motion.g animate={{ x: tx, y: ty, scale: Z }} transition={{ duration: 0.75, ease: EASE }}>
          <VisualScriptInterpreter actions={currentStep.animation?.actions} currentStepIndex={currentStepIndex}>
            <AnimatePresence mode="popLayout">
              {worldElements.map(obj => (
                <g key={obj.id} data-element-id={obj.id} onPointerDown={() => setSelectedElements([obj.id])}>
                  <RenderShape 
                    obj={obj} 
                    highlightIds={highlightIds} 
                    fadeIds={fadeIds} 
                    isSelected={selectedElementIds.includes(obj.id)}
                    onUpdate={updateCanvasObject}
                    onDelete={deleteCanvasObject}
                  />
                </g>
              ))}
            </AnimatePresence>
          </VisualScriptInterpreter>
        </motion.g>
      </svg>
      {editingObjectId && <InlineEditor elements={rawElements} editingObjectId={editingObjectId} Z={Z} tx={tx} ty={ty} />}
    </div>
  );
}