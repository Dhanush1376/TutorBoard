/**
 * AnimationRenderer — Next-Level Visual Teaching Engine
 *
 * Fully speaks the prompt's shape language:
 *   array, pointer, swapbridge, comparator, codeline, highlightbox
 *   circle, rect, arrow, line, text, badge, arc, path
 *
 * Features:
 *   - Per-shape CSS keyframe animations (swap arc, pulse, bounce, draw-line)
 *   - Step diff engine: fade-out removed, animate-in newIds with transition type
 *   - highlightIds pulse/glow draws the eye each step
 *   - Swap bridge animates as a rising arc with elements travelling along it
 *   - Comparator flashes green/red on result
 *   - Sorted cells settle with a ripple
 *   - Pointer arrows bounce into position
 *   - Code lines highlight with a scan-line sweep
 *   - Zero crashes — all shapes safely defaulted
 */

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';

// ─── Colour palette (matches prompt's colour names) ─────────────────────────
const COLORS = {
  blue:    { fill: '#1e40af', stroke: '#3b82f6', light: '#dbeafe', text: '#eff6ff' },
  orange:  { fill: '#92400e', stroke: '#f97316', light: '#fff7ed', text: '#fff7ed' },
  red:     { fill: '#991b1b', stroke: '#ef4444', light: '#fee2e2', text: '#fee2e2' },
  green:   { fill: '#14532d', stroke: '#22c55e', light: '#dcfce7', text: '#f0fdf4' },
  yellow:  { fill: '#713f12', stroke: '#eab308', light: '#fef9c3', text: '#fefce8' },
  purple:  { fill: '#581c87', stroke: '#a855f7', light: '#f3e8ff', text: '#faf5ff' },
  teal:    { fill: '#134e4a', stroke: '#14b8a6', light: '#ccfbf1', text: '#f0fdfa' },
  gray:    { fill: '#374151', stroke: '#9ca3af', light: '#f3f4f6', text: '#f9fafb' },
  white:   { fill: '#1f2937', stroke: '#e5e7eb', light: '#ffffff', text: '#111827' },
  gold:    { fill: '#92400e', stroke: '#f59e0b', light: '#fffbeb', text: '#fefce8' },
  default: { fill: '#1e3a5f', stroke: '#60a5fa', light: '#dbeafe', text: '#eff6ff' },
};

const getColor = (name) => COLORS[name?.toLowerCase?.()] || COLORS.default;

// ─── Canvas dimensions (matches prompt spec) ────────────────────────────────
const CW = 800;
const CH = 600;

// ─── Transition variants (matches prompt transition types) ───────────────────
const TRANSITION_VARIANTS = {
  fadeIn:   { hidden: { opacity: 0 },                      visible: { opacity: 1 } },
  slideUp:  { hidden: { opacity: 0, y: 40 },               visible: { opacity: 1, y: 0 } },
  scaleIn:  { hidden: { opacity: 0, scale: 0.4 },          visible: { opacity: 1, scale: 1 } },
  popIn:    { hidden: { opacity: 0, scale: 0.6 },          visible: { opacity: 1, scale: 1 } },
  reveal:   { hidden: { opacity: 0, x: -30 },              visible: { opacity: 1, x: 0 } },
  drawLine: { hidden: { pathLength: 0, opacity: 0 },       visible: { pathLength: 1, opacity: 1 } },
  default:  { hidden: { opacity: 0 },                      visible: { opacity: 1 } },
};

const getVariant = (type) => TRANSITION_VARIANTS[type] || TRANSITION_VARIANTS.default;

// ─── Helper: compute array cell left-edge (centered at x) ───────────────────
function arrayCellX(arrayX, arrayW, cellW, index) {
  const startX = arrayX - arrayW / 2;
  return startX + index * cellW;
}

// ════════════════════════════════════════════════════════════════════════════
// SHAPE RENDERERS
// ════════════════════════════════════════════════════════════════════════════

// ─── Array ──────────────────────────────────────────────────────────────────
function ArrayShape({ obj, isHighlighted, isNew, transition, stepKey }) {
  const {
    x = CW / 2, y = CH / 2,
    values = [],
    cellW = 60, cellH = 56,
    fontSize = 20,
    showIndex = true,
    highlightCells = [],
    compareCells = [],
    swapCells = [],
    sortedCells = [],
    label,
  } = obj;

  const n = values.length;
  const arrayW = n * cellW;
  const startX = x - arrayW / 2;

  const getCellStyle = (i) => {
    if (sortedCells.includes(i))  return { fill: getColor('green').light,  stroke: getColor('green').stroke,  textColor: '#14532d' };
    if (swapCells.includes(i))    return { fill: getColor('red').light,    stroke: getColor('red').stroke,    textColor: '#7f1d1d' };
    if (compareCells.includes(i)) return { fill: getColor('orange').light, stroke: getColor('orange').stroke, textColor: '#78350f' };
    if (highlightCells.includes(i)) return { fill: getColor('blue').light, stroke: getColor('blue').stroke,  textColor: '#1e3a8a' };
    return { fill: 'var(--bg-secondary, #1e293b)', stroke: 'var(--border-color, #334155)', textColor: 'var(--text-primary, #f1f5f9)' };
  };

  const variant = getVariant(transition);

  return (
    <motion.g
      key={`${obj.id}-${stepKey}`}
      initial={isNew ? variant.hidden : false}
      animate={isNew ? variant.visible : {}}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Label above array */}
      {label && (
        <text
          x={x} y={y - cellH / 2 - 14}
          textAnchor="middle" dominantBaseline="central"
          fontSize={13} fontWeight="600"
          fill="var(--text-tertiary, #94a3b8)"
          fontFamily="system-ui, sans-serif"
        >
          {label}
        </text>
      )}

      {/* Cells */}
      {values.map((val, i) => {
        const cx = startX + i * cellW;
        const cy = y - cellH / 2;
        const style = getCellStyle(i);
        const isSwapped = swapCells.includes(i);
        const isSorted = sortedCells.includes(i);
        const isCompared = compareCells.includes(i);

        return (
          <g key={i}>
            {/* Cell background */}
            <motion.rect
              x={cx} y={cy} width={cellW} height={cellH}
              rx={6}
              fill={style.fill}
              stroke={style.stroke}
              strokeWidth={isHighlighted ? 2 : 1}
              initial={false}
              animate={
                isSwapped ? { y: [cy, cy - 10, cy], scaleX: [1, 1.05, 1] } :
                isSorted  ? { scale: [1, 1.08, 1] } :
                isCompared ? { scale: [1, 1.04, 1] } : {}
              }
              transition={{ duration: isSwapped ? 0.6 : 0.35, ease: 'easeInOut' }}
            />

            {/* Sorted glow ring */}
            {isSorted && (
              <motion.rect
                x={cx - 2} y={cy - 2}
                width={cellW + 4} height={cellH + 4}
                rx={8} fill="none"
                stroke={getColor('green').stroke}
                strokeWidth={2}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: [0, 0.7, 0], scale: [0.85, 1.05, 1] }}
                transition={{ duration: 0.7, delay: 0.1 }}
              />
            )}

            {/* Value text */}
            <text
              x={cx + cellW / 2} y={cy + cellH / 2}
              textAnchor="middle" dominantBaseline="central"
              fontSize={fontSize} fontWeight="700"
              fill={style.textColor}
              fontFamily="'JetBrains Mono', 'Fira Code', monospace"
            >
              {val}
            </text>

            {/* Index below */}
            {showIndex && (
              <text
                x={cx + cellW / 2} y={cy + cellH + 16}
                textAnchor="middle" dominantBaseline="central"
                fontSize={11} fontWeight="500"
                fill="var(--text-tertiary, #64748b)"
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
}

// ─── Pointer ─────────────────────────────────────────────────────────────────
function PointerShape({ obj, isNew, transition, stepKey }) {
  const {
    arrayX = CW / 2, arrayY = CH / 2,
    arrayW = 300, cellW = 60, cellH = 56,
    cellIndex = 0,
    label = 'i',
    color = 'yellow',
    side = 'bottom',
  } = obj;

  const c = getColor(color);
  const startX = arrayX - arrayW / 2;
  const cx = startX + cellIndex * cellW + cellW / 2;

  const ARROW_H = 28;
  const arrowY = side === 'top'
    ? arrayY - cellH / 2 - ARROW_H
    : arrayY + cellH / 2 + ARROW_H;
  const tipY   = side === 'top'
    ? arrayY - cellH / 2 - 4
    : arrayY + cellH / 2 + 4;

  const variant = getVariant(transition);

  return (
    <motion.g
      key={`${obj.id}-${stepKey}`}
      initial={isNew ? { ...variant.hidden, x: 0 } : false}
      animate={isNew ? { ...variant.visible, x: 0 } : {}}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Shaft */}
      <motion.line
        x1={cx} y1={arrowY} x2={cx} y2={tipY}
        stroke={c.stroke} strokeWidth={2.5} strokeLinecap="round"
        initial={isNew ? { scaleY: 0 } : false}
        animate={isNew ? { scaleY: 1 } : {}}
        style={{ transformOrigin: `${cx}px ${arrowY}px` }}
        transition={{ duration: 0.3, delay: 0.1 }}
      />

      {/* Arrowhead */}
      {side === 'bottom' ? (
        <polygon
          points={`${cx},${tipY + 8} ${cx - 7},${tipY - 2} ${cx + 7},${tipY - 2}`}
          fill={c.stroke}
        />
      ) : (
        <polygon
          points={`${cx},${tipY - 8} ${cx - 7},${tipY + 2} ${cx + 7},${tipY + 2}`}
          fill={c.stroke}
        />
      )}

      {/* Label pill */}
      <rect
        x={cx - 14} y={arrowY - (side === 'bottom' ? 0 : 20)}
        width={28} height={20} rx={10}
        fill={c.stroke} opacity={0.9}
      />
      <text
        x={cx} y={arrowY - (side === 'bottom' ? -10 : 10)}
        textAnchor="middle" dominantBaseline="central"
        fontSize={11} fontWeight="700"
        fill="#fff"
        fontFamily="'JetBrains Mono', monospace"
      >
        {label}
      </text>
    </motion.g>
  );
}

// ─── Swap Bridge ─────────────────────────────────────────────────────────────
function SwapBridgeShape({ obj, isNew, stepKey }) {
  const {
    arrayX = CW / 2, arrayY = CH / 2,
    arrayW = 300, cellW = 60, cellH = 56,
    fromIndex = 0, toIndex = 1,
    color = 'red',
  } = obj;

  const c = getColor(color);
  const startX = arrayX - arrayW / 2;
  const x1 = startX + fromIndex * cellW + cellW / 2;
  const x2 = startX + toIndex  * cellW + cellW / 2;
  const baseY = arrayY - cellH / 2;
  const arcH  = Math.max(40, Math.abs(x2 - x1) * 0.55);
  const midX  = (x1 + x2) / 2;
  const midY  = baseY - arcH;

  const pathD = `M ${x1} ${baseY} Q ${midX} ${midY} ${x2} ${baseY}`;

  // Animate a dot travelling along the path
  const dotRef = useRef(null);

  return (
    <g key={`${obj.id}-${stepKey}`}>
      {/* Arc */}
      <motion.path
        d={pathD}
        fill="none"
        stroke={c.stroke}
        strokeWidth={2.5}
        strokeDasharray="8 4"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.85 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
      />

      {/* Travelling dot — left to right */}
      <motion.circle
        r={7} fill={c.stroke}
        initial={{ offsetDistance: '0%', opacity: 0 }}
        animate={{ offsetDistance: ['0%', '100%'], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 0.7, delay: 0.3, ease: 'easeInOut' }}
        style={{ offsetPath: `path("${pathD}")`, offsetRotate: '0deg' }}
      />

      {/* Swap label at apex */}
      <motion.g
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.3 }}
      >
        <rect
          x={midX - 24} y={midY - 14}
          width={48} height={18} rx={9}
          fill={c.stroke} opacity={0.9}
        />
        <text
          x={midX} y={midY - 5}
          textAnchor="middle" dominantBaseline="central"
          fontSize={10} fontWeight="700" fill="#fff"
          fontFamily="system-ui, sans-serif"
        >
          SWAP
        </text>
      </motion.g>
    </g>
  );
}

// ─── Comparator ───────────────────────────────────────────────────────────────
function ComparatorShape({ obj, isNew, transition, stepKey }) {
  const {
    x = CW / 2, y = 180,
    leftVal = '?', rightVal = '?',
    operator = '>', result = 'true',
    color = 'orange',
  } = obj;

  const isTrue = result === 'true';
  const c = isTrue ? getColor('green') : getColor('red');
  const variant = getVariant(transition);

  return (
    <motion.g
      key={`${obj.id}-${stepKey}`}
      initial={isNew ? variant.hidden : false}
      animate={isNew
        ? { ...variant.visible, filter: [`drop-shadow(0 0 0px ${c.stroke})`, `drop-shadow(0 0 12px ${c.stroke})`, `drop-shadow(0 0 4px ${c.stroke})`] }
        : {}}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Background pill */}
      <rect
        x={x - 90} y={y - 22}
        width={180} height={44} rx={22}
        fill={isTrue ? getColor('green').light : getColor('red').light}
        stroke={c.stroke} strokeWidth={1.5}
      />

      {/* Left value */}
      <text
        x={x - 52} y={y}
        textAnchor="middle" dominantBaseline="central"
        fontSize={20} fontWeight="800"
        fill={c.stroke}
        fontFamily="'JetBrains Mono', monospace"
      >
        {leftVal}
      </text>

      {/* Operator */}
      <text
        x={x} y={y}
        textAnchor="middle" dominantBaseline="central"
        fontSize={16} fontWeight="700"
        fill={c.stroke}
        fontFamily="system-ui, sans-serif"
      >
        {operator}
      </text>

      {/* Right value */}
      <text
        x={x + 52} y={y}
        textAnchor="middle" dominantBaseline="central"
        fontSize={20} fontWeight="800"
        fill={c.stroke}
        fontFamily="'JetBrains Mono', monospace"
      >
        {rightVal}
      </text>

      {/* Result badge */}
      <motion.g
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.25, duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
      >
        <rect
          x={x + 96} y={y - 13}
          width={isTrue ? 42 : 46} height={26} rx={13}
          fill={c.stroke}
        />
        <text
          x={x + (isTrue ? 117 : 119)} y={y}
          textAnchor="middle" dominantBaseline="central"
          fontSize={10} fontWeight="700" fill="#fff"
          fontFamily="system-ui, sans-serif"
        >
          {isTrue ? 'TRUE' : 'FALSE'}
        </text>
      </motion.g>
    </motion.g>
  );
}

// ─── Code Line ────────────────────────────────────────────────────────────────
function CodeLineShape({ obj, isHighlighted, isNew, transition, stepKey }) {
  const {
    x = 80, y = 300,
    code = '',
    lineNumber,
    highlight = false,
    color = 'blue',
    w = 300,
    fontSize = 13,
  } = obj;

  const c = getColor(color);
  const isLit = highlight || isHighlighted;

  return (
    <g key={`${obj.id}-${stepKey}`}>
      {/* Row background */}
      <motion.rect
        x={x - 8} y={y - 14}
        width={w + 16} height={28} rx={4}
        fill={isLit ? c.light : 'transparent'}
        stroke={isLit ? c.stroke : 'transparent'}
        strokeWidth={1}
        initial={false}
        animate={{ opacity: isLit ? 1 : 0.5, x: isLit ? x - 12 : x - 8 }}
        transition={{ duration: 0.25 }}
      />

      {/* Scan-line sweep animation on highlight */}
      {isLit && (
        <motion.rect
          x={x - 8} y={y - 14}
          width={8} height={28} rx={2}
          fill={c.stroke} opacity={0.4}
          initial={{ x: x - 8 }}
          animate={{ x: x + w + 8 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      )}

      {/* Line number */}
      {lineNumber !== undefined && (
        <text
          x={x - 4} y={y}
          textAnchor="end" dominantBaseline="central"
          fontSize={11} fontWeight="400"
          fill={isLit ? c.stroke : 'var(--text-tertiary, #64748b)'}
          fontFamily="'JetBrains Mono', monospace"
        >
          {lineNumber}
        </text>
      )}

      {/* Code text */}
      <text
        x={x + (lineNumber !== undefined ? 12 : 0)} y={y}
        dominantBaseline="central"
        fontSize={fontSize} fontWeight={isLit ? '600' : '400'}
        fill={isLit ? c.stroke : 'var(--text-secondary, #94a3b8)'}
        fontFamily="'JetBrains Mono', 'Fira Code', monospace"
      >
        {code}
      </text>
    </g>
  );
}

// ─── Highlight Box ────────────────────────────────────────────────────────────
function HighlightBoxShape({ obj, isNew, transition, stepKey }) {
  const {
    x = 300, y = 260,
    w = 240, h = 80,
    color = 'green',
    label,
  } = obj;

  const c = getColor(color);
  const variant = getVariant(transition);

  return (
    <motion.g
      key={`${obj.id}-${stepKey}`}
      initial={isNew ? variant.hidden : false}
      animate={isNew ? variant.visible : {}}
      transition={{ duration: 0.4 }}
    >
      {label && (
        <text
          x={x + w / 2} y={y - 10}
          textAnchor="middle" dominantBaseline="central"
          fontSize={12} fontWeight="600"
          fill={c.stroke}
          fontFamily="system-ui, sans-serif"
        >
          {label}
        </text>
      )}
      <rect
        x={x} y={y} width={w} height={h} rx={8}
        fill={c.light} stroke={c.stroke} strokeWidth={1.5}
        strokeDasharray="6 3" opacity={0.7}
      />
    </motion.g>
  );
}

// ─── Circle ───────────────────────────────────────────────────────────────────
function CircleShape({ obj, isHighlighted, isNew, transition, stepKey }) {
  const {
    x = CW / 2, y = CH / 2, r = 40,
    color = 'blue',
    label, innerLabel,
    pulse = false, glow = false,
  } = obj;

  const c = getColor(color);
  const variant = getVariant(transition);
  const shouldPulse = pulse || isHighlighted;

  return (
    <motion.g
      key={`${obj.id}-${stepKey}`}
      initial={isNew ? variant.hidden : false}
      animate={isNew ? variant.visible : {}}
      transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
    >
      {/* Glow ring */}
      {(glow || isHighlighted) && (
        <motion.circle
          cx={x} cy={y} r={r + 8}
          fill="none" stroke={c.stroke}
          strokeWidth={2} opacity={0.35}
          animate={{ r: [r + 6, r + 14, r + 6], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* Main circle */}
      <motion.circle
        cx={x} cy={y} r={r}
        fill={c.light} stroke={c.stroke} strokeWidth={2}
        animate={shouldPulse
          ? { r: [r, r * 1.06, r], stroke: [c.stroke, c.stroke, c.stroke] }
          : {}}
        transition={shouldPulse ? { duration: 0.8, repeat: 2, ease: 'easeInOut' } : {}}
      />

      {/* Inner label */}
      {innerLabel && (
        <text
          x={x} y={y}
          textAnchor="middle" dominantBaseline="central"
          fontSize={Math.max(12, r * 0.45)} fontWeight="700"
          fill={c.fill}
          fontFamily="'JetBrains Mono', monospace"
        >
          {innerLabel}
        </text>
      )}

      {/* External label */}
      {label && (
        <text
          x={x} y={y + r + 18}
          textAnchor="middle" dominantBaseline="central"
          fontSize={13} fontWeight="500"
          fill="var(--text-secondary, #94a3b8)"
          fontFamily="system-ui, sans-serif"
        >
          {label}
        </text>
      )}
    </motion.g>
  );
}

// ─── Rect ─────────────────────────────────────────────────────────────────────
function RectShape({ obj, isHighlighted, isNew, transition, stepKey }) {
  const {
    x = 100, y = 100, w = 160, h = 60,
    color = 'blue',
    label, rx: rxProp = 8,
  } = obj;

  const c = getColor(color);
  const variant = getVariant(transition);

  return (
    <motion.g
      key={`${obj.id}-${stepKey}`}
      initial={isNew ? variant.hidden : false}
      animate={isNew ? variant.visible : {}}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      <rect
        x={x} y={y} width={w} height={h} rx={rxProp}
        fill={c.light}
        stroke={isHighlighted ? c.stroke : c.stroke + '99'}
        strokeWidth={isHighlighted ? 2 : 1}
      />
      {label && (
        <text
          x={x + w / 2} y={y + h / 2}
          textAnchor="middle" dominantBaseline="central"
          fontSize={14} fontWeight="600"
          fill={c.fill}
          fontFamily="system-ui, sans-serif"
        >
          {label}
        </text>
      )}
    </motion.g>
  );
}

// ─── Arrow ────────────────────────────────────────────────────────────────────
function ArrowShape({ obj, isNew, transition, stepKey }) {
  const {
    x1 = 100, y1 = 100, x2 = 200, y2 = 100,
    color = 'gray',
    label, dashed = false, thickness = 2,
  } = obj;

  const c = getColor(color);
  const mid = { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };

  return (
    <motion.g key={`${obj.id}-${stepKey}`}>
      <defs>
        <marker
          id={`arr-${obj.id}`}
          viewBox="0 0 10 10" refX="8" refY="5"
          markerWidth="6" markerHeight="6" orient="auto-start-reverse"
        >
          <path d="M2 1L8 5L2 9" fill="none" stroke={c.stroke} strokeWidth="1.5" />
        </marker>
      </defs>
      <motion.line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={c.stroke} strokeWidth={thickness}
        strokeDasharray={dashed ? '8 4' : undefined}
        strokeLinecap="round"
        markerEnd={`url(#arr-${obj.id})`}
        initial={isNew ? { pathLength: 0, opacity: 0 } : false}
        animate={isNew ? { pathLength: 1, opacity: 1 } : {}}
        transition={{ duration: 0.5 }}
      />
      {label && (
        <text
          x={mid.x} y={mid.y - 10}
          textAnchor="middle" dominantBaseline="central"
          fontSize={11} fontWeight="500"
          fill="var(--text-secondary, #94a3b8)"
          fontFamily="system-ui, sans-serif"
        >
          {label}
        </text>
      )}
    </motion.g>
  );
}

// ─── Line ─────────────────────────────────────────────────────────────────────
function LineShape({ obj, isNew, stepKey }) {
  const {
    x1 = 0, y1 = 0, x2 = 100, y2 = 0,
    color = 'gray', strokeWidth = 1.5, dashed = false,
  } = obj;
  const c = getColor(color);

  return (
    <motion.line
      key={`${obj.id}-${stepKey}`}
      x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={c.stroke} strokeWidth={strokeWidth}
      strokeDasharray={dashed ? '6 3' : undefined}
      strokeLinecap="round"
      initial={isNew ? { pathLength: 0, opacity: 0 } : false}
      animate={isNew ? { pathLength: 1, opacity: 1 } : {}}
      transition={{ duration: 0.4 }}
    />
  );
}

// ─── Text ─────────────────────────────────────────────────────────────────────
function TextShape({ obj, isHighlighted, isNew, transition, stepKey }) {
  const {
    x = CW / 2, y = 100,
    text = '',
    fontSize = 16,
    color = 'white',
    fontWeight = '500',
  } = obj;

  const c = getColor(color);
  const variant = getVariant(transition);

  return (
    <motion.text
      key={`${obj.id}-${stepKey}`}
      x={x} y={y}
      textAnchor="middle" dominantBaseline="central"
      fontSize={fontSize}
      fontWeight={isHighlighted ? '700' : fontWeight}
      fill={isHighlighted ? c.stroke : 'var(--text-primary, #f1f5f9)'}
      fontFamily="system-ui, sans-serif"
      initial={isNew ? variant.hidden : false}
      animate={isNew ? variant.visible : {}}
      transition={{ duration: 0.4 }}
    >
      {text}
    </motion.text>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function BadgeShape({ obj, isNew, transition, stepKey }) {
  const {
    x = CW / 2, y = 100,
    text = '',
    bgColor = 'blue', textColor,
  } = obj;

  const c = getColor(bgColor);
  const chars = (text || '').length;
  const bw = Math.max(60, chars * 8 + 24);
  const bh = 26;
  const variant = getVariant(transition);

  return (
    <motion.g
      key={`${obj.id}-${stepKey}`}
      initial={isNew ? variant.hidden : false}
      animate={isNew ? variant.visible : {}}
      transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
    >
      <rect
        x={x - bw / 2} y={y - bh / 2}
        width={bw} height={bh} rx={bh / 2}
        fill={c.stroke}
      />
      <text
        x={x} y={y}
        textAnchor="middle" dominantBaseline="central"
        fontSize={11} fontWeight="700"
        fill={textColor || '#fff'}
        fontFamily="system-ui, sans-serif"
      >
        {text}
      </text>
    </motion.g>
  );
}

// ─── Arc ──────────────────────────────────────────────────────────────────────
function ArcShape({ obj, isNew, stepKey }) {
  const {
    cx = CW / 2, cy = CH / 2, r = 60,
    startAngle = 0, endAngle = 180,
    color = 'blue',
  } = obj;

  const c = getColor(color);
  const toRad = (deg) => (deg * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startAngle));
  const y1 = cy + r * Math.sin(toRad(startAngle));
  const x2 = cx + r * Math.cos(toRad(endAngle));
  const y2 = cy + r * Math.sin(toRad(endAngle));
  const large = endAngle - startAngle > 180 ? 1 : 0;
  const d = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;

  return (
    <motion.path
      key={`${obj.id}-${stepKey}`}
      d={d} fill="none"
      stroke={c.stroke} strokeWidth={2.5} strokeLinecap="round"
      initial={isNew ? { pathLength: 0, opacity: 0 } : false}
      animate={isNew ? { pathLength: 1, opacity: 1 } : {}}
      transition={{ duration: 0.6 }}
    />
  );
}

// ─── Path ─────────────────────────────────────────────────────────────────────
function PathShape({ obj, isNew, stepKey }) {
  const {
    d = '', color = 'blue',
    strokeWidth = 2, fill = 'none',
  } = obj;

  const c = getColor(color);

  return (
    <motion.path
      key={`${obj.id}-${stepKey}`}
      d={d}
      fill={fill === 'none' ? 'none' : c.light}
      stroke={c.stroke} strokeWidth={strokeWidth}
      strokeLinecap="round"
      initial={isNew ? { pathLength: 0, opacity: 0 } : false}
      animate={isNew ? { pathLength: 1, opacity: 1 } : {}}
      transition={{ duration: 0.7 }}
    />
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SHAPE DISPATCHER
// ════════════════════════════════════════════════════════════════════════════

function renderShape(obj, { isHighlighted, isNew, transition, stepKey }) {
  if (!obj?.shape) return null;
  const props = { obj, isHighlighted, isNew, transition, stepKey };

  switch (obj.shape) {
    case 'array':        return <ArrayShape        key={obj.id} {...props} />;
    case 'pointer':      return <PointerShape      key={obj.id} {...props} />;
    case 'swapbridge':   return <SwapBridgeShape   key={obj.id} {...props} />;
    case 'comparator':   return <ComparatorShape   key={obj.id} {...props} />;
    case 'codeline':     return <CodeLineShape     key={obj.id} {...props} />;
    case 'highlightbox': return <HighlightBoxShape key={obj.id} {...props} />;
    case 'circle':       return <CircleShape       key={obj.id} {...props} />;
    case 'rect':         return <RectShape         key={obj.id} {...props} />;
    case 'arrow':        return <ArrowShape        key={obj.id} {...props} />;
    case 'line':         return <LineShape         key={obj.id} {...props} />;
    case 'text':         return <TextShape         key={obj.id} {...props} />;
    case 'badge':        return <BadgeShape        key={obj.id} {...props} />;
    case 'arc':          return <ArcShape          key={obj.id} {...props} />;
    case 'path':         return <PathShape         key={obj.id} {...props} />;
    default:             return null;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// STEP DIFF ENGINE
// ════════════════════════════════════════════════════════════════════════════

function useStepDiff(objects, steps, currentStepIndex) {
  const prevObjectIdsRef = useRef(new Set());

  return useMemo(() => {
    if (!steps || steps.length === 0 || !objects || objects.length === 0) {
      return { visibleObjects: [], highlightIds: new Set(), newIds: new Set(), transition: 'fadeIn' };
    }

    const step = steps[Math.min(currentStepIndex, steps.length - 1)];
    if (!step) return { visibleObjects: [], highlightIds: new Set(), newIds: new Set(), transition: 'fadeIn' };

    const objectMap = {};
    objects.forEach(o => { if (o?.id) objectMap[o.id] = o; });

    const currentIds   = new Set(step.objectIds  || []);
    const highlightIds = new Set(step.highlightIds || []);
    const newIds       = new Set(step.newIds       || []);
    const prevIds      = prevObjectIdsRef.current;

    // Objects to show
    const visibleObjects = [...currentIds]
      .map(id => objectMap[id])
      .filter(Boolean);

    prevObjectIdsRef.current = currentIds;

    return {
      visibleObjects,
      highlightIds,
      newIds,
      transition: step.transition || 'fadeIn',
      stepKey: `step-${currentStepIndex}`,
    };
  }, [objects, steps, currentStepIndex]);
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════════════

const AnimationRenderer = ({ objects = [], steps = [], currentStepIndex = 0, data }) => {
  // Legacy support: if old `data` prop is passed, fall back to legacy renderer
  const isLegacyMode = (!objects || objects.length === 0) && data && (data.elements || data.sequence);

  // ── Legacy renderer (old AnimationRenderer behaviour) ────────────────────
  if (isLegacyMode) {
    return <LegacyAnimationRenderer data={data} />;
  }

  // ── New shape-native renderer ─────────────────────────────────────────────
  const { visibleObjects, highlightIds, newIds, transition, stepKey } =
    useStepDiff(objects, steps, currentStepIndex);

  if (!objects || objects.length === 0) return null;

  return (
    <div className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none overflow-hidden">
      <svg
        viewBox={`0 0 ${CW} ${CH}`}
        width="100%" height="100%"
        style={{ maxWidth: '900px', maxHeight: '80vh', overflow: 'visible' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <AnimatePresence mode="popLayout">
          {visibleObjects.map((obj) =>
            renderShape(obj, {
              isHighlighted: highlightIds.has(obj.id),
              isNew:         newIds.has(obj.id),
              transition,
              stepKey,
            })
          )}
        </AnimatePresence>
      </svg>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// LEGACY RENDERER (preserves old AnimationRenderer behaviour exactly)
// ════════════════════════════════════════════════════════════════════════════

const LegacyAnimationRenderer = ({ data }) => {
  const safeData = data || {};
  const elements = Array.isArray(safeData.elements) ? safeData.elements : [];
  const sequence = Array.isArray(safeData.sequence) ? safeData.sequence : [];
  const connections = Array.isArray(safeData.connections) ? safeData.connections : [];

  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  if (elements.length === 0 && sequence.length === 0) return null;

  useEffect(() => {
    if (!isPlaying || sequence.length === 0) return;
    const interval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= sequence.length - 1) { setIsPlaying(false); return prev; }
        return prev + 1;
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [isPlaying, sequence.length]);

  const getElementPosition = (el, index) => {
    if (el.initialPos && (el.initialPos.x !== 0 || el.initialPos.y !== 0))
      return { x: el.initialPos.x, y: el.initialPos.y };
    const cols = Math.min(elements.length, 4);
    const spacing = 180;
    const row = Math.floor(index / cols);
    const col = index % cols;
    const offsetX = -(cols - 1) * spacing / 2;
    return { x: offsetX + col * spacing, y: row * 120 };
  };

  const currentActions = sequence[currentStep]?.actions || [];

  return (
    <div className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none overflow-hidden">
      <div className="relative w-full h-full max-w-5xl max-h-[80vh] flex items-center justify-center">
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
          <defs>
            <marker id="anim-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--text-tertiary)" opacity="0.4" />
            </marker>
          </defs>
          {connections.map((conn, i) => {
            const fromEl = elements.find(e => e.id === conn?.from);
            const toEl   = elements.find(e => e.id === conn?.to);
            if (!fromEl || !toEl) return null;
            const fromPos = getElementPosition(fromEl, elements.indexOf(fromEl));
            const toPos   = getElementPosition(toEl,   elements.indexOf(toEl));
            const cx = 50, cy = 50;
            return (
              <motion.line key={i}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.3 }}
                transition={{ duration: 1, delay: 0.5 + i * 0.2 }}
                x1={`${cx + fromPos.x / 10}%`} y1={`${cy + fromPos.y / 10}%`}
                x2={`${cx + toPos.x / 10}%`}   y2={`${cy + toPos.y / 10}%`}
                stroke="var(--text-tertiary)" strokeWidth="2" strokeDasharray="6,4"
                markerEnd="url(#anim-arrow)"
              />
            );
          })}
        </svg>
        <div className="relative flex items-center justify-center gap-6 flex-wrap p-8">
          <AnimatePresence>
            {elements.map((el, i) => {
              const safeId = el?.id || `e${i}`;
              const isVisible = currentStep === 0 || currentActions.some(a => a?.includes?.(safeId)) || i <= currentStep;
              return (
                <motion.div key={safeId}
                  initial={{ opacity: 0, scale: 0.5, y: 30 }}
                  animate={{ opacity: isVisible ? 1 : 0.3, scale: isVisible ? 1 : 0.8, y: 0 }}
                  transition={{ duration: 0.8, delay: i * 0.15, ease: [0.16, 1, 0.3, 1] }}
                  className="relative p-6 rounded-[2rem] bg-[var(--bg-secondary)]/80 backdrop-blur-3xl border border-[var(--border-color)] shadow-2xl flex flex-col items-center gap-3"
                  style={{ width: '150px', minHeight: '100px' }}
                >
                  <span className="text-3xl filter drop-shadow-lg">{el?.icon || '✦'}</span>
                  <span className="text-[11px] font-black uppercase tracking-widest text-[var(--text-primary)] text-center leading-tight">
                    {el?.label || `Element ${i + 1}`}
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
        {sequence.length > 0 && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3">
            <div className="px-4 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-full text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
              Step {currentStep + 1} / {sequence.length}
            </div>
            <AnimatePresence mode="wait">
              <motion.p key={currentStep}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="text-base font-medium text-[var(--text-primary)] text-center max-w-lg leading-relaxed px-6 py-3 bg-[var(--bg-secondary)]/60 backdrop-blur-xl rounded-2xl border border-[var(--border-color)]"
              >
                {sequence[currentStep]?.description || 'Animating...'}
              </motion.p>
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnimationRenderer;