import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Palette, Pin, Copy, ArrowUp } from "lucide-react";
import useTutorStore from "../../../store/tutorStore";
import { resolveNoteColors, CW, CH } from "./ShapeUtils";
import { AW } from "./AnimatedWrapper";

export const StickyNoteShape = ({
  x, y, w, h, label, color, rotation = 0, attentionLevel, layoutId, animation, isSelected, onUpdate, onDelete, fontFamily, fontWeight, fontStyle, textDecoration, isPinned: propIsPinned,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const textAreaRef = useRef(null);
  const { setCanvasLocked, setChatInputText, duplicateNote, toggleNotePin, bringToFront, pinnedNotes = [] } = useTutorStore();
  const canvasScale = useTutorStore(s => s.canvasTransform.scale) || 1;
  const isPinned = propIsPinned ?? pinnedNotes.some((n) => n.id === layoutId);

  useEffect(() => {
    setCanvasLocked(isSelected || isDragging);
    return () => setCanvasLocked(false);
  }, [isSelected, isDragging, setCanvasLocked]);

  useEffect(() => { if (label === "") textAreaRef.current?.focus(); }, []);

  const col = resolveNoteColors(color || "#fef9c3");
  const width = w || 180, height = h || 180;
  const fontSize = Math.max(12, Math.min(width, height) / 12);
  const lineH = fontSize * 1.75;
  const lines = [];
  for (let ly = lineH * 2.8; ly < height - 12; ly += lineH) {
    lines.push(`M ${-width / 2} ${-height / 2 + ly} L ${width / 2} ${-height / 2 + ly}`);
  }

  const handleResizePointerDown = (e) => {
    e.stopPropagation();
    const startX = e.clientX, startY = e.clientY, startW = width, startH = height;
    const onMove = (me) => {
      if (onUpdate) onUpdate({ w: Math.max(100, startW + (me.clientX - startX) / canvasScale), h: Math.max(100, startH + (me.clientY - startY) / canvasScale) });
    };
    const onUp = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp);
  };

  const handleDragPointerDown = (e) => {
    e.stopPropagation(); bringToFront(layoutId); setIsDragging(true);
    const startX = e.clientX, startY = e.clientY, ox = x, oy = y;
    const onMove = (me) => {
      if (onUpdate) onUpdate({ x: (ox + (me.clientX - startX) / canvasScale) / CW, y: (oy + (me.clientY - startY) / canvasScale) / CH });
    };
    const onUp = () => { setIsDragging(false); window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp);
  };

  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y} rotate={isDragging ? rotation + 1.5 : rotation} scale={isDragging ? 1.02 : 1} transition={{ type: "spring", damping: 20, stiffness: 120 }}>
      <rect x={-width / 2} y={-height / 2} width={width} height={height} rx={2} fill={col.bg} onPointerDown={handleDragPointerDown} filter={isDragging ? "url(#tb-lift-shadow)" : "url(#tb-drop-shadow)"} style={{ cursor: isDragging ? "grabbing" : "grab" }} />
      {isSelected && !isDragging && <rect x={-width / 2 - 2} y={-height / 2 - 2} width={width + 4} height={height + 4} rx={4} fill="none" stroke="#3b82f6" strokeWidth={2} />}
      <g opacity={0.6}>{lines.map((d, i) => <path key={i} d={d} stroke={col.ruled} strokeWidth={0.8} />)}</g>
      <circle cx={-width / 2 + 15} cy={-height / 2 + 15} r={4} fill={isPinned ? "#ef4444" : "#000"} opacity={isPinned ? 0.9 : 0.35} />
      <g transform={`translate(${width / 2 - 20}, ${height / 2 - 20})`}><polygon points="0,20 20,0 20,20" fill="rgba(0,0,0,0.1)"/><polygon points="4,20 20,4 20,20" fill={col.tape} opacity="0.3"/></g>
      <g transform={`rotate(-0.5, 0, ${-height / 2})`} onPointerDown={handleDragPointerDown}><rect x={-24} y={-height / 2 - 10} width={48} height={22} rx={2} fill={col.tape} opacity={0.55} /></g>
      <foreignObject x={-width / 2 + 10} y={-height / 2 + 30} width={width - 20} height={height - 50}>
        <textarea ref={textAreaRef} value={label} onChange={(e) => onUpdate && onUpdate({ label: e.target.value })} style={{ width: "100%", height: "100%", background: "transparent", border: "none", outline: "none", resize: "none", padding: "2px 12px 12px", fontFamily: fontFamily || "'Caveat', cursive, sans-serif", fontSize: `${fontSize}px`, fontWeight: fontWeight || 600, overflow: "hidden" }} />
      </foreignObject>
      <AnimatePresence>
        {(isSelected || isHovered) && (
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <g transform={`translate(${width / 2 - 12}, ${height / 2 - 12})`} onPointerDown={handleResizePointerDown} style={{ cursor: "nwse-resize" }}><circle r={10} fill={col.bg} stroke={col.tape} strokeWidth={1.5} /></g>
            <g transform={`translate(${width / 2 - 12}, ${-height / 2 + 12})`} onClick={() => onDelete?.()} style={{ cursor: "pointer" }}><circle r={10} fill={col.bg} stroke="#ef4444" strokeWidth={1.5} /><X size={12} x={-6} y={-6} stroke="#ef4444" /></g>
            <g transform={`translate(${-width / 2 + 35}, ${-height / 2 + 15})`} onClick={() => setShowColorPicker(!showColorPicker)} style={{ cursor: "pointer" }}><circle r={10} fill={col.bg} stroke="#000" strokeWidth={1.5} /><Palette size={12} x={-6} y={-6} stroke="#000" /></g>
            <g transform={`translate(${-width / 2 + 60}, ${-height / 2 + 15})`} onClick={() => toggleNotePin(layoutId)} style={{ cursor: "pointer" }}><circle r={10} fill={isPinned ? "#000" : col.bg} stroke="#000" strokeWidth={1.5} /><Pin size={12} x={-6} y={-6} stroke={isPinned ? "white" : "#000"} /></g>
          </motion.g>
        )}
      </AnimatePresence>
    </AW>
  );
};
