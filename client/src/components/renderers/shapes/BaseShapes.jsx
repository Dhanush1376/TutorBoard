import React, { useId } from "react";
import { motion } from "framer-motion";
import { resolve, getStrokeDash } from "./ShapeUtils";
import { AW } from "./AnimatedWrapper";

export const GlowOrb = ({
  cx, cy, r, color, label, attentionLevel, layoutId, animation, isSelected, onUpdate, onDelete,
}) => {
  const c = resolve(color);
  const radius = r || 40;
  const uid = useId().replace(/:/g, "");
  const gradId = `grad-${layoutId}-${uid}`;

  return (
    <AW
      attentionLevel={attentionLevel} layoutId={layoutId} animation={animation}
      cx={cx} cy={cy} w={radius * 2} h={radius * 2}
      isSelected={isSelected} onUpdate={onUpdate} onDelete={onDelete}
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
          r={radius + 14} fill="none" stroke={c.glow} strokeWidth={2}
          animate={{ opacity: [0.15, 0.55, 0.15] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        />
      )}
      <circle r={radius} fill={`url(#${gradId})`} stroke={c.stroke} strokeWidth={2} filter="url(#tb-neon-glow)" />
      {label && (
        <text y={radius + 22} textAnchor="middle" fill="#e2e8f0" fontSize={13} fontWeight="700" style={{ fontFamily: "system-ui, sans-serif" }}>
          {label}
        </text>
      )}
    </AW>
  );
};

export const GlassRect = ({
  x, y, w, h, color, label, attentionLevel, layoutId, animation, strokeStyle = "solid", fill = "none", isSelected, onUpdate, onDelete, rotation,
}) => {
  const c = resolve(color);
  const getFill = () => {
    if (fill === "glass") return c.glass;
    if (fill === "subtle") return `${c.fill}22`;
    return "none";
  };
  return (
    <AW
      attentionLevel={attentionLevel} layoutId={layoutId} animation={animation}
      cx={x} cy={y} w={w} h={h}
      isSelected={isSelected} onUpdate={onUpdate} onDelete={onDelete} rotation={rotation}
    >
      <rect
        x={-w / 2} y={-h / 2} width={w} height={h} rx={12}
        fill={getFill()} stroke={c.stroke}
        strokeWidth={attentionLevel === 2 ? 2.5 : 1.5}
        strokeDasharray={getStrokeDash(strokeStyle)}
        filter="url(#tb-drop-shadow)"
      />
      {label && (
        <text textAnchor="middle" dominantBaseline="central" fill="#f1f5f9" fontSize={13} fontWeight="700" style={{ fontFamily: "system-ui, sans-serif" }}>
          {label}
        </text>
      )}
    </AW>
  );
};

export const GlassEllipse = ({
  cx, cy, rx, ry, color, label, attentionLevel, layoutId, animation, strokeStyle = "solid", fill = "none",
}) => {
  const c = resolve(color);
  const getFill = () => {
    if (fill === "glass") return c.glass;
    if (fill === "subtle") return `${c.fill}22`;
    return "none";
  };
  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={cx} cy={cy}>
      <ellipse
        rx={rx} ry={ry} fill={getFill()} stroke={c.stroke}
        strokeWidth={attentionLevel === 2 ? 2.5 : 1.5}
        strokeDasharray={getStrokeDash(strokeStyle)}
        filter="url(#tb-drop-shadow)"
      />
      {label && (
        <text textAnchor="middle" dominantBaseline="central" fill="#f1f5f9" fontSize={13} fontWeight="700" style={{ fontFamily: "system-ui, sans-serif" }}>
          {label}
        </text>
      )}
    </AW>
  );
};

export const EllipseShape = ({ x, y, w, h, color, attentionLevel, layoutId, animation, label, strokeStyle = "solid", fill, isSelected, onUpdate, onDelete, rotation }) => {
  const c = resolve(color);
  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y} 
        w={w} h={h} isSelected={isSelected} onUpdate={onUpdate} onDelete={onDelete} rotation={rotation}>
      <ellipse 
        rx={Math.max(2, w / 2)} ry={Math.max(2, h / 2)} 
        fill={fill === "none" ? "none" : c.glass} stroke={c.stroke} strokeWidth={2} 
        strokeDasharray={getStrokeDash(strokeStyle)}
      />
      {label && <text y={h/2 + 22} textAnchor="middle" fill={c.text} fontSize={12} fontWeight="bold">{label}</text>}
    </AW>
  );
};

export const DiamondShape = ({ x, y, w, h, color, attentionLevel, layoutId, animation, label, strokeStyle = "solid", fill, isSelected, onUpdate, onDelete, rotation }) => {
  const c = resolve(color);
  const dw = w / 2;
  const dh = h / 2;
  const pts = `0,${-dh} ${dw},0 0,${dh} ${-dw},0`;
  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y} 
        w={w} h={h} isSelected={isSelected} onUpdate={onUpdate} onDelete={onDelete} rotation={rotation}>
      <polygon 
        points={pts} fill={fill === "none" ? "none" : c.glass} stroke={c.stroke} strokeWidth={2} 
        strokeDasharray={getStrokeDash(strokeStyle)}
      />
      {label && <text y={dh + 22} textAnchor="middle" fill={c.text} fontSize={12} fontWeight="bold">{label}</text>}
    </AW>
  );
};

export const StarShape = ({ x, y, w, h, color, attentionLevel, layoutId, animation, label, strokeStyle = "solid", fill, isSelected, onUpdate, onDelete, rotation }) => {
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
        points={points.join(" ")} fill={fill === "none" ? "none" : c.glass} stroke={c.stroke} strokeWidth={2} 
        strokeDasharray={getStrokeDash(strokeStyle)}
      />
      {label && <text y={rOuter + 22} textAnchor="middle" fill={c.text} fontSize={12} fontWeight="bold">{label}</text>}
    </AW>
  );
};

export const HexagonShape = ({ x, y, w, h, color, attentionLevel, layoutId, animation, label, strokeStyle = "solid", fill, isSelected, onUpdate, onDelete, rotation }) => {
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
        points={points.join(" ")} fill={fill === "none" ? "none" : c.glass} stroke={c.stroke} strokeWidth={2} 
        strokeDasharray={getStrokeDash(strokeStyle)}
      />
      {label && <text y={rh + 22} textAnchor="middle" fill={c.text} fontSize={12} fontWeight="bold">{label}</text>}
    </AW>
  );
};

export const CartesianAxes = ({
  x, y, color, label, attentionLevel, layoutId, animation,
}) => {
  const c = resolve(color || "gray");
  const w = 380, h = 280;
  const ticks = [-3, -2, -1, 0, 1, 2, 3];
  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={t * (w / 8)} y1={-h / 2} x2={t * (w / 8)} y2={h / 2} stroke="#334155" strokeWidth={0.5} />
          <line x1={-w / 2} y1={t * (h / 8)} x2={w / 2} y2={t * (h / 8)} stroke="#334155" strokeWidth={0.5} />
        </g>
      ))}
      <line x1={-w / 2} y1={0} x2={w / 2} y2={0} stroke={c.stroke} strokeWidth={2.5} />
      <line x1={0} y1={-h / 2} x2={0} y2={h / 2} stroke={c.stroke} strokeWidth={2.5} />
      <text x={w / 2 + 12} y={4} fill={c.stroke} fontSize={13} fontWeight="700">x</text>
      <text x={6} y={-h / 2 - 10} fill={c.stroke} fontSize={13} fontWeight="700">y</text>
      {label && (
        <text y={-h / 2 - 28} textAnchor="middle" fill={c.text} fontSize={14} fontWeight="bold">{label}</text>
      )}
    </AW>
  );
};

export const GeometryPolygon = ({
  x, y, points, color, label, attentionLevel, layoutId, animation, strokeStyle = "solid", fill = "none",
}) => {
  const c = resolve(color);
  const pts = Array.isArray(points) && points.length > 2 ? points : [[0, 0], [60, 100], [-60, 100]];
  const pstr = pts.map((p) => `${p[0]},${p[1]}`).join(" ");
  const getFill = () => {
    if (fill === "glass") return c.glass;
    if (fill === "subtle") return `${c.fill}22`;
    return "none";
  };
  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y}>
      <polygon points={pstr} fill={getFill()} stroke={c.stroke} strokeWidth={attentionLevel === 2 ? 3 : 2} />
      {label && (
        <text y={pts[0][1] - 18} textAnchor="middle" fill={c.text} fontSize={13} fontWeight="bold">{label}</text>
      )}
    </AW>
  );
};
