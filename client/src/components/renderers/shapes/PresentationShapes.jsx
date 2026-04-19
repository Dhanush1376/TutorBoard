import React, { useId } from "react";
import { motion } from "framer-motion";
import { resolve, getStrokeDash } from "./ShapeUtils";
import { AW } from "./AnimatedWrapper";

export const CodePanel = ({
  x, y, code, content, attentionLevel, layoutId, animation, styles = {},
}) => {
  const c = resolve(attentionLevel === 2 ? "cyan" : "gray");
  const text = content || code || "";
  const lines = text.split('\n');
  const w = 340;
  const h = Math.max(32, lines.length * 18 + 12);

  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={8} 
            fill={attentionLevel === 2 ? "rgba(6,182,212,0.18)" : "rgba(30,41,59,0.6)"}
            stroke={c.stroke} strokeWidth={attentionLevel === 2 ? 1.5 : 0.5} />
      <foreignObject x={-w / 2 + 12} y={-h / 2 + 6} width={w - 24} height={h - 12} pointerEvents="none">
        <div style={{
          fontFamily: "'Geist Mono', 'Fira Code', monospace",
          fontSize: (styles.fontSize || 12) + 'px',
          color: attentionLevel === 2 ? "#22d3ee" : "#94a3b8",
          whiteSpace: 'pre', lineHeight: 1.5
        }}>{text}</div>
      </foreignObject>
    </AW>
  );
};

export const FloatingBadge = ({ x, y, text, color, attentionLevel, layoutId, animation }) => {
  const c = resolve(color);
  const w = Math.max(60, (text || "").length * 8 + 24);
  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y}>
      <rect x={-w / 2} y={-14} width={w} height={28} rx={14} fill={attentionLevel === 2 ? c.fill : c.glass} 
            stroke={c.stroke} strokeWidth={attentionLevel === 2 ? 2 : 1} />
      <text textAnchor="middle" dominantBaseline="central" fill={attentionLevel === 2 ? "#fff" : c.stroke} fontSize={12} fontWeight="800">{text}</text>
    </AW>
  );
};

export const CalloutShape = ({ x, y, w, h, color, attentionLevel, layoutId, animation, label, content, strokeStyle = "solid", fill, isSelected, onUpdate, onDelete, rotation, styles = {} }) => {
  const c = resolve(color);
  const rw = w / 2, rh = h / 2;
  const text = content || label || "";
  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y} w={w} h={h} isSelected={isSelected} onUpdate={onUpdate} onDelete={onDelete} rotation={rotation}>
      <path d={`M ${-rw},${-rh} H ${rw} V ${rh} H ${-rw + 30} L ${-rw},${rh + 20} L ${-rw + 15},${rh} H ${-rw} Z`}
            fill={fill === "none" ? "none" : c.glass} stroke={c.stroke} strokeWidth={2} strokeDasharray={getStrokeDash(strokeStyle)} />
      <foreignObject x={-rw + 10} y={-rh + 10} width={w - 20} height={h - 20} pointerEvents="none">
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.text, fontSize: (styles.fontSize || 13) + 'px', fontWeight: styles.fontWeight || "600", fontFamily: "system-ui, sans-serif", textAlign: 'center', lineHeight: 1.3 }}>{text}</div>
      </foreignObject>
    </AW>
  );
};

export const VennCircle = ({ x, y, label, color, attentionLevel, layoutId, animation, scale = 1 }) => {
  const c = resolve(color || "blue");
  const r = 110 * Math.max(0.4, scale);
  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y}>
      <circle r={r} fill={attentionLevel === 2 ? `${c.fill}44` : `${c.fill}22`} stroke={c.stroke} strokeWidth={attentionLevel === 2 ? 3 : 2} />
      {label && <text y={-r - 14} textAnchor="middle" fill={c.stroke} fontSize={14} fontWeight="800">{label}</text>}
    </AW>
  );
};

export const FlowStep = ({ x, y, label, color, attentionLevel, layoutId, animation, fontSize, fontFamily, fontWeight, fontStyle, textDecoration }) => {
  const c = resolve(color || "blue");
  const text = label || "";
  const w = Math.max(110, text.length * 9 + 28), h = 48;
  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} fill={attentionLevel === 2 ? c.fill : c.glass} stroke={c.stroke} strokeWidth={attentionLevel === 2 ? 2.5 : 1.5} />
      <text textAnchor="middle" dominantBaseline="central" fill={attentionLevel === 2 ? "#fff" : c.stroke} fontSize={fontSize || 13} fontWeight={fontWeight || "700"} fontFamily={fontFamily || "system-ui, sans-serif"}>{text}</text>
    </AW>
  );
};

export const CloudShape = ({ x, y, w, h, color, attentionLevel, layoutId, animation, label, strokeStyle = "solid", fill, isSelected, onUpdate, onDelete, rotation }) => {
  const c = resolve(color);
  const rw = w / 2, rh = h / 2;
  const f = fill === "none" ? "none" : c.glass;
  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y} w={w} h={h} isSelected={isSelected} onUpdate={onUpdate} onDelete={onDelete} rotation={rotation}>
      <ellipse cx={-rw * 0.4} cy={-rh * 0.2} rx={rw * 0.5} ry={rh * 0.5} fill={f} stroke={c.stroke} strokeWidth={2} strokeDasharray={getStrokeDash(strokeStyle)} />
      <ellipse cx={rw * 0.4} cy={-rh * 0.2} rx={rw * 0.5} ry={rh * 0.5} fill={f} stroke={c.stroke} strokeWidth={2} strokeDasharray={getStrokeDash(strokeStyle)} />
      <ellipse cx={0} cy={rh * 0.2} rx={rw * 0.6} ry={rh * 0.5} fill={f} stroke={c.stroke} strokeWidth={2} strokeDasharray={getStrokeDash(strokeStyle)} />
      {label && <text y={rh + 15} textAnchor="middle" fill={c.text} fontSize={12} fontWeight="bold">{label}</text>}
    </AW>
  );
};

export const FreeformShape = ({ layoutId, attentionLevel, x, y, label, color, type, animation }) => {
  const c = resolve(color);
  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y}>
      <rect x={-65} y={-32} width={130} height={64} rx={12} fill={c.glass} stroke={c.stroke} strokeWidth={2} />
      {label && <text textAnchor="middle" dominantBaseline="middle" fill={c.text} fontSize={12} fontWeight="600">{label}</text>}
      <text y={-40} textAnchor="middle" dominantBaseline="middle" fill={c.stroke} fillOpacity={0.6} fontSize={8} fontWeight="700" style={{ textTransform: "uppercase", letterSpacing: "2px" }}>[{type}]</text>
    </AW>
  );
};
