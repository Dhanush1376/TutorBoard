/**
 * CanvasRenderer — SVG shape renderer for the infinite canvas
 * 
 * Renders all scene objects (circles, rects, arrows, text, orbits, arcs)
 * with step-based visibility and framer-motion entrance animations.
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Color Palette ───
const PALETTE = {
  blue: '#3b82f6', red: '#ef4444', green: '#22c55e', yellow: '#eab308',
  orange: '#f97316', purple: '#a855f7', pink: '#ec4899', cyan: '#06b6d4',
  white: '#f8fafc', gray: '#94a3b8', gold: '#fbbf24', teal: '#14b8a6',
};

const resolveColor = (c) => {
  if (!c) return PALETTE.blue;
  const s = String(c);
  if (s.startsWith('#') || s.startsWith('rgb')) return s;
  return PALETTE[s.toLowerCase()] || s;
};

// ─── Helper: Safe Number ───
const safeNum = (val, fallback = 0) => {
  const n = Number(val);
  return isNaN(n) ? fallback : n;
};

// ─── Shape Components ───

const RenderCircle = ({ obj, visible, highlighted, delay }) => {
  const cx = safeNum(obj.x, 400);
  const cy = safeNum(obj.y, 300);
  const r = safeNum(obj.r ?? obj.size, 40);
  
  const fill = resolveColor(obj.fill || obj.color);
  const stroke = resolveColor(obj.stroke || obj.color);
  const fillOpacity = safeNum(obj.fillOpacity, 0.2);

  return (
    <motion.g
      data-id={obj.id}
      initial={{ opacity: 0, scale: 0 }}
      animate={visible ? { opacity: 1, scale: highlighted ? 1.12 : 1 } : { opacity: 0, scale: 0 }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
      style={{ originX: `${cx}px`, originY: `${cy}px` }}
    >
      {/* Glow Layer */}
      {(obj.glow || highlighted) && (
        <motion.circle
          cx={cx} cy={cy}
          r={r + 15}
          fill={fill}
          initial={{ opacity: 0 }}
          animate={visible ? { 
            opacity: [0.08, 0.18, 0.08], 
            r: [r + 10, r + 25, r + 10] 
          } : { opacity: 0, r: r + 15 }}
          transition={{ duration: 2.5, repeat: Infinity }}
        />
      )}
      {/* Main Circle */}
      <motion.circle
        cx={cx} cy={cy}
        r={r}
        fill={fill}
        fillOpacity={fillOpacity}
        stroke={stroke}
        strokeWidth={highlighted ? 3.5 : 2}
        animate={obj.pulse && visible ? { r: [r, r + 4, r] } : { r: r }}
        transition={obj.pulse ? { duration: 1.8, repeat: Infinity } : { duration: 0.3 }}
      />
      {obj.innerLabel && (
        <text 
          x={cx} y={cy + 5} 
          textAnchor="middle" 
          fill="#f8fafc" 
          fontSize={safeNum(obj.innerFontSize, 15)} 
          fontWeight="bold" 
          fontFamily="system-ui, sans-serif"
          pointerEvents="none"
        >
          {obj.innerLabel}
        </text>
      )}
      {obj.label && (
        <text 
          x={cx} y={cy + r + 20} 
          textAnchor="middle" 
          fill="#cbd5e1" 
          fontSize={safeNum(obj.fontSize, 13)} 
          fontWeight="600" 
          fontFamily="system-ui, sans-serif"
          pointerEvents="none"
        >
          {obj.label}
        </text>
      )}
    </motion.g>
  );
};

const RenderRect = ({ obj, visible, highlighted, delay }) => {
  const x = safeNum(obj.x, 350);
  const y = safeNum(obj.y, 250);
  const w = safeNum(obj.w ?? obj.width, 100);
  const h = safeNum(obj.h ?? obj.height, 60);
  const rx = safeNum(obj.rx, 10);
  const fill = resolveColor(obj.fill || obj.color);

  return (
    <motion.g
      data-id={obj.id}
      initial={{ opacity: 0, y: 20 }}
      animate={visible ? { opacity: 1, y: 0, scale: highlighted ? 1.08 : 1 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {highlighted && (
        <motion.rect
          x={x - w/2 - 4} y={y - h/2 - 4} width={w + 8} height={h + 8} rx={rx + 4}
          fill="none" stroke={fill} strokeWidth={2}
          animate={{ opacity: [0.15, 0.35, 0.15] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}
      <rect
        x={x - w/2} y={y - h/2} width={w} height={h} rx={rx}
        fill={fill} fillOpacity={safeNum(obj.fillOpacity, 0.12)}
        stroke={resolveColor(obj.stroke || obj.color)} 
        strokeWidth={highlighted ? 2.5 : 1.5}
      />
      {obj.label && (
        <text 
          x={x} y={y + 5} 
          textAnchor="middle" 
          fill="#e2e8f0" 
          fontSize={safeNum(obj.fontSize, 13)} 
          fontWeight="bold" 
          fontFamily="system-ui, sans-serif"
          pointerEvents="none"
        >
          {obj.label}
        </text>
      )}
    </motion.g>
  );
};

const RenderArrow = ({ obj, visible, highlighted, delay, index }) => {
  const x1 = safeNum(obj.x1, 200), y1 = safeNum(obj.y1, 300);
  const x2 = safeNum(obj.x2, 600), y2 = safeNum(obj.y2, 300);
  const stroke = resolveColor(obj.stroke || obj.color || 'white');
  const markerId = `arrow-${obj.id || index}`;

  return (
    <motion.g
      data-id={obj.id}
      initial={{ opacity: 0 }}
      animate={visible ? { opacity: 1 } : { opacity: 0 }}
      transition={{ duration: 0.6, delay }}
    >
      <defs>
        <marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={stroke} />
        </marker>
      </defs>
      <motion.line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={stroke} strokeWidth={highlighted ? 3 : 2}
        markerEnd={`url(#${markerId})`}
        initial={{ pathLength: 0 }}
        animate={visible ? { pathLength: 1 } : { pathLength: 0 }}
        transition={{ duration: 0.8, delay }}
      />
      {obj.label && (
        <text 
          x={(x1+x2)/2} y={(y1+y2)/2 - 12} 
          textAnchor="middle" 
          fill="#94a3b8" 
          fontSize={11} 
          fontFamily="system-ui, sans-serif"
          pointerEvents="none"
        >
          {obj.label}
        </text>
      )}
    </motion.g>
  );
};

const RenderLine = ({ obj, visible, delay }) => {
  const x1 = safeNum(obj.x1, 200), y1 = safeNum(obj.y1, 300);
  const x2 = safeNum(obj.x2, 600), y2 = safeNum(obj.y2, 300);
  const stroke = resolveColor(obj.stroke || obj.color || 'gray');

  return (
    <motion.line
      data-id={obj.id}
      x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={stroke} 
      strokeWidth={safeNum(obj.strokeWidth, 2)}
      strokeDasharray={obj.dashed ? '8,4' : 'none'}
      initial={{ pathLength: 0, opacity: 0 }}
      animate={visible ? { pathLength: 1, opacity: 0.6 } : { pathLength: 0, opacity: 0 }}
      transition={{ duration: 1, delay }}
    />
  );
};

const RenderText = ({ obj, visible, highlighted, delay }) => {
  const x = safeNum(obj.x, 400);
  const y = safeNum(obj.y, 300);
  const fill = resolveColor(obj.fill || obj.color || 'white');

  return (
    <motion.text
      data-id={obj.id}
      x={x} y={y}
      textAnchor={obj.anchor || 'middle'}
      fill={fill}
      fontSize={safeNum(obj.fontSize, 22)}
      fontWeight={obj.fontWeight || 'bold'}
      fontFamily={obj.fontFamily || 'system-ui, sans-serif'}
      initial={{ opacity: 0, y: y + 12 }}
      animate={visible ? { opacity: highlighted ? 1 : 0.9, y, scale: highlighted ? 1.1 : 1 } : { opacity: 0, y: y + 12 }}
      transition={{ duration: 0.5, delay }}
      pointerEvents="none"
    >
      {obj.text || obj.label || ''}
    </motion.text>
  );
};

const RenderOrbit = ({ obj, visible, delay, index }) => {
  const cx = safeNum(obj.cx, 400), cy = safeNum(obj.cy, 300);
  const orbitR = safeNum(obj.orbitRadius, 100);
  const objR = safeNum(obj.r, 10);
  const fill = resolveColor(obj.fill || obj.color || 'blue');
  const speed = safeNum(obj.speed, 8);
  const pathId = `orbit-path-${obj.id || index}`;

  return (
    <motion.g
      data-id={obj.id}
      initial={{ opacity: 0 }}
      animate={visible ? { opacity: 1 } : { opacity: 0 }}
      transition={{ duration: 0.5, delay }}
    >
      <circle cx={cx} cy={cy} r={orbitR} fill="none" stroke="#475569" strokeWidth={1} strokeDasharray="4,6" opacity={0.3} />
      <defs>
        <path id={pathId} d={`M ${cx - orbitR},${cy} a ${orbitR},${orbitR} 0 1,1 ${orbitR * 2},0 a ${orbitR},${orbitR} 0 1,1 -${orbitR * 2},0`} />
      </defs>
      <circle r={objR} fill={fill}>
        <animateMotion dur={`${speed}s`} repeatCount="indefinite" rotate="auto">
          <mpath xlinkHref={`#${pathId}`} />
        </animateMotion>
      </circle>
      {obj.label && (
        <text 
          fill="#94a3b8" 
          fontSize={10} 
          fontWeight="bold" 
          fontFamily="system-ui, sans-serif"
          pointerEvents="none"
        >
          <animateMotion dur={`${speed}s`} repeatCount="indefinite">
            <mpath xlinkHref={`#${pathId}`} />
          </animateMotion>
          <tspan dy={objR + 14} textAnchor="middle">{obj.label}</tspan>
        </text>
      )}
    </motion.g>
  );
};

const RenderArc = ({ obj, visible, delay }) => {
  const cx = safeNum(obj.cx ?? obj.x, 400), cy = safeNum(obj.cy ?? obj.y, 300);
  const r = safeNum(obj.r, 30);
  const startA = safeNum(obj.startAngle, 0);
  const endA = safeNum(obj.endAngle, 90);
  const startAngle = startA * Math.PI / 180;
  const endAngle = endA * Math.PI / 180;
  const x1 = cx + r * Math.cos(startAngle), y1 = cy - r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle), y2 = cy - r * Math.sin(endAngle);
  const largeArc = Math.abs(endA - startA) > 180 ? 1 : 0;
  const stroke = resolveColor(obj.stroke || obj.color || 'yellow');

  return (
    <motion.path
      data-id={obj.id}
      d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 0 ${x2} ${y2}`}
      fill="none" stroke={stroke} strokeWidth={safeNum(obj.strokeWidth, 2)}
      initial={{ pathLength: 0, opacity: 0 }}
      animate={visible ? { opacity: 0.8, pathLength: 1 } : { opacity: 0, pathLength: 0 }}
      transition={{ duration: 0.8, delay }}
    />
  );
};

// ─── Shape Router ───
const RenderObject = ({ obj, visible, highlighted, delay, index }) => {
  if (!obj) return null;
  const shape = (obj.shape || obj.type || 'circle').toLowerCase();
  const props = { obj, visible, highlighted, delay, index };

  switch (shape) {
    case 'circle': return <RenderCircle {...props} />;
    case 'rect': case 'rectangle': case 'box': return <RenderRect {...props} />;
    case 'arrow': return <RenderArrow {...props} />;
    case 'line': return <RenderLine {...props} />;
    case 'text': case 'label': case 'formula': return <RenderText {...props} />;
    case 'orbit': case 'planet': return <RenderOrbit {...props} />;
    case 'arc': case 'angle': return <RenderArc {...props} />;
    default: return <RenderCircle {...props} />;
  }
};

// ─── Main Renderer ───
const CanvasRenderer = ({ objects = [], currentStepIndex = 0, steps = [], highlightIds = [] }) => {
  const svgRef = useRef(null);
  const safeObjects = Array.isArray(objects) ? objects : [];
  const currentStep = steps[currentStepIndex];

  // Debug logging - check for missing properties
  useEffect(() => {
    if (safeObjects.length > 0) {
      console.log(`[CanvasRenderer] Rendering ${safeObjects.length} objects for step ${currentStepIndex}`);
      safeObjects.forEach(obj => {
        if ((obj.shape === 'circle' || obj.type === 'circle') && obj.r === undefined && obj.size === undefined) {
          console.warn(`[CanvasRenderer] Circle ${obj.id} missing radius!`, obj);
        }
      });
    }
  }, [safeObjects, currentStepIndex]);

  // Determine which objects are visible and highlighted at this step
  const visibleObjectIds = useMemo(() => {
    if (currentStep?.objectIds) {
      return new Set(currentStep.objectIds);
    }
    // Fallback: show objects that have appeared by this step (legacy logic)
    return new Set(
      safeObjects
        .filter(obj => safeNum(obj.appearsAtStep, 0) <= currentStepIndex)
        .map(obj => obj.id)
    );
  }, [currentStep, safeObjects, currentStepIndex]);

  const highlightedIds = useMemo(() => {
    const ids = new Set(highlightIds || []);
    if (currentStep?.highlightIds) {
      currentStep.highlightIds.forEach(id => ids.add(id));
    }
    return ids;
  }, [currentStep, highlightIds]);

  if (safeObjects.length === 0) return null;

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 800 600"
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
      style={{ minWidth: 800, minHeight: 600 }}
    >
      {/* Background grid */}
      <defs>
        <pattern id="canvas-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(148,163,184,0.06)" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="800" height="600" fill="url(#canvas-grid)" rx="16" />

      {/* Render objects */}
      <AnimatePresence>
        {safeObjects.map((obj, i) => {
          const isVisible = visibleObjectIds.has(obj.id);
          const isHighlighted = highlightedIds.has(obj.id);
          
          return (
            <RenderObject
              key={obj.id || `obj-${i}`}
              obj={obj}
              index={i}
              visible={isVisible}
              highlighted={isHighlighted}
              delay={isVisible ? i * 0.05 : 0}
            />
          );
        })}
      </AnimatePresence>
    </svg>
  );
};

export default CanvasRenderer;
