/**
 * AgentCanvasRenderer v4.0 — Universal Cinematic Scene Graph Renderer
 *
 * NEW in v4:
 *  - All new shape types from CinematicShapes v3 are wired in:
 *    equation, tree_node, bar, venn, flowstep, molecule, label
 *  - Step narration overlay at bottom of canvas
 *  - Step title display at top
 *  - Smooth camera choreography between steps
 *  - Richer default behavior when objectIds is empty
 */

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ErrorBoundary from '../common/ErrorBoundary.jsx';
import {
  GlowOrb, GlassRect, GlassEllipse, FlowArrow, DataBlock,
  FlowPointer, CodePanel, FloatingBadge,
  Comparator, SwapBridge, CinematicFilters, FreeformShape,
  DataDot, CartesianAxes, GeometryPolygon, RawLine,
  // NEW shapes v3
  EquationBlock, TreeNode, BarShape, VennCircle,
  FlowStep, MoleculeNode, LabelText, StickyNoteShape,
  EllipseShape, DiamondShape, StarShape, HexagonShape, CalloutShape, CloudShape
} from '../renderers/CinematicShapes.jsx';
import PhysicsRenderer from '../renderers/PhysicsRenderer.jsx';
import NarrativeRenderer from '../renderers/NarrativeRenderer.jsx';
import FloatingFormatBar from './FloatingFormatBar.jsx';
import InlineEditor from './InlineEditor.jsx';
import useTutorStore from '../../store/tutorStore.js';

const CW = 800;
const CH = 600;
const EASE = [0.16, 1, 0.3, 1];

// ─── Camera Director ──────────────────────────────────────────────────────────
function useStepDirector(elements, timelineSteps, currentStepIndex) {
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
    const fadeIds      = new Set(step.fade || step.fadeIds || []);
    const cf           = step.cameraFocus;
    const camera = {
      x:    (cf?.x    ?? 0.5) * CW,
      y:    (cf?.y    ?? 0.5) * CH,
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
    fontFamily:   obj.styles?.fontFamily || obj.fontFamily,
    fontWeight:   obj.styles?.fontWeight || obj.fontWeight,
    fontStyle:    obj.styles?.fontStyle || obj.fontStyle,
    textDecoration: obj.styles?.textDecoration || obj.textDecoration,
  };

  const x = (obj.x ?? 0.5) * CW;
  const y = (obj.y ?? 0.5) * CH;
  // Both `type` and `shape` are set by postProcessTimeline — prefer type
  const shape = (obj.type || obj.shape || 'orb').toLowerCase();

  switch (shape) {

    // ── Orbs / Circles ──────────────────────────────────────
    case 'circle':
    case 'orb':
    case 'node':
    case 'planet': {
      // Respect explicit world-unit radius if provided, else fallback to scale-based sizing
      const r = obj.r ? obj.r * CW : (obj.scale || 1) * 38;
      return <GlowOrb key={obj.id} {...common} cx={x} cy={y}
        r={r} color={obj.color} label={obj.label} />;
    }

    case 'rect':
    case 'block':
    case 'rectangle':
    case 'square':
    case 'box':
    case 'step_box':
    case 'flowstep_rect': {
      const w = obj.w ? (obj.w <= 1 ? obj.w * CW : obj.w) : (obj.scale || 1) * 160;
      const h = obj.h ? (obj.h <= 1 ? obj.h * CH : obj.h) : (obj.scale || 1) * 58;
      return <GlassRect key={obj.id} {...common} x={x - w / 2} y={y - h / 2} w={w} h={h}
        color={obj.color} label={obj.label} dashed={obj.dashed} fill={obj.fill}
        isSelected={isSelected} onUpdate={(p) => onUpdate?.(obj.id, p)} onDelete={() => onDelete?.(obj.id)} rotation={obj.rotation} />;}

    case 'ellipse':
    case 'oval': {
      const rx = obj.w ? (obj.w <= 1 ? (obj.w * CW) / 2 : obj.w / 2) : (obj.scale || 1) * 40;
      const ry = obj.h ? (obj.h <= 1 ? (obj.h * CH) / 2 : obj.h / 2) : (obj.scale || 1) * 40;
      return <EllipseShape key={obj.id} {...common} x={x} y={y} w={rx * 2} h={ry * 2}
        color={obj.color} label={obj.label} dashed={obj.dashed}
        isSelected={isSelected} onUpdate={(p) => onUpdate?.(obj.id, p)} onDelete={() => onDelete?.(obj.id)} rotation={obj.rotation} />;}

    case 'note':
    case 'sticky':
    case 'sticky_note': {
      const w = obj.w || (obj.scale || 1) * 180;
      const h = obj.h || (obj.scale || 1) * 180;
      return (
        <StickyNoteShape 
          key={obj.id}
          {...common} 
          x={x} y={y} w={w} h={h}
          color={obj.color} label={obj.label || obj.text} 
          rotation={obj.rotation}
          isSelected={isSelected}
          onUpdate={(props) => onUpdate && onUpdate(obj.id, props)}
          onDelete={() => onDelete && onDelete(obj.id)}
        />
      );
    }

    // ── Pointer / Cursor ────────────────────────────────────
    case 'pointer':
    case 'cursor':
    case 'index':
      return <FlowPointer key={obj.id} {...common} x={x} y={y} color={obj.color} label={obj.label} />;

    // ── Array / Data Block ──────────────────────────────────
    case 'array':
    case 'data_block':
    case 'datablock':
    case 'list':
      return <DataBlock key={obj.id} {...common} x={x} y={y}
        values={obj.values || []} label={obj.label} color={obj.color} />;

    // ── Badge / Pill ─────────────────────────────────────────
    case 'badge':
    case 'tag':
    case 'chip':
      return <FloatingBadge key={obj.id} {...common} x={x} y={y} text={obj.label || ''} color={obj.color} />;

    // ── Code Line ────────────────────────────────────────────
    case 'codeline':
    case 'code':
    case 'code_line':
      return <CodePanel key={obj.id} {...common} x={x} y={y} code={obj.code || obj.label || ''} />;

    // ── Comparator ───────────────────────────────────────────
    case 'comparator':
    case 'compare':
      return <Comparator key={obj.id} {...common} x={x} y={y}
        leftVal={obj.leftVal} rightVal={obj.rightVal}
        operator={obj.operator} result={obj.result} color={obj.color} />;

    // ── Swap Bridge ──────────────────────────────────────────
    case 'swapbridge':
    case 'swap':
    case 'swap_bridge':
      return <SwapBridge key={obj.id} {...common} x={x} y={y} color={obj.color} />;

    // ── Data Dot ─────────────────────────────────────────────
    case 'dot':
    case 'point':
    case 'data_dot':
    case 'scatter_point':
      return <DataDot key={obj.id} {...common} x={x} y={y} color={obj.color} label={obj.label} />;

    // ── Cartesian Axes ───────────────────────────────────────
    case 'axes':
    case 'plot':
    case 'cartesian':
    case 'graph_axes':
    case 'coordinate_system':
      return <CartesianAxes key={obj.id} {...common} x={x} y={y} color={obj.color} label={obj.label} />;
    
    // ── LINE & ARROW ──────────────────────────────────────────
    case 'line':
    case 'arrow': {
      const x1 = (obj.x1 ?? 0.5) * CW;
      const y1 = (obj.y1 ?? 0.5) * CH;
      // Default to a 10% offset if coordinates are missing or identical
      const x2 = (obj.x2 ?? (obj.x1 ?? 0.5) + 0.1) * CW;
      const y2 = (obj.y2 ?? (obj.y1 ?? 0.5) + 0.1) * CH;
      const props = { ...common, x1, y1, x2, y2, color: obj.color, label: obj.label, dashed: obj.dashed };
      return shape === 'line' ? <RawLine key={obj.id} {...props} /> : <FlowArrow key={obj.id} {...props} />;
    }

    // ── PATH / DRAWING ───────────────────────────────────────
    case 'path': {
      return (
        <motion.path
          key={obj.id}
          {...common}
          d={obj.path}
          fill="none"
          stroke={obj.color.startsWith('var') ? 'var(--text-primary)' : obj.color}
          strokeWidth={obj.strokeWidth || 3}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="pointer-events-auto"
        />
      );
    }

    // ── Polygon / Triangle / Shape ───────────────────────────
    case 'polygon':
    case 'triangle':
    case 'shape':
    case 'geometry': {
      const pts = (obj.points || []).map(p => [
        (p[0] ?? 0) * CW - x,
        (p[1] ?? 0) * CH - y,
      ]);
      return <GeometryPolygon key={obj.id} {...common} x={x} y={y}
        points={pts.length > 2 ? pts : [[-60, 80], [60, 80], [0, -80]]}
        color={obj.color} label={obj.label} dashed={obj.dashed}
        isSelected={isSelected} onUpdate={(p) => onUpdate?.(obj.id, p)} onDelete={() => onDelete?.(obj.id)} rotation={obj.rotation} />;
    }

    case 'diamond': {
      const w = obj.w ? (obj.w <= 1 ? obj.w * CW : obj.w) : (obj.scale || 1) * 160;
      const h = obj.h ? (obj.h <= 1 ? obj.h * CH : obj.h) : (obj.scale || 1) * 160;
      return <DiamondShape key={obj.id} {...common} x={x} y={y} w={w} h={h} color={obj.color} label={obj.label} dashed={obj.dashed}
        isSelected={isSelected} onUpdate={(p) => onUpdate?.(obj.id, p)} onDelete={() => onDelete?.(obj.id)} rotation={obj.rotation} />;
    }

    case 'star': {
      const w = obj.w ? (obj.w <= 1 ? obj.w * CW : obj.w) : (obj.scale || 1) * 160;
      const h = obj.h ? (obj.h <= 1 ? obj.h * CH : obj.h) : (obj.scale || 1) * 160;
      return <StarShape key={obj.id} {...common} x={x} y={y} w={w} h={h} color={obj.color} label={obj.label} dashed={obj.dashed}
        isSelected={isSelected} onUpdate={(p) => onUpdate?.(obj.id, p)} onDelete={() => onDelete?.(obj.id)} rotation={obj.rotation} />;
    }

    case 'hexagon': {
      const w = obj.w ? (obj.w <= 1 ? obj.w * CW : obj.w) : (obj.scale || 1) * 160;
      const h = obj.h ? (obj.h <= 1 ? obj.h * CH : obj.h) : (obj.scale || 1) * 160;
      return <HexagonShape key={obj.id} {...common} x={x} y={y} w={w} h={h} color={obj.color} label={obj.label} dashed={obj.dashed}
        isSelected={isSelected} onUpdate={(p) => onUpdate?.(obj.id, p)} onDelete={() => onDelete?.(obj.id)} rotation={obj.rotation} />;
    }

    case 'callout':
    case 'speech': {
      const w = obj.w ? (obj.w <= 1 ? obj.w * CW : obj.w) : (obj.scale || 1) * 180;
      const h = obj.h ? (obj.h <= 1 ? obj.h * CH : obj.h) : (obj.scale || 1) * 120;
      return <CalloutShape key={obj.id} {...common} x={x} y={y} w={w} h={h} color={obj.color} label={obj.label} dashed={obj.dashed}
        isSelected={isSelected} onUpdate={(p) => onUpdate?.(obj.id, p)} onDelete={() => onDelete?.(obj.id)} rotation={obj.rotation} />;
    }

    case 'cloud': {
      const w = obj.w ? (obj.w <= 1 ? obj.w * CW : obj.w) : (obj.scale || 1) * 200;
      const h = obj.h ? (obj.h <= 1 ? obj.h * CH : obj.h) : (obj.scale || 1) * 140;
      return <CloudShape key={obj.id} {...common} x={x} y={y} w={w} h={h} color={obj.color} label={obj.label} dashed={obj.dashed}
        isSelected={isSelected} onUpdate={(p) => onUpdate?.(obj.id, p)} onDelete={() => onDelete?.(obj.id)} rotation={obj.rotation} />;
    }

    // ── EQUATION (NEW) ───────────────────────────────────────
    case 'equation':
    case 'formula':
    case 'math':
    case 'expression':
    case 'term':
      return <EquationBlock key={obj.id} {...common} x={x} y={y} label={obj.label} color={obj.color} />;

    // ── TREE NODE (NEW) ──────────────────────────────────────
    case 'tree_node':
    case 'tree':
    case 'graph_node':
    case 'vertex':
    case 'bst_node':
      return <TreeNode key={obj.id} {...common} x={x} y={y} label={obj.label} color={obj.color} />;

    // ── BAR (NEW) ────────────────────────────────────────────
    case 'bar':
    case 'column':
    case 'histogram_bar':
    case 'bar_element':
      return <BarShape key={obj.id} {...common} x={x} y={y}
        label={obj.label} color={obj.color} scale={obj.scale || 1} />;

    // ── VENN CIRCLE (NEW) ────────────────────────────────────
    case 'venn':
    case 'venn_circle':
    case 'set_circle':
    case 'set':
      return <VennCircle key={obj.id} {...common} x={x} y={y}
        label={obj.label} color={obj.color} scale={obj.scale || 1} />;

    // ── FLOW STEP (NEW) ──────────────────────────────────────
    case 'flowstep':
    case 'flow_step':
    case 'process_step':
    case 'pipeline_step':
    case 'stage':
      return <FlowStep key={obj.id} {...common} x={x} y={y} label={obj.label} color={obj.color} fontSize={obj.fontSize} />;

    // ── MOLECULE (NEW) ───────────────────────────────────────
    case 'molecule':
    case 'atom':
    case 'chemical':
    case 'compound':
    case 'ion':
      return <MoleculeNode key={obj.id} {...common} x={x} y={y} label={obj.label} color={obj.color} />;

    case 'label':
    case 'text':
    case 'annotation':
    case 'caption':
      return <LabelText key={obj.id} {...common} x={x} y={y} label={obj.label} color={obj.color} fontSize={obj.fontSize} />;

    // ── IMAGE (NEW) ──────────────────────────────────────────
    case 'image': {
      const w = (obj.scale || 1) * 200;
      const h = (obj.scale || 1) * 200;
      return (
        <motion.image 
          key={obj.id}
          {...common}
          href={obj.url}
          x={x - w / 2}
          y={y - h / 2}
          width={w}
          height={h}
          preserveAspectRatio="xMidYMid slice"
          style={{ 
            clipPath: 'inset(0% round 12px)',
            filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.15))'
          }}
        />
      );
    }

    // ── DEFAULT FALLBACK ─────────────────────────────────────
    default:
      return <FreeformShape key={obj.id} {...common} x={x} y={y}
        color={obj.color} label={obj.label} type={shape} />;
  }
}

// ─── SVG Canvas Renderer ──────────────────────────────────────────────────────
function SVGCanvasRenderer({ timeline, currentStepIndex, elements: extEl, connections: extConn, steps: extSteps }) {
  const { 
    showNotes = true, 
    activeTool, 
    selectedElementIds, 
    setSelectedElements, 
    updateCanvasObject, 
    deleteCanvasObject,
    editingObjectId,
    setEditingObjectId
  } = useTutorStore();
  
  // Merge ALL sources from Props
  const rawElements = useMemo(() => {
    const timelineEls = timeline?.elements || timeline?.objects || [];
    return [...(extEl || []), ...timelineEls];
  }, [extEl, timeline]);

  const connections  = extConn  || timeline?.connections || [];
  const timelineSteps= extSteps || timeline?.timeline    || timeline?.steps   || [];
  const currentStep  = timelineSteps?.[currentStepIndex] || {};

  // Visibility filtering: only render elements listed in objectIds OR pinned elements
  const stepObjectIds = useMemo(() => {
    const ids = currentStep.objectIds || currentStep.elements || [];
    const baseSet = new Set(ids);
    
    // Always include Pinned objects (Step 6: "Visible across pages")
    // and custom user-created objects
    rawElements.forEach(el => {
      if (el?.isPinned || el?.pinned || el?.id?.startsWith?.('custom-') || el?.id?.startsWith?.('manual-')) {
        baseSet.add(el.id);
      }
    });

    // If empty (no AI IDs and no custom IDs), show ALL elements (graceful fallback)
    return baseSet.size > 0 ? baseSet : new Set(rawElements.map(e => e?.id).filter(Boolean));
  }, [currentStep, rawElements]);

  // Mutation application: per-step property overrides
  const elements = useMemo(() => {
    let finalElements = rawElements
      .filter(el => el?.id && stepObjectIds.has(el.id))
      .map(el => {
        const mutation = (currentStep.mutations || []).find(m => m.id === el.id);
        return mutation ? { ...el, ...mutation.props } : el;
      });

    // Enforce Show/Hide Notes toggle
    if (!showNotes) {
      finalElements = finalElements.filter(el => el.type !== 'sticky' && el.type !== 'note' && el.type !== 'sticky_note');
    }
    
    return finalElements;
  }, [rawElements, stepObjectIds, currentStep.mutations, showNotes]);

  const { highlightIds, fadeIds, camera } = useStepDirector(elements, timelineSteps, currentStepIndex);
  
  if (!elements.length) return null;

  const Z  = camera.zoom;
  const tx = CW / 2 - camera.x * Z;
  const ty = CH / 2 - camera.y * Z;

  const stepNarration = currentStep.narration || currentStep.explanation || '';
  const stepTitle     = currentStep.title || '';
  const stepNumber    = currentStepIndex + 1;
  const totalSteps    = timelineSteps.length;

  return (
    <div className="relative w-[800px] h-[600px] overflow-visible select-none">
      {/* Step title */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`title-${currentStepIndex}`}
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35 }}
          className="absolute top-4 left-0 right-0 flex items-center justify-center gap-3 pointer-events-none z-10"
        >
          <span className="text-xs font-mono text-slate-500 tabular-nums">
            {totalSteps > 0 ? `${stepNumber}/${totalSteps}` : 'Canvas'}
          </span>
          <span className="text-sm font-semibold text-slate-300 max-w-[540px] truncate">
            {stepTitle}
          </span>
        </motion.div>
      </AnimatePresence>

      {/* Main SVG canvas */}
      <svg
        width="100%" height="100%"
        viewBox={`0 0 ${CW} ${CH}`}
        preserveAspectRatio="xMidYMid meet"
        className="block overflow-visible pointer-events-none"
      >
        <CinematicFilters />

        {/* Camera layer */}
        <motion.g
          animate={{ x: tx, y: ty, scale: Z }}
          transition={{ duration: 0.75, ease: EASE }}
        >
          {/* Connections (behind elements) */}
          <g>
            {connections.map((conn, idx) => {
              const fromEl = rawElements.find(e => e.id === conn.from);
              const toEl   = rawElements.find(e => e.id === conn.to);
              if (!fromEl || !toEl) return null;

              const isHigh  = highlightIds.has(fromEl.id) || highlightIds.has(toEl.id);
              const isFaded = fadeIds.has(fromEl.id) && fadeIds.has(toEl.id);

              // Only render connections if both endpoints are visible
              if (!stepObjectIds.has(fromEl.id) || !stepObjectIds.has(toEl.id)) return null;

              const connProps = {
                key:          `c-${conn.from}-${conn.to}-${idx}`,
                layoutId:     `c-${conn.from}-${conn.to}`,
                x1:           (fromEl.x ?? 0.5) * CW,
                y1:           (fromEl.y ?? 0.5) * CH,
                x2:           (toEl.x   ?? 0.5) * CW,
                y2:           (toEl.y   ?? 0.5) * CH,
                attentionLevel: isHigh ? 2 : isFaded ? 0 : 1,
                label:        conn.label,
                color:        conn.color || fromEl.color,
                dashed:       conn.dashed,
              };

              return conn.type === 'line'
                ? <RawLine {...connProps} />
                : <FlowArrow {...connProps} />;
            })}
          </g>

          {/* Elements */}
          <AnimatePresence mode="popLayout">
            {elements.map(obj => {
              const isSelected = selectedElementIds?.includes(obj.id);
              return (
                <ErrorBoundary key={obj.id} onClose={() => {}} reloadOnRetry={true}>
                  <g 
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingObjectId(obj.id);
                    }}
                    onPointerDown={(e) => {
                      if (activeTool === 'fill') {
                        e.stopPropagation();
                        const currentDrawColor = useTutorStore.getState().drawColor;
                        updateCanvasObject(obj.id, { color: currentDrawColor, fill: 'glass' });
                      } else {
                        // Always allow selecting the shape first, even if not explicitly in select mode!
                        e.stopPropagation();
                        setSelectedElements([obj.id]);
                        // Optional: switch to select tool automatically to avoid accidental drawing
                        if (activeTool !== 'select') {
                           useTutorStore.getState().setActiveTool('select');
                        }
                      }
                    }}
                    style={{ cursor: activeTool === 'fill' ? 'copy' : 'move' }}
                  >
                    {/* Selection Highlight Ring */}
                    {isSelected && (
                      <rect 
                        x={(obj.x * CW) - ((obj.scale || 1) * 90)} 
                        y={(obj.y * CH) - ((obj.scale || 1) * 40)} 
                        width={(obj.scale || 1) * 180} 
                        height={(obj.scale || 1) * 80} 
                        fill="none" 
                        stroke="#3b82f6" 
                        strokeWidth={2} 
                        strokeDasharray="4 4" 
                        rx={8}
                        className="pointer-events-none"
                      />
                    )}
                    <RenderShape
                      obj={obj}
                      highlightIds={highlightIds}
                      fadeIds={fadeIds}
                      animation={currentStep.animation}
                      isSelected={isSelected}
                      onUpdate={updateCanvasObject}
                      onDelete={deleteCanvasObject}
                    />
                  </g>
                </ErrorBoundary>
              );
            })}
          </AnimatePresence>
        </motion.g>
      </svg>

      {/* Inline Editing Overlay */}
      {editingObjectId && (
        <InlineEditor 
          elements={elements}
          editingObjectId={editingObjectId}
          Z={Z} tx={tx} ty={ty}
        />
      )}

      {/* Step narration bar */}
      <AnimatePresence mode="wait">
        {stepNarration && (
          <motion.div
            key={`narr-${currentStepIndex}`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="absolute bottom-6 left-8 right-8 pointer-events-none"
          >
            <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/60 rounded-xl px-5 py-3 text-center">
              <p className="text-sm text-slate-200 leading-relaxed font-medium">
                {stepNarration}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function AgentCanvasRenderer({
  timeline, currentStepIndex,
  elements: extElements, objects: extObjects, 
  connections: extConnections, steps: extSteps,
}) {
  const elements = extElements || extObjects || [];
  const renderer = timeline?.renderer || 'cinematic';

  const normalizedTimeline = {
    ...timeline,
    elements: elements.length ? elements : (timeline?.elements || timeline?.objects || []),
    connections: extConnections || timeline?.connections || [],
    timeline:    extSteps || timeline?.timeline || timeline?.steps || [],
  };

  if (renderer === 'physics') {
    return <PhysicsRenderer timeline={normalizedTimeline} currentStepIndex={currentStepIndex} />;
  }

  if (renderer === 'narrative') {
    return <NarrativeRenderer timeline={normalizedTimeline} currentStepIndex={currentStepIndex} />;
  }

  return (
    <ErrorBoundary key={`canvas-${currentStepIndex}`} onClose={() => {}} reloadOnRetry={true}>
      <SVGCanvasRenderer
        timeline={normalizedTimeline}
        currentStepIndex={currentStepIndex}
        elements={elements}
        connections={extConnections}
        steps={extSteps}
      />
    </ErrorBoundary>
  );
}