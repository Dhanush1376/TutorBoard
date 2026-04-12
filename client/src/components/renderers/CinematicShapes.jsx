/**
 * CinematicShapes v2.5 — Premium Pedagogical Shape Components
 *
 * This version is a robust, self-contained library for the Cinematic Renderer.
 * It implements a 3-Tier Attention System:
 *   Level 2 (Active Focus):  1.1x scale + Intense Glow
 *   Level 1 (Normal logic):  1.0x scale + Standard Visibility
 *   Level 0 (Semantic BG):   0.15x opacity + 3px Blur
 */

import React, { useId } from 'react';
import { motion } from 'framer-motion';

// --- Constants & Helpers ---
const CW = 800;
const CH = 600;
const EASE_CINEMATIC = [0.16, 1, 0.3, 1];

const PALETTE = {
  blue:    { stroke: '#60a5fa', fill: '#3b82f6', glass: 'rgba(59,130,246,0.22)', text: '#f1f5f9', glow: '#60a5fa' },
  red:     { stroke: '#f87171', fill: '#ef4444', glass: 'rgba(239,68,68,0.22)',  text: '#f1f5f9', glow: '#f87171' },
  green:   { stroke: '#4ade80', fill: '#22c55e', glass: 'rgba(34,197,94,0.22)',  text: '#f1f5f9', glow: '#4ade80' },
  yellow:  { stroke: '#fbbf24', fill: '#f59e0b', glass: 'rgba(234,179,8,0.22)',  text: '#f1f5f9', glow: '#fbbf24' },
  orange:  { stroke: '#fb923c', fill: '#f97316', glass: 'rgba(249,115,22,0.22)', text: '#f1f5f9', glow: '#fb923c' },
  purple:  { stroke: '#c084fc', fill: '#9333ea', glass: 'rgba(168,85,247,0.22)', text: '#f1f5f9', glow: '#c084fc' },
  cyan:    { stroke: '#22d3ee', fill: '#06b6d4', glass: 'rgba(6,182,212,0.22)',  text: '#f1f5f9', glow: '#22d3ee' },
  gray:    { stroke: '#94a3b8', fill: '#475569', glass: 'rgba(148,163,184,0.18)',text: '#f1f5f9', glow: '#94a3b8' },
  white:   { stroke: '#f1f5f9', fill: '#334155', glass: 'rgba(255,255,255,0.15)',text: '#f8fafc', glow: '#f1f5f9' },
};

const resolve = (name) => {
  const s = String(name || 'blue').trim().toLowerCase();
  return PALETTE[s] || { stroke: s, fill: s, glass: s + '22', text: '#f8fafc', glow: s };
};

// --- Layer Wrapper ---
const AttentionWrapper = ({ attentionLevel, layoutId, x, y, animation, children }) => {
  const opacity = attentionLevel === 2 ? 1 : attentionLevel === 0 ? 0.15 : 0.8;
  const scale = attentionLevel === 2 ? 1.08 : attentionLevel === 0 ? 0.95 : 1;
  const blur = attentionLevel === 0 ? 'blur(3px)' : 'none';

  // Animation hints (fade, draw, slide, scale)
  const animType = animation?.type || 'fade';
  const duration = animation?.duration || 0.5;
  const delay = animation?.delay || 0;

  const variants = {
    initial: animType === 'slide' ? { x: x - 50, opacity: 0 } : 
             animType === 'scale' ? { scale: 0, opacity: 0 } : 
             { opacity: 0 },
    animate: { 
      x, y, opacity, scale, filter: blur,
      transition: { duration, delay, ease: EASE_CINEMATIC }
    }
  };

  return (
    <motion.g
      layoutId={layoutId}
      initial="initial"
      animate="animate"
      variants={variants}
      style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
    >
      {children}
    </motion.g>
  );
};


// --- Shape Components ---

export const GlowOrb = ({ cx, cy, r, color, label, attentionLevel, layoutId }) => {
  const c = resolve(color);
  const radius = r || 40;
  const uid = useId();
  const gradId = `grad-${layoutId}-${uid.replace(/:/g, '')}`;

  return (
    <AttentionWrapper attentionLevel={attentionLevel} layoutId={layoutId} x={cx} y={cy}>
      <defs>
        <radialGradient id={gradId} cx="35%" cy="35%" r="75%">
          <stop offset="0%" stopColor={c.text} stopOpacity="0.85" />
          <stop offset="50%" stopColor={c.fill} stopOpacity="1" />
          <stop offset="100%" stopColor="#020617" stopOpacity="1" />
        </radialGradient>
      </defs>

      {attentionLevel === 2 && (
        <motion.circle
          r={radius + 12}
          fill="none" stroke={c.glow} strokeWidth={2}
          animate={{ opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}

      <circle r={radius} fill={`url(#${gradId})`} stroke={c.stroke} strokeWidth={2} filter="url(#tb-neon-glow)" />
      
      {label && (
        <text y={radius + 24} textAnchor="middle" fill="#e2e8f0" fontSize={14} fontWeight="700">
          {label}
        </text>
      )}
    </AttentionWrapper>
  );
};

export const GlassRect = ({ x, y, w, h, color, label, attentionLevel, layoutId }) => {
  const c = resolve(color);
  
  return (
    <AttentionWrapper attentionLevel={attentionLevel} layoutId={layoutId} x={x + w/2} y={y + h/2}>
      <rect x={-w/2} y={-h/2} width={w} height={h} rx={12} 
        fill={c.glass} stroke={c.stroke} strokeWidth={attentionLevel === 2 ? 2.5 : 1.5}
        filter="url(#tb-drop-shadow)" />
      
      {label && (
        <text textAnchor="middle" dominantBaseline="central" fill="#f1f5f9" fontSize={14} fontWeight="700">
          {label}
        </text>
      )}
    </AttentionWrapper>
  );
};

export const FlowArrow = ({ x1, y1, x2, y2, color, label, attentionLevel, layoutId }) => {
  const c = resolve(color);
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const rx1 = x1 - mx, ry1 = y1 - my;
  const rx2 = x2 - mx, ry2 = y2 - my;
  const uid = useId();
  const markerId = `marker-${layoutId}-${uid.replace(/:/g, '')}`;

  return (
    <AttentionWrapper attentionLevel={attentionLevel} layoutId={layoutId} x={mx} y={my}>
      <defs>
        <marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0L10 5L0 10z" fill={c.stroke} />
        </marker>
      </defs>
      <line x1={rx1} y1={ry1} x2={rx2} y2={ry2} stroke={c.stroke} strokeWidth={2.5} markerEnd={`url(#${markerId})`} />
      {label && <text y={-12} textAnchor="middle" fill="#94a3b8" fontSize={12}>{label}</text>}
    </AttentionWrapper>
  );
};

export const RawLine = ({ x1, y1, x2, y2, color, label, attentionLevel, layoutId, dashed = false }) => {
  const c = resolve(color);
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const rx1 = x1 - mx, ry1 = y1 - my;
  const rx2 = x2 - mx, ry2 = y2 - my;

  return (
    <AttentionWrapper attentionLevel={attentionLevel} layoutId={layoutId} x={mx} y={my}>
      <line 
        x1={rx1} y1={ry1} x2={rx2} y2={ry2} 
        stroke={c.stroke} 
        strokeWidth={2.5} 
        strokeDasharray={dashed ? "5 5" : "none"} 
      />
      {label && <text y={-12} textAnchor="middle" fill="#94a3b8" fontSize={12} fontWeight="bold">{label}</text>}
    </AttentionWrapper>
  );
};

export const DataBlock = ({ x, y, values = [], label, color, attentionLevel, layoutId }) => {
  const c = resolve(color);
  const cw = 60, ch = 56;
  const totalW = values.length * cw;

  return (
    <AttentionWrapper attentionLevel={attentionLevel} layoutId={layoutId} x={x} y={y}>
      {label && <text y={-ch/2 - 20} textAnchor="middle" fill="#e2e8f0" fontSize={14} fontWeight="800">{label}</text>}
      {values.map((val, i) => {
        const cx = (i * cw) - totalW/2 + cw/2;
        return (
          <g key={i}>
            <rect x={cx - cw/2 + 2} y={-ch/2 + 2} width={cw-4} height={ch-4} rx={8} 
              fill="rgba(30, 41, 59, 0.8)" stroke={c.stroke} strokeWidth={1} />
            <text x={cx} y={0} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={18} fontWeight="800">{val}</text>
          </g>
        );
      })}
    </AttentionWrapper>
  );
};

export const FlowPointer = ({ x, y, color, label, attentionLevel, layoutId }) => {
  const c = resolve(color);
  return (
    <AttentionWrapper attentionLevel={attentionLevel} layoutId={layoutId} x={x} y={y}>
      <path d="M0,0 L-7,15 L7,15 Z" fill={c.stroke} transform="translate(0, 32) rotate(180)" />
      <rect x={-15} y={48} width={30} height={20} rx={6} fill={c.stroke} />
      <text y={58} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={12} fontWeight="900">{label || 'i'}</text>
    </AttentionWrapper>
  );
};

export const CodePanel = ({ x, y, code, attentionLevel, layoutId }) => {
  const c = resolve('blue');
  const w = 300;
  return (
    <AttentionWrapper attentionLevel={attentionLevel} layoutId={layoutId} x={x} y={y}>
      <rect x={-w/2} y={-14} width={w} height={28} rx={6} fill={attentionLevel === 2 ? c.glass : 'transparent'} />
      <text x={-w/2 + 10} y={0} dominantBaseline="central" fill={attentionLevel === 2 ? '#fff' : '#475569'} fontSize={13} fontFamily="monospace">{code}</text>
    </AttentionWrapper>
  );
};

export const FloatingBadge = ({ x, y, text, color, attentionLevel, layoutId }) => {
  const c = resolve(color);
  const w = text.length * 9 + 20;
  return (
    <AttentionWrapper attentionLevel={attentionLevel} layoutId={layoutId} x={x} y={y}>
      <rect x={-w/2} y={-12} width={w} height={24} rx={12} fill={c.stroke} />
      <text textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={11} fontWeight="900">{text}</text>
    </AttentionWrapper>
  );
};

export const SwapBridge = ({ x, y, color, attentionLevel, layoutId }) => {
  const c = resolve(color);
  return (
    <AttentionWrapper attentionLevel={attentionLevel} layoutId={layoutId} x={x} y={y}>
      <path d="M-40,0 Q0,-40 40,0" fill="none" stroke={c.stroke} strokeWidth={3} strokeDasharray="4 4" />
      <circle cx={-40} cy={0} r={4} fill={c.stroke} />
      <circle cx={40} cy={0} r={4} fill={c.stroke} />
    </AttentionWrapper>
  );
};

export const Comparator = ({ x, y, leftVal, rightVal, operator, result, color, attentionLevel, layoutId }) => {
  const isTrue = String(result).toLowerCase() === 'true';
  const c = resolve(isTrue ? 'green' : 'red');
  const w = 180;
  return (
    <AttentionWrapper attentionLevel={attentionLevel} layoutId={layoutId} x={x} y={y}>
      <rect x={-w/2} y={-20} width={w} height={40} rx={20} fill={c.glass} stroke={c.stroke} strokeWidth={2} />
      <text x={-50} y={0} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={18} fontWeight="800" fontFamily="monospace">{leftVal}</text>
      <text x={0} y={0} textAnchor="middle" dominantBaseline="central" fill={c.stroke} fontSize={16} fontWeight="700">{operator}</text>
      <text x={50} y={0} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={18} fontWeight="800" fontFamily="monospace">{rightVal}</text>
    </AttentionWrapper>
  );
};

export const DepthText = ({ x, y, text, attentionLevel, layoutId }) => {
  return (
    <AttentionWrapper attentionLevel={attentionLevel} layoutId={layoutId} x={x} y={y}>
      <rect x={-100} y={-15} width={200} height={30} rx={6} fill="rgba(15, 23, 42, 0.75)" />
      <text textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={16} fontWeight="600">{text}</text>
    </AttentionWrapper>
  );
};

export const WavePath = ({ d, color, attentionLevel, layoutId }) => {
  const c = resolve(color);
  const opacity = attentionLevel === 2 ? 0.9 : attentionLevel === 0 ? 0.1 : 0.6;
  return (
    <motion.path
      layoutId={layoutId}
      d={d}
      fill="none" stroke={c.stroke} strokeWidth={3}
      animate={{ opacity }}
      transition={{ duration: 0.5 }}
    />
  );
};

export const HighlightZone = ({ x, y, w, h, color, label, attentionLevel, layoutId }) => {
  const c = resolve(color);
  return (
    <AttentionWrapper attentionLevel={attentionLevel} layoutId={layoutId} x={x} y={y}>
      <rect x={-w/2} y={-h/2} width={w} height={h} rx={12} fill={c.glass} stroke={c.stroke} strokeWidth={2} strokeDasharray="5 5" />
      {label && <text y={-h/2 - 10} textAnchor="middle" fill={c.stroke} fontSize={12} fontWeight="700">{label}</text>}
    </AttentionWrapper>
  );
};

// ─── Geometric & Plot Shapes (ML/Math) ─────────────────────────────────────────

export const DataDot = ({ x, y, color, label, attentionLevel, layoutId }) => {
  const c = resolve(color);
  return (
    <AttentionWrapper attentionLevel={attentionLevel} layoutId={layoutId} x={x} y={y}>
      <circle r={8} fill={c.stroke} />
      {label && <text y={18} textAnchor="middle" fill={c.text} fontSize={10} fontWeight="bold">{label}</text>}
    </AttentionWrapper>
  );
};

export const CartesianAxes = ({ x, y, color, label, attentionLevel, layoutId }) => {
  const c = resolve(color || 'gray');
  const w = 400; // Plot width
  const h = 300; // Plot height
  return (
    <AttentionWrapper attentionLevel={attentionLevel} layoutId={layoutId} x={x} y={y}>
      {/* Y Axis */}
      <line x1={-w/2} y1={h/2} x2={-w/2} y2={-h/2} stroke={c.stroke} strokeWidth={2} />
      {/* X Axis */}
      <line x1={-w/2} y1={h/2} x2={w/2} y2={h/2} stroke={c.stroke} strokeWidth={2} />
      {label && <text y={-h/2 - 10} textAnchor="middle" fill={c.text} fontSize={16} fontWeight="bold">{label}</text>}
    </AttentionWrapper>
  );
};

export const GeometryPolygon = ({ x, y, points, color, label, attentionLevel, layoutId }) => {
  const c = resolve(color);
  // points should be an array like [[0,0], [100,0], [0,-100]] relative to x,y
  // Handle fallback if points is missing or invalid
  const validPoints = Array.isArray(points) && points.length > 2 
    ? points 
    : [[0,0], [50, 80], [-50, 80]]; 
    
  const ptsString = validPoints.map(p => `${p[0]},${p[1]}`).join(' ');

  return (
    <AttentionWrapper attentionLevel={attentionLevel} layoutId={layoutId} x={x} y={y}>
      <polygon 
        points={ptsString} 
        fill={c.glass} 
        stroke={c.stroke} 
        strokeWidth={attentionLevel === 2 ? 3 : 2} 
      />
      {label && <text y={validPoints[0][1] - 20} textAnchor="middle" fill={c.text} fontSize={14} fontWeight="bold">{label}</text>}
    </AttentionWrapper>
  );
};

// ─── Freeform (AI-Invented) Component ──────────────────────────────────────────
export const FreeformShape = ({ layoutId, attentionLevel, x, y, label, color, type }) => {
  const p = resolve(color);
  const isHigh = attentionLevel === 2;

  return (
    <AttentionWrapper attentionLevel={attentionLevel} layoutId={layoutId} x={x} y={y}>
      <rect
        x={-60} y={-30} width={120} height={60} rx={12}
        fill={p.glass}
        stroke={p.stroke}
        strokeWidth={2}
      />
      {label && (
        <text
          textAnchor="middle" dominantBaseline="middle"
          fill={p.text}
          fontSize={11}
          fontWeight={isHigh ? 'bold' : 'normal'}
          className="select-none"
        >
          {label}
        </text>
      )}
      <text
        y={-38}
        textAnchor="middle" dominantBaseline="middle"
        fill={p.stroke}
        fillOpacity={0.8}
        fontSize={8}
        fontWeight="bold"
        className="select-none uppercase tracking-widest"
      >
        [{type}]
      </text>
      {isHigh && (
        <circle cx={0} cy={0} r={65} fill="none" stroke={p.stroke} strokeWidth={1} strokeOpacity={0.5} strokeDasharray="4 4">
          <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="10s" repeatCount="indefinite" />
        </circle>
      )}
    </AttentionWrapper>
  );
};

export const CinematicFilters = () => (
  <defs>
    <filter id="tb-neon-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4" result="blur" />
      <feFlood floodColor="white" floodOpacity="0.2" result="flood" />
      <feComposite in="flood" in2="blur" operator="in" result="glow" />
      <feComposite in="SourceGraphic" in2="glow" operator="over" />
    </filter>
    <filter id="tb-drop-shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="4.5" result="blur" />
      <feOffset dx="0" dy="8" result="offsetBlur" />
      <feComponentTransfer><feFuncA type="linear" slope="0.55" /></feComponentTransfer>
      <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
  </defs>
);
