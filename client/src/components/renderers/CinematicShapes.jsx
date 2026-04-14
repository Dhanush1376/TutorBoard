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

import React, { useId, useState, useRef, useEffect, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Palette, ArrowUp, Copy, Pin, Layers, RotateCw, Trash2 } from "lucide-react";
import katex from "katex";
import useTutorStore from "../../store/tutorStore";
import { CanvasContext } from "../canvas/InfiniteCanvas";

const CW = 800;
const CH = 600;
const EASE_CINEMATIC = [0.16, 1, 0.3, 1];

const PALETTE = {
  blue: {
    stroke: "#60a5fa",
    fill: "#3b82f6",
    glass: "rgba(59,130,246,0.20)",
    text: "#f1f5f9",
    glow: "#60a5fa",
  },
  red: {
    stroke: "#f87171",
    fill: "#ef4444",
    glass: "rgba(239,68,68,0.20)",
    text: "#f1f5f9",
    glow: "#f87171",
  },
  green: {
    stroke: "#4ade80",
    fill: "#22c55e",
    glass: "rgba(34,197,94,0.20)",
    text: "#f1f5f9",
    glow: "#4ade80",
  },
  yellow: {
    stroke: "#fbbf24",
    fill: "#f59e0b",
    glass: "rgba(245,158,11,0.20)",
    text: "#0f172a",
    glow: "#fbbf24",
  },
  orange: {
    stroke: "#fb923c",
    fill: "#f97316",
    glass: "rgba(249,115,22,0.20)",
    text: "#f1f5f9",
    glow: "#fb923c",
  },
  purple: {
    stroke: "#c084fc",
    fill: "#9333ea",
    glass: "rgba(168,85,247,0.20)",
    text: "#f1f5f9",
    glow: "#c084fc",
  },
  cyan: {
    stroke: "#22d3ee",
    fill: "#06b6d4",
    glass: "rgba(6,182,212,0.20)",
    text: "#0f172a",
    glow: "#22d3ee",
  },
  gray: {
    stroke: "#94a3b8",
    fill: "#475569",
    glass: "rgba(148,163,184,0.15)",
    text: "#f1f5f9",
    glow: "#94a3b8",
  },
  white: {
    stroke: "#f1f5f9",
    fill: "#334155",
    glass: "rgba(255,255,255,0.12)",
    text: "#f8fafc",
    glow: "#f1f5f9",
  },
};

const resolve = (name) => {
  const s = String(name || "blue")
    .trim()
    .toLowerCase();
  if (PALETTE[s]) return PALETTE[s];
  // hex color passed directly
  return { stroke: s, fill: s, glass: s + "33", text: "#f8fafc", glow: s };
};

const getStrokeDash = (strokeStyle) => {
  if (strokeStyle === 'dotted') return "2 4";
  if (strokeStyle === 'dashed') return "6 4";
  return "none";
};

/**
 * Derives rich note colors (tape, ruled lines) from a base background color.
 */
const resolveNoteColors = (bgColor) => {
  const c = String(bgColor).toLowerCase();
  // Match demo colors
  if (c === "#fef9c3" || c === "#fbbf24")
    return { bg: "#fef9c3", ruled: "#fde047", tape: "#facc15" }; // Yellow
  if (c === "#dcfce7" || c === "#6ee7b7")
    return { bg: "#dcfce7", ruled: "#86efac", tape: "#4ade80" }; // Lime/Mint
  if (c === "#dbeafe" || c === "#7dd3fc")
    return { bg: "#dbeafe", ruled: "#93c5fd", tape: "#60a5fa" }; // Sky
  if (c === "#fce7f3" || c === "#fca5a5")
    return { bg: "#fce7f3", ruled: "#f9a8d4", tape: "#f472b6" }; // Rose/Peach
  if (c === "#ffedd5" || c === "#fdba74")
    return { bg: "#ffedd5", ruled: "#fdba74", tape: "#fb923c" }; // Orange/Apricot
  if (c === "#ede9fe" || c === "#c4b5fd")
    return { bg: "#ede9fe", ruled: "#c4b5fd", tape: "#a78bfa" }; // Lavender
  if (c === "#ccfbf1")
    return { bg: "#ccfbf1", ruled: "#5eead4", tape: "#2dd4bf" }; // Mint
  if (c === "#fffef9" || c === "#ffffff")
    return { bg: "#fffef9", ruled: "#e5e7eb", tape: "#d1d5db" }; // White

  // Fallback derivation
  return { bg: bgColor, ruled: "rgba(0,0,0,0.1)", tape: "rgba(0,0,0,0.2)" };
};

// ─── Attention Wrapper ────────────────────────────────────────────────────────
const AW = ({
  attentionLevel = 1,
  layoutId,
  animation,
  children,
  cx = 0,
  cy = 0,
  w = 120,
  h = 80,
  isSelected = false,
  onUpdate,
  onDelete,
  rotation: initialRotation = 0,
  ...props
}) => {
  const opacity = attentionLevel === 2 ? 1 : attentionLevel === 0 ? 0.12 : 1.0;
  const scale = attentionLevel === 2 ? 1.07 : attentionLevel === 0 ? 0.97 : 1;
  const blur = attentionLevel === 0 ? "blur(2px)" : "none";

  const [rotation, setRotation] = useState(initialRotation);
  const isRotatingRef = useRef(false);

  // Sync rotation with props
  useEffect(() => {
    if (!isRotatingRef.current) setRotation(initialRotation);
  }, [initialRotation]);

  const aType = animation?.type || "fade";
  const dur = animation?.duration || 0.5;
  const delay = animation?.delay || 0;

  const initial =
    props.initial ||
    (aType === "slide"
      ? { x: cx - 60, opacity: 0 }
      : aType === "scale"
        ? { scale: 0.1, opacity: 0 }
        : aType === "draw"
          ? { opacity: 0 }
          : aType === "drop"
            ? { scale: 0.2, rotate: -3, opacity: 0 }
            : aType === "bounce"
              ? { scale: 0.5, opacity: 0 }
              : { opacity: 0 });

  const animate = props.animate || {
    x: cx,
    y: cy,
    opacity,
    scale,
    rotate: rotation,
    filter: blur,
    transition:
      aType === "bounce"
        ? { type: "spring", stiffness: 500, damping: 15, delay }
        : { duration: dur, delay, ease: EASE_CINEMATIC },
  };

  const handleRotatePointerDown = (e) => {
    e.stopPropagation();
    isRotatingRef.current = true;
    const startY = e.clientY;
    const startRotation = rotation;

    const onMove = (moveEvent) => {
      const deltaY = (startY - moveEvent.clientY);
      setRotation(startRotation + deltaY);
    };

    const onUp = () => {
      isRotatingRef.current = false;
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      onUpdate?.({ rotation });
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };

  const [isDragging, setIsDragging] = useState(false);

  const handleMovePointerDown = (e) => {
    if (!onUpdate) return;
    
    const svgEl = e.currentTarget.closest('svg');
    if (!svgEl) return;
    
    let ctm;
    try {
      ctm = e.currentTarget.getScreenCTM();
    } catch(err) {
      return; 
    }
    if (!ctm) return;

    const pt = svgEl.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    let startWorld = pt.matrixTransform(ctm.inverse());

    setIsDragging(true);

    const onMove = (moveEvent) => {
      pt.x = moveEvent.clientX;
      pt.y = moveEvent.clientY;
      const moveWorld = pt.matrixTransform(ctm.inverse());
      
      // Step 7: Smooth Snapping Logic (20px grid)
      const GRID_SNAP = 20;
      const snappedWorldX = Math.round(moveWorld.x / GRID_SNAP) * GRID_SNAP;
      const snappedWorldY = Math.round(moveWorld.y / GRID_SNAP) * GRID_SNAP;
      
      const deltaX = snappedWorldX - startWorld.x;
      const deltaY = snappedWorldY - startWorld.y;

      if (Math.abs(deltaX) > 0 || Math.abs(deltaY) > 0) {
        onUpdate({ 
          dx: deltaX / 800, 
          dy: deltaY / 600 
        });
        startWorld = { x: snappedWorldX, y: snappedWorldY };
      }
    };

    const onUp = () => {
      setIsDragging(false);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };

  return (
    <motion.g
      initial={initial}
      animate={{
        ...animate,
        scale: isDragging ? scale * 1.05 : scale, // Step 7: Visual feedback
      }}
      exit={{ scale: 0.8, opacity: 0 }}
      onPointerDown={handleMovePointerDown}
      style={{ 
        cursor: onUpdate ? "move" : "default",
        transformOrigin: "center", 
        transformBox: "fill-box",
        zIndex: isDragging ? 100 : 1
      }}
    >
      {/* Selection Border */}


      {/* Main Content */}
      <g style={{ pointerEvents: onUpdate ? "visiblePainted" : "auto" }}>
        {children}
      </g>

      {/* Manipulation Handles (Only when selected) */}
      <AnimatePresence>
        {isSelected && (
          <motion.g 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            pointerEvents="auto"
          >
            {/* Rotation Handle */}
            <g transform={`translate(0, ${-h / 2 - 35})`} onPointerDown={handleRotatePointerDown} style={{ cursor: 'alias' }}>
              <circle r={14} fill="var(--bg-primary)" stroke="#22d3ee" strokeWidth={1.5} shadow="0 4px 12px rgba(0,0,0,0.2)" />
              <RotateCw size={14} x={-7} y={-7} stroke="#22d3ee" />
            </g>

            {/* Delete Handle */}
            <g transform={`translate(${w / 2 + 25}, ${-h / 2})`} onClick={(e) => { e.stopPropagation(); onDelete?.(); }} style={{ cursor: 'pointer' }}>
               <circle r={13} fill="var(--bg-primary)" stroke="#ef4444" strokeWidth={1.5} />
               <Trash2 size={13} x={-6.5} y={-6.5} stroke="#ef4444" />
            </g>
          </motion.g>
        )}
      </AnimatePresence>
    </motion.g>
  );
};

// ─── EXISTING SHAPES (improved) ───────────────────────────────────────────────

export const GlowOrb = ({
  cx,
  cy,
  r,
  color,
  label,
  attentionLevel,
  layoutId,
  animation,
}) => {
  const c = resolve(color);
  const radius = r || 40;
  const uid = useId().replace(/:/g, "");
  const gradId = `grad-${layoutId}-${uid}`;

  return (
    <AW
      attentionLevel={attentionLevel}
      layoutId={layoutId}
      animation={animation}
      cx={cx}
      cy={cy}
    >
      <defs>
        <radialGradient id={gradId} cx="35%" cy="35%" r="75%">
          <stop offset="0%" stopColor={c.text} stopOpacity="0.8" />
          <stop offset="50%" stopColor={c.fill} stopOpacity="1" />
          <stop offset="100%" stopColor="#020617" stopOpacity="1" />
        </radialGradient>
      </defs>
      {attentionLevel === 2 && (
        <motion.circle
          r={radius + 14}
          fill="none"
          stroke={c.glow}
          strokeWidth={2}
          animate={{ opacity: [0.15, 0.55, 0.15] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        />
      )}
      <circle
        r={radius}
        fill={`url(#${gradId})`}
        stroke={c.stroke}
        strokeWidth={2}
        filter="url(#tb-neon-glow)"
      />
      {label && (
        <text
          y={radius + 22}
          textAnchor="middle"
          fill="#e2e8f0"
          fontSize={13}
          fontWeight="700"
          style={{ fontFamily: "system-ui, sans-serif" }}
        >
          {label}
        </text>
      )}
    </AW>
  );
};

export const GlassRect = ({
  x,
  y,
  w,
  h,
  color,
  label,
  attentionLevel,
  layoutId,
  animation,
  strokeStyle = "solid",
  fill = "none",
  isSelected,
  onUpdate,
  onDelete,
  rotation,
}) => {
  const c = resolve(color);
  const getFill = () => {
    if (fill === "glass") return c.glass;
    if (fill === "subtle") return `${c.fill}22`;
    return "none";
  };
  return (
    <AW
      attentionLevel={attentionLevel}
      layoutId={layoutId}
      animation={animation}
      cx={x + w / 2}
      cy={y + h / 2}
      w={w}
      h={h}
      isSelected={isSelected}
      onUpdate={onUpdate}
      onDelete={onDelete}
      rotation={rotation}
    >
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        rx={12}
        fill={getFill()}
        stroke={c.stroke}
        strokeWidth={attentionLevel === 2 ? 2.5 : 1.5}
        strokeDasharray={getStrokeDash(strokeStyle)}
        style={fill === "glass" ? {} : {}}
        filter="url(#tb-drop-shadow)"
      />
      {label && (
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fill="#f1f5f9"
          fontSize={13}
          fontWeight="700"
          style={{ fontFamily: "system-ui, sans-serif" }}
        >
          {label}
        </text>
      )}
    </AW>
  );
};

export const GlassEllipse = ({
  cx,
  cy,
  rx,
  ry,
  color,
  label,
  attentionLevel,
  layoutId,
  animation,
  strokeStyle = "solid",
  fill = "none",
}) => {
  const c = resolve(color);
  const getFill = () => {
    if (fill === "glass") return c.glass;
    if (fill === "subtle") return `${c.fill}22`;
    return "none";
  };
  return (
    <AW
      attentionLevel={attentionLevel}
      layoutId={layoutId}
      animation={animation}
      cx={cx}
      cy={cy}
    >
      <ellipse
        rx={rx}
        ry={ry}
        fill={getFill()}
        stroke={c.stroke}
        strokeWidth={attentionLevel === 2 ? 2.5 : 1.5}
        strokeDasharray={getStrokeDash(strokeStyle)}
        style={fill === "glass" ? {} : {}}
        filter="url(#tb-drop-shadow)"
      />
      {label && (
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fill="#f1f5f9"
          fontSize={13}
          fontWeight="700"
          style={{ fontFamily: "system-ui, sans-serif" }}
        >
          {label}
        </text>
      )}
    </AW>
  );
};

export const FlowArrow = ({
  x1,
  y1,
  x2,
  y2,
  color,
  label,
  attentionLevel,
  layoutId,
  strokeStyle = "solid",
  animation,
}) => {
  const c = resolve(color);
  const mx = (x1 + x2) / 2,
    my = (y1 + y2) / 2;
  const uid = useId().replace(/:/g, "");
  const mid = `m-${layoutId}-${uid}`;
  return (
    <AW
      attentionLevel={attentionLevel}
      layoutId={layoutId}
      cx={mx}
      cy={my}
      animation={animation}
    >
      <defs>
        <marker
          id={mid}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M0 0L10 5L0 10z" fill={c.stroke} />
        </marker>
      </defs>
      <motion.line
        x1={x1 - mx}
        y1={y1 - my}
        x2={x2 - mx}
        y2={y2 - my}
        stroke={c.stroke}
        strokeWidth={2.5}
        strokeDasharray={getStrokeDash(strokeStyle)}
        markerEnd={`url(#${mid})`}
        initial={animation?.type === "draw" ? { pathLength: 0 } : {}}
        animate={animation?.type === "draw" ? { pathLength: 1 } : {}}
        transition={{
          duration: animation?.duration || 0.5,
          delay: animation?.delay || 0,
        }}
      />
      {label && (
        <text y={-12} textAnchor="middle" fill="#94a3b8" fontSize={11}>
          {label}
        </text>
      )}
    </AW>
  );
};

export const RawLine = ({
  x1,
  y1,
  x2,
  y2,
  color,
  label,
  attentionLevel,
  layoutId,
  strokeStyle = "solid",
  animation,
}) => {
  const c = resolve(color);
  const mx = (x1 + x2) / 2,
    my = (y1 + y2) / 2;
  return (
    <AW
      attentionLevel={attentionLevel}
      layoutId={layoutId}
      cx={mx}
      cy={my}
      animation={animation}
    >
      <motion.line
        x1={x1 - mx}
        y1={y1 - my}
        x2={x2 - mx}
        y2={y2 - my}
        stroke={c.stroke}
        strokeWidth={2}
        strokeDasharray={getStrokeDash(strokeStyle)}
        initial={animation?.type === "draw" ? { pathLength: 0 } : {}}
        animate={animation?.type === "draw" ? { pathLength: 1 } : {}}
        transition={{
          duration: animation?.duration || 0.5,
          delay: animation?.delay || 0,
        }}
      />
      {label && (
        <text y={-10} textAnchor="middle" fill="#94a3b8" fontSize={11}>
          {label}
        </text>
      )}
    </AW>
  );
};

export const DataBlock = ({
  x,
  y,
  values = [],
  label,
  color,
  attentionLevel,
  layoutId,
  animation,
  fontFamily,
  fontWeight,
  fontStyle,
  textDecoration,
}) => {
  const c = resolve(color);
  const cw = 56,
    ch = 52;
  const totalW = values.length * cw;
  return (
    <AW
      attentionLevel={attentionLevel}
      layoutId={layoutId}
      animation={animation}
      cx={x}
      cy={y}
    >
      {label && (
        <text
          y={-ch / 2 - 18}
          textAnchor="middle"
          fill="#e2e8f0"
          fontSize={13}
          fontWeight="800"
        >
          {label}
        </text>
      )}
      {values.map((val, i) => {
        const bx = i * cw - totalW / 2 + cw / 2;
        const isActive = attentionLevel === 2 && i === 0;
        return (
          <g key={i}>
            <rect
              x={bx - cw / 2 + 2}
              y={-ch / 2 + 2}
              width={cw - 4}
              height={ch - 4}
              rx={8}
              fill={isActive ? c.glass : "rgba(30,41,59,0.85)"}
              stroke={c.stroke}
              strokeWidth={isActive ? 2 : 1}
            />
            <text
              key={i}
              x={bx}
              y={0}
              textAnchor="middle"
              dominantBaseline="central"
              fill={isActive ? c.text : "rgba(255,255,255,0.4)"}
              fontSize={17}
              fontWeight={fontWeight || (isActive ? "800" : "800")}
              fontFamily={fontFamily || "monospace"}
              fontStyle={fontStyle || "normal"}
              textDecoration={textDecoration || "none"}
            >
              {val}
            </text>
          </g>
        );
      })}
    </AW>
  );
};

export const FlowPointer = ({
  x,
  y,
  color,
  label,
  attentionLevel,
  layoutId,
  animation,
}) => {
  const c = resolve(color);
  return (
    <AW
      attentionLevel={attentionLevel}
      layoutId={layoutId}
      animation={animation}
      cx={x}
      cy={y}
    >
      <polygon points="0,-18 -8,0 8,0" fill={c.stroke} />
      <rect x={-18} y={4} width={36} height={22} rx={6} fill={c.stroke} />
      <text
        y={15}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#fff"
        fontSize={11}
        fontWeight="900"
      >
        {label || "i"}
      </text>
    </AW>
  );
};

export const CodePanel = ({
  x,
  y,
  code,
  content,
  attentionLevel,
  layoutId,
  animation,
  styles = {},
}) => {
  const c = resolve(attentionLevel === 2 ? "cyan" : "gray");
  const text = content || code || "";
  const lines = text.split('\n');
  const w = 340;
  const h = Math.max(32, lines.length * 18 + 12);

  return (
    <AW
      attentionLevel={attentionLevel}
      layoutId={layoutId}
      animation={animation}
      cx={x}
      cy={y}
    >
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        rx={8}
        fill={
          attentionLevel === 2 ? "rgba(6,182,212,0.18)" : "rgba(30,41,59,0.6)"
        }
        stroke={c.stroke}
        strokeWidth={attentionLevel === 2 ? 1.5 : 0.5}
        style={{}}
      />
      <foreignObject
        x={-w / 2 + 12}
        y={-h / 2 + 6}
        width={w - 24}
        height={h - 12}
        pointerEvents="none"
      >
        <div style={{
          fontFamily: "'Geist Mono', 'Fira Code', monospace",
          fontSize: (styles.fontSize || 12) + 'px',
          color: attentionLevel === 2 ? "#22d3ee" : "#94a3b8",
          whiteSpace: 'pre',
          lineHeight: 1.5
        }}>
          {text}
        </div>
      </foreignObject>
    </AW>
  );
};

export const FloatingBadge = ({
  x,
  y,
  text,
  color,
  attentionLevel,
  layoutId,
  animation,
}) => {
  const c = resolve(color);
  const w = Math.max(60, (text || "").length * 8 + 24);
  return (
    <AW
      attentionLevel={attentionLevel}
      layoutId={layoutId}
      animation={animation}
      cx={x}
      cy={y}
    >
      <rect
        x={-w / 2}
        y={-14}
        width={w}
        height={28}
        rx={14}
        fill={attentionLevel === 2 ? c.fill : c.glass}
        stroke={c.stroke}
        strokeWidth={attentionLevel === 2 ? 2 : 1}
      />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fill={attentionLevel === 2 ? "#fff" : c.stroke}
        fontSize={12}
        fontWeight="800"
      >
        {text}
      </text>
    </AW>
  );
};

export const SwapBridge = ({
  x,
  y,
  color,
  attentionLevel,
  layoutId,
  animation,
}) => {
  const c = resolve(color);
  return (
    <AW
      attentionLevel={attentionLevel}
      layoutId={layoutId}
      animation={animation}
      cx={x}
      cy={y}
    >
      <motion.path
        d="M-50,0 Q0,-55 50,0"
        fill="none"
        stroke={c.stroke}
        strokeWidth={3}
        animate={attentionLevel === 2 ? { strokeDashoffset: [0, -18] } : {}}
        transition={{ duration: 0.6, repeat: Infinity, ease: "linear" }}
      />
      <circle cx={-50} cy={0} r={5} fill={c.stroke} />
      <circle cx={50} cy={0} r={5} fill={c.stroke} />
    </AW>
  );
};

export const Comparator = ({
  x,
  y,
  leftVal,
  rightVal,
  operator,
  result,
  color,
  attentionLevel,
  layoutId,
  animation,
}) => {
  const isTrue = String(result).toLowerCase() === "true";
  const c = resolve(isTrue ? "red" : "green");
  return (
    <AW
      attentionLevel={attentionLevel}
      layoutId={layoutId}
      animation={animation}
      cx={x}
      cy={y}
    >
      <rect
        x={-100}
        y={-24}
        width={200}
        height={48}
        rx={24}
        fill={c.glass}
        stroke={c.stroke}
        strokeWidth={attentionLevel === 2 ? 2.5 : 1.5}
      />
      <text
        x={-52}
        y={0}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#fff"
        fontSize={18}
        fontWeight="800"
        fontFamily="monospace"
      >
        {leftVal}
      </text>
      <text
        x={0}
        y={0}
        textAnchor="middle"
        dominantBaseline="central"
        fill={c.stroke}
        fontSize={16}
        fontWeight="700"
      >
        {operator}
      </text>
      <text
        x={52}
        y={0}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#fff"
        fontSize={18}
        fontWeight="800"
        fontFamily="monospace"
      >
        {rightVal}
      </text>
    </AW>
  );
};

export const DataDot = ({
  x,
  y,
  color,
  label,
  attentionLevel,
  layoutId,
  animation,
}) => {
  const c = resolve(color);
  return (
    <AW
      attentionLevel={attentionLevel}
      layoutId={layoutId}
      animation={animation}
      cx={x}
      cy={y}
    >
      <circle r={attentionLevel === 2 ? 10 : 7} fill={c.stroke} />
      {label && (
        <text
          y={20}
          textAnchor="middle"
          fill={c.text}
          fontSize={10}
          fontWeight="bold"
        >
          {label}
        </text>
      )}
    </AW>
  );
};

export const CartesianAxes = ({
  x,
  y,
  color,
  label,
  attentionLevel,
  layoutId,
  animation,
}) => {
  const c = resolve(color || "gray");
  const w = 380,
    h = 280;
  const ticks = [-3, -2, -1, 0, 1, 2, 3];
  return (
    <AW
      attentionLevel={attentionLevel}
      layoutId={layoutId}
      animation={animation}
      cx={x}
      cy={y}
    >
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={t * (w / 8)}
            y1={-h / 2}
            x2={t * (w / 8)}
            y2={h / 2}
            stroke="#334155"
            strokeWidth={0.5}
          />
          <line
            x1={-w / 2}
            y1={t * (h / 8)}
            x2={w / 2}
            y2={t * (h / 8)}
            stroke="#334155"
            strokeWidth={0.5}
          />
        </g>
      ))}
      <line
        x1={-w / 2}
        y1={0}
        x2={w / 2}
        y2={0}
        stroke={c.stroke}
        strokeWidth={2.5}
      />
      <line
        x1={0}
        y1={-h / 2}
        x2={0}
        y2={h / 2}
        stroke={c.stroke}
        strokeWidth={2.5}
      />
      <text x={w / 2 + 12} y={4} fill={c.stroke} fontSize={13} fontWeight="700">
        x
      </text>
      <text
        x={6}
        y={-h / 2 - 10}
        fill={c.stroke}
        fontSize={13}
        fontWeight="700"
      >
        y
      </text>
      {label && (
        <text
          y={-h / 2 - 28}
          textAnchor="middle"
          fill={c.text}
          fontSize={14}
          fontWeight="bold"
        >
          {label}
        </text>
      )}
    </AW>
  );
};

export const GeometryPolygon = ({
  x,
  y,
  points,
  color,
  label,
  attentionLevel,
  layoutId,
  animation,
  strokeStyle = "solid",
  fill = "none",
}) => {
  const c = resolve(color);
  const pts =
    Array.isArray(points) && points.length > 2
      ? points
      : [
          [0, 0],
          [60, 100],
          [-60, 100],
        ];
  const pstr = pts.map((p) => `${p[0]},${p[1]}`).join(" ");
  const getFill = () => {
    if (fill === "glass") return c.glass;
    if (fill === "subtle") return `${c.fill}22`;
    return "none";
  };
  return (
    <AW
      attentionLevel={attentionLevel}
      layoutId={layoutId}
      animation={animation}
      cx={x}
      cy={y}
    >
      <polygon
        points={pstr}
        fill={getFill()}
        stroke={c.stroke}
        strokeWidth={attentionLevel === 2 ? 3 : 2}
        style={fill === "glass" ? {} : {}}
      />
      {label && (
        <text
          y={pts[0][1] - 18}
          textAnchor="middle"
          fill={c.text}
          fontSize={13}
          fontWeight="bold"
        >
          {label}
        </text>
      )}
    </AW>
  );
};

// ─── NEW SHAPES ────────────────────────────────────────────────────────────────

/**
 * EquationBlock — For math equations, formulas, expressions
 * Renders with a glowing monospace style
 */
export const EquationBlock = ({
  x,
  y,
  label,
  content,
  color,
  attentionLevel,
  layoutId,
  animation,
  styles = {},
}) => {
  const c = resolve(color || "cyan");
  const text = content || label || "";
  const containerRef = useRef(null);
  
  // Base width/height scaling
  const w = Math.max(160, text.length * 11 + 64);
  const h = 64;

  useEffect(() => {
    if (containerRef.current && text) {
      try {
        katex.render(text || "\\text{Type LaTeX here...}", containerRef.current, {
          throwOnError: false,
          displayMode: true,
        });
      } catch (err) {
        console.error("KaTeX error:", err);
      }
    }
  }, [text]);

  return (
    <AW
      attentionLevel={attentionLevel}
      layoutId={layoutId}
      animation={animation}
      cx={x}
      cy={y}
    >
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        rx={12}
        fill={attentionLevel === 2 ? c.glass : "rgba(15,23,42,0.75)"}
        stroke={c.stroke}
        strokeWidth={attentionLevel === 2 ? 2.5 : 1}
        filter={attentionLevel === 2 ? "url(#tb-neon-glow)" : "none"}
        style={{}}
      />
      <foreignObject
        x={-w / 2 + 10}
        y={-h / 2 + 5}
        width={w - 20}
        height={h - 10}
        pointerEvents="none"
      >
        <div 
          ref={containerRef}
          style={{ 
            width: '100%', 
            height: '100%', 
            display: 'flex', 
            itemsCenter: 'center', 
            justifyContent: 'center',
            color: attentionLevel === 2 ? c.text : "#94a3b8",
            fontSize: (styles.fontSize || 18) + 'px'
          }}
        />
      </foreignObject>
    </AW>
  );
};

/**
 * TreeNode — Binary tree / graph nodes with value labels
 */
export const TreeNode = ({
  x,
  y,
  label,
  color,
  attentionLevel,
  layoutId,
  animation,
  fontFamily,
  fontWeight,
  fontStyle,
  textDecoration,
}) => {
  const c = resolve(color || "blue");
  const r = attentionLevel === 2 ? 32 : 28;
  const uid = useId().replace(/:/g, "");
  const gid = `tn-${uid}`;

  return (
    <AW
      attentionLevel={attentionLevel}
      layoutId={layoutId}
      animation={animation}
      cx={x}
      cy={y}
    >
      <defs>
        <radialGradient id={gid} cx="38%" cy="38%" r="72%">
          <stop offset="0%" stopColor={c.text} stopOpacity="0.5" />
          <stop offset="100%" stopColor={c.fill} stopOpacity="1" />
        </radialGradient>
      </defs>
      {attentionLevel === 2 && (
        <circle
          r={r + 10}
          fill="none"
          stroke={c.glow}
          strokeWidth={1.5}
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0"
            to="360"
            dur="6s"
            repeatCount="indefinite"
          />
        </circle>
      )}
      <circle
        r={r}
        fill={`url(#${gid})`}
        stroke={c.stroke}
        strokeWidth={attentionLevel === 2 ? 2.5 : 1.5}
      />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fill="#fff"
        fontSize={14}
        fontWeight={fontWeight || "900"}
        fontFamily={fontFamily || "monospace"}
        fontStyle={fontStyle || "normal"}
        textDecoration={textDecoration || "none"}
      >
        {label}
      </text>
    </AW>
  );
};

/**
 * BarShape — Vertical bar for sorting, histograms, comparisons
 * scale controls height (0.1–2.0 = 10%–200% of base height)
 */
export const BarShape = ({
  x,
  y,
  label,
  color,
  attentionLevel,
  layoutId,
  animation,
  scale = 1,
}) => {
  const c = resolve(color || "blue");
  const baseH = 160;
  const bw = 44;
  const bh = Math.max(20, baseH * Math.min(2, Math.max(0.05, scale)));

  return (
    <AW
      attentionLevel={attentionLevel}
      layoutId={layoutId}
      animation={animation}
      cx={x}
      cy={y}
    >
      <rect
        x={-bw / 2}
        y={-bh}
        width={bw}
        height={bh}
        rx={6}
        fill={attentionLevel === 2 ? c.fill : c.glass}
        stroke={c.stroke}
        strokeWidth={attentionLevel === 2 ? 2.5 : 1.5}
      />
      {label && (
        <text
          y={-bh - 12}
          textAnchor="middle"
          fill={c.stroke}
          fontSize={12}
          fontWeight="800"
        >
          {label}
        </text>
      )}
    </AW>
  );
};

/**
 * VennCircle — Large translucent circle for Venn/set diagrams
 */
export const VennCircle = ({
  x,
  y,
  label,
  color,
  attentionLevel,
  layoutId,
  animation,
  scale = 1,
}) => {
  const c = resolve(color || "blue");
  const r = 110 * Math.max(0.4, scale);

  return (
    <AW
      attentionLevel={attentionLevel}
      layoutId={layoutId}
      animation={animation}
      cx={x}
      cy={y}
    >
      <circle
        r={r}
        fill={attentionLevel === 2 ? `${c.fill}44` : `${c.fill}22`}
        stroke={c.stroke}
        strokeWidth={attentionLevel === 2 ? 3 : 2}
      />
      {label && (
        <text
          y={-r - 14}
          textAnchor="middle"
          fill={c.stroke}
          fontSize={14}
          fontWeight="800"
        >
          {label}
        </text>
      )}
    </AW>
  );
};

/**
 * EllipseShape — Smooth circular/elliptical primitive
 */
export const EllipseShape = ({ x, y, w, h, color, attentionLevel, layoutId, animation, label, strokeStyle = "solid", isSelected, onUpdate, onDelete, rotation }) => {
  const c = resolve(color);
  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y} 
        w={w} h={h} isSelected={isSelected} onUpdate={onUpdate} onDelete={onDelete} rotation={rotation}>
      <ellipse 
        rx={Math.max(2, w / 2)} ry={Math.max(2, h / 2)} 
        fill={c.glass} stroke={c.stroke} strokeWidth={2} 
      />
      {label && <text y={h/2 + 15} textAnchor="middle" fill={c.text} fontSize={12} fontWeight="bold">{label}</text>}
    </AW>
  );
};

/**
 * DiamondShape — Rotated square primitive
 */
export const DiamondShape = ({ x, y, w, h, color, attentionLevel, layoutId, animation, label, strokeStyle = "solid", isSelected, onUpdate, onDelete, rotation }) => {
  const c = resolve(color);
  const dw = w / 2;
  const dh = h / 2;
  const pts = `0,${-dh} ${dw},0 0,${dh} ${-dw},0`;
  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y} 
        w={w} h={h} isSelected={isSelected} onUpdate={onUpdate} onDelete={onDelete} rotation={rotation}>
      <polygon 
        points={pts} fill={c.glass} stroke={c.stroke} strokeWidth={2} 
      />
      {label && <text y={dh + 15} textAnchor="middle" fill={c.text} fontSize={12} fontWeight="bold">{label}</text>}
    </AW>
  );
};

/**
 * StarShape — 5-pointed star primitive
 */
export const StarShape = ({ x, y, w, h, color, attentionLevel, layoutId, animation, label, strokeStyle = "solid", isSelected, onUpdate, onDelete, rotation }) => {
  const c = resolve(color);
  const rOuter = Math.min(w, h) / 2;
  const rInner = rOuter * 0.4;
  const points = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    points.push(`${r * Math.cos(angle)},${r * Math.sin(angle)}`);
  }
  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y} 
        w={w} h={h} isSelected={isSelected} onUpdate={onUpdate} onDelete={onDelete} rotation={rotation}>
      <polygon 
        points={points.join(" ")} fill={c.glass} stroke={c.stroke} strokeWidth={2} 
      />
      {label && <text y={rOuter + 15} textAnchor="middle" fill={c.text} fontSize={12} fontWeight="bold">{label}</text>}
    </AW>
  );
};

/**
 * HexagonShape — 6-sided geometric primitive
 */
export const HexagonShape = ({ x, y, w, h, color, attentionLevel, layoutId, animation, label, strokeStyle = "solid", isSelected, onUpdate, onDelete, rotation }) => {
  const c = resolve(color);
  const rw = w / 2;
  const rh = h / 2;
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    points.push(`${rw * Math.cos(angle)},${rh * Math.sin(angle)}`);
  }
  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y} 
        w={w} h={h} isSelected={isSelected} onUpdate={onUpdate} onDelete={onDelete} rotation={rotation}>
      <polygon 
        points={points.join(" ")} fill={c.glass} stroke={c.stroke} strokeWidth={2} 
      />
      {label && <text y={rh + 15} textAnchor="middle" fill={c.text} fontSize={12} fontWeight="bold">{label}</text>}
    </AW>
  );
};

/**
 * CalloutShape — Speech bubble primitive
 */
export const CalloutShape = ({
  x,
  y,
  w,
  h,
  color,
  attentionLevel,
  layoutId,
  animation,
  label,
  content,
  strokeStyle = "solid",
  isSelected,
  onUpdate,
  onDelete,
  rotation,
  styles = {},
}) => {
  const c = resolve(color);
  const rw = w / 2;
  const rh = h / 2;
  const text = content || label || "";

  return (
    <AW
      attentionLevel={attentionLevel}
      layoutId={layoutId}
      animation={animation}
      cx={x}
      cy={y}
      w={w}
      h={h}
      isSelected={isSelected}
      onUpdate={onUpdate}
      onDelete={onDelete}
      rotation={rotation}
    >
      {/* Refined Callout Path with a "Tail" */}
      <path
        d={`M ${-rw},${-rh} 
           H ${rw} 
           V ${rh} 
           H ${-rw + 30} 
           L ${-rw},${rh + 20} 
           L ${-rw + 15},${rh} 
           H ${-rw} 
           Z`}
        fill={c.glass}
        stroke={c.stroke}
        strokeWidth={2}
        style={{}}
      />
      
      {/* Wrapped Text Content */}
      <foreignObject
        x={-rw + 10}
        y={-rh + 10}
        width={w - 20}
        height={h - 20}
        pointerEvents="none"
      >
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: c.text,
          fontSize: (styles.fontSize || 13) + 'px',
          fontWeight: styles.fontWeight || "600",
          fontFamily: styles.fontFamily || "system-ui, sans-serif",
          textAlign: styles.textAlign || 'center',
          lineHeight: 1.3,
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {text}
        </div>
      </foreignObject>
    </AW>
  );
};

/**
 * CloudShape — Cloud-like bubble primitive
 */
export const CloudShape = ({ x, y, w, h, color, attentionLevel, layoutId, animation, label, strokeStyle = "solid", isSelected, onUpdate, onDelete, rotation }) => {
  const c = resolve(color);
  const rw = w / 2;
  const rh = h / 2;
  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y}
        w={w} h={h} isSelected={isSelected} onUpdate={onUpdate} onDelete={onDelete} rotation={rotation}>
      <ellipse cx={-rw * 0.4} cy={-rh * 0.2} rx={rw * 0.5} ry={rh * 0.5} fill={c.glass} stroke={c.stroke} strokeWidth={2} />
      <ellipse cx={rw * 0.4} cy={-rh * 0.2} rx={rw * 0.5} ry={rh * 0.5} fill={c.glass} stroke={c.stroke} strokeWidth={2} />
      <ellipse cx={0} cy={rh * 0.2} rx={rw * 0.6} ry={rh * 0.5} fill={c.glass} stroke={c.stroke} strokeWidth={2} />
      {label && <text y={rh + 15} textAnchor="middle" fill={c.text} fontSize={12} fontWeight="bold">{label}</text>}
    </AW>
  );
};

/**
 * FlowStep — Rounded process step / pipeline stage
 */
export const FlowStep = ({
  x,
  y,
  label,
  color,
  attentionLevel,
  layoutId,
  animation,
  fontSize,
  fontFamily,
  fontWeight,
  fontStyle,
  textDecoration,
}) => {
  const c = resolve(color || "blue");
  const text = label || "";
  const w = Math.max(110, text.length * 9 + 28);
  const h = 48;

  return (
    <AW
      attentionLevel={attentionLevel}
      layoutId={layoutId}
      animation={animation}
      cx={x}
      cy={y}
    >
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        rx={h / 2}
        fill={attentionLevel === 2 ? c.fill : c.glass}
        stroke={c.stroke}
        strokeWidth={attentionLevel === 2 ? 2.5 : 1.5}
        filter={attentionLevel === 2 ? "url(#tb-drop-shadow)" : "none"}
      />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fill={attentionLevel === 2 ? "#fff" : c.stroke}
        fontSize={fontSize || 13}
        fontWeight={fontWeight || "700"}
        fontFamily={fontFamily || "system-ui, sans-serif"}
        fontStyle={fontStyle || "normal"}
        textDecoration={textDecoration || "none"}
      >
        {text}
      </text>
    </AW>
  );
};

/**
 * MoleculeNode — Chemical formula / atom badge
 */
export const MoleculeNode = ({
  x,
  y,
  label,
  color,
  attentionLevel,
  layoutId,
  animation,
  fontFamily,
  fontWeight,
  fontStyle,
  textDecoration,
}) => {
  const c = resolve(color || "green");
  const text = label || "";
  const w = Math.max(56, text.length * 11 + 24);
  const uid = useId().replace(/:/g, "");
  const gid = `mol-${uid}`;

  return (
    <AW
      attentionLevel={attentionLevel}
      layoutId={layoutId}
      animation={animation}
      cx={x}
      cy={y}
    >
      <defs>
        <radialGradient id={gid} cx="35%" cy="35%" r="70%">
          <stop offset="0%" stopColor={c.text} stopOpacity="0.4" />
          <stop offset="100%" stopColor={c.fill} stopOpacity="0.9" />
        </radialGradient>
      </defs>
      {attentionLevel === 2 && (
        <motion.circle
          r={w / 2 + 10}
          fill="none"
          stroke={c.glow}
          strokeWidth={1.5}
          animate={{ r: [w / 2 + 8, w / 2 + 16, w / 2 + 8] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
      <ellipse
        rx={w / 2}
        ry={24}
        fill={`url(#${gid})`}
        stroke={c.stroke}
        strokeWidth={attentionLevel === 2 ? 2.5 : 1.5}
      />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fill="#fff"
        fontSize={14}
        fontWeight={fontWeight || "900"}
        fontFamily={fontFamily || "'Courier New', monospace"}
        fontStyle={fontStyle || "normal"}
        textDecoration={textDecoration || "none"}
      >
        {text}
      </text>
    </AW>
  );
};

/**
 * LabelText — Full-width text for equations, axis labels, annotations
 */
export const LabelText = ({
  x,
  y,
  label,
  content,
  color,
  attentionLevel,
  layoutId,
  animation,
  styles = {},
}) => {
  const c = resolve(color || "white");
  const text = content || label || "";
  const opacity = attentionLevel === 0 ? 0.2 : attentionLevel === 2 ? 1 : 0.75;

  return (
    <AW
      attentionLevel={attentionLevel}
      layoutId={layoutId}
      animation={animation}
      cx={x}
      cy={y}
    >
      {styles.backgroundColor && styles.backgroundColor !== 'transparent' && (
        <rect 
          x={-((text.length * (styles.fontSize || 14) * 0.6) / 2) - 4}
          y={-(styles.fontSize || 14) / 1.5}
          width={(text.length * (styles.fontSize || 14) * 0.6) + 8}
          height={(styles.fontSize || 14) * 1.4}
          fill={styles.backgroundColor}
          rx={4}
          opacity={opacity}
        />
      )}
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fill={styles.color || c.stroke}
        fontSize={styles.fontSize || 14}
        fontWeight={styles.fontWeight || "600"}
        opacity={opacity}
        fontStyle={styles.fontStyle || "normal"}
        textDecoration={styles.textDecoration || "none"}
        fontFamily={styles.fontFamily || "system-ui, sans-serif"}
        style={{ textAlign: styles.textAlign || 'center' }}
      >
        {text}
      </text>
    </AW>
  );
};

/**
 * FreeformShape — Fallback for unknown/AI-invented types
 */
export const FreeformShape = ({
  layoutId,
  attentionLevel,
  x,
  y,
  label,
  color,
  type,
  animation,
}) => {
  const c = resolve(color);
  return (
    <AW
      attentionLevel={attentionLevel}
      layoutId={layoutId}
      animation={animation}
      cx={x}
      cy={y}
    >
      <rect
        x={-65}
        y={-32}
        width={130}
        height={64}
        rx={12}
        fill={c.glass}
        stroke={c.stroke}
        strokeWidth={2}
      />
      {label && (
        <text
          textAnchor="middle"
          dominantBaseline="middle"
          fill={c.text}
          fontSize={12}
          fontWeight="600"
        >
          {label}
        </text>
      )}
      <text
        y={-40}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={c.stroke}
        fillOpacity={0.6}
        fontSize={8}
        fontWeight="700"
        style={{ textTransform: "uppercase", letterSpacing: "2px" }}
      >
        [{type}]
      </text>
    </AW>
  );
};

/**
 * StickyNote — A premium pedagogical sticky note with tape, ruled lines, and folded corner
 */
export const StickyNoteShape = ({
  x,
  y,
  w,
  h,
  label,
  color,
  rotation = 0,
  attentionLevel,
  layoutId,
  animation,
  isSelected,
  onUpdate,
  onDelete,
  fontFamily,
  fontWeight,
  fontStyle,
  textDecoration,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const textAreaRef = useRef(null);

  const {
    setCanvasLocked,
    setChatInputText,
    duplicateNote,
    toggleNotePin,
    bringToFront,
    pinnedNotes = [],
  } = useTutorStore();
  const canvasCtx = useContext(CanvasContext);
  const canvasScale = canvasCtx?.transform?.scale || 1;
  const isPinned = pinnedNotes.some((n) => n.id === layoutId);

  useEffect(() => {
    if (isSelected || isDragging) setCanvasLocked(true);
    else setCanvasLocked(false);
  }, [isSelected, isDragging, setCanvasLocked]);

  useEffect(() => {
    // Auto-focus empty notes explicitly designed for creation flow
    if (label === "") {
      textAreaRef.current?.focus();
    }
  }, []);

  const col = resolveNoteColors(color || "#fef9c3");
  const width = w || 180;
  const height = h || 180;
  const fontSize = Math.max(12, Math.min(width, height) / 12);
  const lineH = fontSize * 1.75;

  // Ruled lines paths (Improved spacing and consistency)
  const lines = [];
  const startPadding = lineH * 2.8;
  for (let ly = startPadding; ly < height - 12; ly += lineH) {
    lines.push(
      `M ${-width / 2} ${-height / 2 + ly} L ${width / 2} ${-height / 2 + ly}`,
    );
  }

  const handleResizePointerDown = (e) => {
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = width;
    const startH = height;

    const handlePointerMove = (moveEvent) => {
      const dx = (moveEvent.clientX - startX) / canvasScale;
      const dy = (moveEvent.clientY - startY) / canvasScale;
      if (onUpdate) {
        onUpdate({
          w: Math.max(100, startW + dx),
          h: Math.max(100, startH + dy),
        });
      }
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const handleDragPointerDown = (e) => {
    e.stopPropagation();
    bringToFront(layoutId);
    setIsDragging(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const originalWorldX = x;
    const originalWorldY = y;

    const handleDragPointerMove = (moveEvent) => {
      const dx = (moveEvent.clientX - startX) / canvasScale;
      const dy = (moveEvent.clientY - startY) / canvasScale;

      if (onUpdate) {
        onUpdate({
          x: originalWorldX + (dx / CW),
          y: originalWorldY + (dy / CH),
        });
      }
    };

    const handleDragPointerUp = () => {
      setIsDragging(false);
      window.removeEventListener("pointermove", handleDragPointerMove);
      window.removeEventListener("pointerup", handleDragPointerUp);
    };

    window.addEventListener("pointermove", handleDragPointerMove);
    window.addEventListener("pointerup", handleDragPointerUp);
  };

  const handleTextChange = (e) => {
    if (onUpdate) {
      onUpdate({ label: e.target.value });
    }
  };

  return (
    <AW
      attentionLevel={attentionLevel}
      layoutId={layoutId}
      animation={animation}
      cx={x * CW}
      cy={y * CH}
      rotate={isDragging ? rotation + 1.5 : rotation}
      scale={isDragging ? 1.02 : 1}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => {
        setIsHovered(false);
        setShowColorPicker(false);
      }}
      initial={{ x: x * CW, y: y * CH, scale: 0.7, opacity: 0, rotate: rotation - 8 }}
      animate={{ 
        x: x * CW,
        y: y * CH,
        scale: isDragging ? 1.02 : 1, 
        opacity: 1, 
        rotate: isDragging ? rotation + 1.5 : rotation 
      }}
      exit={{ 
        scale: 0.2, 
        opacity: 0, 
        rotate: rotation + 15,
        transition: { duration: 0.3, ease: "backIn" } 
      }}
      onPointerDown={() => {
        if (showColorPicker) setShowColorPicker(false);
      }}
      transition={{ type: "spring", damping: 20, stiffness: 120 }}
    >
      {/* Note Body with shadow (Draggable) */}
      <rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        rx={2}
        fill={col.bg}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        filter={isDragging ? "url(#tb-lift-shadow)" : "url(#tb-drop-shadow)"}
        style={{ cursor: isDragging ? "grabbing" : "grab", transition: 'filter 0.2s' }}
        onPointerDown={handleDragPointerDown}
        pointerEvents="auto"
      />

      {/* Selection Border */}
      {isSelected && !isDragging && (
        <rect
          x={-width / 2 - 2}
          y={-height / 2 - 2}
          width={width + 4}
          height={height + 4}
          rx={4}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2}
        />
      )}

      {/* Ruled Lines (SVG Pattern Style) */}
      <g opacity={0.6}>
        {lines.map((d, i) => (
          <path
            key={i}
            d={d}
            stroke={col.ruled}
            strokeWidth={0.8}
            fill="none"
          />
        ))}
      </g>

      {/* Pin/Dot (Top Left) */}
      <circle
        cx={-width / 2 + 15}
        cy={-height / 2 + 15}
        r={4}
        fill={isPinned ? "#ef4444" : "#475569"}
        opacity={isPinned ? 0.9 : 0.22}
      />

      {/* Folded Corner (Bottom Right) */}
      <g transform={`translate(${width / 2 - 20}, ${height / 2 - 20})`}>
        <polygon points="0,20 20,0 20,20" fill="rgba(0,0,0,0.1)"/>
        <polygon points="4,20 20,4 20,20" fill={col.tape} opacity="0.3"/>
      </g>

      {/* Tape Strip (Top Center - Premium Blur effect) */}
      <g
        transform={`rotate(-0.5, 0, ${-height / 2})`}
        onPointerDown={handleDragPointerDown}
        style={{ cursor: "grab" }}
        pointerEvents="auto"
      >
        <rect
          x={-24}
          y={-height / 2 - 10}
          width={48}
          height={22}
          rx={2}
          fill={col.tape}
          opacity={0.55}
          style={{}}
        />
        {/* Tape Texture (Repeating Stripes) */}
        <defs>
          <pattern id={`tape-tex-${layoutId}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
          </pattern>
        </defs>
        <rect
           x={-24}
           y={-height / 2 - 10}
           width={48}
           height={22}
           rx={2}
           fill={`url(#tape-tex-${layoutId})`}
        />
      </g>

      {/* Label Text (Editable) */}
      <foreignObject
        x={-width / 2 + 10}
        y={-height / 2 + 30}
        width={width - 20}
        height={height - 50}
        pointerEvents={isDragging ? "none" : "auto"}
      >
        <textarea
          ref={textAreaRef}
          value={label}
          onChange={handleTextChange}
          placeholder="// Type here..."
          onFocus={() => setCanvasLocked(true)}
          onBlur={() => setCanvasLocked(false)}
          style={{
            width: "100%",
            height: "100%",
            background: "transparent",
            border: "none",
            outline: "none",
            resize: "none",
            padding: "2px 12px 12px",
            fontFamily: fontFamily || "'Caveat', cursive, 'DM Sans', sans-serif",
            fontSize: `${fontSize}px`,
            color: color || "rgba(0,0,0,0.72)",
            lineHeight: 1.75,
            fontWeight: fontWeight || 500,
            fontStyle: fontStyle || "normal",
            textDecoration: textDecoration || "none",
            overflow: "hidden",
            cursor: "text"
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            bringToFront(layoutId);
          }}
        />
      </foreignObject>

      {/* Interactivity Overlays */}
      <AnimatePresence>
        {(isSelected || isHovered) && (
          <motion.g
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            pointerEvents="auto"
          >
            {/* Resize Handle (Bottom Right) */}
            <g
              transform={`translate(${width / 2 - 12}, ${height / 2 - 12})`}
              onPointerDown={handleResizePointerDown}
              style={{ cursor: "nwse-resize" }}
              pointerEvents="auto"
            >
              <circle r={10} fill={col.bg} stroke={col.tape} strokeWidth={1.5} opacity={0.9} />
              <path
                d="M-3,-3 L3,3 M-3,1 L1,3 M1,-3 L3,-1"
                stroke={col.tape}
                strokeWidth={1.5}
                strokeLinecap="round"
              />
            </g>

            {/* Delete Button (Top Right) */}
            <g
              transform={`translate(${width / 2 - 12}, ${-height / 2 + 12})`}
              onPointerDown={(e) => { e.stopPropagation(); onDelete && onDelete(); }}
              onClick={(e) => { e.stopPropagation(); onDelete && onDelete(); }}
              style={{ cursor: "pointer" }}
              pointerEvents="auto"
            >
              <circle r={10} fill={col.bg} stroke="#ef4444" strokeWidth={1.5} opacity={0.9} />
              <X size={12} x={-6} y={-6} stroke="#ef4444" strokeWidth={2.5} />
            </g>

            {/* Color Palette Toggle (Top Left area) */}
            <g
              transform={`translate(${-width / 2 + 35}, ${-height / 2 + 15})`}
              onPointerDown={(e) => { e.stopPropagation(); setShowColorPicker(!showColorPicker); }}
              onClick={(e) => { e.stopPropagation(); setShowColorPicker(!showColorPicker); }}
              style={{ cursor: "pointer" }}
              pointerEvents="auto"
            >
              <circle r={10} fill={col.bg} stroke={col.tape} strokeWidth={1.5} opacity={0.9} />
              <Palette size={12} x={-6} y={-6} stroke={col.tape} strokeWidth={2} />
            </g>

            {/* Pin Toggle Button */}
            <g
              transform={`translate(${-width / 2 + 60}, ${-height / 2 + 15})`}
              onPointerDown={(e) => { e.stopPropagation(); toggleNotePin(layoutId); }}
              onClick={(e) => { e.stopPropagation(); toggleNotePin(layoutId); }}
              style={{ cursor: "pointer" }}
              pointerEvents="auto"
            >
              <circle r={10} fill={isPinned ? col.tape : col.bg} stroke={col.tape} strokeWidth={1.5} opacity={0.9} />
              <Pin size={12} x={-6} y={-6} stroke={isPinned ? "white" : col.tape} strokeWidth={2} />
            </g>

            {/* Duplicate Button */}
            <g
              transform={`translate(${-width / 2 + 85}, ${-height / 2 + 15})`}
              onPointerDown={(e) => { e.stopPropagation(); duplicateNote(layoutId); }}
              onClick={(e) => { e.stopPropagation(); duplicateNote(layoutId); }}
              style={{ cursor: "pointer" }}
              pointerEvents="auto"
            >
              <circle r={10} fill={col.bg} stroke={col.tape} strokeWidth={1.5} opacity={0.9} />
              <Copy size={12} x={-6} y={-6} stroke={col.tape} strokeWidth={2} />
            </g>

            {/* Sync To Chat Button (Bottom area) */}
            <g
              transform={`translate(${-width / 2 + 110}, ${-height / 2 + 15})`}
              onPointerDown={(e) => { e.stopPropagation(); setChatInputText(label); }}
              onClick={(e) => { e.stopPropagation(); setChatInputText(label); }}
              style={{ cursor: "pointer" }}
              pointerEvents="auto"
            >
              <circle r={10} fill={col.bg} stroke={col.tape} strokeWidth={1.5} opacity={0.9} />
              <ArrowUp size={12} x={-6} y={-6} stroke={col.tape} strokeWidth={2} />
            </g>

            {/* Integrated Color Picker Popover */}
            {showColorPicker && (
              <motion.g
                initial={{ scale: 0.9, opacity: 0, y: -10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transform={`translate(${-width / 2 + 35}, ${-height / 2 + 45})`}
                pointerEvents="auto"
              >
                <rect
                  x={-10} y={0} width={130} height={30}
                  rx={15} fill="white"
                  stroke={col.tape} strokeWidth={1}
                  style={{ filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.1))" }}
                />
                {[
                  "#fef9c3", "#dcfce7", "#dbeafe", "#fce7f3",
                  "#ffedd5", "#ede9fe", "#ccfbf1", "#ffffff",
                ].map((c, i) => (
                  <circle
                    key={c}
                    cx={10 + i * 15} cy={15} r={8}
                    fill={c}
                    stroke={color === c ? col.tape : "rgba(0,0,0,0.1)"}
                    strokeWidth={color === c ? 2 : 1}
                    style={{ cursor: "pointer" }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onUpdate && onUpdate({ color: c });
                      setShowColorPicker(false);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdate && onUpdate({ color: c });
                      setShowColorPicker(false);
                    }}
                  />
                ))}
              </motion.g>
            )}
          </motion.g>
        )}
      </AnimatePresence>
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
      <feComponentTransfer>
        <feFuncA type="linear" slope="0.4" />
      </feComponentTransfer>
      <feMerge>
        <feMergeNode />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <filter id="tb-lift-shadow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="12" result="blur" />
      <feOffset dx="0" dy="16" result="off" />
      <feComponentTransfer>
        <feFuncA type="linear" slope="0.3" />
      </feComponentTransfer>
      <feMerge>
        <feMergeNode />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
);
