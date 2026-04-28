/**
 * AlgorithmRenderer v2.0 — 8+4 Grid Visual Learning Engine
 *
 * Fixed in v2.0:
 *  - Pointers visible (overflow:visible, padded canvas)
 *  - Proper cell auto-sizing (never overflows)
 *  - Swap arc animation
 *  - Right panel: Concept, Steps, Controls, Variables, Legend
 *  - Robust array data extraction (handles all element schemas)
 *  - Typewriter with stepIndex reset key
 */
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ALGO_COLORS, ALGO_STATES, ALGO_GRID } from '../constants/canvas';
import { AlgoRightPanel, getStateColor } from '../components/teaching/AlgoRightPanel';
import './AlgorithmRenderer.css';

const EASE = [0.16, 1, 0.3, 1];

// ─── Detect visualization mode ───────────────────────────────────────────────
function detectMode(elements) {
  if (!elements?.length) return 'array';
  const types = new Set(elements.map(e => (e.type || '').toLowerCase()));
  if (types.has('tree_node') || types.has('bst_node') || types.has('heap_node')) return 'tree';
  if (types.has('graph_node') || types.has('vertex')) return 'graph';
  if (types.has('matrix_cell') || types.has('grid_cell')) return 'matrix';
  if (types.has('stack_item') || types.has('queue_item')) return 'stack-queue';
  if (types.has('list_node') || types.has('linked_node')) return 'linked-list';
  return 'array';
}

// useTypewriter moved to AlgoRightPanel.jsx

// ═══════════════════════════════════════════════════════════════════════════════
// ARRAY CELL — with swap arc animation
// ═══════════════════════════════════════════════════════════════════════════════
function ArrayCell({ value, index, state = 'default', size = 44, delay = 0 }) {
  const c = getStateColor(state);
  const isAnimated = ['active', 'comparing', 'visiting', 'found'].includes(state);
  const isSwapping = state === 'swapping';

  return (
    <motion.div
      className={`algo-cell algo-cell--${state}`}
      data-element-id={`cell-${index}`}
      initial={{ opacity: 0, scale: 0.8, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.35, delay: delay * 0.04, ease: EASE }}
      layout
    >
      <motion.div
        className="algo-cell__box"
        animate={{
          backgroundColor: c.bg,
          borderColor: c.border,
          color: c.text,
          boxShadow: c.glow !== 'transparent' ? `0 0 14px ${c.glow}` : '0 0 0 transparent',
          scale: isAnimated ? [1, 1.08, 1] : 1,
          y: isSwapping ? [0, -30, 0] : 0,
        }}
        transition={{
          duration: 0.4,
          ease: EASE,
          scale: { duration: 0.9, repeat: isAnimated ? Infinity : 0 },
          y: { duration: 0.55, ease: [0.34, 1.56, 0.64, 1] },
        }}
        style={{ width: size, height: size, '--algo-glow': c.glow }}
      >
        {value}
      </motion.div>
      <span className="algo-cell__index">{index}</span>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// POINTER ARROW — rendered ABOVE the cells (top-facing)
// ═══════════════════════════════════════════════════════════════════════════════
function PointerArrow({ label, position, color = '#8b5cf6', total, arrWidth }) {
  if (position < 0 || position === undefined || position === null) return null;
  const gap = ALGO_GRID.CELL_GAP;
  const cellW = arrWidth / Math.max(total, 1) - gap;
  const left = position * (cellW + gap) + cellW / 2;

  return (
    <motion.div
      className="algo-pointer algo-pointer--top"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0, left }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      style={{ color }}
    >
      <span className="algo-pointer__label" style={{ color }}>{label}</span>
      <div className="algo-pointer__arrow--down" style={{ borderTopColor: color }} />
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPARISON BRIDGE
// ═══════════════════════════════════════════════════════════════════════════════
function ComparisonBridge({ from, to, label, arrWidth, total }) {
  if (from === undefined || to === undefined || from === to) return null;
  const gap = ALGO_GRID.CELL_GAP;
  const cellW = arrWidth / Math.max(total, 1) - gap;
  const l = Math.min(from, to) * (cellW + gap) + cellW / 2;
  const r = Math.max(from, to) * (cellW + gap) + cellW / 2;

  return (
    <motion.div
      className="algo-bridge"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, left: l, width: r - l }}
      transition={{ duration: 0.3, ease: EASE }}
    >
      <div className="algo-bridge__line" style={{ width: '100%' }} />
      {label && <span className="algo-bridge__label">{label}</span>}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TREE VISUALIZATION
// ═══════════════════════════════════════════════════════════════════════════════
function TreeVisualization({ elements, connections, stepHighlights, stepFades, width, height }) {
  const nodes = useMemo(() => elements.filter(e =>
    ['tree_node', 'bst_node', 'heap_node', 'circle'].includes((e.type || '').toLowerCase())
  ), [elements]);
  const edges = connections || [];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block overflow-visible">
      {edges.map((edge, i) => {
        const from = nodes.find(n => n.id === edge.from);
        const to = nodes.find(n => n.id === edge.to);
        if (!from || !to) return null;
        const x1 = (from.x ?? 0.5) * width, y1 = (from.y ?? 0.3) * height;
        const x2 = (to.x ?? 0.5) * width, y2 = (to.y ?? 0.6) * height;
        const isActive = stepHighlights.has(from.id) && stepHighlights.has(to.id);
        return (
          <motion.line key={`e-${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
            className={`algo-tree-edge ${isActive ? 'algo-tree-edge--active' : ''}`}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.6, delay: i * 0.05 }}
          />
        );
      })}
      {nodes.map((node, i) => {
        const x = (node.x ?? 0.5) * width, y = (node.y ?? 0.5) * height;
        const state = stepHighlights.has(node.id) ? 'active' : stepFades.has(node.id) ? 'eliminated' : node.state || 'default';
        const c = getStateColor(state);
        const r = (node.scale || 1) * 18;
        return (
          <motion.g key={node.id} data-element-id={node.id}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: stepFades.has(node.id) ? 0.2 : 1, scale: 1, x, y }}
            transition={{ duration: 0.5, delay: i * 0.04, ease: EASE }}
          >
            {c.glow !== 'transparent' && (
              <circle r={r + 6} fill="none" stroke={c.glow} strokeWidth={2} opacity={0.4}>
                <animate attributeName="r" values={`${r+4};${r+10};${r+4}`} dur="2s" repeatCount="indefinite" />
              </circle>
            )}
            <circle r={r} fill={c.bg} stroke={c.border} strokeWidth={2} />
            <text textAnchor="middle" dominantBaseline="central" fill={c.text}
              fontSize={12} fontWeight={700} fontFamily="'JetBrains Mono', monospace"
            >{node.value ?? node.label ?? ''}</text>
          </motion.g>
        );
      })}
    </svg>
  );
}

// AlgoLegend and RightPanel moved to AlgoRightPanel.jsx

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN RENDERER
// ═══════════════════════════════════════════════════════════════════════════════
export default function AlgorithmRenderer({ 
  timeline, currentStepIndex, 
  // Doubt Props
  doubtHistory, isDoubtProcessing, activeDoubtId, onJumpToDoubt, onResume, onAskDoubt, onPinDoubt,
  onGoToStep,
}) {
  const elements    = timeline?.elements || timeline?.objects || [];
  const connections = timeline?.connections || [];
  const steps       = timeline?.timeline || timeline?.steps || [];
  const currentStep = steps[currentStepIndex] || {};

  const mode = useMemo(() => detectMode(elements), [elements]);
  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ w: 560, h: 360 });

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Step-derived state
  const highlightIds = useMemo(() => new Set(currentStep.highlight || currentStep.highlightIds || []), [currentStep]);
  const fadeIds      = useMemo(() => new Set(currentStep.fade || currentStep.fadeIds || []), [currentStep]);
  const pointers     = currentStep.pointers || [];
  const variables    = currentStep.variables || {};
  const comparison   = currentStep.comparison || null;
  const stepTitle    = currentStep.title || `Step ${currentStepIndex + 1}`;

  // Active states for legend
  const activeStates = useMemo(() => {
    const states = new Set(['default']);
    elements.forEach(el => { if (el.state) states.add(el.state); });
    if (highlightIds.size > 0) states.add('active');
    if (fadeIds.size > 0) states.add('eliminated');
    if (currentStep.sorted?.length > 0) states.add('sorted');
    pointers.forEach(p => { if (p.state) states.add(p.state); });
    return Array.from(states);
  }, [elements, highlightIds, fadeIds, currentStep, pointers]);

  // ── Robust array data extraction ──────────────────────────────────────────
  const arrayData = useMemo(() => {
    if (mode !== 'array') return [];

    // Try parent array element with .values[]
    const arrayEl = elements.find(e => {
      const t = (e.type || '').toLowerCase();
      return (t === 'array' || t === 'arr') && Array.isArray(e.values);
    });
    if (arrayEl) {
      return arrayEl.values.map((v, i) => ({
        value: v, index: i,
        state:
          highlightIds.has(`${arrayEl.id}-${i}`) ? 'active' :
          fadeIds.has(`${arrayEl.id}-${i}`)      ? 'eliminated' :
          currentStep.sorted?.includes(i)         ? 'sorted' :
          currentStep.comparing?.includes(i)      ? 'comparing' :
          currentStep.pivot === i                  ? 'pivot' :
          'default'
      }));
    }

    // Fallback: individual cell elements sorted by index field first, then x
    return elements
      .filter(e => e.value !== undefined || e.label !== undefined)
      .sort((a, b) => {
        if (a.index !== undefined && b.index !== undefined) return a.index - b.index;
        return (a.x ?? 0) - (b.x ?? 0);
      })
      .map((el, i) => ({
        value: el.value ?? el.label ?? '',
        index: el.index ?? i,
        state:
          highlightIds.has(el.id)              ? 'active' :
          fadeIds.has(el.id)                   ? 'eliminated' :
          currentStep.sorted?.includes(el.index ?? i) ? 'sorted' :
          el.state || 'default'
      }));
  }, [mode, elements, highlightIds, fadeIds, currentStep]);

  // ── Cell sizing: fill the container exactly ───────────────────────────────
  const cellSize = useMemo(() => {
    const n = arrayData.length;
    if (!n) return ALGO_GRID.MAX_CELL_SIZE;
    const gap = ALGO_GRID.CELL_GAP;
    const avail = containerSize.w - 32; // 16px padding each side
    const ideal = Math.floor((avail - gap * (n - 1)) / n);
    return Math.max(ALGO_GRID.MIN_CELL_SIZE, Math.min(ALGO_GRID.MAX_CELL_SIZE, ideal));
  }, [arrayData.length, containerSize.w]);

  // Width of the actual array row (for pointer positioning)
  const arrRowWidth = useMemo(() => {
    const n = arrayData.length;
    return n * cellSize + (n - 1) * ALGO_GRID.CELL_GAP;
  }, [arrayData.length, cellSize]);

  return (
    <div className="algo-renderer">

      {/* ═══ LEFT: MAIN VISUAL AREA (8 cols) ═══ */}
      <div className="algo-main">
        {/* Step Header moved to TeachingSession.jsx for HUD mode */}

        {/* Visual Canvas — overflow:visible so pointers show above cells */}
        <div className="algo-main__canvas" ref={containerRef}>
          {mode === 'array' && (
            <div className="algo-array-wrap">
              {/* Pointer row ABOVE the cells */}
              <div className="algo-pointer-row" style={{ width: arrRowWidth }}>
                {pointers.map((p, i) => (
                  <PointerArrow
                    key={p.label || i}
                    label={p.label}
                    position={p.index ?? p.position}
                    color={p.color || '#8b5cf6'}
                    total={arrayData.length}
                    arrWidth={arrRowWidth}
                  />
                ))}
                {/* Comparison bridge above cells */}
                {comparison && (
                  <ComparisonBridge
                    from={comparison.from}
                    to={comparison.to}
                    label={comparison.label}
                    arrWidth={arrRowWidth}
                    total={arrayData.length}
                  />
                )}
              </div>

              {/* Cell row */}
              <div className="algo-cell-row" style={{ gap: ALGO_GRID.CELL_GAP }}>
                {arrayData.map((cell, i) => (
                  <ArrayCell
                    key={`${i}-${cell.value}`}
                    value={cell.value}
                    index={cell.index}
                    state={cell.state}
                    size={cellSize}
                    delay={i}
                  />
                ))}
              </div>
            </div>
          )}

          {mode === 'tree' && (
            <TreeVisualization
              elements={elements} connections={connections}
              stepHighlights={highlightIds} stepFades={fadeIds}
              width={containerSize.w} height={containerSize.h - 60}
            />
          )}

          {(mode === 'matrix' || mode === 'stack-queue' || mode === 'linked-list') && (
            <div style={{
              display: 'flex',
              flexDirection: mode === 'stack-queue' ? 'column-reverse' : 'row',
              alignItems: 'center', gap: ALGO_GRID.CELL_GAP, flexWrap: 'wrap',
            }}>
              {elements.map((el, i) => {
                const state = highlightIds.has(el.id) ? 'active' : fadeIds.has(el.id) ? 'eliminated' : el.state || 'default';
                return <ArrayCell key={el.id || i} value={el.value ?? el.label ?? ''} index={i} state={state} size={cellSize} delay={i} />;
              })}
            </div>
          )}
        </div>

        {/* Progress dots */}
        {steps.length > 1 && (
          <div className="algo-progress">
            {steps.slice(0, 20).map((_, i) => (
              <motion.div
                key={i}
                onClick={() => onGoToStep?.(i)}
                className={`algo-progress__dot ${i === currentStepIndex ? 'algo-progress__dot--active' : i < currentStepIndex ? 'algo-progress__dot--completed' : ''}`}
                whileHover={{ scale: 1.4 }}
                layout
              />
            ))}
          </div>
        )}
      </div>

      {/* ═══ RIGHT: INFO PANEL (Portaled to fixed sidebar) ═══ */}
      {createPortal(
        <AlgoRightPanel
          step={currentStep}
          stepIndex={currentStepIndex}
          totalSteps={steps.length}
          variables={variables}
          activeStates={activeStates}
          algorithmName={timeline?.title || ''}
          timeline={timeline}
          onGoToStep={onGoToStep}
          doubtHistory={doubtHistory}
          isDoubtProcessing={isDoubtProcessing}
          activeDoubtId={activeDoubtId}
          onJumpToDoubt={onJumpToDoubt}
          onPinDoubt={onPinDoubt}
          onResume={onResume}
          onAskDoubt={onAskDoubt}
        />,
        document.getElementById('algo-sidebar-portal') || document.body
      )}
    </div>
  );
}