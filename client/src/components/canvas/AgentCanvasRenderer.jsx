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
import DOMPurify from 'dompurify';
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
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../../constants/canvas';
const CW = CANVAS_WIDTH;
const CH = CANVAS_HEIGHT;
import FloatingFormatBar from './FloatingFormatBar.jsx';
import InlineEditor from './InlineEditor.jsx';
import PremiumTextBox from './PremiumTextBox.jsx';
import useTutorStore from '../../store/tutorStore.js';

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
    fontFamily:   obj.styles?.fontFamily || obj.fontFamily,
    fontWeight:   obj.styles?.fontWeight || obj.fontWeight,
    fontStyle:    obj.styles?.fontStyle || obj.fontStyle,
    textDecoration: obj.styles?.textDecoration || obj.textDecoration,
  };

  const x = (obj.x ?? 0.5) * CANVAS_WIDTH;
  const y = (obj.y ?? 0.5) * CANVAS_HEIGHT;
  const w = (obj.w ?? 0.2) * CANVAS_WIDTH;
  const h = (obj.h ?? 0.1) * CANVAS_HEIGHT;
  const label = obj.label ? DOMPurify.sanitize(obj.label) : null;
  const content = obj.content ? DOMPurify.sanitize(obj.content) : null;
  
  // Both `type` and `shape` are set by postProcessTimeline — prefer type
  const shape = (obj.type || obj.shape || 'orb').toLowerCase();

  switch (shape) {

    // ── Orbs / Circles ──────────────────────────────────────
    case 'circle':
    case 'orb':
    case 'node':
    case 'planet': {
      // Respect explicit world-unit radius if provided, else fallback to scale-based sizing
      const r = obj.r ? obj.r * CANVAS_WIDTH : (obj.scale || 1) * 38;
      return <GlowOrb key={obj.id} {...common} cx={x} cy={y}
        r={r} color={obj.color} label={label}
        isSelected={isSelected} onUpdate={(p) => onUpdate?.(obj.id, p)} onDelete={() => onDelete?.(obj.id)} />;
    }

    case 'rect':
    case 'block':
    case 'rectangle':
    case 'square':
    case 'box':
    case 'step_box':
    case 'flowstep_rect': {
      const rw = obj.w ? (obj.w <= 1 ? obj.w * CANVAS_WIDTH : obj.w) : (obj.scale || 1) * 160;
      const rh = obj.h ? (obj.h <= 1 ? obj.h * CANVAS_HEIGHT : obj.h) : (obj.scale || 1) * 58;
      return <GlassRect key={obj.id} {...common} x={x - rw / 2} y={y - rh / 2} w={rw} h={rh}
        color={obj.color} label={label} dashed={obj.dashed} fill={obj.fill}
        isSelected={isSelected} onUpdate={(p) => onUpdate?.(obj.id, p)} onDelete={() => onDelete?.(obj.id)} rotation={obj.rotation} />;}

    case 'ellipse':
    case 'oval': {
      const rx = obj.w ? (obj.w <= 1 ? (obj.w * CANVAS_WIDTH) / 2 : obj.w / 2) : (obj.scale || 1) * 40;
      const ry = obj.h ? (obj.h <= 1 ? (obj.h * CANVAS_HEIGHT) / 2 : obj.h / 2) : (obj.scale || 1) * 40;
      return <EllipseShape key={obj.id} {...common} x={x} y={y} w={rx * 2} h={ry * 2}
        color={obj.color} label={label} strokeStyle={obj.strokeStyle} fill={obj.fill}
        isSelected={isSelected} onUpdate={(p) => onUpdate?.(obj.id, p)} onDelete={() => onDelete?.(obj.id)} rotation={obj.rotation} />;}

    case 'note':
    case 'sticky':
    case 'sticky_note': {
      const nw = obj.w || (obj.scale || 1) * 180;
      const nh = obj.h || (obj.scale || 1) * 180;
      return (
        <StickyNoteShape 
          key={obj.id}
          {...common} 
          x={x} y={y} w={nw} h={nh}
          color={obj.color} label={label || content} 
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
      return <FlowPointer key={obj.id} {...common} x={x} y={y} color={obj.color} label={label}
        isSelected={isSelected} onUpdate={(p) => onUpdate?.(obj.id, p)} onDelete={() => onDelete?.(obj.id)} />;

    // ── Array / Data Block ──────────────────────────────────
    case 'array':
    case 'data_block':
    case 'datablock':
    case 'list':
      return <DataBlock key={obj.id} {...common} x={x} y={y}
        values={obj.values || []} label={label} color={obj.color}
        isSelected={isSelected} onUpdate={(p) => onUpdate?.(obj.id, p)} onDelete={() => onDelete?.(obj.id)} />;

    // ── Badge / Pill ─────────────────────────────────────────
    case 'badge':
    case 'tag':
    case 'chip':
      return <FloatingBadge key={obj.id} {...common} x={x} y={y} text={label || ''} color={obj.color}
        isSelected={isSelected} onUpdate={(p) => onUpdate?.(obj.id, p)} onDelete={() => onDelete?.(obj.id)} />;

    // ── Code Line ────────────────────────────────────────────
    case 'codeline':
    case 'code':
    case 'code_line':
      return <CodePanel key={obj.id} {...common} x={x} y={y} code={obj.code || label || ''}
        isSelected={isSelected} onUpdate={(p) => onUpdate?.(obj.id, p)} onDelete={() => onDelete?.(obj.id)} />;

    // ── Comparator ───────────────────────────────────────────
    case 'comparator':
    case 'compare':
      return <Comparator key={obj.id} {...common} x={x} y={y}
        leftVal={obj.leftVal} rightVal={obj.rightVal}
        operator={obj.operator} result={obj.result} color={obj.color}
        isSelected={isSelected} onUpdate={(p) => onUpdate?.(obj.id, p)} onDelete={() => onDelete?.(obj.id)} />;

    // ── Swap Bridge ──────────────────────────────────────────
    case 'swapbridge':
    case 'swap':
    case 'swap_bridge':
      return <SwapBridge key={obj.id} {...common} x={x} y={y} color={obj.color}
        isSelected={isSelected} onUpdate={(p) => onUpdate?.(obj.id, p)} onDelete={() => onDelete?.(obj.id)} />;

    // ── Data Dot ─────────────────────────────────────────────
    case 'dot':
    case 'point':
    case 'data_dot':
    case 'scatter_point':
      return <DataDot key={obj.id} {...common} x={x} y={y} color={obj.color} label={label}
        isSelected={isSelected} onUpdate={(p) => onUpdate?.(obj.id, p)} onDelete={() => onDelete?.(obj.id)} />;

    // ── Cartesian Axes ───────────────────────────────────────
    case 'axes':
    case 'plot':
    case 'cartesian':
    case 'graph_axes':
    case 'coordinate_system':
      return <CartesianAxes key={obj.id} {...common} x={x} y={y} color={obj.color} label={label}
        isSelected={isSelected} onUpdate={(p) => onUpdate?.(obj.id, p)} onDelete={() => onDelete?.(obj.id)} />;
    
    // ── LINE & ARROW ──────────────────────────────────────────
    case 'line':
    case 'arrow': {
      const x1 = (obj.x1 ?? 0.5) * CW;
      const y1 = (obj.y1 ?? 0.5) * CH;
      // Default to a 10% offset if coordinates are missing or identical
      const x2 = (obj.x2 ?? (obj.x1 ?? 0.5) + 0.1) * CW;
      const y2 = (obj.y2 ?? (obj.y1 ?? 0.5) + 0.1) * CH;
      const props = { ...common, x1, y1, x2, y2, color: obj.color, label: label, strokeStyle: obj.strokeStyle, isSelected, onUpdate: (p) => onUpdate?.(obj.id, p), onDelete: () => onDelete?.(obj.id) };
      return shape === 'line' ? <RawLine key={obj.id} {...props} /> : <FlowArrow key={obj.id} {...props} />;
    }

    // ── PATH / DRAWING ───────────────────────────────────────
    case 'path': {
      const isLaser = obj.isLaser || obj.id.includes('laser');
      const laserColor = '#fde047'; // Neon Yellow
      
      return (
        <motion.path
          key={obj.id}
          {...common}
          d={obj.path}
          fill="none"
          stroke={isLaser ? laserColor : (obj.color.startsWith('var') ? 'var(--text-primary)' : obj.color)}
          strokeWidth={obj.strokeWidth || 3}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false} // Disable redundant mounting animation
          animate={{ opacity: 1 }}
          style={{ 
            filter: isLaser ? `drop-shadow(0 0 4px ${laserColor})` : 'none',
            pointerEvents: 'auto'
          }}
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
        color={obj.color} label={label} strokeStyle={obj.strokeStyle}
        isSelected={isSelected} onUpdate={(p) => onUpdate?.(obj.id, p)} onDelete={() => onDelete?.(obj.id)} rotation={obj.rotation} />;
    }

    case 'diamond': {
      const w = obj.w ? (obj.w <= 1 ? obj.w * CW : obj.w) : (obj.scale || 1) * 160;
      const h = obj.h ? (obj.h <= 1 ? obj.h * CH : obj.h) : (obj.scale || 1) * 160;
      return <DiamondShape key={obj.id} {...common} x={x} y={y} w={w} h={h} color={obj.color} label={label} strokeStyle={obj.strokeStyle} fill={obj.fill}
        isSelected={isSelected} onUpdate={(p) => onUpdate?.(obj.id, p)} onDelete={() => onDelete?.(obj.id)} rotation={obj.rotation} />;
    }

    case 'star': {
      const w = obj.w ? (obj.w <= 1 ? obj.w * CW : obj.w) : (obj.scale || 1) * 160;
      const h = obj.h ? (obj.h <= 1 ? obj.h * CH : obj.h) : (obj.scale || 1) * 160;
      return <StarShape key={obj.id} {...common} x={x} y={y} w={w} h={h} color={obj.color} label={label} strokeStyle={obj.strokeStyle} fill={obj.fill}
        isSelected={isSelected} onUpdate={(p) => onUpdate?.(obj.id, p)} onDelete={() => onDelete?.(obj.id)} rotation={obj.rotation} />;
    }

    case 'hexagon': {
      const w = obj.w ? (obj.w <= 1 ? obj.w * CW : obj.w) : (obj.scale || 1) * 160;
      const h = obj.h ? (obj.h <= 1 ? obj.h * CH : obj.h) : (obj.scale || 1) * 160;
      return <HexagonShape key={obj.id} {...common} x={x} y={y} w={w} h={h} color={obj.color} label={label} strokeStyle={obj.strokeStyle} fill={obj.fill}
        isSelected={isSelected} onUpdate={(p) => onUpdate?.(obj.id, p)} onDelete={() => onDelete?.(obj.id)} rotation={obj.rotation} />;
    }

    case 'callout':
    case 'speech': {
      const w = obj.w ? (obj.w <= 1 ? obj.w * CW : obj.w) : (obj.scale || 1) * 180;
      const h = obj.h ? (obj.h <= 1 ? obj.h * CH : obj.h) : (obj.scale || 1) * 120;
      return <CalloutShape key={obj.id} {...common} x={x} y={y} w={w} h={h} color={obj.color} label={label} strokeStyle={obj.strokeStyle} fill={obj.fill}
        isSelected={isSelected} onUpdate={(p) => onUpdate?.(obj.id, p)} onDelete={() => onDelete?.(obj.id)} rotation={obj.rotation} />;
    }

    case 'cloud': {
      const w = obj.w ? (obj.w <= 1 ? obj.w * CW : obj.w) : (obj.scale || 1) * 200;
      const h = obj.h ? (obj.h <= 1 ? obj.h * CH : obj.h) : (obj.scale || 1) * 140;
      return <CloudShape key={obj.id} {...common} x={x} y={y} w={w} h={h} color={obj.color} label={label} strokeStyle={obj.strokeStyle} fill={obj.fill}
        isSelected={isSelected} onUpdate={(p) => onUpdate?.(obj.id, p)} onDelete={() => onDelete?.(obj.id)} rotation={obj.rotation} />;
    }

    // ── EQUATION (NEW) ───────────────────────────────────────
    case 'equation':
    case 'formula':
    case 'math':
    case 'expression':
    case 'term':
      return <EquationBlock key={obj.id} {...common} x={x} y={y} label={label} color={obj.color} />;

    // ── TREE NODE (NEW) ──────────────────────────────────────
    case 'tree_node':
    case 'tree':
    case 'graph_node':
    case 'vertex':
    case 'bst_node':
      return <TreeNode key={obj.id} {...common} x={x} y={y} label={label} color={obj.color} />;

    // ── BAR (NEW) ────────────────────────────────────────────
    case 'bar':
    case 'column':
    case 'histogram_bar':
    case 'bar_element':
      return <BarShape key={obj.id} {...common} x={x} y={y}
        label={label} color={obj.color} scale={obj.scale || 1} />;

    // ── VENN CIRCLE (NEW) ────────────────────────────────────
    case 'venn':
    case 'venn_circle':
    case 'set_circle':
    case 'set':
      return <VennCircle key={obj.id} {...common} x={x} y={y}
        label={label} color={obj.color} scale={obj.scale || 1} />;

    // ── FLOW STEP (NEW) ──────────────────────────────────────
    case 'flowstep':
    case 'flow_step':
    case 'process_step':
    case 'pipeline_step':
    case 'stage':
      return <FlowStep key={obj.id} {...common} x={x} y={y} label={label} color={obj.color} fontSize={obj.fontSize} />;

    // ── MOLECULE (NEW) ───────────────────────────────────────
    case 'molecule':
    case 'atom':
    case 'chemical':
    case 'compound':
    case 'ion':
      return <MoleculeNode key={obj.id} {...common} x={x} y={y} label={label} color={obj.color} />;

    case 'label':
    case 'text':
    case 'annotation':
    case 'caption':
      return (
        <PremiumTextBox 
          key={obj.id} 
          obj={obj} 
          {...common} 
          isSelected={isSelected}
          onUpdate={(p) => onUpdate?.(obj.id, p)}
          onDelete={() => onDelete?.(obj.id)}
        />
      );

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
        color={obj.color} label={label} type={shape} />;
  }
}

// ─── SVG Canvas Renderer ──────────────────────────────────────────────────────
function SVGCanvasRenderer({ 
  timeline, currentStepIndex, 
  elements: extElements, objects: extObjects, 
  connections: extConnections, steps: extSteps,
  showNotes: propShowNotes 
}) {
  const { 
    showNotes: storeShowNotes = true, 
    activeTool, 
    selectedElementIds, 
    setSelectedElements, 
    updateCanvasObject, 
    deleteCanvasObject,
    editingObjectId,
    setEditingObjectId,
    isSidebarOpen
  } = useTutorStore();
  
  const showNotes = propShowNotes !== undefined ? propShowNotes : storeShowNotes;

  // Merge ALL sources from Props
  const rawElements = useMemo(() => {
    const timelineEls = timeline?.elements || timeline?.objects || [];
    return [...(extElements || extObjects || []), ...timelineEls];
  }, [extElements, extObjects, timeline]);

  const connections  = extConnections  || timeline?.connections || [];
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
    // ── DE-DUPLICATION SAFETY ──
    const uniqueMap = new Map();
    rawElements.forEach((el, idx) => {
      if (!el) return;
      const key = el.id || `el-${idx}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, el);
      }
    });
    const dedupedRaw = Array.from(uniqueMap.values());

    let finalElements = dedupedRaw
      .filter(el => {
        if (!el?.id) return false;
        // Keep it if it's a manual user addition OR it's listed in the current step
        return el.id.startsWith('manual-') || el.id.startsWith('laser-') || stepObjectIds.has(el.id);
      })
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

  const worldElements = useMemo(() => elements.filter(el => !el.isPinned && !el.pinned), [elements]);
  const pinnedElements = useMemo(() => elements.filter(el => el.isPinned || el.pinned), [elements]);

  const { highlightIds, fadeIds, camera } = useStepDirector(worldElements, timelineSteps, currentStepIndex);
  
  if (!elements.length) return null;

  const Z  = camera.zoom;
  const tx = CW / 2 - camera.x * Z;
  const ty = CH / 2 - camera.y * Z;

  const stepNarration = DOMPurify.sanitize(currentStep.narration || currentStep.explanation || '');
  const stepTitle     = DOMPurify.sanitize(currentStep.title || '');
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
          <span className="text-xs font-mono text-[var(--text-tertiary)] tabular-nums">
            {totalSteps > 0 ? `${stepNumber}/${totalSteps}` : ''}
          </span>
          <span className="text-sm font-semibold text-[var(--text-secondary)] max-w-[540px] truncate">
            {stepTitle}
          </span>
        </motion.div>
      </AnimatePresence>

      {/* Main SVG canvas */}
      <svg
        width="100%" height="100%"
        viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
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
                x1:           (fromEl.x ?? 0.5) * CANVAS_WIDTH,
                y1:           (fromEl.y ?? 0.5) * CANVAS_HEIGHT,
                x2:           (toEl.x   ?? 0.5) * CANVAS_WIDTH,
                y2:           (toEl.y   ?? 0.5) * CANVAS_HEIGHT,
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

          {/* World Elements */}
          <AnimatePresence mode="popLayout">
            {worldElements.filter(o => o.id !== editingObjectId || ['text', 'label', 'annotation', 'caption'].includes(o.type)).map(obj => {
              const isSelected = selectedElementIds?.includes(obj.id);
              
              if (obj.type === 'text' || obj.type === 'label' || obj.type === 'annotation' || obj.type === 'caption') {
                return (
                  <ErrorBoundary key={obj.id} onClose={() => {}} reloadOnRetry={true}>
                    <PremiumTextBox 
                      obj={obj}
                      isSelected={isSelected}
                      onUpdate={updateCanvasObject}
                      onDelete={deleteCanvasObject}
                    />
                  </ErrorBoundary>
                );
              }

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
                        e.stopPropagation();
                        setSelectedElements([obj.id]);
                        if (activeTool !== 'select') {
                           useTutorStore.getState().setActiveTool('select');
                        }
                      }
                    }}
                    style={{ cursor: activeTool === 'fill' ? 'copy' : 'move' }}
                  >
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

        {/* Pinned / HUD Elements (Fixed to Viewport) */}
        <g>
          <AnimatePresence mode="popLayout">
            {pinnedElements.filter(o => o.id !== editingObjectId || ['text', 'label', 'annotation', 'caption'].includes(o.type)).map(obj => {
              const isSelected = selectedElementIds?.includes(obj.id);
              return (
                <ErrorBoundary key={obj.id} onClose={() => {}} reloadOnRetry={true}>
                  <g 
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingObjectId(obj.id);
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setSelectedElements([obj.id]);
                    }}
                    style={{ cursor: 'default' }}
                  >
                    <RenderShape
                      obj={obj}
                      highlightIds={highlightIds}
                      fadeIds={fadeIds}
                      animation={{ type: 'fade', duration: 0.3 }}
                      isSelected={isSelected}
                      onUpdate={updateCanvasObject}
                      onDelete={deleteCanvasObject}
                    />
                  </g>
                </ErrorBoundary>
              );
            })}
          </AnimatePresence>
        </g>
      </svg>

      {/* Inline Editing Overlay */}
      {editingObjectId && (
        <InlineEditor 
          elements={rawElements}
          editingObjectId={editingObjectId}
          Z={Z} tx={tx} ty={ty}
        />
      )}
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function AgentCanvasRenderer({
  timeline, currentStepIndex,
  elements: extElements, objects: extObjects, 
  connections: extConnections, steps: extSteps,
  showNotes,
}) {
  const elements = extElements || extObjects || [];
  const renderer = timeline?.renderer || 'cinematic';

  const normalizedTimeline = {
    ...timeline,
    elements: elements.length ? elements : (timeline?.elements || timeline?.objects || []),
    connections: extConnections || timeline?.connections || [],
    timeline:    extSteps || timeline?.timeline || timeline?.steps || [],
  };


  return (
    <ErrorBoundary key={`canvas-${currentStepIndex}`} onClose={() => {}} reloadOnRetry={true}>
      <SVGCanvasRenderer
        timeline={normalizedTimeline}
        currentStepIndex={currentStepIndex}
        elements={elements}
        connections={extConnections}
        steps={extSteps}
        showNotes={showNotes}
      />
    </ErrorBoundary>
  );
}