/**
 * CinematicShapes — Premium 3-Layer Shape Components
 * 
 * Every shape implements:
 *   Layer 1 — Spring-based entry animation
 *   Layer 2 — Continuous micro-interactions (glow, pulse, float, breathe)
 *   Layer 3 — SVG filter effects (depth shadow, neon bloom, glassmorphism)
 * 
 * All shapes are Framer Motion-powered SVG groups. No GSAP.
 * Designed as drop-in replacements for CanvasRenderer shapes.
 */

import React, { useId } from 'react';
import { motion } from 'framer-motion';
import animEngine from '../../engine/UniversalAnimationEngine.js';
import {
  SPRING_STANDARD, SPRING_BOUNCY, SPRING_SNAPPY,
  EASE_CINEMATIC, EASE_OUT, EASE_OVERSHOOT,
  calculateStaggerDelay,
} from '../../engine/animationPresets.js';

// ─── Shared Helpers ──────────────────────────────────────────────────────────

const safeNum = (v, d = 0) => {
  const n = parseFloat(v);
  return isNaN(n) ? d : n;
};

const CW = 800;
const CH = 600;

// ─── Color Registry ──────────────────────────────────────────────────────────

const PALETTE = {
  blue:    { stroke: '#38bdf8', fill: '#0c4a6e', glass: 'rgba(14,165,233,0.12)', text: '#bae6fd', glow: '#0ea5e9' },
  red:     { stroke: '#f87171', fill: '#7f1d1d', glass: 'rgba(239,68,68,0.12)',  text: '#fca5a5', glow: '#ef4444' },
  green:   { stroke: '#4ade80', fill: '#14532d', glass: 'rgba(34,197,94,0.12)',  text: '#86efac', glow: '#22c55e' },
  yellow:  { stroke: '#facc15', fill: '#713f12', glass: 'rgba(234,179,8,0.12)',  text: '#fde047', glow: '#eab308' },
  orange:  { stroke: '#fb923c', fill: '#7c2d12', glass: 'rgba(249,115,22,0.12)', text: '#fdba74', glow: '#f97316' },
  purple:  { stroke: '#c084fc', fill: '#581c87', glass: 'rgba(168,85,247,0.12)', text: '#d8b4fe', glow: '#a855f7' },
  cyan:    { stroke: '#22d3ee', fill: '#164e63', glass: 'rgba(6,182,212,0.12)',  text: '#67e8f9', glow: '#06b6d4' },
  teal:    { stroke: '#2dd4bf', fill: '#134e4a', glass: 'rgba(20,184,166,0.12)', text: '#5eead4', glow: '#14b8a6' },
  pink:    { stroke: '#f472b6', fill: '#831843', glass: 'rgba(236,72,153,0.12)', text: '#f9a8d4', glow: '#ec4899' },
  gold:    { stroke: '#fbbf24', fill: '#78350f', glass: 'rgba(245,158,11,0.12)', text: '#fcd34d', glow: '#f59e0b' },
  gray:    { stroke: '#94a3b8', fill: '#1e293b', glass: 'rgba(148,163,184,0.08)',text: '#cbd5e1', glow: '#64748b' },
  white:   { stroke: '#e2e8f0', fill: '#0f172a', glass: 'rgba(255,255,255,0.06)',text: '#f8fafc', glow: '#94a3b8' },
};

const resolve = (name) => {
  if (!name) return PALETTE.blue;
  const s = String(name).trim().toLowerCase();
  return PALETTE[s] || { stroke: s, fill: s, glass: s + '15', text: '#f8fafc', glow: s };
};

// ─── Text Helper ─────────────────────────────────────────────────────────────

const wrapText = (text, maxChars = 22) => {
  if (!text) return [];
  const words = String(text).split(' ');
  const lines = []; let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length <= maxChars) cur = (cur + ' ' + w).trim();
    else { if (cur) lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
};

// ─── Attention indicator — subtle ring around dominant non-highlight objects ──

const DominanceRing = ({ obj, attentionRole }) => {
  if (attentionRole !== 'dominant') return null;
  
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
      transition={{ duration: 1.2, ease: 'easeOut', repeat: Infinity }}
    />
  );
};

const MultiText = ({ x, y, text, fontSize = 12, fill = '#cbd5e1', fontWeight = '600', anchor = 'middle' }) => {
  const lines = wrapText(text, 22);
  const lh = fontSize * 1.35;
  const sy = y - ((lines.length - 1) * lh) / 2;
  return (
    <>
      {lines.map((l, i) => (
        <motion.text key={i} animate={{ x, y: sy + i * lh }} textAnchor={anchor} fill={fill}
          fontSize={fontSize} fontWeight={fontWeight} fontFamily="system-ui, sans-serif"
          dominantBaseline="central" pointerEvents="none" transition={{ duration: 0.5 }}>{l}</motion.text>
      ))}
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// GlowOrb — Replaces Circle
// Multi-layered radial gradient sphere with ambient glow ring
// ═══════════════════════════════════════════════════════════════════════════

export const GlowOrb = ({ obj, isNew, isHighlighted, isFaded, transition, staggerIndex = 0, stepKey, narrativeHints, attentionOverride }) => {
  if (!obj) return null;
  const x = safeNum(obj.x ?? obj.cx, CW / 2);
  const y = safeNum(obj.y ?? obj.cy, CH / 2);
  const r = safeNum(obj.r ?? obj.size, 40);
  const c = resolve(obj.color || obj.fill);

  const config = animEngine.getFullConfig(obj, { isNew, isHighlighted, isFaded, transition, staggerIndex, narrativeHints, attentionOverride });
  const micro = config.microAnimation;
  const shouldPulse = obj.pulse || isHighlighted;
  const showGlow = obj.glow || isHighlighted;

  const uid = useId();
  const gradId = `orb-grad-${obj.id}-${uid.replace(/:/g, '')}`;

  return (
    <motion.g
      key={obj.id}
      data-id={obj.id}
      initial={config.initial}
      animate={config.animate}
      exit={config.exit}
      transition={config.transition}
      layout
      style={{ ...config.style, transformOrigin: 'center', transformBox: 'fill-box' }}
    >
      <defs>
        <radialGradient id={gradId} cx="35%" cy="35%" r="75%">
          <stop offset="0%" stopColor={c.text} stopOpacity="0.8" />
          <stop offset="50%" stopColor={c.fill} stopOpacity="1" />
          <stop offset="100%" stopColor="#0a0a12" stopOpacity="0.9" />
        </radialGradient>
      </defs>

      {showGlow && (
        <motion.circle
          animate={{ cx: x, cy: y, r: [r + 8, r + 18, r + 8], opacity: [0.2, 0.5, 0.2] }}
          fill="none" stroke={c.glow} strokeWidth={2} opacity={0.3}
          transition={{ 
            r: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' },
            opacity: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' },
            default: { duration: 0.5 } 
          }}
        />
      )}

      <motion.circle
        initial={isNew ? config.initial : false}
        animate={{ 
          ...config.animate, 
          cx: x, cy: y, 
          r: shouldPulse ? [r, r * 1.06, r] : r,
          ...(shouldPulse ? {} : (micro?.animate || {})) 
        }}
        transition={{ 
          ...config.transition, 
          ...(shouldPulse ? { duration: 0.8, repeat: 2, ease: 'easeInOut' } : (micro?.transition || {})) 
        }}
        fill={`url(#${gradId})`}
        stroke={c.stroke} strokeWidth={2} strokeOpacity={0.7}
        filter="url(#tb-neon-glow)"
        style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
      />

      <motion.circle
        animate={{ cx: x - r * 0.2, cy: y - r * 0.25, r: r * 0.25 }}
        fill="white" opacity={0.08}
        pointerEvents="none"
        transition={{ duration: 0.5 }}
      />

      {obj.innerLabel && (
        <motion.text 
          animate={{ x, y }}
          textAnchor="middle" dominantBaseline="central"
          fontSize={Math.max(12, r * 0.45)} fontWeight="800"
          fill="#fff" fontFamily="'JetBrains Mono', monospace"
          filter="url(#tb-drop-shadow)" pointerEvents="none"
          transition={{ duration: 0.5 }}
        >{obj.innerLabel}</motion.text>
      )}

      {obj.label && (
        <MultiText x={x} y={y + r + 20} text={obj.label}
          fontSize={12} fill="#94a3b8" fontWeight="600" />
      )}
    </motion.g>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// GlassRect — Replaces Rect
// Glassmorphic panel with depth shadow and border glow
// ═══════════════════════════════════════════════════════════════════════════

export const GlassRect = ({ obj, isNew, isHighlighted, isFaded, transition, staggerIndex = 0, stepKey, narrativeHints, attentionOverride }) => {
  if (!obj) return null;
  const cx = safeNum(obj.x, 300);
  const cy = safeNum(obj.y, 240);
  const w = safeNum(obj.w ?? obj.width, 200);
  const h = safeNum(obj.h ?? obj.height, 80);
  const rx = safeNum(obj.rx ?? obj.cornerRadius, 12);
  const c = resolve(obj.color || obj.fill);
  const config = animEngine.getFullConfig(obj, { isNew, isHighlighted, isFaded, transition, staggerIndex, narrativeHints, attentionOverride });

  const px = cx - w / 2;
  const py = cy - h / 2;

  return (
    <motion.g
      key={obj.id}
      data-id={obj.id}
      initial={config.initial}
      animate={config.animate}
      exit={config.exit}
      transition={config.transition}
      layout
      style={{ ...config.style, transformOrigin: 'center', transformBox: 'fill-box' }}
    >
      <motion.rect
        initial={isNew ? config.initial : false}
        animate={{ ...config.animate, x: px, y: py, width: w, height: h }}
        transition={config.transition}
        rx={rx}
        fill={c.glass}
        stroke={isHighlighted ? c.stroke : c.stroke + '55'}
        strokeWidth={isHighlighted ? 2.5 : 1.5}
        filter="url(#tb-drop-shadow)"
        style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
      />

      <motion.rect
        animate={{ x: px + 2, y: py + 1, width: Math.max(0, w - 4) }}
        height={1.5} rx={1}
        fill="white" opacity={0.06}
        pointerEvents="none"
        transition={{ duration: 0.5 }}
      />

      {obj.label && (
        <MultiText
          x={cx} y={cy}
          text={obj.label}
          fontSize={14} fontWeight="700" fill={c.text}
        />
      )}
    </motion.g>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// FlowArrow — Replaces Arrow
// Animated flow with gradient stroke and marching ants
// ═══════════════════════════════════════════════════════════════════════════

export const FlowArrow = ({ obj, isNew, isHighlighted, isFaded, transition, staggerIndex = 0, stepKey, narrativeHints, attentionOverride }) => {
  if (!obj) return null;
  const x1 = safeNum(obj.x1, 200), y1 = safeNum(obj.y1, 300);
  const x2 = safeNum(obj.x2, 600), y2 = safeNum(obj.y2, 300);
  const sw = safeNum(obj.strokeWidth ?? obj.thickness, 2.5);
  const c = resolve(obj.color || obj.stroke);
  const config = animEngine.getFullConfig(obj, { isNew, isHighlighted, isFaded, transition: 'drawLine', staggerIndex, narrativeHints, attentionOverride });
  const uid = useId();
  const markerId = `flow-arr-${obj.id}-${uid.replace(/:/g, '')}`;
  const hasFlow = obj.flow || isHighlighted;

  return (
    <motion.g
      key={obj.id}
      data-id={obj.id}
      initial={config.initial}
      animate={config.animate}
      exit={config.exit}
      transition={config.transition}
      layout
      style={{ ...config.style, transformOrigin: 'center', transformBox: 'fill-box' }}
    >
      <defs>
        <marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5"
          markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill={c.stroke} />
        </marker>
      </defs>

      <motion.path
        initial={isNew ? { pathLength: 0, opacity: 0 } : false}
        animate={{ 
          pathLength: 1, 
          opacity: isFaded ? 0.05 : 0.15,
          d: `M ${x1} ${y1} L ${x2} ${y2}`
        }}
        stroke={c.stroke} strokeWidth={sw}
        markerEnd={`url(#${markerId})`}
        transition={{ duration: 0.6, ease: EASE_CINEMATIC }}
        style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
      />

      {hasFlow && (
        <motion.path
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, strokeDashoffset: [24, 0], d: `M ${x1} ${y1} L ${x2} ${y2}` }}
          stroke={c.glow} strokeWidth={sw}
          strokeDasharray="6 12"
          filter="url(#tb-neon-glow)"
          transition={{ 
            strokeDashoffset: { duration: 0.6, repeat: Infinity, ease: 'linear' },
            default: { duration: 0.4 } 
          }}
          style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
        />
      )}

      {obj.label && (
        <motion.text 
          animate={{ x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 14 }}
          textAnchor="middle" dominantBaseline="central"
          fill="#94a3b8" fontSize={11} fontWeight="600"
          fontFamily="system-ui, sans-serif"
          filter="url(#tb-drop-shadow)" pointerEvents="none"
          transition={{ duration: 0.5 }}
        >{obj.label}</motion.text>
      )}
    </motion.g>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// DataBlock — Replaces Array
// Glassmorphic array cells with spring-based swap/sort/compare animations
// ═══════════════════════════════════════════════════════════════════════════

export const DataBlock = ({ obj, isNew, isHighlighted, isFaded, transition, staggerIndex = 0, stepKey, narrativeHints, attentionOverride }) => {
  if (!obj) return null;
  const values = Array.isArray(obj.values) ? obj.values : [];
  const px = safeNum(obj.x, CW / 2);
  const py = safeNum(obj.y, CH / 2);
  const cw = safeNum(obj.cellW, 60);
  const ch = safeNum(obj.cellH, 56);
  const fs = safeNum(obj.fontSize, 18);
  const totalW = values.length * cw;
  const sx = px - totalW / 2;
  const sy = py - ch / 2;

  const hIdx = new Set(obj.highlightCells || []);
  const sIdx = new Set(obj.swapCells || []);
  const cmpIdx = new Set(obj.compareCells || []);
  const okIdx = new Set(obj.sortedCells || []);

  const config = animEngine.getFullConfig(obj, { isNew, isHighlighted, isFaded, transition, staggerIndex });

  const getCellPalette = (i) => {
    if (sIdx.has(i))   return { bg: 'rgba(239,68,68,0.18)', border: '#f87171', val: '#fca5a5', kind: 'swap' };
    if (cmpIdx.has(i)) return { bg: 'rgba(249,115,22,0.18)', border: '#fb923c', val: '#fdba74', kind: 'compare' };
    if (hIdx.has(i))   return { bg: 'rgba(56,189,248,0.18)', border: '#38bdf8', val: '#bae6fd', kind: 'highlight' };
    if (okIdx.has(i))  return { bg: 'rgba(74,222,128,0.18)', border: '#4ade80', val: '#bbf7d0', kind: 'sorted' };
    return { bg: 'rgba(51,65,85,0.35)', border: '#475569', val: '#f8fafc', kind: 'normal' };
  };

  return (
    <motion.g
      key={obj.id}
      data-id={obj.id}
      initial={config.initial}
      animate={config.animate}
      exit={config.exit}
      transition={config.transition}
      layout
      style={{ ...config.style, transformOrigin: 'center', transformBox: 'fill-box' }}
    >
      {obj.label && (
        <motion.text 
          animate={{ x: px, y: sy - 24 }}
          textAnchor="middle" fill="#64748b"
          fontSize={13} fontWeight="700" fontFamily="system-ui, sans-serif"
          filter="url(#tb-drop-shadow)" pointerEvents="none"
          transition={{ duration: 0.5 }}
        >{obj.label}</motion.text>
      )}

      {values.map((val, i) => {
        const pal = getCellPalette(i);
        const cx = sx + i * cw;
        const isSwap = pal.kind === 'swap';
        const isSorted = pal.kind === 'sorted';
        const isCompare = pal.kind === 'compare';

        return (
          <g key={i}>
            {isSorted && (
              <motion.rect
                rx={12} fill="none" stroke="#4ade80" strokeWidth={2}
                initial={{ opacity: 0, scale: 0.82 }}
                animate={{ 
                  opacity: [0, 0.65, 0], 
                  scale: [0.82, 1.06, 1], 
                  x: cx - 3, 
                  y: sy - 3, 
                  width: cw + 6, 
                  height: ch + 6 
                }}
                transition={{ duration: 0.65, delay: 0.05 }}
              />
            )}

            <motion.rect
              key={`cell-bg-${i}-${val}`}
              initial={isNew ? config.initial : false}
              animate={{
                ...config.animate,
                x: cx, y: sy,
                width: cw, height: ch,
                ...(isSwap    ? { y: [sy, sy - 20, sy], scaleX: [1, 1.08, 1] } :
                   isSorted  ? { scale: [1, 1.09, 1] } :
                   isCompare ? { scale: [1, 1.04, 1.04] } : {})
              }}
              rx={10}
              fill={pal.bg} stroke={pal.border} strokeWidth={2}
              filter={(isSwap || hIdx.has(i)) ? 'url(#tb-neon-glow)' : 'url(#tb-drop-shadow)'}
              transition={{ ...config.transition, duration: 0.55, ...SPRING_BOUNCY }}
              style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
            />

            <motion.text
              key={`cell-txt-${i}-${val}`}
              animate={{ x: cx + cw / 2, y: sy + ch / 2 }}
              textAnchor="middle" dominantBaseline="central"
              fill={pal.val} fontSize={fs} fontWeight="800"
              fontFamily="'JetBrains Mono','Fira Code',monospace"
              pointerEvents="none"
              transition={{ duration: 0.5 }}
            >{val}</motion.text>

            {obj.showIndex !== false && (
              <motion.text 
                animate={{ x: cx + cw / 2, y: sy + ch + 19 }}
                textAnchor="middle"
                fill="#475569" fontSize={11} fontWeight="700"
                fontFamily="system-ui, sans-serif" pointerEvents="none"
                transition={{ duration: 0.5 }}
              >[{i}]</motion.text>
            )}
          </g>
        );
      })}
    </motion.g>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// FlowPointer — Replaces Pointer
// Bouncing arrow with neon glow shaft
// ═══════════════════════════════════════════════════════════════════════════

export const FlowPointer = ({ obj, isNew, isHighlighted, isFaded, transition, staggerIndex = 0, stepKey, narrativeHints, attentionOverride }) => {
  if (!obj) return null;
  const config = animEngine.getFullConfig(obj, { isNew, isHighlighted, isFaded, transition, staggerIndex, narrativeHints, attentionOverride });
  
  const arrayX = safeNum(obj.arrayX, CW / 2);
  const arrayY = safeNum(obj.arrayY, CH / 2);
  const totalW = safeNum(obj.arrayW, 300);
  const cw = safeNum(obj.cellW, 60);
  const ch = safeNum(obj.cellH, 56);
  const idx = safeNum(obj.cellIndex, 0);
  const side = obj.side || 'bottom';
  const c = resolve(obj.color || 'yellow');

  const cx = (arrayX - totalW / 2) + idx * cw + cw / 2;
  const SHAFT = 30;
  const tipY = side === 'top' ? (arrayY - ch / 2 - 4) : (arrayY + ch / 2 + 4);
  const baseY = side === 'top' ? (tipY - SHAFT) : (tipY + SHAFT);
  const labelY = side === 'top' ? (baseY - 14) : (baseY + 14);

  return (
    <motion.g
      key={obj.id}
      data-id={obj.id}
      initial={isNew ? { opacity: 0, y: side === 'bottom' ? 16 : -16, scale: 0.6 } : false}
      animate={isNew ? { opacity: 1, y: 0, scale: 1 } : { ...config.animate }}
      exit={config.exit}
      transition={{ ...SPRING_BOUNCY, ...config.transition }}
      layout
      style={{ ...config.style, transformOrigin: 'center', transformBox: 'fill-box' }}
    >
      <motion.line
        stroke={c.stroke} strokeWidth={3} strokeLinecap="round"
        filter="url(#tb-neon-glow)"
        initial={isNew ? { scaleY: 0 } : false}
        animate={{ 
          scaleY: 1, 
          x1: cx, y1: baseY, x2: cx, y2: tipY 
        }}
        style={{ transformOrigin: `${cx}px ${baseY}px`, transformBox: 'fill-box' }}
        transition={{ duration: 0.3, delay: 0.08 }}
      />

      <motion.polygon 
        animate={{ points: side === 'bottom'
          ? `${cx},${tipY + 8} ${cx - 7},${tipY} ${cx + 7},${tipY}`
          : `${cx},${tipY - 8} ${cx - 7},${tipY} ${cx + 7},${tipY}` 
        }}
        fill={c.stroke} filter="url(#tb-neon-glow)" 
        transition={{ duration: 0.5 }}
      />

      <motion.rect 
        animate={{ x: cx - 13, y: labelY - 10 }}
        width={26} height={20} rx={10}
        fill={c.stroke} opacity={0.95} filter="url(#tb-drop-shadow)"
        transition={{ duration: 0.5 }}
      />
      <motion.text 
        animate={{ x: cx, y: labelY }}
        textAnchor="middle" dominantBaseline="central"
        fill="#fff" fontSize={11} fontWeight="900"
        fontFamily="'JetBrains Mono', monospace" pointerEvents="none"
        transition={{ duration: 0.5 }}
      >{obj.label || 'i'}</motion.text>
    </motion.g>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// SwapBridge — Enhanced with travelling orb
// ═══════════════════════════════════════════════════════════════════════════

export const SwapBridge = ({ obj, isNew, stepKey, narrativeHints, attentionOverride }) => {
  if (!obj) return null;
  const ax = safeNum(obj.arrayX, CW / 2);
  const ay = safeNum(obj.arrayY, CH / 2);
  const tw = safeNum(obj.arrayW, 300);
  const cw = safeNum(obj.cellW, 60);
  const ch = safeNum(obj.cellH, 56);
  const fi = safeNum(obj.fromIndex, 0);
  const ti = safeNum(obj.toIndex, 1);
  const c = resolve(obj.color || 'red');

  const x1 = (ax - tw / 2) + fi * cw + cw / 2;
  const x2 = (ax - tw / 2) + ti * cw + cw / 2;
  const baseY = ay - ch / 2;
  const arcH = Math.max(42, Math.abs(x2 - x1) * 0.55);
  const midX = (x1 + x2) / 2;
  const midY = baseY - arcH;
  const d = `M ${x1} ${baseY} Q ${midX} ${midY} ${x2} ${baseY}`;

  return (
    <motion.g 
      key={obj.id} 
      data-id={obj.id} 
      exit={{ opacity: 0, scale: 0.8 }}
      layout
      style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
    >
      <motion.path
        animate={{ d }}
        fill="none" stroke={c.stroke} strokeWidth={2.5}
        strokeDasharray="7 4" strokeLinecap="round"
        filter="url(#tb-neon-glow)"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.9, d }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />

      <motion.circle r={7} fill={c.glow} filter="url(#tb-neon-glow)" opacity={0}>
        <animate attributeName="opacity" values="0;1;1;0" dur="0.65s" begin="0.28s" fill="freeze" />
        <animateMotion dur="0.65s" begin="0.28s" fill="freeze" path={d} />
      </motion.circle>

      <motion.g
        initial={{ opacity: 0, y: midY - 8 }}
        animate={{ opacity: 1, y: midY, x: midX }}
        transition={{ delay: 0.38, duration: 0.3 }}
      >
        <rect x={midX - 26} y={midY - 15} width={52} height={19} rx={9}
          fill={c.stroke} opacity={0.95} filter="url(#tb-drop-shadow)" />
        <text x={midX} y={midY - 5} textAnchor="middle" dominantBaseline="central"
          fontSize={10} fontWeight="900" fill="#fff"
          fontFamily="system-ui, sans-serif" letterSpacing="0.08em" pointerEvents="none"
        >SWAP</text>
      </motion.g>
    </motion.g>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Comparator — Enhanced with spring badge
// ═══════════════════════════════════════════════════════════════════════════

export const Comparator = ({ obj, isNew, isHighlighted, isFaded, transition, staggerIndex = 0, stepKey, narrativeHints, attentionOverride }) => {
  if (!obj) return null;
  const x = safeNum(obj.x, CW / 2);
  const y = safeNum(obj.y, 185);
  const isTrue = String(obj.result).toLowerCase() === 'true';
  const c = resolve(isTrue ? 'green' : 'red');
  const config = animEngine.getFullConfig(obj, { isNew, isHighlighted, isFaded, transition, staggerIndex });

  return (
    <motion.g
      key={obj.id}
      data-id={obj.id}
      initial={config.initial}
      animate={config.animate}
      exit={config.exit}
      transition={config.transition}
      layout
      style={{ ...config.style, transformOrigin: 'center', transformBox: 'fill-box' }}
    >
      <motion.rect
        initial={isNew ? config.initial : false}
        animate={{ ...config.animate, x: x - 95, y: y - 23 }}
        transition={config.transition}
        width={190} height={46} rx={23}
        fill={isTrue ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.1)'}
        stroke={c.stroke} strokeWidth={2}
        filter="url(#tb-neon-glow)"
        style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
      />

      <motion.text animate={{ x: x - 54, y }} textAnchor="middle" dominantBaseline="central"
        fontSize={21} fontWeight="800" fill={c.text}
        fontFamily="'JetBrains Mono',monospace" pointerEvents="none"
        transition={{ duration: 0.5 }}
      >{obj.leftVal || '?'}</motion.text>

      <motion.text animate={{ x, y }} textAnchor="middle" dominantBaseline="central"
        fontSize={16} fontWeight="700" fill={c.stroke}
        fontFamily="system-ui, sans-serif" pointerEvents="none"
        transition={{ duration: 0.5 }}
      >{obj.operator || '>'}</motion.text>

      <motion.text animate={{ x: x + 54, y }} textAnchor="middle" dominantBaseline="central"
        fontSize={21} fontWeight="800" fill={c.text}
        fontFamily="'JetBrains Mono',monospace" pointerEvents="none"
        transition={{ duration: 0.5 }}
      >{obj.rightVal || '?'}</motion.text>

      <motion.g
        animate={{ x, y }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 0.22, ...SPRING_SNAPPY }}
      >
        <rect x={x + 99} y={y - 13} width={52} height={26} rx={13} fill={c.stroke} />
        <text x={x + 125} y={y} textAnchor="middle" dominantBaseline="central"
          fontSize={10} fontWeight="900" fill="#fff"
          fontFamily="system-ui, sans-serif" letterSpacing="0.05em" pointerEvents="none"
        >{isTrue ? 'TRUE' : 'FALSE'}</text>
      </motion.g>
    </motion.g>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// CodePanel — Replaces CodeLine
// IDE-style code block with scanline highlight
// ═══════════════════════════════════════════════════════════════════════════

export const CodePanel = ({ obj, isNew, isHighlighted, isFaded, transition, staggerIndex = 0, stepKey, narrativeHints, attentionOverride }) => {
  if (!obj) return null;
  const config = animEngine.getFullConfig(obj, { isNew, isHighlighted, isFaded, transition, staggerIndex, narrativeHints, attentionOverride });
  
  const x = safeNum(obj.x, 80);
  const y = safeNum(obj.y, 300);
  const w = safeNum(obj.w, 300);
  const fs = safeNum(obj.fontSize, 13);
  const c = resolve(obj.color || 'blue');
  const isLit = obj.highlight || isHighlighted;

  return (
    <motion.g 
      key={obj.id} 
      data-id={obj.id} 
      exit={config.exit}
      layout
    >
      <motion.rect
        initial={isNew ? config.initial : false}
        animate={{ 
          ...config.animate,
          opacity: isLit ? 1 : 0.45,
          x: x - 10, y: y - 14,
          width: w + 20
        }}
        height={28} rx={5}
        fill={isLit ? c.glass.replace('12)', '35)') : 'transparent'}
        stroke={isLit ? c.stroke + '55' : 'transparent'}
        strokeWidth={1}
        transition={{ duration: 0.2, ...config.transition }}
        style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
      />

      {isLit && (
        <motion.rect animate={{ x: x - 10, y: y - 14 }} width={3} height={28} rx={2}
          fill={c.stroke} transition={{ duration: 0.5 }} />
      )}

      {isLit && (
        <motion.rect
          animate={{ x: [x - 10, x + w + 10], y: y - 14 }} width={10} height={28} rx={3}
          fill={c.glow} opacity={0.4}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
        />
      )}

      <motion.text 
        animate={{ x: x + 2, y }} textAnchor="start" dominantBaseline="central"
        fontSize={11} fontWeight="400" fill={isLit ? c.stroke : '#334155'}
        fontFamily="'JetBrains Mono',monospace" pointerEvents="none"
        transition={{ duration: 0.5 }}
      >{obj.lineNumber}</motion.text>

      <motion.text
        animate={{ x: x + (obj.lineNumber !== undefined ? 26 : 4), y }}
        dominantBaseline="central"
        fontSize={fs} fontWeight={isLit ? '600' : '400'}
        fill={isLit ? c.text : '#475569'}
        fontFamily="'JetBrains Mono','Fira Code',monospace"
        pointerEvents="none"
        transition={{ duration: 0.5 }}
      >{obj.code || ''}</motion.text>
    </motion.g>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// FloatingBadge — Replaces Badge
// Glassmorphic floating label with spring entry
// ═══════════════════════════════════════════════════════════════════════════

export const FloatingBadge = ({ obj, isNew, isHighlighted, isFaded, transition, staggerIndex = 0, stepKey, narrativeHints, attentionOverride }) => {
  if (!obj) return null;
  const x = safeNum(obj.x, CW / 2);
  const y = safeNum(obj.y, 100);
  const text = obj.text || '';
  const c = resolve(obj.bgColor || 'blue');
  const bw = Math.max(60, text.length * 8.5 + 28);
  const config = animEngine.getFullConfig(obj, { isNew, isHighlighted, isFaded, transition: 'popIn', staggerIndex, narrativeHints, attentionOverride });

  return (
    <motion.g
      key={obj.id}
      data-id={obj.id}
      initial={config.initial}
      animate={{
        ...config.animate,
        y: isNew ? [y - 4, y] : y,
      }}
      exit={config.exit}
      transition={config.transition}
      layout
      style={{ ...config.style, transformOrigin: 'center', transformBox: 'fill-box' }}
    >
      <motion.rect 
        initial={isNew ? { scaleX: 0 } : false}
        animate={{ scaleX: 1, x: x - bw / 2, y: y - 14, width: bw }}
        height={28} rx={14}
        fill={c.stroke} filter="url(#tb-drop-shadow)" 
        transition={{ duration: 0.5 }}
      />
      <motion.text animate={{ x, y }} textAnchor="middle" dominantBaseline="central"
        fill={obj.textColor || '#fff'} fontSize={11} fontWeight="900"
        fontFamily="system-ui, sans-serif" letterSpacing="0.06em" pointerEvents="none"
        transition={{ duration: 0.5 }}
      >{text}</motion.text>
    </motion.g>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// DepthText — Replaces Text
// Text with drop shadow and optional emphasis
// ═══════════════════════════════════════════════════════════════════════════

export const DepthText = ({ obj, isNew, isHighlighted, isFaded, transition, staggerIndex = 0, stepKey, narrativeHints, attentionOverride }) => {
  if (!obj) return null;
  const x = safeNum(obj.x, CW / 2);
  const y = safeNum(obj.y, 100);
  const fs = safeNum(obj.fontSize, 18);
  const c = resolve(obj.color || obj.fill || 'white');
  const content = obj.text || obj.label || '';
  const config = animEngine.getFullConfig(obj, { isNew, isHighlighted, isFaded, transition, staggerIndex, narrativeHints, attentionOverride });

  return (
    <motion.text
      key={obj.id}
      data-id={obj.id}
      initial={config.initial}
      animate={{ ...config.animate, x, y, fontSize: fs }}
      exit={config.exit}
      transition={config.transition}
      textAnchor={obj.anchor || obj.align || 'middle'}
      dominantBaseline="central"
      fontWeight={isHighlighted ? '800' : (obj.fontWeight || '600')}
      fontStyle={obj.italic ? 'italic' : 'normal'}
      fill={isHighlighted ? c.stroke : c.text}
      fontFamily={obj.fontFamily || 'system-ui, sans-serif'}
      filter="url(#tb-drop-shadow)"
      pointerEvents="none"
      layout
      style={{ ...config.style, transformOrigin: 'center', transformBox: 'fill-box' }}
    >{content}</motion.text>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// WavePath — Replaces Path
// Animated path drawing with trailing glow
// ═══════════════════════════════════════════════════════════════════════════

export const WavePath = ({ obj, isNew, isHighlighted, isFaded, transition, staggerIndex = 0, stepKey, narrativeHints, attentionOverride }) => {
  if (!obj) return null;
  const sw = safeNum(obj.strokeWidth, 2);
  const c = resolve(obj.color);
  const config = animEngine.getFullConfig(obj, { isNew, isHighlighted, isFaded, transition, staggerIndex });

  return (
    <motion.path
      key={obj.id}
      data-id={obj.id}
      initial={isNew ? { pathLength: 0, opacity: 0 } : false}
      animate={{ pathLength: 1, opacity: isFaded ? 0.3 : 1, d: obj.d || '' }}
      exit={config.exit}
      fill={obj.fill === 'none' || !obj.filled ? 'none' : c.glass}
      stroke={c.stroke} strokeWidth={sw} strokeLinecap="round"
      filter={isHighlighted ? 'url(#tb-neon-glow)' : 'none'}
      style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
      transition={{ duration: 0.8, ease: EASE_CINEMATIC }}
      layout
    />
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// ArcPath — Replaces Arc
// Smooth animated arc with angle markers
// ═══════════════════════════════════════════════════════════════════════════

export const ArcPath = ({ obj, isNew, isHighlighted, isFaded, transition, staggerIndex = 0, stepKey, narrativeHints, attentionOverride }) => {
  if (!obj) return null;
  const cx = safeNum(obj.cx ?? obj.x, CW / 2);
  const cy = safeNum(obj.cy ?? obj.y, CH / 2);
  const r = safeNum(obj.r, 40);
  const sa = safeNum(obj.startAngle, 0);
  const ea = safeNum(obj.endAngle, 90);
  const sw = safeNum(obj.strokeWidth, 2.5);
  const c = resolve(obj.color || 'yellow');

  const toRad = (d) => (d * Math.PI) / 180;
  const sx = cx + r * Math.cos(toRad(sa));
  const sy = cy - r * Math.sin(toRad(sa));
  const ex = cx + r * Math.cos(toRad(ea));
  const ey = cy - r * Math.sin(toRad(ea));
  const large = Math.abs(ea - sa) > 180 ? 1 : 0;
  const d = `M ${sx} ${sy} A ${r} ${r} 0 ${large} 0 ${ex} ${ey}`;

  return (
    <motion.path
      key={obj.id}
      data-id={obj.id}
      fill="none" stroke={c.stroke} strokeWidth={sw} strokeLinecap="round"
      initial={isNew ? { pathLength: 0, opacity: 0 } : false}
      animate={{ pathLength: 1, opacity: 1, d }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.65, ease: EASE_CINEMATIC }}
      style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
      layout
    />
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// HighlightZone — Replaces HighlightBox
// Animated border shimmer with pulsing opacity
// ═══════════════════════════════════════════════════════════════════════════

export const HighlightZone = ({ obj, isNew, isHighlighted, isFaded, transition, staggerIndex = 0, stepKey, narrativeHints, attentionOverride }) => {
  if (!obj) return null;
  const x = safeNum(obj.x, 300);
  const y = safeNum(obj.y, 260);
  const w = safeNum(obj.w, 240);
  const h = safeNum(obj.h, 80);
  const c = resolve(obj.color || 'green');
  const config = animEngine.getFullConfig(obj, { isNew, isHighlighted, isFaded, transition, staggerIndex, narrativeHints, attentionOverride });

  return (
    <motion.g
      key={obj.id}
      data-id={obj.id}
      initial={config.initial}
      animate={config.animate}
      exit={config.exit}
      transition={config.transition}
      layout
      style={{ ...config.style, transformOrigin: 'center', transformBox: 'fill-box' }}
    >
      {obj.label && (
        <motion.text 
          animate={{ x: x + w / 2, y: y - 11 }}
          textAnchor="middle" dominantBaseline="central"
          fontSize={12} fontWeight="700" fill={c.stroke}
          fontFamily="system-ui, sans-serif" pointerEvents="none"
          transition={{ duration: 0.5 }}
        >{obj.label}</motion.text>
      )}

      <motion.rect
        animate={{ x, y, width: w, height: h, opacity: [0.5, 0.85, 0.5] }}
        rx={10}
        fill={c.glass} stroke={c.stroke} strokeWidth={1.5}
        strokeDasharray="7 3"
        transition={{ 
          opacity: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
          default: { duration: 0.4 }
        }}
      />
    </motion.g>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// SimpleLine — Replaces Line
// ═══════════════════════════════════════════════════════════════════════════

export const SimpleLine = ({ obj, isNew, isHighlighted, isFaded, transition, staggerIndex = 0, stepKey, narrativeHints, attentionOverride }) => {
  if (!obj) return null;
  const config = animEngine.getFullConfig(obj, { isNew, isFaded, transition: 'drawLine', narrativeHints, attentionOverride });
  
  const x1 = safeNum(obj.x1, 0), y1 = safeNum(obj.y1, 0);
  const x2 = safeNum(obj.x2, 100), y2 = safeNum(obj.y2, 100);
  const sw = safeNum(obj.strokeWidth, 1.5);
  const c = resolve(obj.color || obj.stroke || 'gray');

  return (
    <motion.path
      key={obj.id}
      data-id={obj.id}
      stroke={c.stroke} strokeWidth={sw}
      strokeDasharray={obj.dashed ? '7 3' : undefined}
      strokeLinecap="round"
      initial={isNew ? { pathLength: 0, opacity: 0 } : false}
      animate={{ 
        pathLength: 1, 
        opacity: isFaded ? 0.25 : (obj.opacity ?? 0.65), 
        d: `M ${x1} ${y1} L ${x2} ${y2}` 
      }}
      exit={config.exit}
      transition={{ duration: 0.55, ease: EASE_CINEMATIC, ...config.transition }}
      style={{ ...config.style, transformOrigin: 'center', transformBox: 'fill-box' }}
      layout
    />
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Orbit — Orbital body with circular motion
// ═══════════════════════════════════════════════════════════════════════════

export const OrbitBody = ({ obj, isNew, isHighlighted, isFaded, transition, staggerIndex = 0, stepKey, narrativeHints, attentionOverride }) => {
  if (!obj) return null;
  const config = animEngine.getFullConfig(obj, { isNew, isHighlighted, isFaded, transition, staggerIndex, narrativeHints, attentionOverride });
  
  const cx = safeNum(obj.cx ?? obj.x, CW / 2);
  const cy = safeNum(obj.cy ?? obj.y, CH / 2);
  const or = safeNum(obj.orbitRadius, 100);
  const r = safeNum(obj.size ?? obj.r ?? 10, 10);
  const speed = safeNum(obj.speed, 8);
  const c = resolve(obj.color || obj.fill || 'blue');
  const uid = useId();
  const pathId = `orbit-path-${obj.id}-${uid.replace(/:/g, '')}`;

  return (
    <motion.g
      key={obj.id}
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1, ...config.animate }}
      exit={config.exit}
      transition={{ delay: (staggerIndex || 0) * 0.15, duration: 0.5, ...config.transition }}
      layout
      style={{ ...config.style, transformOrigin: 'center', transformBox: 'fill-box' }}
    >
      <motion.circle animate={{ cx, cy, r: or }}
        fill="none" stroke="#334155" strokeWidth={1}
        strokeDasharray="4 6" opacity={0.2} 
        transition={{ duration: 0.5 }}
      />
      <defs>
        <path id={pathId}
          d={`M ${cx - or},${cy} a ${or},${or} 0 1,1 ${or * 2},0 a ${or},${or} 0 1,1 -${or * 2},0`} />
      </defs>
      <circle r={r} fill={c.stroke} opacity={0.9} filter="url(#tb-neon-glow)">
        <animateMotion dur={`${speed}s`} repeatCount="indefinite">
          <mpath xlinkHref={`#${pathId}`} />
        </animateMotion>
      </circle>
      {obj.label && (
        <text fill="#64748b" fontSize={11} fontWeight="600" fontFamily="system-ui, sans-serif">
          <animateMotion dur={`${speed}s`} repeatCount="indefinite">
            <mpath xlinkHref={`#${pathId}`} />
          </animateMotion>
          <tspan dy={r + 15} textAnchor="middle">{obj.label}</tspan>
        </text>
      )}
    </motion.g>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// CinematicShapeRouter
// Resolves higher-fidelity shapes based on object type
// ═══════════════════════════════════════════════════════════════════════════

export const CinematicShapeRouter = (props) => {
  const { obj, attentionRole, isFaded, stepKey } = props;
  if (!obj) return null;
  const s = (obj.type || obj.shape || 'circle').toLowerCase();

  const wrapDraggable = (el) => {
    const isEffectivelyFaded = isFaded || attentionRole === 'background';
    const targetOpacity = isEffectivelyFaded ? 0.32 : 1;

    return (
      <motion.g
        key={obj.id}
        drag dragMomentum={false}
        onDragStart={e => e.stopPropagation()}
        style={{ cursor: 'grab', transformOrigin: 'center', transformBox: 'fill-box' }}
        whileTap={{ cursor: 'grabbing' }}
        animate={{ opacity: targetOpacity }}
        transition={{ duration: 0.4 }}
        layout
      >
        {attentionRole === 'dominant' && s !== 'text' && s !== 'badge' && (
          <DominanceRing obj={obj} attentionRole={attentionRole} />
        )}
        {el}
      </motion.g>
    );
  };

  switch (s) {
    case 'circle':
    case 'orb':
    case 'node':          return wrapDraggable(<GlowOrb {...props} />);
    case 'rect':
    case 'rectangle':
    case 'box':           return wrapDraggable(<GlassRect {...props} />);
    case 'arrow':
    case 'connector':
    case 'line':          return wrapDraggable(<FlowArrow {...props} />);
    case 'array':
    case 'arraycell':
    case 'datablock':     return wrapDraggable(<DataBlock {...props} />);
    case 'pointer':       return wrapDraggable(<FlowPointer {...props} />);
    case 'swapbridge':    return wrapDraggable(<SwapBridge {...props} />);
    case 'comparator':    return wrapDraggable(<Comparator {...props} />);
    case 'codeline':      return wrapDraggable(<CodePanel {...props} />);
    case 'badge':         return wrapDraggable(<FloatingBadge {...props} />);
    case 'text':
    case 'label':
    case 'formula':       return wrapDraggable(<DepthText {...props} />);
    case 'path':          return wrapDraggable(<WavePath {...props} />);
    case 'arc':
    case 'angle':         return wrapDraggable(<ArcPath {...props} />);
    case 'highlightbox':
    case 'zone':          return wrapDraggable(<HighlightZone {...props} />);
    case 'simpleline':    return wrapDraggable(<SimpleLine {...props} />);
    case 'orbit':
    case 'planet':        return wrapDraggable(<OrbitBody {...props} />);
    default:              return wrapDraggable(<GlowOrb {...props} />);
  }
};
