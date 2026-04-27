/**
 * AlgorithmRenderer v1.0 — Dynamic Algorithm Visualization Engine
 * 
 * Renders algorithm/DSA visualizations within a strict 8+4 grid layout.
 * Supports: arrays, trees, graphs, matrices, stacks, linked lists.
 * All visuals are fully dynamic and step-reactive.
 */
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ALGO_COLORS, ALGO_STATES, ALGO_GRID } from '../constants/canvas';
import './AlgorithmRenderer.css';

const EASE = [0.16, 1, 0.3, 1];

// ─── Detect visualization mode from timeline data ────────────────────────────
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

// ─── Get state color config ──────────────────────────────────────────────────
function getStateColor(state) {
  return ALGO_COLORS[state] || ALGO_COLORS.default;
}

// ─── Typewriter Hook ─────────────────────────────────────────────────────────
function useTypewriter(text = '', speed = 30) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    setCount(0);
    if (!text) return;
    let i = 0;
    const tick = () => { i++; setCount(i); if (i < text.length) ref.current = setTimeout(tick, speed); };
    ref.current = setTimeout(tick, speed);
    return () => clearTimeout(ref.current);
  }, [text, speed]);
  return { displayed: text.slice(0, count), done: count >= text.length };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Array Cell ──────────────────────────────────────────────────────────────
function ArrayCell({ value, index, state = 'default', size = 44, delay = 0 }) {
  const c = getStateColor(state);
  const isAnimated = state === 'active' || state === 'comparing' || state === 'visiting' || state === 'swapping';
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
          scale: isAnimated ? [1, 1.06, 1] : 1,
        }}
        transition={{ duration: 0.4, ease: EASE, scale: { duration: 0.8, repeat: isAnimated ? Infinity : 0 } }}
        style={{
          width: size, height: size,
          '--algo-glow': c.glow,
        }}
      >
        {value}
      </motion.div>
      <span className="algo-cell__index">{index}</span>
    </motion.div>
  );
}

// ─── Pointer Arrow ───────────────────────────────────────────────────────────
function PointerArrow({ label, position, color = '#8b5cf6', total, containerWidth }) {
  if (position < 0 || position === undefined || position === null) return null;
  const cellW = Math.min(ALGO_GRID.MAX_CELL_SIZE, Math.max(ALGO_GRID.MIN_CELL_SIZE, (containerWidth || 500) / Math.max(total, 1)));
  const gap = ALGO_GRID.CELL_GAP;
  const left = position * (cellW + gap) + cellW / 2;

  return (
    <motion.div
      className="algo-pointer"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, left }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      style={{ color }}
    >
      <div className="algo-pointer__arrow" style={{ borderBottomColor: color }} />
      <span className="algo-pointer__label" style={{ color }}>{label}</span>
    </motion.div>
  );
}

// ─── Comparison Bridge ───────────────────────────────────────────────────────
function ComparisonBridge({ from, to, label, containerWidth, total }) {
  if (from === undefined || to === undefined || from === to) return null;
  const cellW = Math.min(ALGO_GRID.MAX_CELL_SIZE, Math.max(ALGO_GRID.MIN_CELL_SIZE, (containerWidth || 500) / Math.max(total, 1)));
  const gap = ALGO_GRID.CELL_GAP;
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
      {label && <span className="algo-bridge__label" style={{ left: '50%', transform: 'translateX(-50%)' }}>{label}</span>}
    </motion.div>
  );
}

// ─── Tree Visualization (SVG) ────────────────────────────────────────────────
function TreeVisualization({ elements, connections, stepHighlights, stepFades, width, height }) {
  const nodes = useMemo(() => elements.filter(e =>
    ['tree_node', 'bst_node', 'heap_node', 'circle'].includes((e.type || '').toLowerCase())
  ), [elements]);
  const edges = connections || [];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block overflow-visible">
      {/* Edges */}
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
      {/* Nodes */}
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
                <animate attributeName="r" values={`${r + 4};${r + 10};${r + 4}`} dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.4;0.1;0.4" dur="2s" repeatCount="indefinite" />
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

// ─── Graph Visualization (SVG) ───────────────────────────────────────────────
function GraphVisualization({ elements, connections, stepHighlights, stepFades, width, height }) {
  const nodes = elements.filter(e => ['graph_node', 'vertex', 'circle'].includes((e.type || '').toLowerCase()) || !e.type);
  const edges = connections || [];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block overflow-visible">
      {edges.map((edge, i) => {
        const from = nodes.find(n => n.id === edge.from);
        const to = nodes.find(n => n.id === edge.to);
        if (!from || !to) return null;
        const x1 = (from.x ?? 0.5) * width, y1 = (from.y ?? 0.5) * height;
        const x2 = (to.x ?? 0.5) * width, y2 = (to.y ?? 0.5) * height;
        const isActive = stepHighlights.has(edge.from) || stepHighlights.has(edge.to);
        return (
          <motion.line key={`ge-${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
            className={`algo-graph-edge ${isActive ? 'algo-graph-edge--active' : ''}`}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: i * 0.03 }}
          />
        );
      })}
      {nodes.map((node, i) => {
        const x = (node.x ?? 0.5) * width, y = (node.y ?? 0.5) * height;
        const state = stepHighlights.has(node.id) ? 'visiting' : stepFades.has(node.id) ? 'visited' : node.state || 'default';
        const c = getStateColor(state);
        const r = (node.scale || 1) * 20;
        return (
          <motion.g key={node.id} data-element-id={node.id}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: stepFades.has(node.id) ? 0.4 : 1, scale: 1, x, y }}
            transition={{ duration: 0.45, delay: i * 0.04, ease: EASE }}
          >
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

// ─── Legend ───────────────────────────────────────────────────────────────────
function AlgoLegend({ activeStates }) {
  const LABELS = {
    active: 'Active / Current', comparing: 'Comparing', eliminated: 'Eliminated',
    sorted: 'Sorted / Done', pivot: 'Pivot', found: 'Found / Target',
    visiting: 'Visiting', visited: 'Visited', swapping: 'Swapping', default: 'Unvisited',
  };
  const states = activeStates.length > 0 ? activeStates : ['default', 'active', 'sorted'];
  return (
    <div className="algo-legend">
      {states.map(s => {
        const c = getStateColor(s);
        return (
          <motion.div key={s} className="algo-legend__item"
            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="algo-legend__dot" style={{ background: c.border, border: `1px solid ${c.border}` }} />
            <span>{LABELS[s] || s}</span>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Progress Dots ───────────────────────────────────────────────────────────
function ProgressDots({ total, current, onGoTo }) {
  if (total <= 1) return null;
  const maxDots = 20;
  const step = total > maxDots ? Math.ceil(total / maxDots) : 1;
  const dots = [];
  for (let i = 0; i < total; i += step) dots.push(i);
  if (dots[dots.length - 1] !== total - 1) dots.push(total - 1);

  return (
    <div className="algo-progress">
      {dots.map(i => (
        <motion.div
          key={i}
          className={`algo-progress__dot ${i === current ? 'algo-progress__dot--active' : i < current ? 'algo-progress__dot--completed' : ''}`}
          onClick={() => onGoTo?.(i)}
          whileHover={{ scale: 1.4 }}
          layout
        />
      ))}
    </div>
  );
}

// ─── Step Info Panel ─────────────────────────────────────────────────────────
function StepInfo({ step, stepIndex, totalSteps, variables, activeStates, algorithmName }) {
  const narration = step?.narration || step?.explanation || step?.description || '';
  const { displayed, done } = useTypewriter(narration, 25);

  return (
    <div className="algo-info">
      {/* Algorithm Name */}
      {algorithmName && (
        <div className="algo-info__section">
          <span className="algo-info__section-title">Algorithm</span>
          <motion.div
            className="algo-animate-fade-in"
            style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}
          >
            {algorithmName}
          </motion.div>
        </div>
      )}

      {/* Step Counter */}
      <div className="algo-info__section">
        <span className="algo-info__section-title">Progress</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            flex: 1, height: 3, borderRadius: 2, background: 'var(--bg-tertiary)', overflow: 'hidden'
          }}>
            <motion.div
              style={{ height: '100%', borderRadius: 2, background: '#8b5cf6' }}
              animate={{ width: `${((stepIndex + 1) / Math.max(totalSteps, 1)) * 100}%` }}
              transition={{ duration: 0.5, ease: EASE }}
            />
          </div>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>
            {stepIndex + 1}/{totalSteps}
          </span>
        </div>
      </div>

      {/* Narration */}
      <div className="algo-info__section" style={{ flex: 1 }}>
        <span className="algo-info__section-title">Explanation</span>
        <AnimatePresence mode="wait">
          <motion.p
            key={stepIndex}
            className="algo-info__narration"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 6 }}
            transition={{ duration: 0.3 }}
            style={{ borderLeftColor: '#8b5cf6' }}
          >
            {displayed}
            {!done && (
              <motion.span
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.6, repeat: Infinity }}
                style={{ display: 'inline-block', width: 2, height: 12, background: '#8b5cf6', marginLeft: 2, verticalAlign: 'middle', borderRadius: 1 }}
              />
            )}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Variables */}
      {variables && Object.keys(variables).length > 0 && (
        <div className="algo-info__section">
          <span className="algo-info__section-title">Variables</span>
          <div className="algo-info__variables">
            {Object.entries(variables).map(([k, v]) => (
              <motion.div key={k} className="algo-info__var"
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
              >
                <span className="algo-info__var-name">{k}</span>
                <motion.span className="algo-info__var-value"
                  key={`${k}-${v}`}
                  initial={{ scale: 1.2, color: '#8b5cf6' }}
                  animate={{ scale: 1, color: 'var(--text-primary)' }}
                  transition={{ duration: 0.4 }}
                >{String(v)}</motion.span>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="algo-info__section">
        <span className="algo-info__section-title">Legend</span>
        <AlgoLegend activeStates={activeStates} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN RENDERER
// ═══════════════════════════════════════════════════════════════════════════════

export default function AlgorithmRenderer({ timeline, currentStepIndex }) {
  const elements    = timeline?.elements || timeline?.objects || [];
  const connections = timeline?.connections || [];
  const steps       = timeline?.timeline || timeline?.steps || [];
  const currentStep = steps[currentStepIndex] || {};

  const mode = useMemo(() => detectMode(elements), [elements]);
  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ w: 500, h: 350 });

  // Measure container
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
  const explanation  = currentStep.explanation || currentStep.narration || '';
  const algorithmName = timeline?.title || '';

  // Collect active states for legend
  const activeStates = useMemo(() => {
    const states = new Set(['default']);
    elements.forEach(el => { if (el.state) states.add(el.state); });
    if (highlightIds.size > 0) states.add('active');
    if (fadeIds.size > 0) states.add('eliminated');
    if (currentStep.sorted) states.add('sorted');
    pointers.forEach(p => { if (p.state) states.add(p.state); });
    return Array.from(states);
  }, [elements, highlightIds, fadeIds, currentStep, pointers]);

  // Array data: extract values from elements
  const arrayData = useMemo(() => {
    if (mode !== 'array') return [];
    // Try to find an array-type element with values
    const arrayEl = elements.find(e => (e.type || '').toLowerCase() === 'array');
    if (arrayEl?.values) {
      return arrayEl.values.map((v, i) => ({
        value: v, index: i,
        state: highlightIds.has(`${arrayEl.id}-${i}`) ? 'active'
             : fadeIds.has(`${arrayEl.id}-${i}`) ? 'eliminated'
             : currentStep.sorted?.includes(i) ? 'sorted'
             : currentStep.comparing?.includes(i) ? 'comparing'
             : currentStep.pivot === i ? 'pivot'
             : 'default'
      }));
    }
    // Fallback: treat individual elements as array cells
    return elements
      .filter(e => e.value !== undefined || e.label !== undefined)
      .sort((a, b) => (a.x ?? 0) - (b.x ?? 0))
      .map((el, i) => ({
        value: el.value ?? el.label ?? '',
        index: i,
        state: highlightIds.has(el.id) ? 'active'
             : fadeIds.has(el.id) ? 'eliminated'
             : el.state || 'default'
      }));
  }, [mode, elements, highlightIds, fadeIds, currentStep]);

  // Auto-scale cell size
  const cellSize = useMemo(() => {
    if (mode !== 'array' || !arrayData.length) return ALGO_GRID.MAX_CELL_SIZE;
    const available = containerSize.w - ALGO_GRID.PADDING * 2;
    const maxFit = Math.floor(available / (ALGO_GRID.MIN_CELL_SIZE + ALGO_GRID.CELL_GAP));
    if (arrayData.length <= maxFit) {
      return Math.min(ALGO_GRID.MAX_CELL_SIZE, Math.floor(available / arrayData.length) - ALGO_GRID.CELL_GAP);
    }
    return ALGO_GRID.MIN_CELL_SIZE;
  }, [mode, arrayData.length, containerSize.w]);

  return (
    <div className="algo-renderer">
      {/* ═══ MAIN VISUAL AREA (8 cols) ═══ */}
      <div className="algo-main">
        {/* Step Badge */}
        <div className="algo-main__header">
          <motion.div className="algo-main__step-badge"
            key={currentStepIndex}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              style={{ width: 5, height: 5, borderRadius: '50%', background: '#8b5cf6' }}
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            Step {currentStepIndex + 1}
          </motion.div>
          <AnimatePresence mode="wait">
            <motion.span
              key={stepTitle}
              className="algo-main__explanation"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.25 }}
              style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}
            >
              {stepTitle}
            </motion.span>
          </AnimatePresence>
        </div>

        {/* Short Explanation */}
        {explanation && (
          <AnimatePresence mode="wait">
            <motion.div
              key={`exp-${currentStepIndex}`}
              className="algo-main__explanation"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              {explanation.length > 120 ? explanation.slice(0, 120) + '…' : explanation}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Dynamic Visual Canvas */}
        <div className="algo-main__canvas" ref={containerRef}>
          {mode === 'array' && (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: ALGO_GRID.CELL_GAP, flexWrap: 'wrap', paddingBottom: 36 }}>
              {arrayData.map((cell, i) => (
                <ArrayCell key={`${i}-${cell.value}`} value={cell.value} index={cell.index} state={cell.state} size={cellSize} delay={i} />
              ))}
              {/* Pointers */}
              {pointers.map((p, i) => (
                <PointerArrow key={p.label || i} label={p.label} position={p.index ?? p.position} color={p.color || '#8b5cf6'} total={arrayData.length} containerWidth={containerSize.w - ALGO_GRID.PADDING * 2} />
              ))}
              {/* Comparison Bridge */}
              {comparison && (
                <ComparisonBridge from={comparison.from} to={comparison.to} label={comparison.label} total={arrayData.length} containerWidth={containerSize.w - ALGO_GRID.PADDING * 2} />
              )}
            </div>
          )}

          {mode === 'tree' && (
            <TreeVisualization elements={elements} connections={connections} stepHighlights={highlightIds} stepFades={fadeIds} width={containerSize.w} height={containerSize.h} />
          )}

          {mode === 'graph' && (
            <GraphVisualization elements={elements} connections={connections} stepHighlights={highlightIds} stepFades={fadeIds} width={containerSize.w} height={containerSize.h} />
          )}

          {(mode === 'matrix' || mode === 'stack-queue' || mode === 'linked-list') && (
            <div style={{ display: 'flex', flexDirection: mode === 'stack-queue' ? 'column-reverse' : 'row', alignItems: 'center', gap: ALGO_GRID.CELL_GAP, flexWrap: 'wrap' }}>
              {elements.map((el, i) => {
                const state = highlightIds.has(el.id) ? 'active' : fadeIds.has(el.id) ? 'eliminated' : el.state || 'default';
                return <ArrayCell key={el.id || i} value={el.value ?? el.label ?? ''} index={i} state={state} size={cellSize} delay={i} />;
              })}
            </div>
          )}

          {/* Progress Dots (bottom of main area) */}
          <ProgressDots total={steps.length} current={currentStepIndex} />
        </div>
      </div>

      {/* ═══ RIGHT INFO PANEL (4 cols) ═══ */}
      <StepInfo
        step={currentStep}
        stepIndex={currentStepIndex}
        totalSteps={steps.length}
        variables={variables}
        activeStates={activeStates}
        algorithmName={algorithmName}
      />
    </div>
  );
}
