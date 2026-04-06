import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * CanvasRenderer v4.1 — High-Fidelity Infinite Visual Engine
 * 
 * Features:
 * - Infinite Coordinate System: Maps 800x600 logical space to viewport.
 * - Draggable Elements: All SVG shapes and HTML overlays are draggable.
 * - Server Sync: Supports all shape types from teaching machine prompts.
 */

// ─── Palette (Unified 17 Domains) ─────────────────────────────────────────────
const PALETTE = {
  blue:    { stroke: '#3b82f6', fill: '#1e3a8a', light: '#dbeafe20', text: '#93c5fd' },
  red:     { stroke: '#ef4444', fill: '#7f1d1d', light: '#fee2e220', text: '#fca5a5' },
  green:   { stroke: '#22c55e', fill: '#14532d', light: '#dcfce720', text: '#86efac' },
  yellow:  { stroke: '#eab308', fill: '#713f12', light: '#fef9c320', text: '#fde047' },
  orange:  { stroke: '#f97316', fill: '#7c2d12', light: '#fff7ed20', text: '#fdba74' },
  purple:  { stroke: '#a855f7', fill: '#581c87', light: '#f3e8ff20', text: '#d8b4fe' },
  pink:    { stroke: '#ec4899', fill: '#831843', light: '#fce7f320', text: '#f9a8d4' },
  cyan:    { stroke: '#06b6d4', fill: '#164e63', light: '#cffafe20', text: '#67e8f9' },
  teal:    { stroke: '#14b8a6', fill: '#134e4a', light: '#ccfbf120', text: '#5eead4' },
  gold:    { stroke: '#f59e0b', fill: '#78350f', light: '#fffbeb20', text: '#fcd34d' },
  gray:    { stroke: '#94a3b8', fill: '#1e293b', light: '#f1f5f920', text: '#cbd5e1' },
  white:   { stroke: '#e2e8f0', fill: '#0f172a', light: '#ffffff10', text: '#f8fafc' },
  emerald: { stroke: '#10b981', fill: '#064e3b', light: '#d1fae520', text: '#a7f3d0' },
  indigo:  { stroke: '#6366f1', fill: '#312e81', light: '#e0e7ff20', text: '#c7d2fe' },
  lime:    { stroke: '#84cc16', fill: '#365314', light: '#f0fdf420', text: '#bef264' },
  amber:   { stroke: '#f59e0b', fill: '#78350f', light: '#fffbeb20', text: '#fcd34d' },
  slate:   { stroke: '#475569', fill: '#0f172a', light: '#f8fafc10', text: '#cbd5e1' },
};

const resolveColor = (c, fallback = 'blue') => {
  if (!c) return PALETTE[fallback] || PALETTE.blue;
  const s = String(c).trim().toLowerCase();
  if (PALETTE[s]) return PALETTE[s];
  if (s.startsWith('#') || s.startsWith('rgb')) return { stroke: s, fill: s, light: s + '20', text: '#fff' };
  return PALETTE[fallback] || PALETTE.blue;
};

const safeNum = (val, fallback = 0) => {
  const n = parseFloat(val);
  return isNaN(n) ? fallback : n;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const wrapText = (text, maxChars = 20) => {
  if (!text) return [];
  const words = String(text).split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length <= maxChars) cur = (cur + ' ' + w).trim();
    else { if (cur) lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
};

const MultilineText = ({ x, y, text, fontSize = 13, fill = '#fff', fontWeight = '600', anchor = 'middle', maxChars = 22 }) => {
  const lines = wrapText(text, maxChars);
  const lh = fontSize * 1.35;
  const startY = y - ((lines.length - 1) * lh) / 2;
  return (
    <>
      {lines.map((line, i) => (
        <text key={i} x={x} y={startY + (i * lh)} textAnchor={anchor} fill={fill} fontSize={fontSize} fontWeight={fontWeight} fontFamily="system-ui" dominantBaseline="central" pointerEvents="none">{line}</text>
      ))}
    </>
  );
};

// ─── Draggable Wrapper for SVG elements ──────────────────────────────────
const DraggableSVG = ({ children, id }) => {
  return (
    <motion.g
      drag
      dragMomentum={false}
      onDragStart={(e) => e.stopPropagation()}
      style={{ cursor: 'grab' }}
      whileTap={{ cursor: 'grabbing' }}
    >
      {children}
    </motion.g>
  );
};

// ─── ALGORITHM SHAPES ──────────────────────────────────────────────────────────

const RenderArray = ({ obj, visible, delay }) => {
  const values = Array.isArray(obj.values) ? obj.values : [];
  const cw = safeNum(obj.cellW, 60), ch = safeNum(obj.cellH, 56);
  const totalW = values.length * cw;
  const sx = safeNum(obj.x, 400) - totalW / 2, sy = safeNum(obj.y, 300) - ch / 2;

  const hIdx = new Set(obj.highlightCells || []);
  const sIdx = new Set(obj.swapCells || []);
  const cIdx = new Set(obj.compareCells || []);
  const okIdx = new Set(obj.sortedCells || []);

  const getPal = (i) => {
    if (sIdx.has(i)) return { bg: '#450a0a', border: '#ef4444', val: '#fca5a5' };
    if (cIdx.has(i)) return { bg: '#431407', border: '#f97316', val: '#fdba74' };
    if (hIdx.has(i)) return { bg: '#1e3a5f', border: '#3b82f6', val: '#93c5fd' };
    if (okIdx.has(i)) return { bg: '#052e16', border: '#22c55e', val: '#86efac' };
    return { bg: '#1e293b', border: '#334155', val: '#e2e8f0' };
  };

  return (
    <motion.g initial={{ opacity: 0 }} animate={visible ? { opacity: 1 } : { opacity: 0 }} transition={{ delay }}>
      {obj.label && <text x={sx + totalW / 2} y={sy - 20} textAnchor="middle" fill="#64748b" fontSize={13} fontWeight="600">{obj.label}</text>}
      {values.map((val, i) => {
        const x = sx + (i * cw), pal = getPal(i), isS = sIdx.has(i);
        return (
          <motion.g key={i} animate={isS ? { y: [0, -15, 0] } : {}} transition={{ repeat: isS ? Infinity : 0, duration: 0.6 }}>
            <rect x={x} y={sy} width={cw} height={ch} rx={8} fill={pal.bg} stroke={pal.border} strokeWidth={isS ? 2.5 : 1.5} />
            <text x={x + cw / 2} y={sy + ch / 2} textAnchor="middle" dominantBaseline="central" fill={pal.val} fontSize={safeNum(obj.fontSize, 18)} fontWeight="800" fontFamily="monospace">{val}</text>
            {obj.showIndex !== false && <text x={x + cw / 2} y={sy + ch + 18} textAnchor="middle" fill="#475569" fontSize={11}>[{i}]</text>}
          </motion.g>
        );
      })}
    </motion.g>
  );
};

const RenderPointer = ({ obj, visible, delay }) => {
  const cw = safeNum(obj.cellW, 60), tw = safeNum(obj.arrayW, 300);
  const cx = (safeNum(obj.arrayX, 400) - tw / 2) + (safeNum(obj.cellIndex, 0) * cw) + cw / 2;
  const ay = safeNum(obj.arrayY, 300), ah = safeNum(obj.cellH, 56);
  const side = obj.side || 'bottom', color = resolveColor(obj.color, 'yellow').stroke;
  const tipY = side === 'top' ? (ay - ah / 2 - 4) : (ay + ah / 2 + 4), by = side === 'top' ? (tipY - 30) : (tipY + 30);

  return (
    <motion.g initial={{ opacity: 0, scale: 0, y: side === 'bottom' ? 20 : -20 }} animate={visible ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0 }} transition={{ delay, type: 'spring', damping: 20 }}>
      <line x1={cx} y1={by} x2={cx} y2={tipY} stroke={color} strokeWidth={3} strokeLinecap="round" />
      <polygon points={side==='bottom' ? `${cx},${tipY+8} ${cx-7},${tipY} ${cx+7},${tipY}` : `${cx},${tipY-8} ${cx-7},${tipY} ${cx+7},${tipY}`} fill={color} />
      <rect x={cx-14} y={by + (side==='bottom' ? 0 : -20)} width={28} height={20} rx={10} fill={color} />
      <text x={cx} y={by + (side==='bottom' ? 10 : -10)} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={11} fontWeight="900">{obj.label || 'i'}</text>
    </motion.g>
  );
};

const RenderComparator = ({ obj, visible, delay }) => {
  const x = safeNum(obj.x, 400), y = safeNum(obj.y, 200), isT = String(obj.result).toLowerCase()==='true';
  const c = resolveColor(isT ? 'green' : 'red');
  return (
    <motion.g initial={{ scale: 0.8, opacity: 0 }} animate={visible ? { scale: 1, opacity: 1 } : { opacity: 0 }} transition={{ delay, type: 'spring' }}>
      <rect x={x-90} y={y-24} width={180} height={48} rx={24} fill={isT ? '#052e16' : '#450a0a'} stroke={c.stroke} strokeWidth={2} />
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill={c.text} fontSize={20} fontWeight="800" fontFamily="monospace">
        {obj.leftVal} {obj.operator || '>'} {obj.rightVal}
      </text>
    </motion.g>
  );
};

// ─── Standard Shapes ──────────────────────────────────────────────────────────

const RenderCircle = ({ obj, visible, delay }) => {
  const x = safeNum(obj.x || obj.cx, 400), y = safeNum(obj.y || obj.cy, 300), r = safeNum(obj.r || obj.size, 40);
  const c = resolveColor(obj.color || obj.fill);
  return (
    <motion.g initial={{ scale: 0 }} animate={visible ? { scale: 1 } : { opacity: 0 }} transition={{ delay, type: 'spring', damping: 15 }}>
      <circle cx={x} cy={y} r={r} fill={c.fill} stroke={c.stroke} strokeWidth={2.5} fillOpacity={0.3} />
      {obj.innerLabel && <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill={c.text} fontSize={Math.max(12, r*0.45)} fontWeight="800">{obj.innerLabel}</text>}
      {obj.label && <MultilineText x={x} y={y+r+22} text={obj.label} fontSize={12} fill="#94a3b8" />}
    </motion.g>
  );
};

const RenderArrow = ({ obj, visible, delay, id }) => {
  const x1 = safeNum(obj.x1, 100), y1 = safeNum(obj.y1, 100), x2 = safeNum(obj.x2, 200), y2 = safeNum(obj.y2, 100);
  const c = resolveColor(obj.color || obj.stroke).stroke, mid = `arr-${id}`;
  return (
    <motion.g initial={{ opacity: 0 }} animate={visible ? { opacity: 1 } : { opacity: 0 }} transition={{ delay }}>
      <defs><marker id={mid} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill={c}/></marker></defs>
      <motion.line x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeWidth={safeNum(obj.thickness, 2.5)} markerEnd={`url(#${mid})`} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7 }} />
      {obj.label && <text x={(x1+x2)/2} y={(y1+y2)/2 - 12} textAnchor="middle" fill="#64748b" fontSize={11}>{obj.label}</text>}
    </motion.g>
  );
};

// ─── Quiz Overlay (HTML Layer) ─────────────────────────────────────────────
const HelpCircle = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const QuizOverlay = ({ obj, visible }) => {
  const { question, options, correctAnswer, explanation } = obj.quizData || {};
  const [selectedOption, setSelectedOption] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);

  if (!visible || !question) return null;

  return (
    <motion.div
      drag
      dragMomentum={false}
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="absolute z-[100] bg-[var(--bg-secondary)]/90 backdrop-blur-3xl border border-[var(--border-color)] rounded-[2.5rem] p-10 max-w-xl w-[500px] shadow-2xl pointer-events-auto cursor-grab active:cursor-grabbing"
      style={{ left: safeNum(obj.x, 150), top: safeNum(obj.y, 100) }}
    >
      <div className="flex justify-center mb-6 drag-handle">
        <span className="px-4 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-full text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)] flex items-center gap-2">
          <HelpCircle size={12} /> Knowledge Check
        </span>
      </div>
      <h3 className="text-2xl font-serif text-[var(--text-primary)] mb-8 text-center leading-snug">{question}</h3>
      <div className="grid grid-cols-1 gap-3">
        {options?.map((option, i) => (
          <button
            key={i}
            onClick={() => { setSelectedOption(option); setShowFeedback(true); }}
            disabled={showFeedback}
            className={`
              group w-full p-5 rounded-2xl border text-left transition-all duration-300 flex items-center justify-between
              ${!showFeedback ? 'hover:bg-[var(--bg-tertiary)] border-[var(--border-color)] bg-[var(--bg-primary)]/40' : 'cursor-default'}
              ${showFeedback && option === correctAnswer ? 'border-green-500/50 bg-green-500/10' : ''}
              ${showFeedback && selectedOption === option && option !== correctAnswer ? 'border-red-500/50 bg-red-500/10' : ''}
            `}
          >
            <div className="flex items-center gap-4">
              <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-[var(--bg-tertiary)] font-bold">{String.fromCharCode(65 + i)}</div>
              <span className="text-[15px] font-medium">{option}</span>
            </div>
          </button>
        ))}
      </div>
      {showFeedback && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-6 p-5 bg-[var(--bg-tertiary)]/50 rounded-2xl border border-[var(--border-color)]">
          <p className="text-[14px] text-[var(--text-secondary)] italic">{explanation}</p>
        </motion.div>
      )}
    </motion.div>
  );
};

// ─── Object Router ───────────────────────────────────────────────────────────
const ShapeRouter = ({ obj, visible, delay, index }) => {
  if (!obj) return null;
  const s = (obj.shape || obj.type || 'circle').toLowerCase();
  const props = { obj, visible, delay, index };

  const wrap = (el) => (
    <DraggableSVG key={obj.id || index} id={obj.id || index}>
      {el}
    </DraggableSVG>
  );

  switch (s) {
    case 'array':        return wrap(<RenderArray {...props} />);
    case 'pointer':      return wrap(<RenderPointer {...props} />);
    case 'comparator':   return wrap(<RenderComparator {...props} />);
    case 'circle':       return wrap(<RenderCircle {...props} />);
    case 'arrow':        return wrap(<RenderArrow {...props} id={obj.id || index} />);
    case 'text':
    case 'label':
      return wrap(
        <motion.g initial={{ opacity: 0 }} animate={visible ? { opacity: 1 } : { opacity: 0 }} transition={{ delay }}>
          <MultilineText x={safeNum(obj.x, 400)} y={safeNum(obj.y, 300)} text={obj.text || obj.label} fill={resolveColor(obj.color).text} fontSize={safeNum(obj.fontSize, 16)} fontWeight="700" />
        </motion.g>
      );
    case 'rect':
    case 'box':
      return wrap(
        <motion.g initial={{ opacity: 0 }} animate={visible ? { opacity: 1 } : { opacity: 0 }} transition={{ delay }}>
          <rect x={safeNum(obj.x, 400) - safeNum(obj.w, 100) / 2} y={safeNum(obj.y, 300) - safeNum(obj.h, 50) / 2} width={safeNum(obj.w, 100)} height={safeNum(obj.h, 50)} rx={8} fill={resolveColor(obj.color).fill} stroke={resolveColor(obj.color).stroke} strokeWidth={2} fillOpacity={0.3} />
          {obj.label && <text x={safeNum(obj.x, 400)} y={safeNum(obj.y, 300) + safeNum(obj.h, 50) / 2 + 18} textAnchor="middle" fill="#64748b" fontSize={11}>{obj.label}</text>}
        </motion.g>
      );
    case 'line':
      return wrap(
        <motion.line x1={safeNum(obj.x1, 0)} y1={safeNum(obj.y1, 0)} x2={safeNum(obj.x2, 100)} y2={safeNum(obj.y2, 100)} stroke={resolveColor(obj.color).stroke} strokeWidth={2} initial={{ pathLength: 0 }} animate={visible ? { pathLength: 1, opacity: 0.6 } : { opacity: 0 }} transition={{ delay }} />
      );
    case 'path':
      return wrap(
        <motion.path d={obj.d} fill="none" stroke={resolveColor(obj.color).stroke} strokeWidth={2} initial={{ pathLength: 0 }} animate={visible ? { pathLength: 1 } : { opacity: 0 }} transition={{ delay }} />
      );
    case 'arc':
      const cx = safeNum(obj.cx, 400), cy = safeNum(obj.cy, 300), r = safeNum(obj.r, 50);
      const start = safeNum(obj.startAngle, 0) * (Math.PI / 180), end = safeNum(obj.endAngle, 90) * (Math.PI / 180);
      const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
      const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
      const largeArc = Math.abs(end - start) > Math.PI ? 1 : 0;
      return wrap(
        <motion.path d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`} fill="none" stroke={resolveColor(obj.color).stroke} strokeWidth={3} initial={{ pathLength: 0 }} animate={visible ? { pathLength: 1 } : {}} transition={{ delay }} />
      );
    case 'badge':
      return wrap(
        <motion.g initial={{ scale: 0.8, opacity: 0 }} animate={visible ? { scale: 1, opacity: 1 } : { opacity: 0 }} transition={{ delay }}>
          <rect x={safeNum(obj.x, 400) - 40} y={safeNum(obj.y, 300) - 12} width={80} height={24} rx={12} fill={obj.bgColor || '#1e293b'} stroke={obj.textColor || '#fff'} strokeWidth={1} />
          <text x={safeNum(obj.x, 400)} y={safeNum(obj.y, 300)} textAnchor="middle" dominantBaseline="central" fill={obj.textColor || '#fff'} fontSize={10} fontWeight="900">{obj.text || 'INFO'}</text>
        </motion.g>
      );
    default: return null;
  }
};

// ─── Main Component ──────────────────────────────────────────────────────────
const CanvasRenderer = ({ objects = [], currentStepIndex = 0, steps = [] }) => {
  const safeObjects = Array.isArray(objects) ? objects : [];
  const currentStep = Array.isArray(steps) ? steps[currentStepIndex] : null;

  const visibleIds = useMemo(() => {
    if (currentStep?.objectIds?.length > 0) return new Set(currentStep.objectIds);
    return new Set(safeObjects.filter(o => safeNum(o.appearsAtStep, 0) <= currentStepIndex).map(o => o.id));
  }, [currentStep, safeObjects, currentStepIndex]);

  const delays = useMemo(() => {
    const map = {}, newIds = new Set(currentStep?.newIds || []);
    let c = 0;
    safeObjects.forEach(obj => {
      if (visibleIds.has(obj.id) && newIds.has(obj.id)) map[obj.id] = Math.min((c++) * 0.1, 0.6);
    });
    return map;
  }, [safeObjects, visibleIds, currentStep]);

  const quizzes = useMemo(() => safeObjects.filter(o => (o.shape === 'quiz' || o.type === 'quiz') && visibleIds.has(o.id)), [safeObjects, visibleIds]);

  return (
    <div className="relative w-full h-full pointer-events-none" style={{ minWidth: 800, minHeight: 600 }}>
      {/* SVG Layer for Draggable Shapes */}
      <svg
        width="800"
        height="600"
        viewBox="0 0 800 600"
        className="absolute top-0 left-0 w-full h-full"
        style={{ overflow: 'visible', pointerEvents: 'none', display: 'block' }}
      >
        <AnimatePresence>
          {safeObjects.map((obj, i) => (
            <ShapeRouter key={obj.id || i} obj={obj} visible={visibleIds.has(obj.id)} delay={delays[obj.id] || 0} index={i} />
          ))}
        </AnimatePresence>
      </svg>

      {/* HTML Layer for Overlays */}
      <div className="absolute inset-0 pointer-events-none">
        <AnimatePresence>
          {quizzes.map(q => <QuizOverlay key={q.id} obj={q} visible={true} />)}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default CanvasRenderer;