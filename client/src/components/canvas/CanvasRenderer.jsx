/**
 * CanvasRenderer v7.0 — Universal Cinematic Visualization Engine
 *
 * All 5 systems active in the render pipeline:
 *
 *  1. BehaviorIntelligence  — every object has live, domain-aware behavior
 *  2. NarrativeSync         — step narration drives animation emphasis
 *  3. AttentionSystem       — 1-3 dominant objects, rest fade
 *  4. CameraDirector        — auto-pan/zoom to focus per step
 *  5. 3-Layer Animations    — spring entry, micro-interaction, cinematic glow
 *
 * Shape types: circle/orb, rect/box, arrow/connector, array, pointer,
 *              swapbridge, comparator, codeline, badge, text/label,
 *              path, line, arc, highlightbox, orbit
 */

import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import {
  GlowOrb, GlassRect, FlowArrow, DataBlock, FlowPointer,
  SwapBridge, Comparator, CodePanel, FloatingBadge,
  DepthText, WavePath, ArcPath, HighlightZone,
  SimpleLine, OrbitBody,
} from '../renderers/CinematicShapes.jsx';

import animEngine from '../../engine/UniversalAnimationEngine.js';
import stepOrchestrator from '../../engine/StepOrchestrator.js';
import cameraDirector from '../../engine/CameraDirector.js';
import { analyzeNarration, classifyAttention } from '../../engine/BehaviorIntelligence.js';
import { EASE_CINEMATIC } from '../../engine/animationPresets.js';

// ─── Constants ───────────────────────────────────────────────────────────────
const CW = 800;
const CH = 600;
const safeNum = (v, d = 0) => { const n = parseFloat(v); return isNaN(n) ? d : n; };

// ─── SVG Filter Library ──────────────────────────────────────────────────────

const CinematicFilters = () => (
  <defs>
    {/* ── Bloom — primary neon glow */}
    <filter id="tb-neon-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
      <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>

    {/* ── Depth shadow */}
    <filter id="tb-drop-shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#000" floodOpacity="0.55"/>
    </filter>

    {/* ── Intense highlight bloom */}
    <filter id="tb-highlight-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="10" result="glow"/>
      <feMerge><feMergeNode in="glow"/><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>

    {/* ── Dominant object glow (extra strong) */}
    <filter id="tb-dominant-glow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="12" result="b1"/>
      <feGaussianBlur stdDeviation="6"  result="b2" in="SourceGraphic"/>
      <feMerge><feMergeNode in="b1"/><feMergeNode in="b2"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>

    {/* ── Background fade */}
    <filter id="tb-fade-filter">
      <feColorMatrix type="saturate" values="0.35"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.38"/></feComponentTransfer>
    </filter>

    {/* ── Supporting object soft glow */}
    <filter id="tb-soft-glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="3" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>

    {/* ── Ambient canvas glow */}
    <radialGradient id="tb-ambient-glow" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stopColor="rgba(59,130,246,0.03)"/>
      <stop offset="100%" stopColor="transparent"/>
    </radialGradient>

    {/* ── Subtle dot grid */}
    <pattern id="tb-canvas-grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(148,163,184,0.04)" strokeWidth="0.5"/>
    </pattern>

    {/* ── Per-color orb gradients */}
    {[
      ['blue','#bae6fd','#0c4a6e'], ['red','#fca5a5','#7f1d1d'], ['green','#86efac','#14532d'],
      ['yellow','#fde047','#713f12'], ['orange','#fdba74','#7c2d12'], ['purple','#d8b4fe','#581c87'],
      ['cyan','#67e8f9','#164e63'], ['teal','#5eead4','#134e4a'], ['pink','#f9a8d4','#831843'],
      ['gold','#fcd34d','#78350f'], ['gray','#cbd5e1','#1e293b'], ['white','#f8fafc','#0f172a'],
    ].map(([c, light, fill]) => (
      <radialGradient id={`tb-grad-${c}`} cx="35%" cy="35%" r="75%" key={c}>
        <stop offset="0%"   stopColor={light} stopOpacity="0.7"/>
        <stop offset="55%"  stopColor={fill}  stopOpacity="1"/>
        <stop offset="100%" stopColor="#0a0a0a" stopOpacity="0.85"/>
      </radialGradient>
    ))}
  </defs>
);

// ─── Attention indicator — subtle ring around dominant non-highlight objects ──

const DominanceRing = ({ obj, attentionRole }) => {
  if (attentionRole !== 'dominant') return null;
  
  // Bug 8: Add shape-type guards for x1,y1,x2,y2 shapes
  let cx, cy, r;
  if (obj.x1 !== undefined && obj.x2 !== undefined) {
    cx = safeNum((obj.x1 + obj.x2) / 2, 400);
    cy = safeNum((obj.y1 + obj.y2) / 2, 300);
    r  = safeNum(obj.thickness || 2, 2) * 8 + 14;
  } else {
    cx = safeNum(obj.x ?? obj.cx, 400);
    cy = safeNum(obj.y ?? obj.cy, 300);
    r  = safeNum(obj.r ?? obj.size, 50) + 14;
  }

  return (
    <motion.circle
      cx={cx} cy={cy} r={r}
      fill="none" stroke="#f59e0b" strokeWidth={1.5} opacity={0}
      animate={{ opacity: [0, 0.38, 0.2], r: [r, r + 10, r] }}
      transition={{ duration: 1.2, ease: 'easeOut', repeat: 1 }}
    />
  );
};

// ─── Highlight Ring Layer ─────────────────────────────────────────────────────

const HighlightRings = ({ highlightIds, objects }) => (
  <>
    {[...highlightIds].map(id => {
      const obj = objects.find(o => o.id === id);
      if (!obj) return null;
      const hx = safeNum(obj.x ?? obj.cx, 400);
      const hy = safeNum(obj.y ?? obj.cy, 300);
      const hr = safeNum(obj.r ?? obj.size, 50);
      return (
        <motion.circle key={`hl-ring-${id}`}
          cx={hx} cy={hy} r={hr}
          fill="none" stroke="#f59e0b" strokeWidth={2.5} opacity={0}
          animate={{ opacity: [0, 0.6, 0.35], r: [hr + 5, hr + 18] }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      );
    })}
  </>
);

// ─── Narration Bar — with narrative-emphasis color coding ────────────────────

const NarrationBar = ({ stepIndex, narration, title, emphasis = 'normal' }) => {
  if (!narration && !title) return null;

  const emphasisStyles = {
    subtle:   { border: 'rgba(51,65,85,0.6)',   accent: '#64748b' },
    normal:   { border: 'rgba(51,65,85,0.7)',   accent: '#94a3b8' },
    dramatic: { border: 'rgba(245,158,11,0.4)', accent: '#f59e0b' },
  };
  const style = emphasisStyles[emphasis] || emphasisStyles.normal;

  return (
    <AnimatePresence>
      <motion.div
        key={`narr-${stepIndex}`}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.38, ease: EASE_CINEMATIC }}
        className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
        style={{ maxWidth: '580px', width: '90%' }}
      >
        <div style={{
          background: 'rgba(15,23,42,0.82)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: `0.5px solid ${style.border}`,
          borderLeft: `2.5px solid ${style.accent}`,
          borderRadius: '12px',
          padding: '10px 18px',
          textAlign: 'left',
        }}>
          {title && (
            <p style={{
              fontSize: '9px', fontWeight: '700', color: style.accent,
              textTransform: 'uppercase', letterSpacing: '0.14em',
              marginBottom: narration ? '3px' : 0,
            }}>{title}</p>
          )}
          {narration && (
            <p style={{
              fontSize: '12.5px', color: '#cbd5e1', lineHeight: '1.65',
              margin: 0, fontWeight: emphasis === 'dramatic' ? '500' : '400',
            }}>{narration}</p>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

// ─── Quiz Overlay ─────────────────────────────────────────────────────────────

const QuizOverlay = ({ obj, visible }) => {
  const { question, options, correctAnswer, explanation } = obj.quizData || {};
  const [selected, setSelected] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  if (!visible || !question) return null;

  return (
    <motion.div
      drag dragMomentum={false}
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="absolute z-[100] bg-[var(--bg-secondary)]/90 backdrop-blur-3xl border border-[var(--border-color)] rounded-[2rem] p-8 max-w-lg w-[480px] shadow-2xl pointer-events-auto"
      style={{ left: safeNum(obj.x, 150), top: safeNum(obj.y, 100), cursor: 'grab' }}
    >
      <div className="flex justify-center mb-5">
        <span className="px-3 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-full text-[9px] font-black uppercase tracking-widest text-[var(--text-tertiary)]">
          Knowledge Check
        </span>
      </div>
      <h3 className="text-xl font-medium text-[var(--text-primary)] mb-6 text-center leading-snug">{question}</h3>
      <div className="grid gap-2.5">
        {options?.map((opt, i) => (
          <button key={i}
            onClick={() => { if (!showFeedback) { setSelected(opt); setShowFeedback(true); } }}
            disabled={showFeedback}
            className={`w-full p-4 rounded-xl border text-left text-sm font-medium transition-all duration-200
              ${!showFeedback ? 'hover:bg-[var(--bg-tertiary)] border-[var(--border-color)]' : 'cursor-default'}
              ${showFeedback && opt === correctAnswer ? 'border-green-500/50 bg-green-500/10 text-green-400' : ''}
              ${showFeedback && selected === opt && opt !== correctAnswer ? 'border-red-500/50 bg-red-500/10 text-red-400' : ''}
            `}
          >
            <span className="mr-3 font-bold text-[var(--text-tertiary)]">{String.fromCharCode(65+i)}.</span>{opt}
          </button>
        ))}
      </div>
      {showFeedback && (
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="mt-5 text-[13px] text-[var(--text-secondary)] italic p-4 bg-[var(--bg-tertiary)]/50 rounded-xl border border-[var(--border-color)]"
        >{explanation}</motion.p>
      )}
    </motion.div>
  );
};

// ─── Cinematic Shape Router ───────────────────────────────────────────────────

function CinematicShapeRouter({
  obj, isNew, isHighlighted, isFaded, transition,
  staggerIndex, stepKey, legacyIndex, attentionRole,
  narrativeHints, attentionOverride,
}) {
  if (!obj) return null;
  const s = (obj.shape || obj.type || 'circle').toLowerCase();

  const commonProps = { 
    obj, isNew, isHighlighted, isFaded, transition, 
    staggerIndex, stepKey, narrativeHints, attentionOverride 
  };

  // Choose filter based on attention role
  const filterByRole = (base) => {
    if (attentionRole === 'dominant')   return 'url(#tb-dominant-glow)';
    if (attentionRole === 'supporting') return 'url(#tb-soft-glow)';
    if (attentionRole === 'background') return 'url(#tb-fade-filter)';
    return base || 'none';
  };

  const wrapDraggable = (el) => (
    <motion.g
      key={`${obj.id}-${stepKey}` || legacyIndex}
      drag dragMomentum={false}
      onDragStart={e => e.stopPropagation()}
      style={{ cursor: 'grab', transformOrigin: 'center', transformBox: 'fill-box' }}
      whileTap={{ cursor: 'grabbing' }}
      // Attention role: background objects slightly reduced opacity
      animate={attentionRole === 'background' ? { opacity: 0.32 } : { opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Dominance ring for top-attention shapes */}
      {attentionRole === 'dominant' && s !== 'text' && s !== 'badge' && (
        <DominanceRing obj={obj} attentionRole={attentionRole} />
      )}
      {el}
    </motion.g>
  );

  switch (s) {
    case 'array':
    case 'arraycell':     return wrapDraggable(<DataBlock {...commonProps} />);
    case 'pointer':       return wrapDraggable(<FlowPointer {...commonProps} />);
    case 'swapbridge':    return wrapDraggable(<SwapBridge obj={obj} isNew={isNew} stepKey={stepKey} />);
    case 'comparator':    return wrapDraggable(<Comparator {...commonProps} />);
    case 'codeline':      return wrapDraggable(<CodePanel {...commonProps} />);
    case 'highlightbox':  return wrapDraggable(<HighlightZone {...commonProps} />);
    case 'circle':
    case 'orb':
    case 'node':          return wrapDraggable(<GlowOrb {...commonProps} />);
    case 'rect':
    case 'rectangle':
    case 'box':           return wrapDraggable(<GlassRect {...commonProps} />);
    case 'arrow':
    case 'connector':     return wrapDraggable(<FlowArrow {...commonProps} />);
    case 'line':          return wrapDraggable(<SimpleLine obj={obj} isNew={isNew} isFaded={isFaded} stepKey={stepKey} />);
    case 'text':
    case 'label':
    case 'formula':       return wrapDraggable(<DepthText {...commonProps} />);
    case 'badge':         return wrapDraggable(<FloatingBadge {...commonProps} />);
    case 'arc':
    case 'angle':         return wrapDraggable(<ArcPath obj={obj} isNew={isNew} stepKey={stepKey} />);
    case 'path':          return wrapDraggable(<WavePath {...commonProps} />);
    case 'orbit':
    case 'planet':        return wrapDraggable(<OrbitBody obj={obj} index={legacyIndex} />);
    default:              return wrapDraggable(<GlowOrb {...commonProps} />);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN CANVAS RENDERER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @param {Object} props
 * @param {Object[]} props.objects        - All scene objects
 * @param {number}   props.currentStepIndex
 * @param {Object[]} props.steps
 * @param {React.RefObject} [props.canvasRef]   - InfiniteCanvas ref (for CameraDirector)
 */
const CanvasRenderer = ({ objects = [], currentStepIndex = 0, steps = [], canvasRef }) => {
  const safeObjects = Array.isArray(objects) ? objects : [];
  const safeSteps   = Array.isArray(steps) ? steps : [];
  const currentStep = safeSteps[currentStepIndex] || null;

  // ── Attach CameraDirector to canvas ref ──
  // ── Bug 6: Attach CameraDirector to canvas element wrap ref ──
  useEffect(() => {
    if (canvasRef) {
      cameraDirector.attach(canvasRef);
    }
  }, [canvasRef]);

  // ── Configure engines when domain changes ──
  useEffect(() => {
    const domain = currentStep?.domain || 'general';
    animEngine.setDomain(domain);
    stepOrchestrator.setDomain(domain);
    cameraDirector.setDomain(domain);
  }, [currentStep?.domain]);

  // ── Reset orchestrator on new timeline ──
  useEffect(() => {
    stepOrchestrator.reset();
    cameraDirector.resetToOverview();
  }, [safeObjects.length > 0 ? safeObjects[0]?.id : null]);

  // ── STEP ANALYSIS via orchestrator ──
  const stepData = useMemo(() => {
    if (!currentStep) {
      const visible = safeObjects.filter(o => safeNum(o.appearsAtStep, 0) <= currentStepIndex);
      return {
        visibleObjects: visible,
        newIds: new Set(),
        highlightIds: new Set(),
        fadeIds: new Set(),
        transition: 'springIn',
        staggerDelays: new Map(),
        focusPoint: null,
      };
    }
    return stepOrchestrator.analyzeStep(currentStep, safeObjects, currentStepIndex);
  }, [safeObjects, safeSteps, currentStepIndex, currentStep]);

  const { visibleObjects = [], newIds, highlightIds, fadeIds, transition: stepTransition, focusPoint } = stepData;

  // ── NARRATIVE SYNC: calculate hints and attention during render (Bug 5) ──
  const narrativeData = useMemo(() => {
    const narration = currentStep?.narration || currentStep?.description || '';
    const domain    = currentStep?.domain || 'general';
    const hints = analyzeNarration(narration, domain);
    
    // Fix Bug 5: using explicit classifyAttention import
    const attention = classifyAttention(
      visibleObjects,
      highlightIds,
      newIds,
      hints.actionType
    );

    return { hints, attention };
  }, [currentStepIndex, visibleObjects, highlightIds, newIds]);

  const { hints: narrativeHints, attention: attentionOverride } = narrativeData;

  // ── Sync orchestrator and singleton for legacy support (side effects) ──
  useEffect(() => {
    stepOrchestrator.syncSeen(visibleObjects);
  }, [visibleObjects]);

  // ── CAMERA DIRECTION: fire per step ──
  useEffect(() => {
    if (!currentStep) return;
    cameraDirector.directStep(
      currentStep,
      safeObjects,
      highlightIds,
      newIds,
      focusPoint,
      narrativeHints.focusIntensity,
    );
  }, [currentStepIndex]);

  // ── Visible ID set ──
  const visibleIdSet = useMemo(() => {
    if (currentStep?.objectIds?.length > 0) return new Set(currentStep.objectIds);
    return new Set(safeObjects.filter(o => safeNum(o.appearsAtStep, 0) <= currentStepIndex).map(o => o.id));
  }, [currentStep, safeObjects, currentStepIndex]);

  // ── Stagger index map ──
  const staggerIndexMap = useMemo(() => {
    const map = new Map();
    let idx = 0;
    for (const obj of visibleObjects) {
      if (newIds.has(obj.id)) map.set(obj.id, idx++);
    }
    return map;
  }, [visibleObjects, newIds]);

  // ── Quiz objects ──
  const quizzes = useMemo(() =>
    safeObjects.filter(o => (o.shape === 'quiz' || o.type === 'quiz') && visibleIdSet.has(o.id)),
    [safeObjects, visibleIdSet]
  );

  const narration = currentStep?.narration || currentStep?.description || '';
  const stepTitle  = currentStep?.label || currentStep?.title || '';

  // ── Resolved effective objects to render ──
  const renderObjects = visibleObjects.length > 0
    ? visibleObjects
    : safeObjects.filter(o => visibleIdSet.has(o.id));

  return (
    <div
      className="relative w-full h-full pointer-events-none"
      style={{ minWidth: 800, minHeight: 600 }}
    >
      {/* ── SVG Canvas ── */}
      <svg
        width="800" height="600"
        viewBox={`0 0 ${CW} ${CH}`}
        className="absolute top-0 left-0 w-full h-full"
        style={{ overflow: 'visible', pointerEvents: 'none', display: 'block' }}
      >
        <CinematicFilters />

        {/* Background grid + ambient */}
        <rect width={CW} height={CH} fill="url(#tb-canvas-grid)"/>
        <rect width={CW} height={CH} fill="url(#tb-ambient-glow)"/>

        {/* Highlight glow rings — rendered behind shapes */}
        <HighlightRings highlightIds={highlightIds} objects={safeObjects}/>

        {/* ── Shape Layer — AnimatePresence enables Framer exit animations ── */}
        <AnimatePresence>
          {renderObjects.map((obj, i) => {
            const isNew        = newIds.has(obj.id);
            const isHighlighted = highlightIds.has(obj.id);
            const isFaded      = fadeIds.has(obj.id);

            // Get attention role from engine (updated via syncNarration)
            const attentionRole = animEngine.getAttentionRole(obj.id);

            return (
              <CinematicShapeRouter
                key={obj.id || i}
                obj={obj}
                isNew={isNew}
                isHighlighted={isHighlighted}
                isFaded={isFaded}
                transition={narrativeHints.transitionHint || stepTransition}
                staggerIndex={staggerIndexMap.get(obj.id) || 0}
                stepKey={`step-${currentStepIndex}`}
                legacyIndex={i}
                attentionRole={animEngine.getAttentionRole(obj.id, attentionOverride)}
                narrativeHints={narrativeHints}
                attentionOverride={attentionOverride}
              />
            );
          })}
        </AnimatePresence>
      </svg>

      {/* ── HTML Quiz Overlay Layer ── */}
      <div className="absolute inset-0 pointer-events-none">
        <AnimatePresence>
          {quizzes.map(q => <QuizOverlay key={q.id} obj={q} visible />)}
        </AnimatePresence>
      </div>

      {/* ── Narration Bar — emphasis-aware styling ── */}
      <NarrationBar
        stepIndex={currentStepIndex}
        narration={narration}
        title={stepTitle}
        emphasis={narrativeHints.emphasis}
      />
    </div>
  );
};

export default CanvasRenderer;