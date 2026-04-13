/**
 * CinematicShapes v3.0 — Complete Pedagogical Shape Library
 *
 * NEW in v3:
 *  - EquationBlock: Renders math equations/formulas with glowing style
 *  - TreeNode: Circular node for binary trees, tries, graphs
 *  - BarShape: Vertical bar for sorting visualizations / histograms
 *  - VennCircle: Large translucent circle for set/logic diagrams
 *  - FlowStep: Rounded pill for process flow / pipeline steps
 *  - MoleculeNode: Compact molecule/atom badge with formula support
 *  - LabelText: Full-width text label for equations, notes, axis labels
 *  - All existing shapes preserved and improved
 */

import React, { useId } from 'react';
import { motion } from 'framer-motion';

const CW = 800;
const CH = 600;
const EASE_CINEMATIC = [0.16, 1, 0.3, 1];

const PALETTE = {
  blue:   { stroke: '#60a5fa', fill: '#3b82f6', glass: 'rgba(59,130,246,0.20)',  text: '#f1f5f9', glow: '#60a5fa' },
  red:    { stroke: '#f87171', fill: '#ef4444', glass: 'rgba(239,68,68,0.20)',   text: '#f1f5f9', glow: '#f87171' },
  green:  { stroke: '#4ade80', fill: '#22c55e', glass: 'rgba(34,197,94,0.20)',   text: '#f1f5f9', glow: '#4ade80' },
  yellow: { stroke: '#fbbf24', fill: '#f59e0b', glass: 'rgba(245,158,11,0.20)',  text: '#0f172a', glow: '#fbbf24' },
  orange: { stroke: '#fb923c', fill: '#f97316', glass: 'rgba(249,115,22,0.20)',  text: '#f1f5f9', glow: '#fb923c' },
  purple: { stroke: '#c084fc', fill: '#9333ea', glass: 'rgba(168,85,247,0.20)',  text: '#f1f5f9', glow: '#c084fc' },
  cyan:   { stroke: '#22d3ee', fill: '#06b6d4', glass: 'rgba(6,182,212,0.20)',   text: '#0f172a', glow: '#22d3ee' },
  gray:   { stroke: '#94a3b8', fill: '#475569', glass: 'rgba(148,163,184,0.15)', text: '#f1f5f9', glow: '#94a3b8' },
  white:  { stroke: '#f1f5f9', fill: '#334155', glass: 'rgba(255,255,255,0.12)', text: '#f8fafc', glow: '#f1f5f9' },
};

const resolve = (name) => {
  const s = String(name || 'blue').trim().toLowerCase();
  if (PALETTE[s]) return PALETTE[s];
  // hex color passed directly
  return { stroke: s, fill: s, glass: s + '33', text: '#f8fafc', glow: s };
};

/**
 * Derives rich note colors (tape, ruled lines) from a base background color.
 */
const resolveNoteColors = (bgColor) => {
  const c = String(bgColor).toLowerCase();
  // Match demo colors
  if (c === '#fef9c3' || c === '#fbbf24') return { bg: '#fef9c3', ruled: '#fde047', tape: '#facc15' }; // Yellow
  if (c === '#dcfce7' || c === '#6ee7b7') return { bg: '#dcfce7', ruled: '#86efac', tape: '#4ade80' }; // Lime/Mint
  if (c === '#dbeafe' || c === '#7dd3fc') return { bg: '#dbeafe', ruled: '#93c5fd', tape: '#60a5fa' }; // Sky
  if (c === '#fce7f3' || c === '#fca5a5') return { bg: '#fce7f3', ruled: '#f9a8d4', tape: '#f472b6' }; // Rose/Peach
  if (c === '#ffedd5' || c === '#fdba74') return { bg: '#ffedd5', ruled: '#fdba74', tape: '#fb923c' }; // Orange/Apricot
  if (c === '#ede9fe' || c === '#c4b5fd') return { bg: '#ede9fe', ruled: '#c4b5fd', tape: '#a78bfa' }; // Lavender
  if (c === '#ccfbf1') return { bg: '#ccfbf1', ruled: '#5eead4', tape: '#2dd4bf' }; // Mint
  if (c === '#fffef9' || c === '#ffffff') return { bg: '#fffef9', ruled: '#e5e7eb', tape: '#d1d5db' }; // White
  
  // Fallback derivation
  return { bg: bgColor, ruled: 'rgba(0,0,0,0.1)', tape: 'rgba(0,0,0,0.2)' };
};

// ─── Attention Wrapper ────────────────────────────────────────────────────────
const AW = ({ attentionLevel = 1, layoutId, animation, children, cx = 0, cy = 0 }) => {
  const opacity = attentionLevel === 2 ? 1 : attentionLevel === 0 ? 0.12 : 0.82;
  const scale   = attentionLevel === 2 ? 1.07 : attentionLevel === 0 ? 0.97 : 1;
  const blur    = attentionLevel === 0 ? 'blur(2px)' : 'none';

  const aType   = animation?.type || 'fade';
  const dur     = animation?.duration || 0.5;
  const delay   = animation?.delay || 0;

  const initial =
    aType === 'slide' ? { x: cx - 60, opacity: 0 } :
    aType === 'scale' ? { scale: 0.1, opacity: 0 } :
    aType === 'draw'  ? { opacity: 0 } :
    aType === 'drop'  ? { scale: 0.2, rotate: -3, opacity: 0 } :
    aType === 'bounce' ? { scale: 0.5, opacity: 0 } :
    { opacity: 0 };

  const animate = {
    x: cx, y: cy, opacity, scale,
    rotate: (aType === 'drop' && attentionLevel !== 0) ? 0 : undefined,
    filter: blur,
    transition: aType === 'bounce' 
      ? { type: 'spring', stiffness: 500, damping: 15, delay }
      : { duration: dur, delay, ease: EASE_CINEMATIC },
  };

  return (
    <motion.g
      layoutId={layoutId}
      initial={initial}
      animate={animate}
      style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
    >
      {children}
    </motion.g>
  );
};

// ─── EXISTING SHAPES (improved) ───────────────────────────────────────────────

export const GlowOrb = ({ cx, cy, r, color, label, attentionLevel, layoutId, animation }) => {
  const c = resolve(color);
  const radius = r || 40;
  const uid = useId().replace(/:/g, '');
  const gradId = `grad-${layoutId}-${uid}`;

  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={cx} cy={cy}>
      <defs>
        <radialGradient id={gradId} cx="35%" cy="35%" r="75%">
          <stop offset="0%"   stopColor={c.text} stopOpacity="0.8" />
          <stop offset="50%"  stopColor={c.fill} stopOpacity="1" />
          <stop offset="100%" stopColor="#020617" stopOpacity="1" />
        </radialGradient>
      </defs>
      {attentionLevel === 2 && (
        <motion.circle r={radius + 14} fill="none" stroke={c.glow} strokeWidth={2}
          animate={{ opacity: [0.15, 0.55, 0.15] }} transition={{ duration: 1.8, repeat: Infinity }} />
      )}
      <circle r={radius} fill={`url(#${gradId})`} stroke={c.stroke} strokeWidth={2} filter="url(#tb-neon-glow)" />
      {label && (
        <text y={radius + 22} textAnchor="middle" fill="#e2e8f0" fontSize={13} fontWeight="700"
          style={{ fontFamily: 'system-ui, sans-serif' }}>{label}</text>
      )}
    </AW>
  );
};

export const GlassRect = ({ x, y, w, h, color, label, attentionLevel, layoutId, animation, dashed, fill = 'none' }) => {
  const c = resolve(color);
  const getFill = () => {
    if (fill === 'glass') return c.glass;
    if (fill === 'subtle') return `${c.fill}22`;
    return 'none';
  };
  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x + w / 2} cy={y + h / 2}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={12}
        fill={getFill()}
        stroke={c.stroke} strokeWidth={attentionLevel === 2 ? 2.5 : 1.5}
        strokeDasharray={dashed ? '6 4' : 'none'}
        style={fill === 'glass' ? { backdropFilter: 'blur(4px)' } : {}}
        filter="url(#tb-drop-shadow)" />
      {label && (
        <text textAnchor="middle" dominantBaseline="central" fill="#f1f5f9" fontSize={13} fontWeight="700"
          style={{ fontFamily: 'system-ui, sans-serif' }}>{label}</text>
      )}
    </AW>
  );
};

export const GlassEllipse = ({ cx, cy, rx, ry, color, label, attentionLevel, layoutId, animation, dashed, fill = 'none' }) => {
  const c = resolve(color);
  const getFill = () => {
    if (fill === 'glass') return c.glass;
    if (fill === 'subtle') return `${c.fill}22`;
    return 'none';
  };
  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={cx} cy={cy}>
      <ellipse rx={rx} ry={ry}
        fill={getFill()}
        stroke={c.stroke} strokeWidth={attentionLevel === 2 ? 2.5 : 1.5}
        strokeDasharray={dashed ? '6 4' : 'none'}
        style={fill === 'glass' ? { backdropFilter: 'blur(4px)' } : {}}
        filter="url(#tb-drop-shadow)" />
      {label && (
        <text textAnchor="middle" dominantBaseline="central" fill="#f1f5f9" fontSize={13} fontWeight="700"
          style={{ fontFamily: 'system-ui, sans-serif' }}>{label}</text>
      )}
    </AW>
  );
};

export const FlowArrow = ({ x1, y1, x2, y2, color, label, attentionLevel, layoutId, dashed, animation }) => {
  const c = resolve(color);
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const uid = useId().replace(/:/g, '');
  const mid = `m-${layoutId}-${uid}`;
  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} cx={mx} cy={my} animation={animation}>
      <defs>
        <marker id={mid} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0L10 5L0 10z" fill={c.stroke} />
        </marker>
      </defs>
      <motion.line 
        x1={x1 - mx} y1={y1 - my} x2={x2 - mx} y2={y2 - my}
        stroke={c.stroke} strokeWidth={2.5} 
        strokeDasharray={dashed ? '6 4' : 'none'}
        markerEnd={`url(#${mid})`}
        initial={animation?.type === 'draw' ? { pathLength: 0 } : {}}
        animate={animation?.type === 'draw' ? { pathLength: 1 } : {}}
        transition={{ duration: animation?.duration || 0.5, delay: animation?.delay || 0 }}
      />
      {label && <text y={-12} textAnchor="middle" fill="#94a3b8" fontSize={11}>{label}</text>}
    </AW>
  );
};

export const RawLine = ({ x1, y1, x2, y2, color, label, attentionLevel, layoutId, dashed = false, animation }) => {
  const c = resolve(color);
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} cx={mx} cy={my} animation={animation}>
      <motion.line 
        x1={x1 - mx} y1={y1 - my} x2={x2 - mx} y2={y2 - my}
        stroke={c.stroke} strokeWidth={2} strokeDasharray={dashed ? '6 4' : 'none'}
        initial={animation?.type === 'draw' ? { pathLength: 0 } : {}}
        animate={animation?.type === 'draw' ? { pathLength: 1 } : {}}
        transition={{ duration: animation?.duration || 0.5, delay: animation?.delay || 0 }}
      />
      {label && <text y={-10} textAnchor="middle" fill="#94a3b8" fontSize={11}>{label}</text>}
    </AW>
  );
};

export const DataBlock = ({ x, y, values = [], label, color, attentionLevel, layoutId, animation }) => {
  const c = resolve(color);
  const cw = 56, ch = 52;
  const totalW = values.length * cw;
  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y}>
      {label && <text y={-ch / 2 - 18} textAnchor="middle" fill="#e2e8f0" fontSize={13} fontWeight="800">{label}</text>}
      {values.map((val, i) => {
        const bx = i * cw - totalW / 2 + cw / 2;
        const isActive = attentionLevel === 2 && i === 0;
        return (
          <g key={i}>
            <rect x={bx - cw / 2 + 2} y={-ch / 2 + 2} width={cw - 4} height={ch - 4} rx={8}
              fill={isActive ? c.glass : 'rgba(30,41,59,0.85)'} stroke={c.stroke} strokeWidth={isActive ? 2 : 1} />
            <text x={bx} y={0} textAnchor="middle" dominantBaseline="central"
              fill="#fff" fontSize={17} fontWeight="800" fontFamily="monospace">{val}</text>
          </g>
        );
      })}
    </AW>
  );
};

export const FlowPointer = ({ x, y, color, label, attentionLevel, layoutId, animation }) => {
  const c = resolve(color);
  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y}>
      <polygon points="0,-18 -8,0 8,0" fill={c.stroke} />
      <rect x={-18} y={4} width={36} height={22} rx={6} fill={c.stroke} />
      <text y={15} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={11} fontWeight="900">{label || 'i'}</text>
    </AW>
  );
};

export const CodePanel = ({ x, y, code, label, attentionLevel, layoutId, animation }) => {
  const c = resolve(attentionLevel === 2 ? 'cyan' : 'gray');
  const w = 340;
  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y}>
      <rect x={-w / 2} y={-16} width={w} height={32} rx={8}
        fill={attentionLevel === 2 ? 'rgba(6,182,212,0.18)' : 'rgba(30,41,59,0.6)'}
        stroke={c.stroke} strokeWidth={attentionLevel === 2 ? 1.5 : 0.5} />
      <text x={-w / 2 + 14} y={0} dominantBaseline="central"
        fill={attentionLevel === 2 ? '#22d3ee' : '#64748b'}
        fontSize={12} fontFamily="'Courier New', Courier, monospace">{code || label}</text>
    </AW>
  );
};

export const FloatingBadge = ({ x, y, text, color, attentionLevel, layoutId, animation }) => {
  const c = resolve(color);
  const w = Math.max(60, (text || '').length * 8 + 24);
  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y}>
      <rect x={-w / 2} y={-14} width={w} height={28} rx={14}
        fill={attentionLevel === 2 ? c.fill : c.glass} stroke={c.stroke} strokeWidth={attentionLevel === 2 ? 2 : 1} />
      <text textAnchor="middle" dominantBaseline="central"
        fill={attentionLevel === 2 ? '#fff' : c.stroke} fontSize={12} fontWeight="800">{text}</text>
    </AW>
  );
};

export const SwapBridge = ({ x, y, color, attentionLevel, layoutId, animation }) => {
  const c = resolve(color);
  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y}>
      <motion.path d="M-50,0 Q0,-55 50,0" fill="none" stroke={c.stroke} strokeWidth={3} strokeDasharray="5 4"
        animate={attentionLevel === 2 ? { strokeDashoffset: [0, -18] } : {}}
        transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }} />
      <circle cx={-50} cy={0} r={5} fill={c.stroke} />
      <circle cx={50} cy={0} r={5} fill={c.stroke} />
    </AW>
  );
};

export const Comparator = ({ x, y, leftVal, rightVal, operator, result, color, attentionLevel, layoutId, animation }) => {
  const isTrue = String(result).toLowerCase() === 'true';
  const c = resolve(isTrue ? 'red' : 'green');
  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y}>
      <rect x={-100} y={-24} width={200} height={48} rx={24}
        fill={c.glass} stroke={c.stroke} strokeWidth={attentionLevel === 2 ? 2.5 : 1.5} />
      <text x={-52} y={0} textAnchor="middle" dominantBaseline="central"
        fill="#fff" fontSize={18} fontWeight="800" fontFamily="monospace">{leftVal}</text>
      <text x={0} y={0} textAnchor="middle" dominantBaseline="central"
        fill={c.stroke} fontSize={16} fontWeight="700">{operator}</text>
      <text x={52} y={0} textAnchor="middle" dominantBaseline="central"
        fill="#fff" fontSize={18} fontWeight="800" fontFamily="monospace">{rightVal}</text>
    </AW>
  );
};

export const DataDot = ({ x, y, color, label, attentionLevel, layoutId, animation }) => {
  const c = resolve(color);
  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y}>
      <circle r={attentionLevel === 2 ? 10 : 7} fill={c.stroke} />
      {label && <text y={20} textAnchor="middle" fill={c.text} fontSize={10} fontWeight="bold">{label}</text>}
    </AW>
  );
};

export const CartesianAxes = ({ x, y, color, label, attentionLevel, layoutId, animation }) => {
  const c = resolve(color || 'gray');
  const w = 380, h = 280;
  const ticks = [-3, -2, -1, 0, 1, 2, 3];
  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y}>
      {ticks.map(t => (
        <g key={t}>
          <line x1={t * (w / 8)} y1={-h / 2} x2={t * (w / 8)} y2={h / 2}
            stroke="#334155" strokeWidth={0.5} />
          <line x1={-w / 2} y1={t * (h / 8)} x2={w / 2} y2={t * (h / 8)}
            stroke="#334155" strokeWidth={0.5} />
        </g>
      ))}
      <line x1={-w / 2} y1={0} x2={w / 2} y2={0} stroke={c.stroke} strokeWidth={2.5} />
      <line x1={0} y1={-h / 2} x2={0} y2={h / 2} stroke={c.stroke} strokeWidth={2.5} />
      <text x={w / 2 + 12} y={4} fill={c.stroke} fontSize={13} fontWeight="700">x</text>
      <text x={6} y={-h / 2 - 10} fill={c.stroke} fontSize={13} fontWeight="700">y</text>
      {label && <text y={-h / 2 - 28} textAnchor="middle" fill={c.text} fontSize={14} fontWeight="bold">{label}</text>}
    </AW>
  );
};

export const GeometryPolygon = ({ x, y, points, color, label, attentionLevel, layoutId, animation, dashed, fill = 'none' }) => {
  const c = resolve(color);
  const pts = Array.isArray(points) && points.length > 2 ? points : [[0, 0], [60, 100], [-60, 100]];
  const pstr = pts.map(p => `${p[0]},${p[1]}`).join(' ');
  const getFill = () => {
    if (fill === 'glass') return c.glass;
    if (fill === 'subtle') return `${c.fill}22`;
    return 'none';
  };
  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y}>
      <polygon points={pstr} 
        fill={getFill()} 
        stroke={c.stroke} strokeWidth={attentionLevel === 2 ? 3 : 2}
        strokeDasharray={dashed ? '6 4' : 'none'}
        style={fill === 'glass' ? { backdropFilter: 'blur(4px)' } : {}}
      />
      {label && <text y={pts[0][1] - 18} textAnchor="middle" fill={c.text} fontSize={13} fontWeight="bold">{label}</text>}
    </AW>
  );
};

// ─── NEW SHAPES ────────────────────────────────────────────────────────────────

/**
 * EquationBlock — For math equations, formulas, expressions
 * Renders with a glowing monospace style
 */
export const EquationBlock = ({ x, y, label, color, attentionLevel, layoutId, animation }) => {
  const c = resolve(color || 'cyan');
  const text = label || '';
  const w = Math.max(160, text.length * 11 + 32);

  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y}>
      <rect x={-w / 2} y={-22} width={w} height={44} rx={10}
        fill={attentionLevel === 2 ? c.glass : 'rgba(15,23,42,0.7)'}
        stroke={c.stroke} strokeWidth={attentionLevel === 2 ? 2.5 : 1}
        filter={attentionLevel === 2 ? 'url(#tb-neon-glow)' : 'none'} />
      <text textAnchor="middle" dominantBaseline="central"
        fill={attentionLevel === 2 ? c.stroke : '#94a3b8'}
        fontSize={15} fontWeight="700" fontFamily="'Courier New', Courier, monospace"
        letterSpacing="0.5">{text}</text>
    </AW>
  );
};

/**
 * TreeNode — Binary tree / graph nodes with value labels
 */
export const TreeNode = ({ x, y, label, color, attentionLevel, layoutId, animation }) => {
  const c = resolve(color || 'blue');
  const r = attentionLevel === 2 ? 32 : 28;
  const uid = useId().replace(/:/g, '');
  const gid = `tn-${uid}`;

  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y}>
      <defs>
        <radialGradient id={gid} cx="38%" cy="38%" r="72%">
          <stop offset="0%" stopColor={c.text} stopOpacity="0.5" />
          <stop offset="100%" stopColor={c.fill} stopOpacity="1" />
        </radialGradient>
      </defs>
      {attentionLevel === 2 && (
        <circle r={r + 10} fill="none" stroke={c.glow} strokeWidth={1.5} strokeDasharray="3 3">
          <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="6s" repeatCount="indefinite" />
        </circle>
      )}
      <circle r={r} fill={`url(#${gid})`} stroke={c.stroke} strokeWidth={attentionLevel === 2 ? 2.5 : 1.5} />
      <text textAnchor="middle" dominantBaseline="central"
        fill="#fff" fontSize={14} fontWeight="900" fontFamily="monospace">{label}</text>
    </AW>
  );
};

/**
 * BarShape — Vertical bar for sorting, histograms, comparisons
 * scale controls height (0.1–2.0 = 10%–200% of base height)
 */
export const BarShape = ({ x, y, label, color, attentionLevel, layoutId, animation, scale = 1 }) => {
  const c = resolve(color || 'blue');
  const baseH = 160;
  const bw = 44;
  const bh = Math.max(20, baseH * Math.min(2, Math.max(0.05, scale)));

  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y}>
      <rect x={-bw / 2} y={-bh} width={bw} height={bh} rx={6}
        fill={attentionLevel === 2 ? c.fill : c.glass}
        stroke={c.stroke} strokeWidth={attentionLevel === 2 ? 2.5 : 1.5} />
      {label && (
        <text y={-bh - 12} textAnchor="middle" fill={c.stroke}
          fontSize={12} fontWeight="800">{label}</text>
      )}
    </AW>
  );
};

/**
 * VennCircle — Large translucent circle for Venn/set diagrams
 */
export const VennCircle = ({ x, y, label, color, attentionLevel, layoutId, animation, scale = 1 }) => {
  const c = resolve(color || 'blue');
  const r = 110 * Math.max(0.4, scale);

  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y}>
      <circle r={r}
        fill={attentionLevel === 2 ? `${c.fill}44` : `${c.fill}22`}
        stroke={c.stroke} strokeWidth={attentionLevel === 2 ? 3 : 2}
        strokeDasharray={attentionLevel === 0 ? '6 6' : 'none'} />
      {label && (
        <text y={-r - 14} textAnchor="middle"
          fill={c.stroke} fontSize={14} fontWeight="800">{label}</text>
      )}
    </AW>
  );
};

/**
 * FlowStep — Rounded process step / pipeline stage
 */
export const FlowStep = ({ x, y, label, color, attentionLevel, layoutId, animation, fontSize }) => {
  const c = resolve(color || 'blue');
  const text = label || '';
  const w = Math.max(110, text.length * 9 + 28);
  const h = 48;

  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2}
        fill={attentionLevel === 2 ? c.fill : c.glass}
        stroke={c.stroke} strokeWidth={attentionLevel === 2 ? 2.5 : 1.5}
        filter={attentionLevel === 2 ? 'url(#tb-drop-shadow)' : 'none'} />
      <text textAnchor="middle" dominantBaseline="central"
        fill={attentionLevel === 2 ? '#fff' : c.stroke}
        fontSize={fontSize || 13} fontWeight="700"
        style={{ fontFamily: 'system-ui, sans-serif' }}>{text}</text>
    </AW>
  );
};

/**
 * MoleculeNode — Chemical formula / atom badge
 */
export const MoleculeNode = ({ x, y, label, color, attentionLevel, layoutId, animation }) => {
  const c = resolve(color || 'green');
  const text = label || '';
  const w = Math.max(56, text.length * 11 + 24);
  const uid = useId().replace(/:/g, '');
  const gid = `mol-${uid}`;

  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y}>
      <defs>
        <radialGradient id={gid} cx="35%" cy="35%" r="70%">
          <stop offset="0%" stopColor={c.text} stopOpacity="0.4" />
          <stop offset="100%" stopColor={c.fill} stopOpacity="0.9" />
        </radialGradient>
      </defs>
      {attentionLevel === 2 && (
        <motion.circle r={w / 2 + 10} fill="none" stroke={c.glow} strokeWidth={1.5}
          animate={{ r: [w / 2 + 8, w / 2 + 16, w / 2 + 8] }}
          transition={{ duration: 2, repeat: Infinity }} />
      )}
      <ellipse rx={w / 2} ry={24}
        fill={`url(#${gid})`} stroke={c.stroke} strokeWidth={attentionLevel === 2 ? 2.5 : 1.5} />
      <text textAnchor="middle" dominantBaseline="central"
        fill="#fff" fontSize={14} fontWeight="900"
        fontFamily="'Courier New', monospace">{text}</text>
    </AW>
  );
};

/**
 * LabelText — Full-width text for equations, axis labels, annotations
 */
export const LabelText = ({ x, y, label, color, attentionLevel, layoutId, animation, fontSize }) => {
  const c = resolve(color || 'white');
  const opacity = attentionLevel === 0 ? 0.2 : attentionLevel === 2 ? 1 : 0.75;

  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y}>
      <text textAnchor="middle" dominantBaseline="central"
        fill={c.stroke} fontSize={fontSize || 14} fontWeight="600" opacity={opacity}
        style={{ fontFamily: 'system-ui, sans-serif' }}>{label}</text>
    </AW>
  );
};

/**
 * FreeformShape — Fallback for unknown/AI-invented types
 */
export const FreeformShape = ({ layoutId, attentionLevel, x, y, label, color, type, animation }) => {
  const c = resolve(color);
  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y}>
      <rect x={-65} y={-32} width={130} height={64} rx={12}
        fill={c.glass} stroke={c.stroke} strokeWidth={2} />
      {label && (
        <text textAnchor="middle" dominantBaseline="middle"
          fill={c.text} fontSize={12} fontWeight="600">{label}</text>
      )}
      <text y={-40} textAnchor="middle" dominantBaseline="middle"
        fill={c.stroke} fillOpacity={0.6} fontSize={8} fontWeight="700"
        style={{ textTransform: 'uppercase', letterSpacing: '2px' }}>[{type}]</text>
    </AW>
  );
};

/**
 * StickyNote — A premium pedagogical sticky note with tape, ruled lines, and folded corner
 */
export const StickyNoteShape = ({ x, y, w, h, label, color, attentionLevel, layoutId, animation }) => {
  const col = resolveNoteColors(color || '#fef9c3');
  const width = w || 180;
  const height = h || 180;
  const fontSize = Math.max(12, Math.min(width, height) / 12);
  const lineH = fontSize * 1.75;
  
  // Ruled lines paths
  const lines = [];
  for (let ly = lineH * 2.5; ly < height - 10; ly += lineH) {
    lines.push(`M ${-width/2 + 8} ${-height/2 + ly} L ${width/2 - 8} ${-height/2 + ly}`);
  }

  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y}>
      {/* Note Body with shadow */}
      <rect x={-width/2} y={-height/2} width={width} height={height} rx={2}
        fill={col.bg} filter="url(#tb-drop-shadow)" />
      
      {/* Ruled Lines */}
      {lines.map((d, i) => (
        <path key={i} d={d} stroke={col.ruled} strokeWidth={1} fill="none" opacity={0.6} />
      ))}

      {/* Folded Corner (Bottom Right) */}
      <path d={`M ${width/2 - 18} ${height/2} L ${width/2} ${height/2 - 18} L ${width/2} ${height/2} Z`}
        fill="rgba(0,0,0,0.08)" />
      <path d={`M ${width/2 - 14} ${height/2} L ${width/2} ${height/2 - 14} L ${width/2} ${height/2} Z`}
        fill={col.tape} opacity={0.25} />

      {/* Tape Strip (Top Center) */}
      <rect x={-22} y={-height/2 - 8} width={44} height={18} rx={1}
        fill={col.tape} opacity={0.5} />
      {/* Tape Texture (diagonal stripes) */}
      <g opacity={0.15}>
        <path d="M-20,-height/2-6 L-14,-height/2+8 M-12,-height/2-6 L-6,-height/2+8 M-4,-height/2-6 L2,-height/2+8 M10,-height/2-6 L16,-height/2+8" 
          stroke="white" strokeWidth={1} />
      </g>

      {/* Label Text */}
      <foreignObject x={-width/2 + 12} y={-height/2 + 8} width={width - 24} height={height - 24}>
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: "'Caveat', cursive, 'Comic Sans MS', cursive",
          fontSize: `${fontSize}px`,
          color: 'rgba(0,0,0,0.7)',
          lineHeight: 1.75,
          overflow: 'hidden',
          wordWrap: 'break-word',
          textAlign: 'left'
        }}>
          {label}
        </div>
      </foreignObject>
    </AW>
  );
};

// ─── SVG Filters ──────────────────────────────────────────────────────────────
export const CinematicFilters = () => (
  <defs>
    <filter id="tb-neon-glow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="5" result="blur" />
      <feFlood floodColor="white" floodOpacity="0.15" result="flood" />
      <feComposite in="flood" in2="blur" operator="in" result="glow" />
      <feComposite in="SourceGraphic" in2="glow" operator="over" />
    </filter>
    <filter id="tb-drop-shadow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="blur" />
      <feOffset dx="0" dy="6" result="off" />
      <feComponentTransfer><feFuncA type="linear" slope="0.4" /></feComponentTransfer>
      <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
  </defs>
);