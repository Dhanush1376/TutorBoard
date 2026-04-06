import React, { useMemo, useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';

/**
 * SceneRenderer — Full-vocabulary SVG teaching canvas.
 *
 * Speaks every shape the prompt generates:
 *   Standard : circle, rect, arrow, line, text, badge, arc, path, orbit
 *   Algorithm: array, pointer, swapbridge, comparator, codeline, highlightbox
 *
 * Core systems:
 *   • Step-diff engine  — objectIds set per step drives enter/exit
 *   • Entrance registry — each transition type maps to real motion values
 *   • highlightIds      — pulse/glow ring drawn on top each step
 *   • newIds            — only newly appearing objects run entrance animation
 *   • Geometry helpers  — array cell math, pointer placement, arc math
 *   • Color registry    — maps prompt color names → hex, handles dark bg
 */

// ─── Canvas constants ────────────────────────────────────────────────────────
const CW = 800;
const CH = 600;

const safeNum = (v, d = 0) => {
  const n = parseFloat(v);
  return isNaN(n) ? d : n;
};

// ─── Color registry ───────────────────────────────────────────────────────────
const HEX = {
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
};

const resolveColor = (name) => {
  if (!name) return HEX.blue;
  const s = String(name).toLowerCase();
  return HEX[s] || { stroke: name, fill: name, light: name + '20', text: '#f8fafc' };
};

// ─── Transition entrance variants ────────────────────────────────────────────
const VARIANTS = {
  fadeIn:   { hidden: { opacity: 0 },                           visible: { opacity: 1 } },
  slideUp:  { hidden: { opacity: 0, y: 50 },                   visible: { opacity: 1, y: 0 } },
  scaleIn:  { hidden: { opacity: 0, scale: 0.3 },              visible: { opacity: 1, scale: 1 } },
  popIn:    { hidden: { opacity: 0, scale: 0.5 },              visible: { opacity: 1, scale: 1 } },
  reveal:   { hidden: { opacity: 0, x: -40 },                  visible: { opacity: 1, x: 0 } },
  drawLine: { hidden: { pathLength: 0, opacity: 0 },           visible: { pathLength: 1, opacity: 1 } },
  default:  { hidden: { opacity: 0 },                          visible: { opacity: 1 } },
};

const getVariant = (t) => VARIANTS[t] || VARIANTS.default;

// ─── Array cell geometry ─────────────────────────────────────────────────────
const cellLeft = (arrayX, arrayW, cellW, i) => arrayX - arrayW / 2 + i * cellW;
const cellCenterX = (arrayX, arrayW, cellW, i) => cellLeft(arrayX, arrayW, cellW, i) + cellW / 2;

// ─── Cell colour rules ───────────────────────────────────────────────────────
const getCellPalette = (i, { highlightCells, compareCells, swapCells, sortedCells }) => {
  if (sortedCells?.includes(i))   return { bg: '#052e16', border: '#22c55e', val: '#86efac', kind: 'sorted' };
  if (swapCells?.includes(i))     return { bg: '#450a0a', border: '#ef4444', val: '#fca5a5', kind: 'swap' };
  if (compareCells?.includes(i))  return { bg: '#431407', border: '#f97316', val: '#fdba74', kind: 'compare' };
  if (highlightCells?.includes(i))return { bg: '#1e3a5f', border: '#3b82f6', val: '#93c5fd', kind: 'highlight' };
  return { bg: '#1e293b', border: '#334155', val: '#e2e8f0', kind: 'normal' };
};

// ════════════════════════════════════════════════════════════════════════════
// ALGORITHM SHAPES
// ════════════════════════════════════════════════════════════════════════════

// ─── Array ──────────────────────────────────────────────────────────────────
const ShapeArray = ({ obj, isNew, isHighlighted, transition, stepKey }) => {
  const px = safeNum(obj.x, CW / 2);
  const py = safeNum(obj.y, CH / 2);
  const pcw = safeNum(obj.cellW, 60);
  const pch = safeNum(obj.cellH, 56);
  const pfs = safeNum(obj.fontSize, 20);

  const {
    values = [],
    showIndex = true,
    highlightCells = [], compareCells = [], swapCells = [], sortedCells = [],
    label,
  } = obj;

  const n = values.length;
  const arrayW = n * pcw;
  const variant = getVariant(transition);

  return (
    <motion.g
      key={`${obj.id}-${stepKey}`}
      data-id={obj.id}
      initial={isNew ? variant.hidden : false}
      animate={isNew ? variant.visible : {}}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      {label && (
        <text
          x={px} y={py - pch / 2 - 18}
          textAnchor="middle" dominantBaseline="central"
          fontSize={13} fontWeight="600" fill="#64748b"
          fontFamily="system-ui, sans-serif"
        >
          {label}
        </text>
      )}

      {values.map((val, i) => {
        const pal = getCellPalette(i, { highlightCells, compareCells, swapCells, sortedCells });
        const cx = cellLeft(px, arrayW, pcw, i);
        const cy = py - pch / 2;
        const isSwap = pal.kind === 'swap';
        const isSorted = pal.kind === 'sorted';
        const isCompare = pal.kind === 'compare';

        return (
          <g key={i}>
            {/* Sorted settle ripple */}
            {isSorted && (
              <motion.rect
                x={cx - 3} y={cy - 3}
                width={pcw + 6} height={pch + 6} rx={10}
                fill="none" stroke="#22c55e" strokeWidth={2}
                initial={{ opacity: 0, scale: 0.82 }}
                animate={{ opacity: [0, 0.65, 0], scale: [0.82, 1.06, 1] }}
                transition={{ duration: 0.65, delay: 0.05 }}
              />
            )}

            {/* Cell body */}
            <motion.rect
              x={cx} y={cy} width={pcw} height={pch} rx={7}
              fill={pal.bg} stroke={pal.border} strokeWidth={1.5}
              animate={
                isSwap    ? { y: [cy, cy - 12, cy], scaleX: [1, 1.06, 1] } :
                isSorted  ? { scale: [1, 1.09, 1] } :
                isCompare ? { scale: [1, 1.04, 1.04] } : {}
              }
              transition={{ duration: 0.55, ease: 'easeInOut' }}
            />

            {/* Value */}
            <text
              x={cx + pcw / 2} y={cy + pch / 2}
              textAnchor="middle" dominantBaseline="central"
              fontSize={pfs} fontWeight="800"
              fill={pal.val}
              fontFamily="'JetBrains Mono','Fira Code',monospace"
            >
              {val}
            </text>

            {/* Index */}
            {showIndex && (
              <text
                x={cx + pcw / 2} y={cy + pch + 17}
                textAnchor="middle" dominantBaseline="central"
                fontSize={11} fontWeight="500" fill="#475569"
                fontFamily="system-ui, sans-serif"
              >
                [{i}]
              </text>
            )}
          </g>
        );
      })}
    </motion.g>
  );
};

// ─── Pointer ─────────────────────────────────────────────────────────────────
const ShapePointer = ({ obj, isNew, transition, stepKey }) => {
  const px = safeNum(obj.arrayX, CW / 2);
  const py = safeNum(obj.arrayY, CH / 2);
  const paw = safeNum(obj.arrayW, 300);
  const pcw = safeNum(obj.cellW, 60);
  const pch = safeNum(obj.cellH, 56);
  const pidx = safeNum(obj.cellIndex, 0);

  const { label = 'i', color = 'yellow', side = 'bottom' } = obj;

  const c = resolveColor(color);
  const ppx = cellCenterX(px, paw, pcw, pidx);
  const SHAFT = 30;

  const tipY  = side === 'top'
    ? py - pch / 2 - 4
    : py + pch / 2 + 4;
  const baseY = side === 'top'
    ? tipY - SHAFT
    : tipY + SHAFT;
  const labelY = side === 'top'
    ? baseY - 14
    : baseY + 14;

  return (
    <motion.g
      key={`${obj.id}-${stepKey}`}
      data-id={obj.id}
      initial={isNew ? { opacity: 0, y: side === 'bottom' ? 16 : -16 } : false}
      animate={isNew ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Shaft */}
      <motion.line
        x1={ppx} y1={baseY} x2={ppx} y2={tipY}
        stroke={c.stroke} strokeWidth={2.5} strokeLinecap="round"
        initial={isNew ? { scaleY: 0 } : false}
        animate={isNew ? { scaleY: 1 } : {}}
        style={{ transformOrigin: `${ppx}px ${baseY}px` }}
        transition={{ duration: 0.3, delay: 0.08 }}
      />

      {/* Arrowhead */}
      {side === 'bottom'
        ? <polygon points={`${ppx},${tipY + 7} ${ppx - 6},${tipY - 2} ${ppx + 6},${tipY - 2}`} fill={c.stroke} />
        : <polygon points={`${ppx},${tipY - 7} ${ppx - 6},${tipY + 2} ${ppx + 6},${tipY + 2}`} fill={c.stroke} />
      }

      {/* Label pill */}
      <rect x={ppx - 13} y={labelY - 10} width={26} height={20} rx={10} fill={c.stroke} opacity={0.92} />
      <text
        x={ppx} y={labelY} textAnchor="middle" dominantBaseline="central"
        fontSize={11} fontWeight="800" fill="#fff"
        fontFamily="'JetBrains Mono', monospace"
      >
        {label}
      </text>
    </motion.g>
  );
};

// ─── Swap Bridge ──────────────────────────────────────────────────────────────
const ShapeSwapBridge = ({ obj, isNew, stepKey }) => {
  const px = safeNum(obj.arrayX, CW / 2);
  const py = safeNum(obj.arrayY, CH / 2);
  const paw = safeNum(obj.arrayW, 300);
  const pcw = safeNum(obj.cellW, 60);
  const pch = safeNum(obj.cellH, 56);
  const pfrom = safeNum(obj.fromIndex, 0);
  const pto = safeNum(obj.toIndex, 1);

  const { color = 'red' } = obj;

  const c = resolveColor(color);
  const x1 = cellCenterX(px, paw, pcw, pfrom);
  const x2 = cellCenterX(px, paw, pcw, pto);
  const baseY = py - pch / 2;
  const arcH  = Math.max(42, Math.abs(x2 - x1) * 0.55);
  const midX  = (x1 + x2) / 2;
  const midY  = baseY - arcH;
  const d     = `M ${x1} ${baseY} Q ${midX} ${midY} ${x2} ${baseY}`;

  return (
    <g key={`${obj.id}-${stepKey}`} data-id={obj.id}>
      {/* Dashed arc */}
      <motion.path
        d={d} fill="none"
        stroke={c.stroke} strokeWidth={2.5}
        strokeDasharray="7 4" strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.9 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />

      {/* Travelling dot */}
      <motion.circle
        r={7} fill={c.stroke}
        style={{ offsetPath: `path("${d}")`, offsetRotate: '0deg' }}
        initial={{ offsetDistance: '0%', opacity: 0 }}
        animate={{ offsetDistance: ['0%', '100%'], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 0.65, delay: 0.28, ease: 'easeInOut' }}
      />

      {/* SWAP label at apex */}
      <motion.g
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.38, duration: 0.3 }}
      >
        <rect x={midX - 26} y={midY - 15} width={52} height={19} rx={9} fill={c.stroke} opacity={0.92} />
        <text
          x={midX} y={midY - 5}
          textAnchor="middle" dominantBaseline="central"
          fontSize={10} fontWeight="800" fill="#fff"
          fontFamily="system-ui, sans-serif"
          letterSpacing="0.08em"
        >
          SWAP
        </text>
      </motion.g>
    </g>
  );
};

// ─── Comparator ───────────────────────────────────────────────────────────────
const ShapeComparator = ({ obj, isNew, transition, stepKey }) => {
  const px = safeNum(obj.x, CW / 2);
  const py = safeNum(obj.y, 185);

  const {
    leftVal = '?', rightVal = '?',
    operator = '>', result = 'true',
  } = obj;

  const isTrue = String(result).toLowerCase() === 'true';
  const c = resolveColor(isTrue ? 'green' : 'red');
  const variant = getVariant(transition);

  return (
    <motion.g
      key={`${obj.id}-${stepKey}`}
      data-id={obj.id}
      initial={isNew ? variant.hidden : false}
      animate={isNew ? variant.visible : {}}
      transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Pill bg */}
      <rect
        x={px - 95} y={py - 23} width={190} height={46} rx={23}
        fill={isTrue ? '#052e16' : '#450a0a'}
        stroke={c.stroke} strokeWidth={1.5}
      />

      {/* Left value */}
      <text x={px - 54} y={py} textAnchor="middle" dominantBaseline="central"
        fontSize={21} fontWeight="800" fill={c.text}
        fontFamily="'JetBrains Mono',monospace">{leftVal}</text>

      {/* Operator */}
      <text x={px} y={py} textAnchor="middle" dominantBaseline="central"
        fontSize={16} fontWeight="700" fill={c.stroke}
        fontFamily="system-ui, sans-serif">{operator}</text>

      {/* Right value */}
      <text x={px + 54} y={py} textAnchor="middle" dominantBaseline="central"
        fontSize={21} fontWeight="800" fill={c.text}
        fontFamily="'JetBrains Mono',monospace">{rightVal}</text>

      {/* Result badge springs in */}
      <motion.g
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.22, duration: 0.38, ease: [0.34, 1.56, 0.64, 1] }}
      >
        <rect x={px + 99} y={py - 13} width={52} height={26} rx={13} fill={c.stroke} />
        <text x={px + 125} y={py} textAnchor="middle" dominantBaseline="central"
          fontSize={10} fontWeight="800" fill="#fff"
          fontFamily="system-ui, sans-serif" letterSpacing="0.05em">
          {isTrue ? 'TRUE' : 'FALSE'}
        </text>
      </motion.g>
    </motion.g>
  );
};

// ─── Code Line ────────────────────────────────────────────────────────────────
const ShapeCodeLine = ({ obj, isHighlighted, isNew, stepKey }) => {
  const px = safeNum(obj.x, 80);
  const py = safeNum(obj.y, 300);
  const pw = safeNum(obj.w, 300);
  const pfs = safeNum(obj.fontSize, 13);

  const {
    code = '', lineNumber,
    highlight = false, color = 'blue',
  } = obj;

  const c = resolveColor(color);
  const isLit = highlight || isHighlighted;

  return (
    <g key={`${obj.id}-${stepKey}`} data-id={obj.id}>
      {/* Row bg */}
      <motion.rect
        x={px - 10} y={py - 14} width={pw + 20} height={28} rx={5}
        fill={isLit ? c.light.replace('20', '40') : 'transparent'}
        stroke={isLit ? c.stroke + '55' : 'transparent'}
        strokeWidth={1}
        animate={{ opacity: isLit ? 1 : 0.45 }}
        transition={{ duration: 0.2 }}
      />

      {/* Scan-line sweep */}
      {isLit && (
        <motion.rect
          x={px - 10} y={py - 14} width={10} height={28} rx={3}
          fill={c.stroke} opacity={0.45}
          initial={{ x: px - 10 }}
          animate={{ x: px + pw + 10 }}
          transition={{ duration: 0.38, ease: 'easeOut' }}
        />
      )}

      {/* Active line indicator bar */}
      {isLit && (
        <rect x={px - 10} y={py - 14} width={3} height={28} rx={2} fill={c.stroke} />
      )}

      {/* Line number */}
      {lineNumber !== undefined && (
        <text x={px + 2} y={py} textAnchor="start" dominantBaseline="central"
          fontSize={11} fontWeight="400" fill={isLit ? c.stroke : '#334155'}
          fontFamily="'JetBrains Mono',monospace">
          {lineNumber}
        </text>
      )}

      {/* Code text */}
      <text
        x={px + (lineNumber !== undefined ? 26 : 4)} y={py}
        dominantBaseline="central"
        fontSize={pfs} fontWeight={isLit ? '600' : '400'}
        fill={isLit ? c.text : '#475569'}
        fontFamily="'JetBrains Mono','Fira Code',monospace"
      >
        {code}
      </text>
    </g>
  );
};

// ─── Highlight Box ────────────────────────────────────────────────────────────
const ShapeHighlightBox = ({ obj, isNew, transition, stepKey }) => {
  const px = safeNum(obj.x, 300);
  const py = safeNum(obj.y, 260);
  const pw = safeNum(obj.w, 240);
  const ph = safeNum(obj.h, 80);
  const { color = 'green', label } = obj;
  const c = resolveColor(color);
  const variant = getVariant(transition);

  return (
    <motion.g
      key={`${obj.id}-${stepKey}`}
      data-id={obj.id}
      initial={isNew ? variant.hidden : false}
      animate={isNew ? variant.visible : {}}
      transition={{ duration: 0.38 }}
    >
      {label && (
        <text x={px + pw / 2} y={py - 11} textAnchor="middle" dominantBaseline="central"
          fontSize={12} fontWeight="600" fill={c.stroke} fontFamily="system-ui, sans-serif">
          {label}
        </text>
      )}
      <motion.rect
        x={px} y={py} width={pw} height={ph} rx={9}
        fill={c.light} stroke={c.stroke} strokeWidth={1.5}
        strokeDasharray="7 3" opacity={0.75}
        animate={{ opacity: [0.55, 0.85, 0.55] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
    </motion.g>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// STANDARD SHAPES
// ════════════════════════════════════════════════════════════════════════════

// ─── Circle ──────────────────────────────────────────────────────────────────
const ShapeCircle = ({ obj, isNew, isHighlighted, transition, stepKey }) => {
  if (!obj) return null;
  const px = safeNum(obj.cx ?? obj.x, CW / 2);
  const py = safeNum(obj.cy ?? obj.y, CH / 2);
  const pr = safeNum(obj.size ?? obj.r, 40);

  const {
    color = 'blue', label, innerLabel,
    pulse = false, glow = false,
    // legacy SceneRenderer fields
    fill, stroke, fillOpacity,
  } = obj;
  const c = resolveColor(fill || color);
  const variant = getVariant(transition);
  const shouldPulse = pulse || isHighlighted;

  return (
    <motion.g
      key={`${obj.id}-${stepKey}`}
      data-id={obj.id}
      initial={isNew ? variant.hidden : false}
      animate={isNew ? variant.visible : {}}
      transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
    >
      {/* Glow halo */}
      {(glow || isHighlighted) && (
        <motion.circle cx={px} cy={py} r={pr + 10}
          fill="none" stroke={c.stroke} strokeWidth={2} opacity={0.3}
          animate={{ r: [pr + 8, pr + 18, pr + 8], opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* Body */}
      <motion.circle
        data-id={obj.id}
        cx={px} cy={py} r={pr}
        fill={c.fill} fillOpacity={fillOpacity ?? 0.25}
        stroke={c.stroke} strokeWidth={2.5}
        animate={shouldPulse ? { r: [pr, pr * 1.07, pr] } : {}}
        transition={shouldPulse ? { duration: 0.85, repeat: 2 } : {}}
      />

      {/* Inner label */}
      {innerLabel && (
        <text x={px} y={py} textAnchor="middle" dominantBaseline="central"
          fontSize={Math.max(12, pr * 0.46)} fontWeight="800"
          fill={c.text} fontFamily="'JetBrains Mono',monospace">
          {innerLabel}
        </text>
      )}

      {/* External label */}
      {label && (
        <text x={px} y={py + pr + 20} textAnchor="middle" dominantBaseline="central"
          fontSize={13} fontWeight="600" fill="#94a3b8"
          fontFamily="system-ui, sans-serif">
          {label}
        </text>
      )}
    </motion.g>
  );
};

// ─── Rect ─────────────────────────────────────────────────────────────────────
const ShapeRect = ({ obj, isNew, isHighlighted, transition, stepKey }) => {
  if (!obj) return null;
  const px = safeNum(obj.x, 300);
  const py = safeNum(obj.y, 240);
  const pw = safeNum(obj.w ?? obj.width, 200);
  const ph = safeNum(obj.h ?? obj.height, 80);
  const prx = safeNum(obj.rx, 10);

  const {
    color = 'blue', label,
    // legacy fields
    fill,
  } = obj;

  const c = resolveColor(fill || color);
  const variant = getVariant(transition);

  // prompt uses center-based x/y
  const rx_ = px - pw / 2;
  const ry_ = py - ph / 2;

  return (
    <motion.g
      key={`${obj.id}-${stepKey}`}
      data-id={obj.id}
      initial={isNew ? variant.hidden : false}
      animate={isNew ? variant.visible : {}}
      transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
    >
      <rect
        x={rx_} y={ry_} width={pw} height={ph} rx={prx}
        fill={c.fill} fillOpacity={0.22}
        stroke={c.stroke} strokeWidth={isHighlighted ? 2.5 : 1.5}
      />
      {label && (
        <text x={px} y={py} textAnchor="middle" dominantBaseline="central"
          fontSize={14} fontWeight="700" fill={c.text}
          fontFamily="system-ui, sans-serif">
          {label}
        </text>
      )}
    </motion.g>
  );
};

// ─── Arrow ────────────────────────────────────────────────────────────────────
const ShapeArrow = ({ obj, isNew, stepKey }) => {
  if (!obj) return null;
  const px1 = safeNum(obj.x1, 200);
  const py1 = safeNum(obj.y1, 300);
  const px2 = safeNum(obj.x2, 600);
  const py2 = safeNum(obj.y2, 300);
  const pth = safeNum(obj.thickness, 2);

  const { color = 'gray', label, dashed = false, stroke } = obj;

  const c = resolveColor(stroke || color);
  const mid = { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
  const markerId = `arr-${obj.id || Math.random().toString(36).slice(2)}`;

  return (
    <motion.g key={`${obj.id}-${stepKey}`} data-id={obj.id}
      initial={isNew ? { opacity: 0 } : false}
      animate={isNew ? { opacity: 1 } : {}}
      transition={{ duration: 0.4 }}
    >
      <defs>
        <marker id={markerId} viewBox="0 0 10 10" refX="8" refY="5"
          markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M2 1L8 5L2 9" fill="none" stroke={c.stroke} strokeWidth="1.8" strokeLinecap="round" />
        </marker>
      </defs>
      <motion.line
        x1={px1} y1={py1} x2={px2} y2={py2}
        stroke={c.stroke} strokeWidth={pth}
        strokeDasharray={dashed ? '9 4' : undefined}
        strokeLinecap="round"
        markerEnd={`url(#${markerId})`}
        initial={isNew ? { pathLength: 0 } : false}
        animate={isNew ? { pathLength: 1 } : {}}
        transition={{ duration: 0.55 }}
      />
      {label && (
        <text x={(px1 + px2) / 2} y={(py1 + py2) / 2 - 12} textAnchor="middle" dominantBaseline="central"
          fontSize={11} fontWeight="500" fill="#64748b"
          fontFamily="system-ui, sans-serif">
          {label}
        </text>
      )}
    </motion.g>
  );
};

// ─── Line ─────────────────────────────────────────────────────────────────────
const ShapeLine = ({ obj, isNew, stepKey }) => {
  if (!obj) return null;
  const px1 = safeNum(obj.x1, 100);
  const py1 = safeNum(obj.y1, 300);
  const px2 = safeNum(obj.x2, 700);
  const py2 = safeNum(obj.y2, 300);
  const psw = safeNum(obj.strokeWidth, 1.5);

  const { color = 'gray', dashed = false, stroke, opacity } = obj;

  const c = resolveColor(stroke || color);

  return (
    <motion.line
      key={`${obj.id}-${stepKey}`}
      data-id={obj.id}
      x1={px1} y1={py1} x2={px2} y2={py2}
      stroke={c.stroke} strokeWidth={psw}
      strokeDasharray={dashed ? '7 3' : undefined}
      strokeLinecap="round" opacity={opacity ?? 0.65}
      initial={isNew ? { pathLength: 0, opacity: 0 } : false}
      animate={isNew ? { pathLength: 1, opacity: opacity ?? 0.65 } : {}}
      transition={{ duration: 0.55 }}
    />
  );
};

// ─── Text ─────────────────────────────────────────────────────────────────────
const ShapeText = ({ obj, isNew, isHighlighted, transition, stepKey }) => {
  if (!obj) return null;
  const px = safeNum(obj.x, CW / 2);
  const py = safeNum(obj.y, 100);
  const pfs = safeNum(obj.fontSize, 18);

  const {
    text = '', label,
    color = 'white',
    fontWeight = '600',
    // legacy
    fill, anchor, italic, fontFamily,
  } = obj;

  const c = resolveColor(fill || color);
  const content = text || label || '';
  const variant = getVariant(transition);

  return (
    <motion.text
      key={`${obj.id}-${stepKey}`}
      data-id={obj.id}
      x={px} y={py}
      textAnchor={anchor || 'middle'} dominantBaseline="central"
      fontSize={pfs}
      fontWeight={isHighlighted ? '800' : fontWeight}
      fontStyle={italic ? 'italic' : 'normal'}
      fill={isHighlighted ? c.stroke : c.text}
      fontFamily={fontFamily || 'system-ui, sans-serif'}
      initial={isNew ? variant.hidden : false}
      animate={isNew ? variant.visible : {}}
      transition={{ duration: 0.4 }}
    >
      {content}
    </motion.text>
  );
};

// ─── Badge ────────────────────────────────────────────────────────────────────
const ShapeBadge = ({ obj, isNew, transition, stepKey }) => {
  if (!obj) return null;
  const px = safeNum(obj.x, CW / 2);
  const py = safeNum(obj.y, 100);
  const { text = '', bgColor = 'blue', textColor } = obj;
  const c = resolveColor(bgColor);
  const bw = Math.max(60, (text?.length || 0) * 8.5 + 28);
  const bh = 28;
  const variant = getVariant(transition);

  return (
    <motion.g
      key={`${obj.id}-${stepKey}`}
      data-id={obj.id}
      initial={isNew ? variant.hidden : false}
      animate={isNew ? variant.visible : {}}
      transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
    >
      <rect x={px - bw / 2} y={py - bh / 2} width={bw} height={bh} rx={bh / 2} fill={c.stroke} />
      <text x={px} y={py} textAnchor="middle" dominantBaseline="central"
        fontSize={11} fontWeight="800" fill={textColor || '#fff'}
        fontFamily="system-ui, sans-serif" letterSpacing="0.06em">
        {text}
      </text>
    </motion.g>
  );
};

// ─── Arc ──────────────────────────────────────────────────────────────────────
const ShapeArc = ({ obj, isNew, stepKey }) => {
  if (!obj) return null;
  const {
    cx: ocx, cy: ocy, x, y,
    r = 40, startAngle = 0, endAngle = 90,
    color = 'yellow', strokeWidth = 2.5,
  } = obj;

  const pcx = safeNum(ocx ?? x, CW / 2);
  const pcy = safeNum(ocy ?? y, CH / 2);
  const pr = safeNum(obj.r ?? r, 40);
  const psa = safeNum(startAngle, 0);
  const pea = safeNum(endAngle, 90);
  const psw = safeNum(strokeWidth, 2.5);

  const c = resolveColor(color);
  const toRad = (d) => (d * Math.PI) / 180;
  const sx = pcx + pr * Math.cos(toRad(psa));
  const sy = pcy - pr * Math.sin(toRad(psa));
  const ex = pcx + pr * Math.cos(toRad(pea));
  const ey = pcy - pr * Math.sin(toRad(pea));
  const large = Math.abs(pea - psa) > 180 ? 1 : 0;

  return (
    <motion.path
      key={`${obj.id}-${stepKey}`}
      data-id={obj.id}
      d={`M ${sx} ${sy} A ${pr} ${pr} 0 ${large} 0 ${ex} ${ey}`}
      fill="none" stroke={c.stroke} strokeWidth={psw} strokeLinecap="round"
      initial={isNew ? { pathLength: 0, opacity: 0 } : false}
      animate={isNew ? { pathLength: 1, opacity: 1 } : {}}
      transition={{ duration: 0.65 }}
    />
  );
};

// ─── Path ─────────────────────────────────────────────────────────────────────
const ShapePath = ({ obj, isNew, stepKey }) => {
  if (!obj) return null;
  const psw = safeNum(obj.strokeWidth, 2);
  const { d = '', color = 'blue', fill = 'none' } = obj;
  const c = resolveColor(color);

  return (
    <motion.path
      key={`${obj.id}-${stepKey}`}
      data-id={obj.id}
      d={d} fill={fill === 'none' ? 'none' : c.light}
      stroke={c.stroke} strokeWidth={psw} strokeLinecap="round"
      initial={isNew ? { pathLength: 0, opacity: 0 } : false}
      animate={isNew ? { pathLength: 1, opacity: 1 } : {}}
      transition={{ duration: 0.72 }}
    />
  );
};

// ─── Orbit (legacy SceneRenderer support) ────────────────────────────────────
const ShapeOrbit = ({ obj, index }) => {
  if (!obj) return null;
  const px = safeNum(obj.cx ?? obj.x, CW / 2);
  const py = safeNum(obj.cy ?? obj.y, CH / 2);
  const por = safeNum(obj.orbitRadius, 100);
  const pr = safeNum(obj.size ?? obj.r ?? 10, 10);
  const psp = safeNum(obj.speed, 8);

  const { color = 'blue', fill } = obj;
  const c = resolveColor(fill || color);
  const pathId = `orbit-path-${obj.id || index}-${Math.random().toString(36).slice(2, 6)}`;

  return (
    <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 0.15, duration: 0.5 }} data-id={obj.id}>
      <circle cx={px} cy={py} r={por}
        fill="none" stroke="#334155" strokeWidth={1} strokeDasharray="4 6" opacity={0.25} />
      <defs>
        <path id={pathId}
          d={`M ${px - por},${py} a ${por},${por} 0 1,1 ${por * 2},0 a ${por},${por} 0 1,1 -${por * 2},0`} />
      </defs>
      <circle r={pr} fill={c.stroke} opacity={0.9}>
        <animateMotion dur={`${psp}s`} repeatCount="indefinite">
          <mpath xlinkHref={`#${pathId}`} />
        </animateMotion>
      </circle>
      {obj.label && (
        <text fill="#64748b" fontSize={11} fontWeight="600" fontFamily="system-ui, sans-serif">
          <animateMotion dur={`${psp}s`} repeatCount="indefinite">
            <mpath xlinkHref={`#${pathId}`} />
          </animateMotion>
          <tspan dy={pr + 15} textAnchor="middle">{obj.label}</tspan>
        </text>
      )}
    </motion.g>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SHAPE DISPATCHER
// ════════════════════════════════════════════════════════════════════════════

function dispatchShape(obj, props, legacyIndex) {
  if (!obj?.shape && !obj?.type) return null;
  const s = (obj.shape || obj.type || '').toLowerCase();

  switch (s) {
    // Algorithm shapes
    case 'array':        return <ShapeArray        key={obj.id} {...props} />;
    case 'pointer':      return <ShapePointer      key={obj.id} {...props} />;
    case 'swapbridge':   return <ShapeSwapBridge   key={obj.id} {...props} />;
    case 'comparator':   return <ShapeComparator   key={obj.id} {...props} />;
    case 'codeline':     return <ShapeCodeLine     key={obj.id} {...props} />;
    case 'highlightbox': return <ShapeHighlightBox key={obj.id} {...props} />;

    // Standard shapes
    case 'circle':                  return <ShapeCircle key={obj.id} {...props} />;
    case 'rect': case 'rectangle':
    case 'box':                     return <ShapeRect   key={obj.id} {...props} />;
    case 'arrow':                   return <ShapeArrow  key={obj.id} {...props} />;
    case 'line':                    return <ShapeLine   key={obj.id} {...props} />;
    case 'text': case 'label':
    case 'formula':                 return <ShapeText   key={obj.id} {...props} />;
    case 'badge':                   return <ShapeBadge  key={obj.id} {...props} />;
    case 'arc': case 'angle':       return <ShapeArc    key={obj.id} {...props} />;
    case 'path':                    return <ShapePath   key={obj.id} {...props} />;
    case 'orbit': case 'planet':    return <ShapeOrbit  key={obj.id} obj={obj} index={legacyIndex} />;

    default: return <ShapeCircle key={obj.id} {...props} />;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// STEP-DIFF ENGINE
// ════════════════════════════════════════════════════════════════════════════

function useStepDiff(objects, steps, currentStepIndex) {
  const prevIdsRef = useRef(new Set());

  return useMemo(() => {
    // Legacy mode — no steps array, just render all objects
    if (!steps || steps.length === 0) {
      return {
        visibleObjects: objects || [],
        highlightIds: new Set(),
        newIds: new Set(),
        transition: 'fadeIn',
        stepKey: 'legacy',
        isLegacy: true,
      };
    }

    if (!objects || objects.length === 0) {
      return { visibleObjects: [], highlightIds: new Set(), newIds: new Set(), transition: 'fadeIn', stepKey: '0', isLegacy: false };
    }

    const step = steps[Math.min(currentStepIndex, steps.length - 1)];
    if (!step) return { visibleObjects: [], highlightIds: new Set(), newIds: new Set(), transition: 'fadeIn', stepKey: '0', isLegacy: false };

    const objectMap = {};
    objects.forEach(o => { if (o?.id) objectMap[o.id] = o; });

    const currentIds   = new Set(Array.isArray(step.objectIds) ? step.objectIds : []);
    const highlightIds = new Set(Array.isArray(step.highlightIds) ? step.highlightIds : []);
    const newIds       = new Set(Array.isArray(step.newIds) ? step.newIds : []);
    const prevIds      = prevIdsRef.current;

    // Objects that just appeared this step
    const freshIds = new Set([...currentIds].filter(id => !prevIds.has(id)));
    const effectiveNewIds = newIds.size > 0 ? newIds : freshIds;

    const visibleObjects = [...currentIds].map(id => objectMap[id]).filter(Boolean);
    prevIdsRef.current = currentIds;

    return {
      visibleObjects,
      highlightIds,
      newIds: effectiveNewIds,
      transition: step.transition || 'fadeIn',
      stepKey: `step-${currentStepIndex}`,
      isLegacy: false,
    };
  }, [objects, steps, currentStepIndex]);
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════════════

const SceneRenderer = ({ objects, steps, currentStep, currentStepIndex }) => {
  // Support both prop names
  const stepIdx = currentStepIndex ?? currentStep ?? 0;

  const safeObjects = Array.isArray(objects) ? objects : [];
  const safeSteps   = Array.isArray(steps)   ? steps   : [];

  const { visibleObjects, highlightIds, newIds, transition, stepKey, isLegacy } =
    useStepDiff(safeObjects, safeSteps, stepIdx);

  if (safeObjects.length === 0) return null;

  const step = safeSteps[Math.min(stepIdx, safeSteps.length - 1)];
  const narration = step?.narration || step?.description || '';
  const stepLabel = step?.label || step?.title || '';

  return (
    <div className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden">
      <svg
        viewBox={`0 0 ${CW} ${CH}`}
        className="w-full h-full"
        style={{ maxWidth: '95%', maxHeight: '82%' }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Subtle grid */}
        <defs>
          <pattern id="scene-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none"
              stroke="rgba(148,163,184,0.05)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width={CW} height={CH} fill="url(#scene-grid)" />

        {/* Highlight glow rings — drawn behind shapes */}
        {[...highlightIds].map(id => {
          const obj = safeObjects.find(o => o.id === id);
          if (!obj) return null;
          const hx = safeNum(obj.x ?? obj.cx, CW / 2);
          const hy = safeNum(obj.y ?? obj.cy, CH / 2);
          const hr = safeNum(obj.r ?? obj.size, 50);
          return (
            <motion.circle key={`hl-${id}`}
              cx={hx} cy={hy} r={hr}
              fill="none" stroke="#f59e0b" strokeWidth={2.5} opacity={0}
              animate={{ opacity: [0, 0.55, 0.35], r: [hr + 6, hr + 18] }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
            />
          );
        })}

        {/* Shape layer */}
        <AnimatePresence mode="popLayout">
          {visibleObjects.map((obj, i) => {
            const shapeProps = {
              obj,
              isNew: newIds.has(obj.id),
              isHighlighted: highlightIds.has(obj.id),
              transition,
              stepKey,
            };
            return dispatchShape(obj, shapeProps, i);
          })}
        </AnimatePresence>
      </svg>

      {/* Step narration bar */}
      <AnimatePresence mode="wait">
        {(narration || stepLabel) && (
          <motion.div
            key={`narr-${stepIdx}`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
            style={{ maxWidth: '580px', width: '90%' }}
          >
            <div
              style={{
                background: 'rgba(15,23,42,0.78)',
                backdropFilter: 'blur(18px)',
                WebkitBackdropFilter: 'blur(18px)',
                border: '0.5px solid rgba(51,65,85,0.7)',
                borderRadius: '14px',
                padding: '11px 20px',
                textAlign: 'center',
              }}
            >
              {stepLabel && (
                <p style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: narration ? '4px' : 0 }}>
                  {stepLabel}
                </p>
              )}
              {narration && (
                <p style={{ fontSize: '12.5px', color: '#cbd5e1', lineHeight: '1.6', margin: 0, fontWeight: '400' }}>
                  {narration}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SceneRenderer;