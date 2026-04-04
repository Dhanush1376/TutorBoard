/**
 * CanvasRenderer — Complete SVG Animation Engine
 *
 * Supports:
 *  - Standard shapes: circle, rect, arrow, line, text, badge, orbit, arc, path
 *  - Algorithm shapes: array, arraybox, pointer, highlightbox, codeline, comparator, swapbridge
 *  - Auto-centering: all shapes rendered within 800x600 viewBox, centered
 *  - Word-wrap on all text labels
 *  - Step-local animation delays (no global index stagger)
 *  - Empty objectIds fallback to appearsAtStep
 */

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useTutorStore from '../../store/tutorStore';

// ─── Palette ───
const PALETTE = {
  blue: '#3b82f6', red: '#ef4444', green: '#22c55e', yellow: '#eab308',
  orange: '#f97316', purple: '#a855f7', pink: '#ec4899', cyan: '#06b6d4',
  white: '#f8fafc', gray: '#64748b', gold: '#fbbf24', teal: '#14b8a6',
  emerald: '#10b981', indigo: '#6366f1', lime: '#84cc16', amber: '#f59e0b',
  'light-blue': '#60a5fa', 'light-green': '#4ade80', navy: '#1e3a5f',
  dark: '#0f172a', slate: '#475569',
};

const resolveColor = (c, fallback = '#3b82f6') => {
  if (!c) return fallback;
  const s = String(c).trim();
  if (s.startsWith('#') || s.startsWith('rgb')) return s;
  return PALETTE[s.toLowerCase()] || fallback;
};

const safeNum = (val, fallback = 0) => {
  const n = Number(val);
  return isNaN(n) ? fallback : n;
};

// ─── Word-wrap ───
const wrapText = (text, maxCharsPerLine = 20) => {
  if (!text) return [];
  const words = String(text).split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length <= maxCharsPerLine) {
      cur = (cur + ' ' + w).trim();
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
};

const MultilineText = ({ x, y, text, fontSize = 13, fill = '#e2e8f0', fontWeight = '600', anchor = 'middle', maxChars = 22 }) => {
  const lines = wrapText(String(text || ''), maxChars);
  const lh = safeNum(fontSize) * 1.35;
  const startY = y - ((lines.length - 1) * lh) / 2;
  return (
    <>
      {lines.map((line, i) => (
        <text key={i} x={x} y={startY + i * lh}
          textAnchor={anchor} fill={fill}
          fontSize={fontSize} fontWeight={fontWeight}
          fontFamily="'JetBrains Mono', 'Courier New', monospace"
          pointerEvents="none"
        >{line}</text>
      ))}
    </>
  );
};

// ══════════════════════════════════════════════════════
// ALGORITHM SHAPES
// ══════════════════════════════════════════════════════

/**
 * array — renders a horizontal array of labeled boxes
 * { id, shape:"array", x, y, values:["5","3","8",...], cellW, cellH,
 *   highlightCells:[], swapCells:[], compareCells:[], sortedCells:[],
 *   label, appearsAtStep }
 *
 * x,y = top-left of the array block
 * All highlighting done via cell index arrays
 */
const RenderArray = ({ obj, visible, highlighted, delay }) => {
  const values = Array.isArray(obj.values) ? obj.values : [];
  const cellW = safeNum(obj.cellW, 60);
  const cellH = safeNum(obj.cellH, 56);
  const totalW = values.length * cellW;
  // Center the array on x,y
  const startX = safeNum(obj.x, 400) - totalW / 2;
  const startY = safeNum(obj.y, 300) - cellH / 2;

  const highlightSet = new Set(obj.highlightCells || []);
  const swapSet = new Set(obj.swapCells || []);
  const compareSet = new Set(obj.compareCells || []);
  const sortedSet = new Set(obj.sortedCells || []);

  const getCellColor = (i) => {
    if (swapSet.has(i)) return { fill: '#ef4444', stroke: '#fca5a5', text: '#fff' };
    if (compareSet.has(i)) return { fill: '#f97316', stroke: '#fdba74', text: '#fff' };
    if (highlightSet.has(i)) return { fill: '#3b82f6', stroke: '#93c5fd', text: '#fff' };
    if (sortedSet.has(i)) return { fill: '#22c55e', stroke: '#86efac', text: '#fff' };
    return { fill: '#1e293b', stroke: '#475569', text: '#e2e8f0' };
  };

  return (
    <motion.g
      data-id={obj.id}
      initial={{ opacity: 0, y: 20 }}
      animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {values.map((val, i) => {
        const cx = startX + i * cellW;
        const colors = getCellColor(i);
        const isSwap = swapSet.has(i);

        return (
          <motion.g key={i}
            animate={isSwap ? { y: [0, -18, 0] } : { y: 0 }}
            transition={isSwap ? { duration: 0.6, delay: delay + i * 0.05 } : {}}
          >
            {/* Cell border */}
            <rect
              x={cx} y={startY}
              width={cellW} height={cellH}
              fill={colors.fill} fillOpacity={0.25}
              stroke={colors.stroke} strokeWidth={isSwap ? 2.5 : 1.8}
              rx={6}
            />
            {/* Glow for special cells */}
            {(isSwap || compareSet.has(i)) && (
              <motion.rect
                x={cx - 2} y={startY - 2}
                width={cellW + 4} height={cellH + 4} rx={8}
                fill="none" stroke={colors.stroke}
                animate={{ opacity: [0.2, 0.7, 0.2] }}
                transition={{ duration: 1.0, repeat: Infinity }}
              />
            )}
            {/* Value */}
            <text
              x={cx + cellW / 2} y={startY + cellH / 2 + 6}
              textAnchor="middle" fill={colors.text}
              fontSize={safeNum(obj.fontSize, 20)} fontWeight="bold"
              fontFamily="'JetBrains Mono', monospace" pointerEvents="none"
            >{val}</text>
            {/* Index label below */}
            {obj.showIndex !== false && (
              <text
                x={cx + cellW / 2} y={startY + cellH + 18}
                textAnchor="middle" fill="#64748b"
                fontSize={11} fontWeight="500"
                fontFamily="monospace" pointerEvents="none"
              >[{i}]</text>
            )}
          </motion.g>
        );
      })}

      {/* Array label */}
      {obj.label && (
        <text
          x={startX + totalW / 2} y={startY - 16}
          textAnchor="middle" fill="#94a3b8"
          fontSize={13} fontWeight="600"
          fontFamily="system-ui, sans-serif" pointerEvents="none"
        >{obj.label}</text>
      )}
    </motion.g>
  );
};

/**
 * pointer — a labeled arrow pointing at an array cell
 * { id, shape:"pointer", arrayX, arrayY, arrayW (totalWidth), cellIndex, cellW,
 *   label, color, side:"top"|"bottom", appearsAtStep }
 */
const RenderPointer = ({ obj, visible, highlighted, delay }) => {
  const cellW = safeNum(obj.cellW, 60);
  const totalW = safeNum(obj.arrayW ?? (safeNum(obj.cellCount, 1) * cellW), cellW);
  const startX = safeNum(obj.arrayX, 400) - totalW / 2;
  const cellIdx = safeNum(obj.cellIndex, 0);
  const cx = startX + cellIdx * cellW + cellW / 2;
  const arrayY = safeNum(obj.arrayY, 300);
  const cellH = safeNum(obj.cellH, 56);
  const side = obj.side || 'bottom';
  const color = resolveColor(obj.color, '#fbbf24');

  const arrowY1 = side === 'top'
    ? arrayY - cellH / 2 - 30
    : arrayY + cellH / 2 + 32;
  const arrowY2 = side === 'top'
    ? arrayY - cellH / 2 - 4
    : arrayY + cellH / 2 + 4;
  const labelY = side === 'top'
    ? arrowY1 - 14
    : arrowY1 + 16;

  const markerId = `ptr-${obj.id}`;

  return (
    <motion.g
      data-id={obj.id}
      initial={{ opacity: 0, x: cx }}
      animate={visible ? { opacity: 1, x: cx } : { opacity: 0, x: cx }}
      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
      style={{ transformOrigin: `${cx}px ${arrayY}px` }}
    >
      <defs>
        <marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5"
          markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
        </marker>
      </defs>
      <motion.line
        x1={cx} y1={arrowY1}
        x2={cx} y2={arrowY2}
        stroke={color} strokeWidth={2.5}
        markerEnd={`url(#${markerId})`}
        initial={{ pathLength: 0 }}
        animate={visible ? { pathLength: 1 } : { pathLength: 0 }}
        transition={{ duration: 0.35, delay }}
      />
      {obj.label && (
        <text
          x={cx} y={labelY}
          textAnchor="middle" fill={color}
          fontSize={12} fontWeight="bold"
          fontFamily="'JetBrains Mono', monospace" pointerEvents="none"
        >{obj.label}</text>
      )}
    </motion.g>
  );
};

/**
 * swapbridge — animated arc showing two elements being swapped
 * { id, shape:"swapbridge", arrayX, arrayY, arrayW, cellW, cellH,
 *   fromIndex, toIndex, color, appearsAtStep }
 */
const RenderSwapBridge = ({ obj, visible, delay }) => {
  const cellW = safeNum(obj.cellW, 60);
  const totalW = safeNum(obj.arrayW ?? (safeNum(obj.cellCount, 1) * cellW), cellW);
  const startX = safeNum(obj.arrayX, 400) - totalW / 2;
  const cellH = safeNum(obj.cellH, 56);
  const arrayY = safeNum(obj.arrayY, 300);

  const fromIdx = safeNum(obj.fromIndex, 0);
  const toIdx = safeNum(obj.toIndex, 1);
  const x1 = startX + fromIdx * cellW + cellW / 2;
  const x2 = startX + toIdx * cellW + cellW / 2;
  const topY = arrayY - cellH / 2 - 40;
  const color = resolveColor(obj.color, '#ef4444');

  // Arc path above the array
  const d = `M ${x1} ${arrayY - cellH / 2} Q ${(x1 + x2) / 2} ${topY} ${x2} ${arrayY - cellH / 2}`;

  return (
    <motion.g data-id={obj.id}>
      <motion.path
        d={d} fill="none"
        stroke={color} strokeWidth={2.5}
        strokeDasharray="6,4"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={visible ? { pathLength: 1, opacity: 0.85 } : { pathLength: 0, opacity: 0 }}
        transition={{ duration: 0.7, delay, ease: 'easeOut' }}
      />
      {/* Swap label at arc top */}
      <motion.text
        x={(x1 + x2) / 2} y={topY - 12}
        textAnchor="middle" fill={color}
        fontSize={12} fontWeight="bold"
        fontFamily="monospace" pointerEvents="none"
        initial={{ opacity: 0 }}
        animate={visible ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.3, delay: delay + 0.5 }}
      >SWAP</motion.text>
    </motion.g>
  );
};

/**
 * comparator — shows a comparison box between two values
 * { id, shape:"comparator", x, y, leftVal, rightVal, operator:"<"|">"|"=",
 *   result:"true"|"false", color, appearsAtStep }
 */
const RenderComparator = ({ obj, visible, delay }) => {
  const x = safeNum(obj.x, 400);
  const y = safeNum(obj.y, 300);
  const color = resolveColor(obj.color, '#f97316');
  const resultColor = obj.result === 'true' ? '#22c55e' : '#ef4444';

  return (
    <motion.g
      data-id={obj.id}
      initial={{ opacity: 0, scale: 0.7 }}
      animate={visible ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.7 }}
      transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}
      style={{ transformOrigin: `${x}px ${y}px` }}
    >
      {/* Box */}
      <rect x={x - 90} y={y - 28} width={180} height={56} rx={10}
        fill={color} fillOpacity={0.12}
        stroke={color} strokeWidth={1.8}
      />
      {/* Expression */}
      <text x={x} y={y + 6}
        textAnchor="middle" fill="#e2e8f0"
        fontSize={20} fontWeight="bold"
        fontFamily="'JetBrains Mono', monospace" pointerEvents="none"
      >{obj.leftVal} {obj.operator || '<'} {obj.rightVal}</text>
      {/* Result badge */}
      {obj.result && (
        <motion.g
          initial={{ opacity: 0, scale: 0 }}
          animate={visible ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }}
          transition={{ duration: 0.3, delay: delay + 0.4 }}
          style={{ transformOrigin: `${x}px ${y + 44}px` }}
        >
          <rect x={x - 30} y={y + 34} width={60} height={22} rx={11}
            fill={resultColor} fillOpacity={0.2}
            stroke={resultColor} strokeWidth={1.5}
          />
          <text x={x} y={y + 49}
            textAnchor="middle" fill={resultColor}
            fontSize={12} fontWeight="bold"
            fontFamily="monospace" pointerEvents="none"
          >{obj.result}</text>
        </motion.g>
      )}
    </motion.g>
  );
};

/**
 * codeline — a highlighted line of pseudo-code
 * { id, shape:"codeline", x, y, code, lineNumber, highlight, color, appearsAtStep }
 */
const RenderCodeLine = ({ obj, visible, highlighted, delay }) => {
  const x = safeNum(obj.x, 100);
  const y = safeNum(obj.y, 300);
  const w = safeNum(obj.w, 320);
  const h = 26;
  const isHL = obj.highlight || highlighted;
  const bg = isHL ? resolveColor(obj.color, '#3b82f6') : 'transparent';
  const code = obj.code || obj.text || '';

  return (
    <motion.g
      data-id={obj.id}
      initial={{ opacity: 0, x: -10 }}
      animate={visible ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
      transition={{ duration: 0.35, delay, ease: 'easeOut' }}
    >
      {isHL && (
        <rect x={x - 8} y={y - 18} width={w + 16} height={h} rx={4}
          fill={bg} fillOpacity={0.22}
          stroke={bg} strokeWidth={1}
        />
      )}
      {obj.lineNumber && (
        <text x={x - 4} y={y}
          textAnchor="end" fill="#475569"
          fontSize={11} fontFamily="monospace" pointerEvents="none"
        >{obj.lineNumber}</text>
      )}
      <text x={x} y={y}
        textAnchor="start" fill={isHL ? '#f8fafc' : '#94a3b8'}
        fontSize={safeNum(obj.fontSize, 13)} fontWeight={isHL ? 'bold' : '400'}
        fontFamily="'JetBrains Mono', monospace" pointerEvents="none"
      >{code}</text>
    </motion.g>
  );
};

/**
 * highlightbox — draws a glowing rectangle around a region (e.g., sorted subarray)
 * { id, shape:"highlightbox", x, y, w, h, color, label, appearsAtStep }
 */
const RenderHighlightBox = ({ obj, visible, delay }) => {
  const x = safeNum(obj.x, 300);
  const y = safeNum(obj.y, 270);
  const w = safeNum(obj.w, 200);
  const h = safeNum(obj.h, 80);
  const color = resolveColor(obj.color, '#22c55e');

  return (
    <motion.g data-id={obj.id}
      initial={{ opacity: 0 }}
      animate={visible ? { opacity: 1 } : { opacity: 0 }}
      transition={{ duration: 0.5, delay }}
    >
      <motion.rect
        x={x} y={y} width={w} height={h} rx={10}
        fill={color} fillOpacity={0.07}
        stroke={color} strokeWidth={2}
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.8, repeat: Infinity }}
      />
      {obj.label && (
        <text x={x + w / 2} y={y - 10}
          textAnchor="middle" fill={color}
          fontSize={12} fontWeight="bold"
          fontFamily="monospace" pointerEvents="none"
        >{obj.label}</text>
      )}
    </motion.g>
  );
};

// ══════════════════════════════════════════════════════
// STANDARD SHAPES
// ══════════════════════════════════════════════════════

const RenderCircle = ({ obj, visible, highlighted, delay }) => {
  const cx = safeNum(obj.x, 400);
  const cy = safeNum(obj.y, 300);
  const r = safeNum(obj.r ?? obj.size, 40);
  const fill = resolveColor(obj.fill || obj.color);
  const stroke = resolveColor(obj.stroke || obj.color);

  return (
    <motion.g data-id={obj.id}
      initial={{ opacity: 0, scale: 0.3 }}
      animate={visible ? { opacity: 1, scale: highlighted ? 1.1 : 1 } : { opacity: 0, scale: 0.3 }}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
      style={{ transformOrigin: `${cx}px ${cy}px` }}
    >
      {(obj.glow || highlighted) && (
        <motion.circle cx={cx} cy={cy}
          animate={{ r: [r + 8, r + 22, r + 8], opacity: [0.07, 0.18, 0.07] }}
          fill={fill}
          transition={{ duration: 2.2, repeat: Infinity }}
        />
      )}
      <circle cx={cx} cy={cy} r={r}
        fill={fill} fillOpacity={safeNum(obj.fillOpacity, 0.18)}
        stroke={stroke} strokeWidth={highlighted ? 3 : 2}
      />
      {obj.pulse && visible && (
        <motion.circle cx={cx} cy={cy} fill="none" stroke={stroke} strokeWidth={1.5}
          animate={{ r: [r, r + 7, r], opacity: [0.6, 0.1, 0.6] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        />
      )}
      {obj.innerLabel && (
        <text x={cx} y={cy + safeNum(obj.innerFontSize, 14) * 0.4}
          textAnchor="middle" fill="#f8fafc"
          fontSize={safeNum(obj.innerFontSize, 14)} fontWeight="bold"
          fontFamily="system-ui, sans-serif" pointerEvents="none"
        >{obj.innerLabel}</text>
      )}
      {obj.label && (
        <MultilineText x={cx} y={cy + r + 20}
          text={obj.label} fontSize={safeNum(obj.fontSize, 12)}
          fill="#cbd5e1" maxChars={16}
        />
      )}
    </motion.g>
  );
};

const RenderRect = ({ obj, visible, highlighted, delay }) => {
  const cx = safeNum(obj.x, 400);
  const cy = safeNum(obj.y, 300);
  const w = safeNum(obj.w ?? obj.width, 120);
  const h = safeNum(obj.h ?? obj.height, 56);
  const rx = safeNum(obj.rx, 10);
  const fill = resolveColor(obj.fill || obj.color);
  const stroke = resolveColor(obj.stroke || obj.color);

  return (
    <motion.g data-id={obj.id}
      initial={{ opacity: 0, y: 18 }}
      animate={visible ? { opacity: 1, y: 0, scale: highlighted ? 1.05 : 1 } : { opacity: 0, y: 18 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      style={{ transformOrigin: `${cx}px ${cy}px` }}
    >
      {highlighted && (
        <motion.rect x={cx - w / 2 - 4} y={cy - h / 2 - 4} width={w + 8} height={h + 8} rx={rx + 4}
          fill="none" stroke={fill}
          animate={{ opacity: [0.12, 0.35, 0.12] }}
          strokeWidth={2}
          transition={{ duration: 1.4, repeat: Infinity }}
        />
      )}
      <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={rx}
        fill={fill} fillOpacity={safeNum(obj.fillOpacity, 0.14)}
        stroke={stroke} strokeWidth={highlighted ? 2.5 : 1.5}
      />
      {obj.label && (
        <MultilineText x={cx} y={cy}
          text={obj.label} fontSize={safeNum(obj.fontSize, 13)}
          fill="#e2e8f0" fontWeight="bold"
          maxChars={Math.floor(w / 7.5)}
        />
      )}
    </motion.g>
  );
};

const RenderArrow = ({ obj, visible, highlighted, delay, index }) => {
  const x1 = safeNum(obj.x1, 200), y1 = safeNum(obj.y1, 300);
  const x2 = safeNum(obj.x2, 600), y2 = safeNum(obj.y2, 300);
  const stroke = resolveColor(obj.stroke || obj.color || 'white');
  const mid = `arrow-${obj.id || index}`;

  return (
    <motion.g data-id={obj.id}
      initial={{ opacity: 0 }}
      animate={visible ? { opacity: 1 } : { opacity: 0 }}
      transition={{ duration: 0.5, delay }}
    >
      <defs>
        <marker id={mid} viewBox="0 0 10 10" refX="9" refY="5"
          markerWidth="7" markerHeight="7" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={stroke} />
        </marker>
      </defs>
      <motion.line x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={stroke}
        strokeWidth={highlighted ? 3 : safeNum(obj.thickness ?? obj.strokeWidth, 2)}
        strokeDasharray={obj.dashed ? '8,5' : 'none'}
        markerEnd={`url(#${mid})`}
        initial={{ pathLength: 0 }}
        animate={visible ? { pathLength: 1 } : { pathLength: 0 }}
        transition={{ duration: 0.65, delay, ease: 'easeOut' }}
      />
      {obj.label && (
        <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 12}
          textAnchor="middle" fill="#94a3b8"
          fontSize={11} fontWeight="500"
          fontFamily="system-ui, sans-serif" pointerEvents="none"
        >{obj.label}</text>
      )}
    </motion.g>
  );
};

const RenderLine = ({ obj, visible, delay }) => (
  <motion.line data-id={obj.id}
    x1={safeNum(obj.x1, 100)} y1={safeNum(obj.y1, 300)}
    x2={safeNum(obj.x2, 700)} y2={safeNum(obj.y2, 300)}
    stroke={resolveColor(obj.stroke || obj.color, '#64748b')}
    strokeWidth={safeNum(obj.strokeWidth, 1.5)}
    strokeDasharray={obj.dashed ? '8,5' : 'none'}
    initial={{ pathLength: 0, opacity: 0 }}
    animate={visible ? { pathLength: 1, opacity: 0.5 } : { pathLength: 0, opacity: 0 }}
    transition={{ duration: 0.9, delay, ease: 'easeOut' }}
  />
);

const RenderText = ({ obj, visible, highlighted, delay }) => {
  const x = safeNum(obj.x, 400);
  const y = safeNum(obj.y, 300);
  const sz = safeNum(obj.fontSize, 16);
  const fill = resolveColor(obj.fill || obj.color, '#f8fafc');
  const maxChars = Math.floor(680 / (sz * 0.6));

  return (
    <motion.g data-id={obj.id}
      initial={{ opacity: 0, y: y + 10 }}
      animate={visible ? { opacity: highlighted ? 1 : 0.88, y } : { opacity: 0, y: y + 10 }}
      transition={{ duration: 0.45, delay }}
    >
      <MultilineText x={x} y={y} text={obj.text || obj.label || ''}
        fontSize={sz} fill={fill}
        fontWeight={obj.fontWeight || (sz >= 18 ? 'bold' : '500')}
        anchor={obj.anchor || obj.align || 'middle'}
        maxChars={maxChars}
      />
    </motion.g>
  );
};

const RenderBadge = ({ obj, visible, highlighted, delay }) => {
  const x = safeNum(obj.x, 400), y = safeNum(obj.y, 300);
  const text = obj.text || obj.label || '';
  const bg = resolveColor(obj.bgColor || obj.color, '#a855f7');
  const tc = resolveColor(obj.textColor, '#f8fafc');
  const estW = Math.max(60, text.length * 7.5 + 28);

  return (
    <motion.g data-id={obj.id}
      initial={{ opacity: 0, scale: 0.75 }}
      animate={visible ? { opacity: 1, scale: highlighted ? 1.08 : 1 } : { opacity: 0, scale: 0.75 }}
      transition={{ duration: 0.45, delay }}
      style={{ transformOrigin: `${x}px ${y}px` }}
    >
      <rect x={x - estW / 2} y={y - 13} width={estW} height={26} rx={13}
        fill={bg} fillOpacity={0.22}
        stroke={bg} strokeWidth={1.5} strokeOpacity={0.5}
      />
      <text x={x} y={y + 4.5}
        textAnchor="middle" fill={tc}
        fontSize={11} fontWeight="bold"
        fontFamily="system-ui, sans-serif" pointerEvents="none"
      >{text}</text>
    </motion.g>
  );
};

const RenderOrbit = ({ obj, visible, delay, index }) => {
  const cx = safeNum(obj.cx ?? obj.x, 400), cy = safeNum(obj.cy ?? obj.y, 300);
  const or = safeNum(obj.orbitRadius, 90), br = safeNum(obj.r, 10);
  const fill = resolveColor(obj.fill || obj.color, '#3b82f6');
  const speed = safeNum(obj.speed, 8);
  const pid = `orbit-${obj.id || index}`;

  return (
    <motion.g data-id={obj.id}
      initial={{ opacity: 0 }} animate={visible ? { opacity: 1 } : { opacity: 0 }}
      transition={{ duration: 0.5, delay }}
    >
      <circle cx={cx} cy={cy} r={or} fill="none" stroke="#334155" strokeWidth={1} strokeDasharray="4,6" opacity={0.3} />
      <defs>
        <path id={pid} d={`M ${cx - or},${cy} a ${or},${or} 0 1,1 ${or * 2},0 a ${or},${or} 0 1,1 -${or * 2},0`} />
      </defs>
      <circle r={br} fill={fill}>
        <animateMotion dur={`${speed}s`} repeatCount="indefinite"><mpath xlinkHref={`#${pid}`} /></animateMotion>
      </circle>
    </motion.g>
  );
};

const RenderArc = ({ obj, visible, delay }) => {
  const cx = safeNum(obj.cx ?? obj.x, 400), cy = safeNum(obj.cy ?? obj.y, 300);
  const r = safeNum(obj.r, 60);
  const sa = safeNum(obj.startAngle, 0) * Math.PI / 180;
  const ea = safeNum(obj.endAngle, 180) * Math.PI / 180;
  const x1 = cx + r * Math.cos(sa), y1 = cy - r * Math.sin(sa);
  const x2 = cx + r * Math.cos(ea), y2 = cy - r * Math.sin(ea);
  const lg = Math.abs(safeNum(obj.endAngle, 180) - safeNum(obj.startAngle, 0)) > 180 ? 1 : 0;
  const stroke = resolveColor(obj.stroke || obj.color, '#eab308');

  return (
    <motion.path data-id={obj.id}
      d={`M ${x1} ${y1} A ${r} ${r} 0 ${lg} 0 ${x2} ${y2}`}
      fill="none" stroke={stroke} strokeWidth={safeNum(obj.strokeWidth, 2)} strokeLinecap="round"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={visible ? { pathLength: 1, opacity: 0.8 } : { pathLength: 0, opacity: 0 }}
      transition={{ duration: 0.9, delay, ease: 'easeOut' }}
    />
  );
};

const RenderPath = ({ obj, visible, highlighted, delay }) => {
  const fill = obj.fill ? resolveColor(obj.fill) : 'none';
  const stroke = resolveColor(obj.stroke || obj.color, '#06b6d4');

  return (
    <motion.path data-id={obj.id}
      d={obj.d || ''}
      fill={fill} fillOpacity={fill !== 'none' ? safeNum(obj.fillOpacity, 0.14) : 0}
      stroke={stroke} strokeWidth={safeNum(obj.strokeWidth, 2)}
      strokeLinecap="round" strokeLinejoin="round"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={visible ? { pathLength: 1, opacity: highlighted ? 1 : 0.8 } : { pathLength: 0, opacity: 0 }}
      transition={{ duration: 1.1, delay, ease: 'easeOut' }}
    />
  );
};

/**
 * doubt_note — a pinned doubt explanation on the canvas
 * { id, shape:"doubt_note", x, y, text, question, color, appearsAtStep }
 */
const RenderDoubtNote = ({ obj, visible, delay }) => {
  const x = safeNum(obj.x, 400);
  const y = safeNum(obj.y, 300);
  const color = resolveColor(obj.color, '#fbbf24');
  const { unpinDoubtFromCanvas } = useTutorStore();

  return (
    <motion.g
      data-id={obj.id}
      initial={{ opacity: 0, scale: 0.8, rotate: -2 }}
      animate={visible ? { opacity: 1, scale: 1, rotate: 0 } : { opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      style={{ transformOrigin: `${x}px ${y}px` }}
    >
      <rect
        x={x - 100} y={y - 60} width={200} height={120} rx={8}
        fill="#1e293b" fillOpacity={0.9}
        stroke={color} strokeWidth={1.5}
        className="pointer-events-auto shadow-2xl"
      />
      <rect x={x - 100} y={y - 60} width={200} height={28} rx={8} fill={color} fillOpacity={0.2} />
      <text x={x - 85} y={y - 42} fill={color} fontSize={9} fontWeight="bold" style={{ letterSpacing: '0.1em' }} className="uppercase">Pinned Doubt</text>
      
      <motion.g 
        whileHover={{ scale: 1.2 }}
        className="cursor-pointer pointer-events-auto" 
        onClick={(e) => { e.stopPropagation(); unpinDoubtFromCanvas(obj.id); }}
      >
        <circle cx={x + 85} cy={y - 46} r={8} fill="rgba(255,255,255,0.05)" />
        <text x={x + 85} y={y - 43} textAnchor="middle" fill="#ef4444" fontSize={11} fontWeight="bold">×</text>
      </motion.g>

      <text x={x - 85} y={y - 15} fill={color} fontSize={8} fontWeight="bold" opacity={0.5}>Q: {obj.question?.substring(0, 35)}{obj.question?.length > 35 ? '...' : ''}</text>
      
      <MultilineText 
        x={x - 85} y={y + 15} 
        text={obj.text} 
        fontSize={10} 
        fill="#f1f5f9" 
        anchor="start" 
        maxChars={32} 
      />
    </motion.g>
  );
};

// ─── Shape Router ───
const RenderObject = ({ obj, visible, highlighted, delay, index, objects }) => {
  if (!obj) return null;
  const shape = (obj.shape || obj.type || 'circle').toLowerCase();
  const props = { obj, visible, highlighted, delay, index, objects };

  switch (shape) {
    // Algorithm shapes
    case 'array': return <RenderArray       {...props} />;
    case 'pointer': return <RenderPointer     {...props} />;
    case 'swapbridge': return <RenderSwapBridge  {...props} />;
    case 'comparator': return <RenderComparator  {...props} />;
    case 'codeline': return <RenderCodeLine    {...props} />;
    case 'highlightbox': return <RenderHighlightBox {...props} />;
    // Standard shapes
    case 'circle': return <RenderCircle  {...props} />;
    case 'rect': case 'rectangle': case 'box': return <RenderRect {...props} />;
    case 'arrow': return <RenderArrow   {...props} />;
    case 'line': return <RenderLine    {...props} />;
    case 'text': case 'label': case 'formula': return <RenderText {...props} />;
    case 'badge': case 'tag': return <RenderBadge  {...props} />;
    case 'orbit': case 'planet': return <RenderOrbit {...props} />;
    case 'arc': return <RenderArc    {...props} />;
    case 'path': case 'polyline': return <RenderPath {...props} />;
    case 'doubt_note': return <RenderDoubtNote {...props} />;
    default: return <RenderCircle  {...props} />;
  }
};

// ─── Main CanvasRenderer ───
const CanvasRenderer = ({
  objects = [],
  currentStepIndex = 0,
  steps = [],
  highlightIds = [],
}) => {
  const safeObjects = Array.isArray(objects) ? objects : [];
  const currentStep = steps[currentStepIndex];

  // Visible IDs — treat empty array same as missing
  const visibleObjectIds = useMemo(() => {
    if (currentStep?.objectIds?.length > 0) {
      return new Set(currentStep.objectIds);
    }
    return new Set(
      safeObjects
        .filter(o => safeNum(o.appearsAtStep, 0) <= currentStepIndex)
        .map(o => o.id)
    );
  }, [currentStep, safeObjects, currentStepIndex]);

  // Highlighted IDs
  const highlightedIds = useMemo(() => {
    const ids = new Set(Array.isArray(highlightIds) ? highlightIds : []);
    currentStep?.highlightIds?.forEach(id => ids.add(id));
    return ids;
  }, [currentStep, highlightIds]);

  // Step-local delays: new objects stagger, old objects = 0 delay
  const delays = useMemo(() => {
    const map = {};
    const newIds = new Set(currentStep?.newIds || []);
    let counter = 0;
    safeObjects.forEach(obj => {
      if (visibleObjectIds.has(obj.id) && newIds.has(obj.id)) {
        map[obj.id] = Math.min(counter++ * 0.07, 0.45);
      }
    });
    safeObjects.forEach(obj => {
      if (visibleObjectIds.has(obj.id) && !newIds.has(obj.id)) {
        map[obj.id] = 0;
      }
    });
    return map;
  }, [safeObjects, visibleObjectIds, currentStep]);

  if (safeObjects.length === 0) return null;

  return (
    <svg
      viewBox="0 0 800 600"
      width="800"
      height="600"
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <AnimatePresence>
        {safeObjects.map((obj, i) => {
          if (!obj?.id) return null;
          return (
            <RenderObject
              key={obj.id}
              obj={obj}
              index={i}
              objects={safeObjects}
              visible={visibleObjectIds.has(obj.id)}
              highlighted={highlightedIds.has(obj.id)}
              delay={delays[obj.id] ?? 0}
            />
          );
        })}
      </AnimatePresence>
    </svg>
  );
};

export default CanvasRenderer;