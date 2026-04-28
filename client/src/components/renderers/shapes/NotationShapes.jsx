import React, { useId } from "react";
import { motion } from "framer-motion";
import { resolve, getStrokeDash } from "./ShapeUtils";
import { AW } from "./AnimatedWrapper";

export const FlowArrow = ({
  x1, y1, x2, y2, color, label, attentionLevel, layoutId, strokeStyle = "solid", animation, isSelected, onUpdate, onDelete,
}) => {
  const c = resolve(color);
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const uid = useId().replace(/:/g, "");
  const mid = `m-${layoutId}-${uid}`;
  return (
    <AW
      attentionLevel={attentionLevel} layoutId={layoutId} cx={mx} cy={my}
      w={Math.max(40, Math.abs(x2 - x1))} h={Math.max(40, Math.abs(y2 - y1))}
      animation={animation} isSelected={isSelected} onUpdate={onUpdate} onDelete={onDelete}
    >
      <defs>
        <marker id={mid} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0L10 5L0 10z" fill={c.stroke} />
        </marker>
      </defs>
      <motion.line
        x1={x1 - mx} y1={y1 - my} x2={x2 - mx} y2={y2 - my}
        stroke={c.stroke} strokeWidth={2.5} strokeDasharray={getStrokeDash(strokeStyle)}
        markerEnd={`url(#${mid})`}
        initial={animation?.type === "draw" ? { pathLength: 0 } : {}}
        animate={animation?.type === "draw" ? { pathLength: 1 } : {}}
        transition={{ duration: animation?.duration || 0.5, delay: animation?.delay || 0 }}
      />
      {label && <text y={-12} textAnchor="middle" fill="#94a3b8" fontSize={11}>{label}</text>}
    </AW>
  );
};

export const RawLine = ({
  x1, y1, x2, y2, color, label, attentionLevel, layoutId, strokeStyle = "solid", animation, isSelected, onUpdate, onDelete,
}) => {
  const c = resolve(color);
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  return (
    <AW
      attentionLevel={attentionLevel} layoutId={layoutId} cx={mx} cy={my}
      w={Math.max(40, Math.abs(x2 - x1))} h={Math.max(40, Math.abs(y2 - y1))}
      animation={animation} isSelected={isSelected} onUpdate={onUpdate} onDelete={onDelete}
    >
      <motion.line
        x1={x1 - mx} y1={y1 - my} x2={x2 - mx} y2={y2 - my}
        stroke={c.stroke} strokeWidth={2} strokeDasharray={getStrokeDash(strokeStyle)}
        initial={animation?.type === "draw" ? { pathLength: 0 } : {}}
        animate={animation?.type === "draw" ? { pathLength: 1 } : {}}
        transition={{ duration: animation?.duration || 0.5, delay: animation?.delay || 0 }}
      />
      {label && <text y={-10} textAnchor="middle" fill="#94a3b8" fontSize={11}>{label}</text>}
    </AW>
  );
};

export const SwapBridge = ({ x, y, color, attentionLevel, layoutId, animation }) => {
  const c = resolve(color);
  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y}>
      <motion.path
        d="M-50,0 Q0,-55 50,0" fill="none" stroke={c.stroke} strokeWidth={3}
        animate={attentionLevel === 2 ? { strokeDashoffset: [0, -18] } : {}}
        transition={{ duration: 0.6, repeat: Infinity, ease: "linear" }}
      />
      <circle cx={-50} cy={0} r={5} fill={c.stroke} />
      <circle cx={50} cy={0} r={5} fill={c.stroke} />
    </AW>
  );
};

export const Comparator = ({
  x, y, leftVal, rightVal, operator, result, color, attentionLevel, layoutId, animation,
}) => {
  const isTrue = String(result).toLowerCase() === "true";
  const c = resolve(isTrue ? "red" : "green");
  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y}>
      <rect x={-100} y={-24} width={200} height={48} rx={24} fill={c.glass} stroke={c.stroke} strokeWidth={attentionLevel === 2 ? 2.5 : 1.5} />
      <text x={-52} y={0} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={18} fontWeight="800" fontFamily="monospace">{leftVal}</text>
      <text x={0} y={0} textAnchor="middle" dominantBaseline="central" fill={c.stroke} fontSize={16} fontWeight="700">{operator}</text>
      <text x={52} y={0} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={18} fontWeight="800" fontFamily="monospace">{rightVal}</text>
    </AW>
  );
};
