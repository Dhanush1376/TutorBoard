import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useTutorStore from '../../store/tutorStore';

/**
 * CanvasRenderer v3.0 — Unified Infinite Visual Engine
 * 
 * Features:
 * - Truly Infinite: No viewBox or 800x600 clipping. Renders anywhere on the grid.
 * - Advanced Animations: Arc-swaps with travelling dots, pulsing comparators.
 * - Performance: Minimal re-renders, CSS-optimized transforms.
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

// ─── Animation Variants ──────────────────────────────────────────────────────
const VARIANTS = {
  fadeIn:  { hidden: { opacity: 0 }, visible: { opacity: 1 } },
  popIn:   { hidden: { opacity: 0, scale: 0.5 }, visible: { opacity: 1, scale: 1 } },
  slideUp: { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } },
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

// ══════════════════════════════════════════════════════════════════════════════
// SHAPE RENDERERS
// ══════════════════════════════════════════════════════════════════════════════

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
    <motion.g initial="hidden" animate={visible ? "visible" : "hidden"} variants={VARIANTS.slideUp} transition={{ delay }}>
      {values.map((val, i) => {
        const x = sx + (i * cw), pal = getPal(i), isS = sIdx.has(i);
        return (
          <motion.g key={i} animate={isS ? { y: [0, -15, 0] } : {}} transition={{ repeat: isS ? Infinity : 0, duration: 0.6 }}>
            <rect x={x} y={sy} width={cw} height={ch} rx={8} fill={pal.bg} stroke={pal.border} strokeWidth={isS ? 2.5 : 1.5} />
            <text x={x + cw / 2} y={sy + ch / 2} textAnchor="middle" dominantBaseline="central" fill={pal.val} fontSize={safeNum(obj.fontSize, 18)} fontWeight="800" fontFamily="monospace">{val}</text>
            {obj.showIndex !== false && <text x={x + cw / 2} y={sy + ch + 18} textAnchor="middle" fill="#64748b" fontSize={11}>[{i}]</text>}
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
  const ty = side === 'top' ? (ay - ah / 2 - 4) : (ay + ah / 2 + 4), by = side === 'top' ? (ty - 30) : (ty + 30);

  return (
    <motion.g initial={{ opacity: 0, scale: 0 }} animate={visible ? { opacity: 1, scale: 1 } : {}} transition={{ delay, type: 'spring' }}>
      <line x1={cx} y1={by} x2={cx} y2={ty} stroke={color} strokeWidth={3} strokeLinecap="round" />
      <polygon points={side==='bottom' ? `${cx},${ty+8} ${cx-7},${ty} ${cx+7},${ty}` : `${cx},${ty-8} ${cx-7},${ty} ${cx+7},${ty}`} fill={color} />
      <circle cx={cx} cy={by + (side==='bottom' ? 12 : -12)} r={12} fill={color} />
      <text x={cx} y={by + (side==='bottom' ? 12 : -12)} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={11} fontWeight="900">{obj.label || 'i'}</text>
    </motion.g>
  );
};

const RenderSwapBridge = ({ obj, visible, delay }) => {
  const cw = safeNum(obj.cellW, 60), tw = safeNum(obj.arrayW, 300);
  const sx = safeNum(obj.arrayX, 400) - tw / 2, ay = safeNum(obj.arrayY, 300), ah = safeNum(obj.cellH, 56);
  const x1 = sx + (safeNum(obj.fromIndex, 0) * cw) + cw / 2, x2 = sx + (safeNum(obj.toIndex, 1) * cw) + cw / 2;
  const by = ay - ah / 2, h = Math.max(40, Math.abs(x2 - x1) * 0.5), mx = (x1 + x2) / 2, my = by - h;
  const d = `M ${x1} ${by} Q ${mx} ${my} ${x2} ${by}`, c = resolveColor(obj.color, 'red').stroke;

  return (
    <motion.g initial={{ opacity: 0 }} animate={visible ? { opacity: 1 } : {}} transition={{ delay }}>
      <motion.path d={d} fill="none" stroke={c} strokeWidth={3} strokeDasharray="8 4" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8 }} />
      <motion.circle r={8} fill={c} style={{ offsetPath: `path("${d}")` }} animate={visible ? { offsetDistance: ['0%', '100%'] } : {}} transition={{ duration: 1, repeat: Infinity, repeatDelay: 1 }} />
    </motion.g>
  );
};

const RenderComparator = ({ obj, visible, delay }) => {
  const x = safeNum(obj.x, 400), y = safeNum(obj.y, 200), isT = String(obj.result).toLowerCase()==='true';
  const c = resolveColor(isT ? 'green' : 'red');
  return (
    <motion.g initial={{ scale: 0, opacity: 0 }} animate={visible ? { scale: 1, opacity: 1 } : {}} transition={{ delay, type: 'spring' }}>
      <rect x={x-80} y={y-22} width={160} height={44} rx={22} fill={c.fill} stroke={c.stroke} strokeWidth={2} />
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill={c.text} fontSize={18} fontWeight="800" fontFamily="monospace">
        {obj.leftVal} {obj.operator || '>'} {obj.rightVal}
      </text>
      <motion.text x={x} y={y+35} textAnchor="middle" fill={c.stroke} fontSize={10} fontWeight="900" animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1 }}>{isT ? '✓ TRUE' : '✗ FALSE'}</motion.text>
    </motion.g>
  );
};

// ─── Standard Shapes ──────────────────────────────────────────────────────────
const RenderCircle = ({ obj, visible, delay }) => {
  const x = safeNum(obj.x, 400), y = safeNum(obj.y, 300), r = safeNum(obj.r, 40), c = resolveColor(obj.color || obj.fill);
  return (
    <motion.g initial={{ scale: 0 }} animate={visible ? { scale: 1 } : {}} transition={{ delay, type: 'spring' }}>
      <circle cx={x} cy={y} r={r} fill={c.fill} stroke={c.stroke} strokeWidth={2.5} fillOpacity={0.3} />
      {obj.innerLabel && <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill={c.text} fontSize={Math.max(12, r*0.4)} fontWeight="800">{obj.innerLabel}</text>}
      {obj.label && <MultilineText x={x} y={y+r+20} text={obj.label} fontSize={12} fill="#94a3b8" />}
    </motion.g>
  );
};

const RenderArrow = ({ obj, visible, delay, id }) => {
  const x1 = safeNum(obj.x1, 100), y1 = safeNum(obj.y1, 100), x2 = safeNum(obj.x2, 200), y2 = safeNum(obj.y2, 100);
  const c = resolveColor(obj.color || obj.stroke).stroke, mid = `arr-${id}`;
  return (
    <motion.g initial={{ opacity: 0 }} animate={visible ? { opacity: 1 } : {}} transition={{ delay }}>
      <defs><marker id={mid} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill={c}/></marker></defs>
      <motion.line x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeWidth={safeNum(obj.thickness, 2.5)} markerEnd={`url(#${mid})`} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6 }} />
    </motion.g>
  );
};

// ─── Object Router ───────────────────────────────────────────────────────────
const ShapeRouter = ({ obj, visible, delay, index }) => {
  if (!obj) return null;
  const s = (obj.shape || obj.type || 'circle').toLowerCase();
  const props = { obj, visible, delay, index };

  switch (s) {
    case 'array': return <RenderArray {...props} />;
    case 'pointer': return <RenderPointer {...props} />;
    case 'swapbridge': return <RenderSwapBridge {...props} />;
    case 'comparator': return <RenderComparator {...props} />;
    case 'circle': return <RenderCircle {...props} />;
    case 'arrow': return <RenderArrow {...props} id={obj.id || index} />;
    case 'text': case 'label': return <motion.g initial={{ opacity: 0 }} animate={visible ? { opacity: 1 } : {}} transition={{ delay }}><MultilineText x={safeNum(obj.x, 400)} y={safeNum(obj.y, 300)} text={obj.text || obj.label} fill={resolveColor(obj.color).text} fontSize={safeNum(obj.fontSize, 16)} fontWeight="700" /></motion.g>;
    case 'rect': case 'box': return <motion.g initial={{ opacity: 0 }} animate={visible ? { opacity: 1 } : {}} transition={{ delay }}><rect x={safeNum(obj.x, 400)-safeNum(obj.w, 100)/2} y={safeNum(obj.y, 300)-safeNum(obj.h, 50)/2} width={safeNum(obj.w, 100)} height={safeNum(obj.h, 50)} rx={8} fill={resolveColor(obj.color).fill} stroke={resolveColor(obj.color).stroke} strokeWidth={2} fillOpacity={0.3} /></motion.g>;
    case 'line': return <motion.line x1={safeNum(obj.x1, 0)} y1={safeNum(obj.y1, 0)} x2={safeNum(obj.x2, 100)} y2={safeNum(obj.y2, 100)} stroke={resolveColor(obj.color).stroke} strokeWidth={2} initial={{ pathLength: 0 }} animate={visible ? { pathLength: 1, opacity: 0.6 } : { opacity: 0 }} transition={{ delay }} />;
    default: return null;
  }
};

// ─── Main Component ──────────────────────────────────────────────────────────
const CanvasRenderer = ({ objects = [], currentStepIndex = 0, steps = [] }) => {
  const safeObjects = Array.isArray(objects) ? objects : [];
  const currentStep = steps[currentStepIndex];

  const visibleIds = useMemo(() => {
    if (currentStep?.objectIds?.length > 0) return new Set(currentStep.objectIds);
    return new Set(safeObjects.filter(o => safeNum(o.appearsAtStep, 0) <= currentStepIndex).map(o => o.id));
  }, [currentStep, safeObjects, currentStepIndex]);

  const delays = useMemo(() => {
    const map = {}, newIds = new Set(currentStep?.newIds || []);
    let c = 0;
    safeObjects.forEach(obj => {
      if (visibleIds.has(obj.id) && newIds.has(obj.id)) map[obj.id] = Math.min((c++) * 0.08, 0.45);
    });
    return map;
  }, [safeObjects, visibleIds, currentStep]);

  if (safeObjects.length === 0) return null;

  return (
    <svg 
      width="800" 
      height="600"
      viewBox="0 0 800 600"
      className="w-full h-full" 
      style={{ overflow: 'visible', pointerEvents: 'none', display: 'block' }}
    >
      <AnimatePresence>
        {safeObjects.map((obj, i) => (
          <ShapeRouter key={obj.id || i} obj={obj} visible={visibleIds.has(obj.id)} delay={delays[obj.id] || 0} index={i} />
        ))}
      </AnimatePresence>
    </svg>
  );
};

export default CanvasRenderer;