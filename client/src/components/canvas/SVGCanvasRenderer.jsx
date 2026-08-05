/**
 * SVGCanvasRenderer v5.0 — High-Fidelity SVG Orchestration
 * Extracted from AgentCanvasRenderer for Phase 2 Modularization.
 */
import React, { useMemo, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import DOMPurify from 'dompurify';
import ErrorBoundary from '../common/ErrorBoundary';
import { resolve } from '../renderers/shapes/ShapeUtils.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../../constants/canvas';
import InlineEditor from './InlineEditor';
import PremiumTextBox from './PremiumTextBox';
import useTutorStore from '../../store/tutorStore.js';

const CW = CANVAS_WIDTH;
const CH = CANVAS_HEIGHT;
const EASE = [0.16, 1, 0.3, 1];

// ─── Ambient Motion Keyframes ────────────────────────────────────────────────
function getAmbientKeyframes(motion) {
  if (!motion) return {};
  const phase = motion.phase || 0;
  switch (motion.type) {
    case 'float':
      return {
        animate: { y: [0, -(motion.amplitude || 4), 0, (motion.amplitude || 4), 0] },
        transition: { duration: 1 / (motion.frequency || 0.4), repeat: Infinity, ease: 'easeInOut', delay: phase * 0.3 },
      };
    case 'breathe':
      return {
        animate: { scale: [motion.scaleMin || 0.96, motion.scaleMax || 1.04, motion.scaleMin || 0.96] },
        transition: { duration: motion.period || 3, repeat: Infinity, ease: 'easeInOut', delay: phase * 0.2 },
      };
    case 'orbit':
      return {
        animate: {
          x: [0, (motion.radius || 3), 0, -(motion.radius || 3), 0],
          y: [-(motion.radius || 3), 0, (motion.radius || 3), 0, -(motion.radius || 3)]
        },
        transition: { duration: 1 / (motion.speed || 0.3), repeat: Infinity, ease: 'linear', delay: phase * 0.4 },
      };
    case 'shimmer':
      return {
        animate: { opacity: motion.opacity || [0.85, 1] },
        transition: { duration: motion.period || 2.5, repeat: Infinity, ease: 'easeInOut', delay: phase * 0.5 },
      };
    case 'pulse':
      return {
        animate: { scale: [motion.scaleMin || 0.98, motion.scaleMax || 1.06, motion.scaleMin || 0.98] },
        transition: { duration: motion.period || 2, repeat: Infinity, ease: 'easeInOut', delay: phase * 0.3 },
      };
    default:
      return {};
  }
}

// ─── Cinematic Shape Renderer ────────────────────────────────────────────────
function FreeformShape({ type, x, y, w, h, color, label, attentionLevel, path, strokeWidth, animation, obj }) {
  const c = resolve(color || 'blue');
  const ambientMotion = obj?.ambientMotion;
  const glowIntensity = obj?.glowIntensity || 0;
  const revealDelay = obj?.revealDelay || 0;
  const revealAnim = obj?.revealAnimation || 'fadeScaleUp';
  const icon = obj?.icon;
  const title = obj?.title;
  const subtitle = obj?.subtitle;
  const importance = obj?.importance || 3;

  // Compute ambient animation
  const ambientAnimate = getAmbientKeyframes(ambientMotion);

  // Reveal initial state
  const revealInitial = revealAnim === 'dropIn'
    ? { opacity: 0, y: -30, scale: 0.7 }
    : revealAnim === 'slideFromLeft'
    ? { opacity: 0, x: -40 }
    : { opacity: 0, scale: 0.5 };

  // Node sizing based on importance
  const nodeW = w || (40 + importance * 10);
  const nodeH = h || (40 + importance * 8);

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
    <motion.g
      initial={revealInitial}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1, ...(ambientAnimate.animate || {}) }}
      transition={{ delay: revealDelay, duration: 0.5, ease: EASE, ...(ambientAnimate.transition || {}) }}
      style={{ originX: '50%', originY: '50%' }}
      whileHover={{ scale: 1.12, filter: 'brightness(1.2)' }}
    >
      <g transform={`translate(${x * CANVAS_WIDTH}, ${y * CANVAS_HEIGHT})`}>
        {/* Glow effect for important nodes */}
        {glowIntensity > 0 && (
          <motion.circle
            cx={0} cy={0} r={nodeW * 0.7}
            fill="none" stroke={c.stroke}
            strokeWidth={1}
            opacity={glowIntensity * 0.4}
            filter="url(#cinematic-glow)"
            animate={{ r: [nodeW * 0.6, nodeW * 0.8, nodeW * 0.6], opacity: [glowIntensity * 0.2, glowIntensity * 0.5, glowIntensity * 0.2] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}

        {/* Main shape */}
        {type === 'circle' ? (
          <circle
            cx={0} cy={0} r={nodeW / 2}
            fill={c.glass} stroke={c.stroke}
            strokeWidth={attentionLevel === 2 ? 2.5 : importance >= 4 ? 1.8 : 1.2}
          />
        ) : type === 'triangle' ? (
          <polygon
            points={`0,${-nodeH/2} ${nodeW/2},${nodeH/2} ${-nodeW/2},${nodeH/2}`}
            fill={c.glass} stroke={c.stroke}
            strokeWidth={attentionLevel === 2 ? 2.5 : importance >= 4 ? 1.8 : 1.2}
          />
        ) : (
          <rect
            x={-nodeW / 2} y={-nodeH / 2} width={nodeW} height={nodeH} rx={type === 'diamond' ? 2 : type === 'pill' ? nodeH / 2 : 8}
            fill={c.glass} stroke={c.stroke}
            strokeWidth={attentionLevel === 2 ? 2.5 : importance >= 4 ? 1.8 : 1.2}
            style={type === 'diamond' ? { transform: 'rotate(45deg)', transformOrigin: 'center' } : {}}
          />
        )}

        {/* Icon */}
        {icon && (
          <text textAnchor="middle" dominantBaseline="middle" fontSize={18} y={title ? -8 : 0}>{icon}</text>
        )}

        {/* Title */}
        {title ? (
          <>
            <text textAnchor="middle" dominantBaseline="middle" fill={c.text} fontSize={11} fontWeight="700" y={icon ? 8 : -4}>
              {title}
            </text>
            {subtitle && (
              <text textAnchor="middle" dominantBaseline="middle" fill={c.text} fontSize={8} opacity={0.65} y={icon ? 20 : 10}>
                {subtitle}
              </text>
            )}
          </>
        ) : label && (
          <text textAnchor="middle" dominantBaseline="middle" fill={c.text} fontSize={12} fontWeight="600">{label}</text>
        )}
      </g>
    </motion.g>
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
  const content = obj.content ? DOMPurify.sanitize(obj.content) : null;
  const sanitizedTextAnnotation = textAnnotation ? DOMPurify.sanitize(textAnnotation) : (obj.textAnnotation ? DOMPurify.sanitize(obj.textAnnotation) : null);
  const shape = (obj.type || obj.shape || 'orb').toLowerCase();

  const props = { 
    ...common, 
    x, y, cx: x, cy: y, 
    w, h, width: w, height: h, 
    r: w/2, rx: w/2, ry: h/2,
    color: obj.color, 
    label, 
    content,
    textAnnotation: sanitizedTextAnnotation,
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
      return <FreeformShape key={obj.id} {...props} type={shape} obj={obj} />;
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
  } = useTutorStore(useShallow(state => ({
    showNotes: state.showNotes,
    selectedElementIds: state.selectedElementIds,
    setSelectedElements: state.setSelectedElements,
    updateCanvasObject: state.updateCanvasObject,
    deleteCanvasObject: state.deleteCanvasObject,
    editingObjectId: state.editingObjectId,
    setEditingObjectId: state.setEditingObjectId,
    activeTool: state.activeTool,
    deltaState: state.deltaState
  })));
  
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
        
        // The D3 / AgentCanvasRenderer pipeline is the single source of truth for
        // scene rendering whenever a specialized renderer is active (D3, KaTeX,
        // Matter, etc.) — and it's the one that drives step-by-step animation.
        // Rendering the same timeline elements here double-drew every node/edge
        // and painted narrate objects as overlapping center text. So when
        // forceManualOnly is set (which is true for all D3/KaTeX/Specialized
        // scenes) SVGCanvasRenderer only handles manual annotations/notes.
        if (isTimeline && forceManualOnly) return false;
        
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
        {/* Cinematic SVG Filters */}
        <defs>
          <filter id="cinematic-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="edge-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <motion.g 
          animate={{ x: tx, y: ty, scale: Z }} 
          transition={{ duration: 0.75, ease: EASE }}
        >
            {/* Animated Connections Layer */}
            <g className="cinematic-connections">
              {connections.map(conn => {
                if (!conn?.from || !conn?.to) return null;
                const fromEl = worldElements.find(e => e.id === conn.from);
                const toEl = worldElements.find(e => e.id === conn.to);
                if (!fromEl || !toEl) return null;

                const x1 = (fromEl.x ?? 0.5) * CANVAS_WIDTH;
                const y1 = (fromEl.y ?? 0.5) * CANVAS_HEIGHT;
                const x2 = (toEl.x ?? 0.5) * CANVAS_WIDTH;
                const y2 = (toEl.y ?? 0.5) * CANVAS_HEIGHT;
                const edgeColor = conn.color || '#6366F180';
                const isAnimated = conn.animated !== false;
                const revealDelay = conn.revealDelay || 0;

                return (
                  <motion.g key={conn.id || `${conn.from}-${conn.to}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: revealDelay, duration: 0.6 }}
                  >
                    <motion.line
                      x1={x1} y1={y1} x2={x2} y2={y2}
                      stroke={edgeColor}
                      strokeWidth={conn.type === 'glow' ? 2.5 : 1.5}
                      strokeDasharray={conn.type === 'dashed' ? '6 4' : 'none'}
                      filter={conn.type === 'glow' ? 'url(#edge-glow)' : undefined}
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ delay: revealDelay, duration: 0.8, ease: 'easeOut' }}
                      markerEnd={conn.type !== 'bidirectional' ? undefined : undefined}
                    />
                    {/* Edge label */}
                    {conn.label && (
                      <text
                        x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6}
                        textAnchor="middle" fill="#94A3B8" fontSize={8} opacity={0.8}
                      >
                        {conn.label}
                      </text>
                    )}
                    {/* Animated flow particle */}
                    {isAnimated && (
                      <motion.circle
                        r={2.5} fill={edgeColor}
                        filter="url(#edge-glow)"
                        animate={{
                          cx: [x1, x2],
                          cy: [y1, y2],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: 'linear',
                          delay: revealDelay + 0.5,
                        }}
                      />
                    )}
                  </motion.g>
                );
              })}
            </g>

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
