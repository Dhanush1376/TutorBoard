import React, { useId, useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCw, Trash2 } from "lucide-react";

export const CW = 800;
export const CH = 600;
export const EASE_CINEMATIC = [0.16, 1, 0.3, 1];

export const PALETTE = {
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

export const resolve = (name) => {
  const s = String(name || "blue")
    .trim()
    .toLowerCase();
  if (PALETTE[s]) return PALETTE[s];
  // hex color passed directly
  return { stroke: s, fill: s, glass: s + "33", text: "#f8fafc", glow: s };
};

export const getStrokeDash = (strokeStyle) => {
  if (strokeStyle === 'dotted') return "2 4";
  if (strokeStyle === 'dashed') return "6 4";
  return "none";
};

export const resolveNoteColors = (bgColor) => {
  const c = String(bgColor).toLowerCase();
  if (c === "#fef9c3" || c === "#fbbf24")
    return { bg: "#fef9c3", ruled: "#fde047", tape: "#facc15" };
  if (c === "#dcfce7" || c === "#6ee7b7")
    return { bg: "#dcfce7", ruled: "#86efac", tape: "#4ade80" };
  if (c === "#dbeafe" || c === "#7dd3fc")
    return { bg: "#dbeafe", ruled: "#93c5fd", tape: "#60a5fa" };
  if (c === "#fce7f3" || c === "#fca5a5")
    return { bg: "#fce7f3", ruled: "#f9a8d4", tape: "#f472b6" };
  if (c === "#ffedd5" || c === "#fdba74")
    return { bg: "#ffedd5", ruled: "#fdba74", tape: "#fb923c" };
  if (c === "#ede9fe" || c === "#c4b5fd")
    return { bg: "#ede9fe", ruled: "#c4b5fd", tape: "#a78bfa" };
  if (c === "#ccfbf1")
    return { bg: "#ccfbf1", ruled: "#5eead4", tape: "#2dd4bf" };
  if (c === "#fffef9" || c === "#ffffff")
    return { bg: "#fffef9", ruled: "#e5e7eb", tape: "#d1d5db" };

  return { bg: bgColor, ruled: "rgba(0,0,0,0.1)", tape: "rgba(0,0,0,0.2)" };
};

export const AW = ({
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
  isLocked = false,
  ...props
}) => {
  const opacity = attentionLevel === 2 ? 1 : attentionLevel === 0 ? 0.12 : 1.0;
  const scale = attentionLevel === 2 ? 1.07 : attentionLevel === 0 ? 0.97 : 1;
  const blur = attentionLevel === 0 ? "blur(2px)" : "none";

  const [rotation, setRotation] = useState(initialRotation);
  const isRotatingRef = useRef(false);

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
    e.stopPropagation();
    if (!onUpdate || isLocked) return;
    
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

  const handleResizePointerDown = (e, dirX, dirY) => {
    e.stopPropagation();
    if (!onUpdate || isLocked) return;

    const svgEl = e.currentTarget.closest('svg');
    if (!svgEl) return;

    let ctm;
    try { ctm = e.currentTarget.getScreenCTM(); } catch { return; }
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

      const GRID_SNAP = 20;
      const snappedWorldX = Math.round(moveWorld.x / GRID_SNAP) * GRID_SNAP;
      const snappedWorldY = Math.round(moveWorld.y / GRID_SNAP) * GRID_SNAP;

      const deltaX = snappedWorldX - startWorld.x;
      const deltaY = snappedWorldY - startWorld.y;

      if (Math.abs(deltaX) > 0 || Math.abs(deltaY) > 0) {
        const sizeDeltaX = deltaX * dirX;
        const sizeDeltaY = deltaY * dirY;

        const shiftX = deltaX / 2;
        const shiftY = deltaY / 2;

        onUpdate({ 
           dw: sizeDeltaX / 800, 
           dh: sizeDeltaY / 600, 
           dx: shiftX / 800,
           dy: shiftY / 600
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
        scale: isDragging ? scale * 1.05 : scale,
      }}
      exit={{ scale: 0.8, opacity: 0 }}
      onPointerDown={handleMovePointerDown}
      onMouseDown={(e) => e.stopPropagation()}
      style={{ 
        cursor: onUpdate ? "move" : "default",
        transformOrigin: "center", 
        transformBox: "fill-box",
        zIndex: isDragging ? 100 : 1
      }}
    >
      <g style={{ pointerEvents: onUpdate ? "visiblePainted" : "auto" }}>
        {children}
      </g>

      <AnimatePresence>
        {isSelected && (
          <motion.g 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            pointerEvents="auto"
          >
            <circle cx={-w/2} cy={-h/2} r={6} fill="#3b82f6" stroke="#fff" strokeWidth={2} style={{cursor: 'nwse-resize'}} onPointerDown={(e) => handleResizePointerDown(e, -1, -1)} onMouseDown={(e) => e.stopPropagation()} />
            <circle cx={w/2} cy={-h/2} r={6} fill="#3b82f6" stroke="#fff" strokeWidth={2} style={{cursor: 'nesw-resize'}} onPointerDown={(e) => handleResizePointerDown(e, 1, -1)} onMouseDown={(e) => e.stopPropagation()} />
            <circle cx={-w/2} cy={h/2} r={6} fill="#3b82f6" stroke="#fff" strokeWidth={2} style={{cursor: 'nesw-resize'}} onPointerDown={(e) => handleResizePointerDown(e, -1, 1)} onMouseDown={(e) => e.stopPropagation()} />
            <circle cx={w/2} cy={h/2} r={6} fill="#3b82f6" stroke="#fff" strokeWidth={2} style={{cursor: 'nwse-resize'}} onPointerDown={(e) => handleResizePointerDown(e, 1, 1)} onMouseDown={(e) => e.stopPropagation()} />

            <g transform={`translate(0, ${-h / 2 - 35})`} onPointerDown={handleRotatePointerDown} onMouseDown={(e) => e.stopPropagation()} style={{ cursor: 'alias' }}>
              <circle r={14} fill="var(--bg-primary)" stroke="#22d3ee" strokeWidth={1.5} />
              <RotateCw size={14} x={-7} y={-7} stroke="#22d3ee" />
            </g>

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
