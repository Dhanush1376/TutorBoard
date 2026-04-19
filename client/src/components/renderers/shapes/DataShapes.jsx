import React, { useId } from "react";
import { motion } from "framer-motion";
import { resolve, AW } from "./ShapeUtils";

export const DataBlock = ({
  x, y, values = [], label, color, attentionLevel, layoutId, animation, fontFamily, fontWeight, fontStyle, textDecoration,
}) => {
  const c = resolve(color);
  const cw = 56, ch = 52;
  const totalW = values.length * cw;
  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y}>
      {label && (
        <text y={-ch / 2 - 18} textAnchor="middle" fill="#e2e8f0" fontSize={13} fontWeight="800">{label}</text>
      )}
      {values.map((val, i) => {
        const bx = i * cw - totalW / 2 + cw / 2;
        const isActive = attentionLevel === 2 && i === 0;
        return (
          <g key={i}>
            <rect
              x={bx - cw / 2 + 2} y={-ch / 2 + 2} width={cw - 4} height={ch - 4} rx={8}
              fill={isActive ? c.glass : "rgba(30,41,59,0.85)"} stroke={c.stroke} strokeWidth={isActive ? 2 : 1}
            />
            <text
              x={bx} y={0} textAnchor="middle" dominantBaseline="central"
              fill={isActive ? c.text : "rgba(255,255,255,0.4)"}
              fontSize={17} fontWeight={fontWeight || "800"} fontFamily={fontFamily || "monospace"}
              fontStyle={fontStyle || "normal"} textDecoration={textDecoration || "none"}
            >
              {val}
            </text>
          </g>
        );
      })}
    </AW>
  );
};

export const FlowPointer = ({ x, y, color, label, attentionLevel, layoutId, animation }) => {
  const c = resolve(color);
  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y}>
      <polygon points="0,-18 -8,0 8,0" fill={c.stroke} />
      <rect x={-18} y={4} width={36} height={22} rx={6} fill={c.stroke} />
      <text y={15} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={11} fontWeight="900">
        {label || "i"}
      </text>
    </AW>
  );
};

export const DataDot = ({ x, y, color, label, attentionLevel, layoutId, animation }) => {
  const c = resolve(color);
  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y}>
      <circle r={attentionLevel === 2 ? 10 : 7} fill={c.stroke} />
      {label && (
        <text y={20} textAnchor="middle" fill={c.text} fontSize={10} fontWeight="bold">{label}</text>
      )}
    </AW>
  );
};

export const TreeNode = ({
  x, y, label, color, attentionLevel, layoutId, animation, fontFamily, fontWeight, fontStyle, textDecoration,
}) => {
  const c = resolve(color || "blue");
  const r = attentionLevel === 2 ? 32 : 28;
  const uid = useId().replace(/:/g, "");
  const gid = `tn-${uid}`;

  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y}>
      <defs>
        <radialGradient id={gid} cx="38%" cy="38%" r="72%">
          <stop offset="0%" stopColor={c.text} stopOpacity="0.5" />
          <stop offset="100%" stopColor={c.fill} stopOpacity="1" />
        </radialGradient>
      </defs>
      {attentionLevel === 2 && (
        <circle r={r + 10} fill="none" stroke={c.glow} strokeWidth={1.5}>
          <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="6s" repeatCount="indefinite" />
        </circle>
      )}
      <circle r={r} fill={`url(#${gid})`} stroke={c.stroke} strokeWidth={attentionLevel === 2 ? 2.5 : 1.5} />
      <text
        textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={14} fontWeight={fontWeight || "900"}
        fontFamily={fontFamily || "monospace"} fontStyle={fontStyle || "normal"} textDecoration={textDecoration || "none"}
      >
        {label}
      </text>
    </AW>
  );
};

export const BarShape = ({ x, y, label, color, attentionLevel, layoutId, animation, scale = 1 }) => {
  const c = resolve(color || "blue");
  const baseH = 160;
  const bw = 44;
  const bh = Math.max(20, baseH * Math.min(2, Math.max(0.05, scale)));

  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y}>
      <rect
        x={-bw / 2} y={-bh} width={bw} height={bh} rx={6}
        fill={attentionLevel === 2 ? c.fill : c.glass} stroke={c.stroke}
        strokeWidth={attentionLevel === 2 ? 2.5 : 1.5}
      />
      {label && (
        <text y={-bh - 12} textAnchor="middle" fill={c.stroke} fontSize={12} fontWeight="800">{label}</text>
      )}
    </AW>
  );
};
