import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * SceneRenderer — Draws actual SVG visual diagrams with animation.
 * 
 * Renders circles, rectangles, lines, arrows, text, orbits, etc.
 * Uses a viewBox coordinate system (0-800 x 0-600) so positions
 * are resolution-independent.
 * 
 * Props:
 *   objects: Array of scene objects with shape definitions
 *   steps: Array of step descriptions for playback
 *   currentStep: Currently active step index
 */

// ─── Shape Colors ───
const PALETTE = {
  blue: '#3b82f6', red: '#ef4444', green: '#22c55e', yellow: '#eab308',
  orange: '#f97316', purple: '#a855f7', pink: '#ec4899', cyan: '#06b6d4',
  white: '#f8fafc', gray: '#94a3b8', gold: '#fbbf24', teal: '#14b8a6',
};

const resolveColor = (c) => {
  if (!c) return PALETTE.blue;
  const strColor = String(c);
  if (strColor.startsWith('#') || strColor.startsWith('rgb')) return strColor;
  return PALETTE[strColor.toLowerCase()] || strColor;
};

// ─── SVG Circle ───
const SceneCircle = ({ obj, index, isActive }) => {
  const cx = obj.x ?? 400;
  const cy = obj.y ?? 300;
  const r = obj.r ?? obj.size ?? 40;
  const fill = resolveColor(obj.fill || obj.color);
  const stroke = resolveColor(obj.stroke || obj.color);
  const fillOpacity = obj.fillOpacity ?? 0.2;

  return (
    <motion.g
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, delay: index * 0.2, ease: [0.16, 1, 0.3, 1] }}
      style={{ originX: `${cx}px`, originY: `${cy}px` }}
    >
      {/* Glow effect */}
      {obj.glow && (
        <motion.circle
          cx={cx} cy={cy} r={r + 15}
          fill={fill} opacity={0.15}
          animate={{ r: [r + 10, r + 25, r + 10], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 3, repeat: Infinity }}
        />
      )}
      <motion.circle
        cx={cx} cy={cy} r={r}
        fill={fill} fillOpacity={fillOpacity}
        stroke={stroke} strokeWidth={obj.strokeWidth ?? 2.5}
        animate={obj.pulse ? { r: [r, r + 5, r] } : {}}
        transition={obj.pulse ? { duration: 2, repeat: Infinity } : {}}
      />
      {obj.label && (
        <text
          x={cx} y={cy + r + 22}
          textAnchor="middle" fill="#e2e8f0"
          fontSize={obj.fontSize || 14} fontWeight="bold"
          fontFamily="system-ui, sans-serif"
        >
          {obj.label}
        </text>
      )}
      {obj.innerLabel && (
        <text
          x={cx} y={cy + 5}
          textAnchor="middle" fill={obj.innerFill || '#f8fafc'}
          fontSize={obj.innerFontSize || 16} fontWeight="bold"
          fontFamily="system-ui, sans-serif"
        >
          {obj.innerLabel}
        </text>
      )}
    </motion.g>
  );
};

// ─── SVG Rectangle ───
const SceneRect = ({ obj, index }) => {
  const x = obj.x ?? 350;
  const y = obj.y ?? 250;
  const w = obj.w ?? obj.width ?? 100;
  const h = obj.h ?? obj.height ?? 60;
  const fill = resolveColor(obj.fill || obj.color);
  const rx = obj.rx ?? 12;

  return (
    <motion.g
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: index * 0.15 }}
    >
      <motion.rect
        x={x - w/2} y={y - h/2} width={w} height={h} rx={rx}
        fill={fill} fillOpacity={obj.fillOpacity ?? 0.15}
        stroke={resolveColor(obj.stroke || obj.color)} strokeWidth={obj.strokeWidth ?? 2}
      />
      {obj.label && (
        <text
          x={x} y={y + 5}
          textAnchor="middle" fill="#e2e8f0"
          fontSize={obj.fontSize || 14} fontWeight="bold"
          fontFamily="system-ui, sans-serif"
        >
          {obj.label}
        </text>
      )}
    </motion.g>
  );
};

// ─── SVG Line ───
const SceneLine = ({ obj, index }) => {
  const x1 = obj.x1 ?? 200;
  const y1 = obj.y1 ?? 300;
  const x2 = obj.x2 ?? 600;
  const y2 = obj.y2 ?? 300;
  const stroke = resolveColor(obj.stroke || obj.color || 'gray');

  return (
    <motion.line
      x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={stroke} strokeWidth={obj.strokeWidth ?? 2}
      strokeDasharray={obj.dashed ? "8,4" : "none"}
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: obj.opacity ?? 0.6 }}
      transition={{ duration: 1, delay: index * 0.2 }}
    />
  );
};

// ─── SVG Arrow ───
const SceneArrow = ({ obj, index }) => {
  const x1 = obj.x1 ?? 200;
  const y1 = obj.y1 ?? 300;
  const x2 = obj.x2 ?? 600;
  const y2 = obj.y2 ?? 300;
  const stroke = resolveColor(obj.stroke || obj.color || 'white');
  const markerId = `arrow-${index}`;

  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, delay: index * 0.2 }}
    >
      <defs>
        <marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={stroke} />
        </marker>
      </defs>
      <motion.line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={stroke} strokeWidth={obj.strokeWidth ?? 2}
        markerEnd={`url(#${markerId})`}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, delay: index * 0.2 }}
      />
      {obj.label && (
        <text
          x={(x1 + x2)/2} y={(y1 + y2)/2 - 10}
          textAnchor="middle" fill="#94a3b8"
          fontSize={12} fontFamily="system-ui, sans-serif"
        >
          {obj.label}
        </text>
      )}
    </motion.g>
  );
};

// ─── SVG Text ───
const SceneText = ({ obj, index }) => {
  const x = obj.x ?? 400;
  const y = obj.y ?? 300;
  const fill = resolveColor(obj.fill || obj.color || 'white');

  return (
    <motion.text
      x={x} y={y}
      textAnchor={obj.anchor || "middle"}
      fill={fill}
      fontSize={obj.fontSize || 24}
      fontWeight={obj.fontWeight || "bold"}
      fontFamily={obj.fontFamily || "system-ui, sans-serif"}
      fontStyle={obj.italic ? "italic" : "normal"}
      initial={{ opacity: 0, y: y + 15 }}
      animate={{ opacity: 1, y: y }}
      transition={{ duration: 0.6, delay: index * 0.2 }}
    >
      {obj.text || obj.label || ''}
    </motion.text>
  );
};

// ─── SVG Orbit (animated circle following a circular path) ───
const SceneOrbit = ({ obj, index }) => {
  const cx = obj.cx ?? obj.aroundX ?? 400;
  const cy = obj.cy ?? obj.aroundY ?? 300;
  const orbitR = obj.orbitRadius ?? 100;
  const objR = obj.r ?? obj.size ?? 10;
  const fill = resolveColor(obj.fill || obj.color || 'blue');
  const speed = obj.speed ?? 8;
  const pathId = `orbit-path-${index}`;

  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: index * 0.15 }}
    >
      {/* Orbit path (dashed circle) */}
      <circle
        cx={cx} cy={cy} r={orbitR}
        fill="none" stroke="#475569" strokeWidth={1}
        strokeDasharray="4,6" opacity={0.3}
      />
      {/* Hidden path for animateMotion */}
      <defs>
        <path id={pathId}
          d={`M ${cx - orbitR},${cy} a ${orbitR},${orbitR} 0 1,1 ${orbitR * 2},0 a ${orbitR},${orbitR} 0 1,1 -${orbitR * 2},0`}
        />
      </defs>
      {/* Orbiting body */}
      <circle r={objR} fill={fill}>
        {obj.glow && (
          <>
            <animate attributeName="opacity" values="0.8;1;0.8" dur="2s" repeatCount="indefinite" />
          </>
        )}
        <animateMotion dur={`${speed}s`} repeatCount="indefinite" rotate="auto">
          <mpath xlinkHref={`#${pathId}`} />
        </animateMotion>
      </circle>
      {obj.label && (
        <text fill="#94a3b8" fontSize={11} fontWeight="bold" fontFamily="system-ui, sans-serif">
          <animateMotion dur={`${speed}s`} repeatCount="indefinite">
            <mpath xlinkHref={`#${pathId}`} />
          </animateMotion>
          <tspan dy={objR + 14} textAnchor="middle">{obj.label}</tspan>
        </text>
      )}
    </motion.g>
  );
};

// ─── SVG Arc / Angle marker ───
const SceneArc = ({ obj, index }) => {
  const cx = obj.cx ?? obj.x ?? 400;
  const cy = obj.cy ?? obj.y ?? 300;
  const r = obj.r ?? 30;
  const startAngle = (obj.startAngle ?? 0) * Math.PI / 180;
  const endAngle = (obj.endAngle ?? 90) * Math.PI / 180;
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy - r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy - r * Math.sin(endAngle);
  const largeArc = Math.abs(obj.endAngle - obj.startAngle) > 180 ? 1 : 0;
  const stroke = resolveColor(obj.stroke || obj.color || 'yellow');

  return (
    <motion.path
      d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 0 ${x2} ${y2}`}
      fill="none" stroke={stroke} strokeWidth={obj.strokeWidth ?? 2}
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 0.8 }}
      transition={{ duration: 0.8, delay: index * 0.2 }}
    />
  );
};

// ─── Main Shape Router ───
const SceneObject = ({ obj, index, isActive }) => {
  if (!obj) return null;
  const shape = (obj.shape || obj.type || 'circle').toLowerCase();
  switch (shape) {
    case 'circle': return <SceneCircle obj={obj} index={index} isActive={isActive} />;
    case 'rect':
    case 'rectangle':
    case 'box': return <SceneRect obj={obj} index={index} />;
    case 'line': return <SceneLine obj={obj} index={index} />;
    case 'arrow': return <SceneArrow obj={obj} index={index} />;
    case 'text':
    case 'label':
    case 'formula': return <SceneText obj={obj} index={index} />;
    case 'orbit':
    case 'planet': return <SceneOrbit obj={obj} index={index} />;
    case 'arc':
    case 'angle': return <SceneArc obj={obj} index={index} />;
    default: return <SceneCircle obj={obj} index={index} isActive={isActive} />;
  }
};

// ─── MAIN COMPONENT ───
const SceneRenderer = ({ objects, steps, currentStep }) => {
  const safeObjects = Array.isArray(objects) ? objects : [];
  const safeSteps = Array.isArray(steps) ? steps : [];

  if (safeObjects.length === 0) return null;

  return (
    <div className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden">
      {/* SVG Canvas */}
      <svg
        viewBox="0 0 800 600"
        className="w-full h-full max-w-[90%] max-h-[80%]"
        preserveAspectRatio="xMidYMid meet"
        style={{ filter: 'drop-shadow(0 0 40px rgba(0,0,0,0.3))' }}
      >
        {/* Background grid */}
        <defs>
          <pattern id="scene-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(148,163,184,0.06)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="800" height="600" fill="url(#scene-grid)" rx="20" />

        {/* Render all objects */}
        <AnimatePresence>
          {safeObjects.map((obj, i) => (
            <SceneObject
              key={obj.id || `obj-${i}`}
              obj={obj}
              index={i}
              isActive={i <= currentStep}
            />
          ))}
        </AnimatePresence>
      </svg>

      {/* Step Description Overlay */}
      {safeSteps.length > 0 && currentStep < safeSteps.length && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-20">
          <div className="px-3 py-1 bg-[var(--bg-tertiary)]/80 border border-[var(--border-color)] rounded-full text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--text-tertiary)] backdrop-blur-md">
            Step {currentStep + 1} / {safeSteps.length}
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="px-6 py-3 bg-[var(--bg-secondary)]/70 backdrop-blur-2xl border border-[var(--border-color)] rounded-2xl max-w-lg text-center"
            >
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                {safeSteps[currentStep]?.label || safeSteps[currentStep]?.description || ''}
              </span>
              {safeSteps[currentStep]?.description && safeSteps[currentStep]?.label && (
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  {safeSteps[currentStep].description}
                </p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default SceneRenderer;
