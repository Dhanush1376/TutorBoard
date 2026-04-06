import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * CanvasRenderer v5.0 — Cinematic Interactive Visualization Engine
 * 
 * Features:
 * - Orb Physics: Orbital rotation and levitation.
 * - Flow Connectivity: "Marching ants" logic flow for Neural Networks.
 * - Global Aesthetics: Neon glows, deep radial gradients, glassmorphism.
 */

// ─── Palette (Cinematic Neon Theme) ─────────────────────────────────────────────
const PALETTE = {
  blue:    { stroke: '#38bdf8', fill: '#0ea5e9', light: '#e0f2fe', text: '#bae6fd' },
  red:     { stroke: '#f87171', fill: '#dc2626', light: '#fee2e2', text: '#fca5a5' },
  green:   { stroke: '#4ade80', fill: '#16a34a', light: '#dcfce7', text: '#86efac' },
  yellow:  { stroke: '#facc15', fill: '#ca8a04', light: '#fef08a', text: '#fde047' },
  orange:  { stroke: '#fb923c', fill: '#ea580c', light: '#ffedd5', text: '#fdba74' },
  purple:  { stroke: '#c084fc', fill: '#9333ea', light: '#f3e8ff', text: '#d8b4fe' },
  cyan:    { stroke: '#22d3ee', fill: '#0891b2', light: '#cffafe', text: '#67e8f9' },
  teal:    { stroke: '#2dd4bf', fill: '#0d9488', light: '#ccfbf1', text: '#5eead4' },
  gray:    { stroke: '#94a3b8', fill: '#475569', light: '#f1f5f9', text: '#cbd5e1' },
  white:   { stroke: '#f8fafc', fill: '#94a3b8', light: '#ffffff', text: '#f8fafc' },
};

const resolveColor = (c, fallback = 'blue') => {
  if (!c) return PALETTE[fallback] || PALETTE.blue;
  const s = String(c).trim().toLowerCase();
  if (PALETTE[s]) return PALETTE[s];
  if (s.startsWith('#') || s.startsWith('rgb')) return { stroke: s, fill: s, light: s, text: '#fff' };
  return PALETTE[fallback] || PALETTE.blue;
};

const getColorKey = (c, fallback = 'blue') => {
  if (!c) return fallback;
  const s = String(c).trim().toLowerCase();
  return PALETTE[s] ? s : fallback;
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

const MultilineText = ({ x, y, text, fontSize = 13, fill = '#fff', fontWeight = '600', anchor = 'middle', maxChars = 22, dropShadow }) => {
  const lines = wrapText(text, maxChars);
  const lh = fontSize * 1.35;
  const startY = y - ((lines.length - 1) * lh) / 2;
  return (
    <>
      {lines.map((line, i) => (
        <text 
          key={i} x={x} y={startY + (i * lh)} textAnchor={anchor} fill={fill} 
          fontSize={fontSize} fontWeight={fontWeight} fontFamily="system-ui" 
          dominantBaseline="central" pointerEvents="none" filter={dropShadow ? "url(#drop-shadow)" : "none"}
        >
          {line}
        </text>
      ))}
    </>
  );
};

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

// ─── Cinematic Objects ────────────────────────────────────────────────────────
// 1. Orb / Planet / Node (Replaces Circle)
const RenderOrb = ({ obj, visible, delay }) => {
  const x = safeNum(obj.x || obj.cx, 400);
  const y = safeNum(obj.y || obj.cy, 300);
  const r = safeNum(obj.r || obj.size, 40);
  
  const isOrbiting = obj.orbit && typeof obj.orbit === 'object';
  const orbitCx = isOrbiting ? safeNum(obj.orbit.cx, 400) : x;
  const orbitCy = isOrbiting ? safeNum(obj.orbit.cy, 300) : y;
  const orbitRadius = isOrbiting ? safeNum(obj.orbit.radius, 100) : 0;
  const orbitSpeed = isOrbiting ? safeNum(obj.orbit.speed, 20) : 20;
  
  const isFloating = obj.float === true || String(obj.float) === 'true';
  const floatAnim = isFloating ? { y: [0, -8, 0], transition: { duration: 4, repeat: Infinity, ease: "easeInOut" } } : {};

  const colKey = getColorKey(obj.color || obj.fill);
  const c = resolveColor(colKey);

  return (
    <motion.g 
      initial={{ scale: 0, opacity: 0 }} 
      animate={visible ? { scale: 1, opacity: 1, ...floatAnim } : { opacity: 0, scale: 0 }} 
      transition={{ delay, type: 'spring', damping: 15 }}
    >
      {isOrbiting ? (
        <motion.g
          animate={{ rotate: 360 }}
          transition={{ duration: orbitSpeed, repeat: Infinity, ease: 'linear' }}
          style={{ originX: `${orbitCx}px`, originY: `${orbitCy}px` }}
        >
          {/* Orbit Track Indicator */}
          <circle cx={orbitCx} cy={orbitCy} r={orbitRadius} fill="none" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 6" />
          
          {/* The Orb */}
          <g transform={`translate(${orbitCx + orbitRadius}, ${orbitCy})`}>
            {/* The actual sphere with multi-gradient and bloom */}
            <circle cx="0" cy="0" r={r} fill={`url(#grad-${colKey})`} filter="url(#neon-glow)" stroke={c.stroke} strokeWidth={1} strokeOpacity={0.5} />
            <circle cx="0" cy="0" r={r} fill="url(#orb-inner-shadow)" pointerEvents="none" />
            
            {obj.innerLabel && <text x="0" y="0" textAnchor="middle" dominantBaseline="central" fill="#ffffff" fontSize={Math.max(12, r*0.45)} fontWeight="800" filter="url(#drop-shadow)">{obj.innerLabel}</text>}
            {obj.label && (
              <motion.g animate={{ rotate: -360 }} transition={{ duration: orbitSpeed, repeat: Infinity, ease: 'linear' }}>
                <MultilineText x="0" y={r+22} text={obj.label} fontSize={12} fill="#cbd5e1" dropShadow />
              </motion.g>
            )}
          </g>
        </motion.g>
      ) : (
        <g transform={`translate(${x}, ${y})`}>
          {/* Static Glowing Sphere */}
          <circle cx="0" cy="0" r={r} fill={`url(#grad-${colKey})`} filter="url(#neon-glow)" stroke={c.stroke} strokeWidth={1.5} strokeOpacity={0.8} />
          <circle cx="0" cy="0" r={r} fill="url(#orb-inner-shadow)" pointerEvents="none" />
          
          {obj.innerLabel && <text x="0" y="0" textAnchor="middle" dominantBaseline="central" fill="#ffffff" fontSize={Math.max(12, r*0.45)} fontWeight="800" filter="url(#drop-shadow)">{obj.innerLabel}</text>}
          {obj.label && <MultilineText x="0" y={r+22} text={obj.label} fontSize={12} fill="#cbd5e1" dropShadow />}
        </g>
      )}
    </motion.g>
  );
};

// 2. Connector / Flowing Arrow (Replaces Arrow)
const RenderConnector = ({ obj, visible, delay, id }) => {
  const x1 = safeNum(obj.x1, 100), y1 = safeNum(obj.y1, 100), x2 = safeNum(obj.x2, 200), y2 = safeNum(obj.y2, 100);
  const c = resolveColor(obj.color || obj.stroke).stroke, mid = `arr-${id}`;
  
  // flow system: 'pulse', true, etc.
  const hasFlow = obj.flow;
  const speed = obj.flow?.speed || 1;
  const flowAnim = hasFlow ? { strokeDashoffset: [24, 0] } : {};
  const flowTrans = hasFlow ? { duration: 0.6 / speed, repeat: Infinity, ease: 'linear' } : {};

  return (
    <motion.g initial={{ opacity: 0 }} animate={visible ? { opacity: 1 } : { opacity: 0 }} transition={{ delay }}>
      <defs><marker id={mid} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill={c}/></marker></defs>
      
      {/* Background track line */}
      <motion.line x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeOpacity="0.15" strokeWidth={safeNum(obj.thickness, 2.5)} markerEnd={`url(#${mid})`} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7 }} />
      
      {/* Marching ants / Active Flow effect */}
      {hasFlow && (
        <motion.line 
          x1={x1} y1={y1} x2={x2} y2={y2} 
          stroke={c} strokeWidth={safeNum(obj.thickness, 2.5)} 
          strokeDasharray="6 12" filter="url(#neon-glow)" 
          animate={flowAnim} transition={flowTrans} 
        />
      )}
      
      {obj.label && <text x={(x1+x2)/2} y={(y1+y2)/2 - 14} textAnchor="middle" fill="#cbd5e1" fontSize={11} fontWeight="800" filter="url(#drop-shadow)">{obj.label}</text>}
    </motion.g>
  );
};

// 3. ArrayViewer (Glassmorphic)
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
    if (sIdx.has(i)) return { bg: 'rgba(239,68,68,0.2)', border: '#f87171', val: '#fca5a5' };
    if (cIdx.has(i)) return { bg: 'rgba(249,115,22,0.2)', border: '#fb923c', val: '#fdba74' };
    if (hIdx.has(i)) return { bg: 'rgba(56,189,248,0.2)', border: '#38bdf8', val: '#bae6fd' };
    if (okIdx.has(i)) return { bg: 'rgba(74,222,128,0.2)', border: '#4ade80', val: '#bbf7d0' };
    return { bg: 'rgba(51,65,85,0.4)', border: '#64748b', val: '#f8fafc' };
  };

  return (
    <motion.g initial={{ opacity: 0 }} animate={visible ? { opacity: 1 } : { opacity: 0 }} transition={{ delay }}>
      {obj.label && <text x={sx + totalW / 2} y={sy - 24} textAnchor="middle" fill="#94a3b8" fontSize={14} fontWeight="800" filter="url(#drop-shadow)">{obj.label}</text>}
      {values.map((val, i) => {
        const x = sx + (i * cw), pal = getPal(i), isS = sIdx.has(i);
        return (
          <motion.g key={i} animate={isS ? { y: [0, -25, 0], scale: [1, 1.1, 1] } : {}} transition={{ duration: 0.6, type: 'spring' }}>
            <rect x={x} y={sy} width={cw} height={ch} rx={10} fill={pal.bg} stroke={pal.border} strokeWidth={2} filter={isS || hIdx.has(i) ? "url(#neon-glow)" : "none"} />
            <text x={x + cw / 2} y={sy + ch / 2} textAnchor="middle" dominantBaseline="central" fill={pal.val} fontSize={safeNum(obj.fontSize, 18)} fontWeight="800" fontFamily="monospace">{val}</text>
            {obj.showIndex !== false && <text x={x + cw / 2} y={sy + ch + 20} textAnchor="middle" fill="#64748b" fontSize={11} fontWeight="800">[{i}]</text>}
          </motion.g>
        );
      })}
    </motion.g>
  );
};

// 4. Pointer
const RenderPointer = ({ obj, visible, delay }) => {
  const cw = safeNum(obj.cellW, 60), tw = safeNum(obj.arrayW, 300);
  const cx = (safeNum(obj.arrayX, 400) - tw / 2) + (safeNum(obj.cellIndex, 0) * cw) + cw / 2;
  const ay = safeNum(obj.arrayY, 300), ah = safeNum(obj.cellH, 56);
  const side = obj.side || 'bottom', color = resolveColor(obj.color, 'yellow').stroke;
  const tipY = side === 'top' ? (ay - ah / 2 - 8) : (ay + ah / 2 + 8), by = side === 'top' ? (tipY - 30) : (tipY + 30);

  return (
    <motion.g initial={{ opacity: 0, scale: 0, y: side === 'bottom' ? 20 : -20 }} animate={visible ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0 }} transition={{ delay, type: 'spring', damping: 20 }}>
      {/* Glow applied to marker */}
      <line x1={cx} y1={by} x2={cx} y2={tipY} stroke={color} strokeWidth={3} strokeLinecap="round" filter="url(#neon-glow)" />
      <polygon points={side==='bottom' ? `${cx},${tipY+8} ${cx-7},${tipY} ${cx+7},${tipY}` : `${cx},${tipY-8} ${cx-7},${tipY} ${cx+7},${tipY}`} fill={color} filter="url(#neon-glow)" />
      <rect x={cx-14} y={by + (side==='bottom' ? 0 : -20)} width={28} height={20} rx={10} fill={color} filter="url(#drop-shadow)" />
      <text x={cx} y={by + (side==='bottom' ? 10 : -10)} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={11} fontWeight="900" filter="url(#drop-shadow)">{obj.label || 'i'}</text>
    </motion.g>
  );
};

// 5. Comparator
const RenderComparator = ({ obj, visible, delay }) => {
  const x = safeNum(obj.x, 400), y = safeNum(obj.y, 200), isT = String(obj.result).toLowerCase()==='true';
  const c = resolveColor(isT ? 'green' : 'red');
  return (
    <motion.g initial={{ scale: 0.8, opacity: 0 }} animate={visible ? { scale: 1, opacity: 1 } : { opacity: 0 }} transition={{ delay, type: 'spring' }}>
      <rect x={x-90} y={y-24} width={180} height={48} rx={24} fill={isT ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.1)'} stroke={c.stroke} strokeWidth={2} filter="url(#neon-glow)" />
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill={c.text} fontSize={20} fontWeight="800" fontFamily="monospace" filter="url(#drop-shadow)">
        {obj.leftVal} {obj.operator || '>'} {obj.rightVal}
      </text>
    </motion.g>
  );
};

const RenderSvg = ({ obj, visible, delay }) => {
  const cx = safeNum(obj.x, 400), cy = safeNum(obj.y, 300);
  const w = safeNum(obj.w, 200), h = safeNum(obj.h, 200);
  const sx = cx - w / 2, sy = cy - h / 2;
  const isFloating = obj.float === true || String(obj.float) === 'true';
  const floatAnim = isFloating ? { y: [0, -8, 0], transition: { duration: 4, repeat: Infinity, ease: "easeInOut" } } : {};
  
  return (
    <motion.g 
      initial={{ opacity: 0, scale: 0.8 }} 
      animate={visible ? { opacity: 1, scale: 1, ...floatAnim } : { opacity: 0 }} 
      transition={{ delay, type: 'spring', damping: 20 }}
    >
      <svg x={sx} y={sy} width={w} height={h} viewBox={`0 0 ${w} ${h}`} overflow="visible">
         <g dangerouslySetInnerHTML={{ __html: obj.rawSvg || '' }} />
      </svg>
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
  const s = (obj.shape || obj.type || 'orb').toLowerCase();
  const props = { obj, visible, delay, index };

  const wrap = (el) => (
    <DraggableSVG key={obj.id || index} id={obj.id || index}>
      {el}
    </DraggableSVG>
  );

  switch (s) {
    case 'svg':          return wrap(<RenderSvg {...props} />);
    case 'array':
    case 'arraycell':    return wrap(<RenderArray {...props} />);
    case 'pointer':      return wrap(<RenderPointer {...props} />);
    case 'comparator':   return wrap(<RenderComparator {...props} />);
    case 'circle':   
    case 'orb':          
    case 'node':         return wrap(<RenderOrb {...props} />);
    case 'arrow':        
    case 'connector':    return wrap(<RenderConnector {...props} id={obj.id || index} />);
    case 'text':
    case 'label':
      return wrap(
        <motion.g initial={{ opacity: 0 }} animate={visible ? { opacity: 1 } : { opacity: 0 }} transition={{ delay }}>
          <MultilineText x={safeNum(obj.x, 400)} y={safeNum(obj.y, 300)} text={obj.text || obj.label} fill={resolveColor(obj.color).text} fontSize={safeNum(obj.fontSize, 16)} fontWeight="700" dropShadow />
        </motion.g>
      );
    case 'rect':
    case 'box':
      const isFloating = obj.float === true || String(obj.float) === 'true';
      const floatAnim = isFloating ? { y: [0, -8, 0], transition: { duration: 4, repeat: Infinity, ease: "easeInOut" } } : {};
      return wrap(
        <motion.g initial={{ opacity: 0 }} animate={visible ? { opacity: 1, ...floatAnim } : { opacity: 0 }} transition={{ delay }}>
          <rect x={safeNum(obj.x, 400) - safeNum(obj.w, 100) / 2} y={safeNum(obj.y, 300) - safeNum(obj.h, 50) / 2} width={safeNum(obj.w, 100)} height={safeNum(obj.h, 50)} rx={12} fill="rgba(51,65,85,0.4)" stroke={resolveColor(obj.color).stroke} strokeWidth={2} filter="url(#drop-shadow)" />
          {obj.label && <text x={safeNum(obj.x, 400)} y={safeNum(obj.y, 300) + safeNum(obj.h, 50) / 2 + 18} textAnchor="middle" fill="#94a3b8" fontSize={11} fontWeight="bold">{obj.label}</text>}
        </motion.g>
      );
    case 'line':
      return wrap(
        <motion.line x1={safeNum(obj.x1, 0)} y1={safeNum(obj.y1, 0)} x2={safeNum(obj.x2, 100)} y2={safeNum(obj.y2, 100)} stroke={resolveColor(obj.color).stroke} strokeWidth={2} initial={{ pathLength: 0 }} animate={visible ? { pathLength: 1, opacity: 0.6 } : { opacity: 0 }} transition={{ delay }} />
      );
    case 'path':
      return wrap(
        <motion.path d={obj.d} fill="none" stroke={resolveColor(obj.color).stroke} strokeWidth={2} initial={{ pathLength: 0 }} animate={visible ? { pathLength: 1 } : { opacity: 0 }} transition={{ delay }} filter="url(#neon-glow)" />
      );
    case 'badge':
      return wrap(
        <motion.g initial={{ scale: 0.8, opacity: 0 }} animate={visible ? { scale: 1, opacity: 1 } : { opacity: 0 }} transition={{ delay }}>
          <rect x={safeNum(obj.x, 400) - 40} y={safeNum(obj.y, 300) - 12} width={80} height={24} rx={12} fill={obj.bgColor || '#1e293b'} stroke={obj.textColor || '#fff'} strokeWidth={1} filter="url(#drop-shadow)" />
          <text x={safeNum(obj.x, 400)} y={safeNum(obj.y, 300)} textAnchor="middle" dominantBaseline="central" fill={obj.textColor || '#fff'} fontSize={10} fontWeight="900" filter="url(#drop-shadow)">{obj.text || 'INFO'}</text>
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
        <defs>
          {/* Intense Neon Glow */}
          <filter id="neon-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          
          {/* Drop Shadow for text and deep objects */}
          <filter id="drop-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.7"/>
          </filter>

          {/* Inner spherical shadow to make orbs look 3D */}
          <radialGradient id="orb-inner-shadow" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.2" />
            <stop offset="70%" stopColor="#000000" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.8" />
          </radialGradient>

          {/* Radial Gradients for PALETTE */}
          {Object.keys(PALETTE).map(color => (
            <radialGradient id={`grad-${color}`} cx="30%" cy="30%" r="80%" key={color}>
              <stop offset="0%" stopColor={PALETTE[color].light} stopOpacity="0.9" />
              <stop offset="60%" stopColor={PALETTE[color].fill} stopOpacity="1" />
              <stop offset="100%" stopColor="#0a0a0a" stopOpacity="0.95" />
            </radialGradient>
          ))}
        </defs>

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