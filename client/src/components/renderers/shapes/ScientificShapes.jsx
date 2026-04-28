import React, { useId, useRef, useEffect } from "react";
import katex from "katex";
import { resolve } from "./ShapeUtils";
import { AW } from "./AnimatedWrapper";

export const EquationBlock = ({
  x, y, label, content, color, attentionLevel, layoutId, animation, styles = {},
}) => {
  const c = resolve(color || "cyan");
  const text = content || label || "";
  const containerRef = useRef(null);
  const w = Math.max(160, text.length * 11 + 64);
  const h = 64;

  useEffect(() => {
    if (containerRef.current && text) {
      try {
        katex.render(text || "\\text{Type LaTeX here...}", containerRef.current, {
          throwOnError: false, displayMode: true,
        });
      } catch (err) { console.error("KaTeX error:", err); }
    }
  }, [text]);

  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={12} 
            fill={attentionLevel === 2 ? c.glass : "rgba(15,23,42,0.75)"}
            stroke={c.stroke} strokeWidth={attentionLevel === 2 ? 2.5 : 1}
            filter={attentionLevel === 2 ? "url(#tb-neon-glow)" : "none"} />
      <foreignObject x={-w / 2 + 10} y={-h / 2 + 5} width={w - 20} height={h - 10} pointerEvents="none">
        <div ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: attentionLevel === 2 ? c.text : "#94a3b8", fontSize: (styles.fontSize || 18) + 'px' }} />
      </foreignObject>
    </AW>
  );
};

export const MoleculeNode = ({
  x, y, label, color, attentionLevel, layoutId, animation, fontFamily, fontWeight, fontStyle, textDecoration,
}) => {
  const c = resolve(color || "green");
  const text = label || "";
  const w = Math.max(56, text.length * 11 + 24);
  const uid = useId().replace(/:/g, "");
  const gid = `mol-${uid}`;

  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y}>
      <defs>
        <radialGradient id={gid} cx="35%" cy="35%" r="70%">
          <stop offset="0%" stopColor={c.text} stopOpacity="0.4" />
          <stop offset="100%" stopColor={c.fill} stopOpacity="0.9" />
        </radialGradient>
      </defs>
      {attentionLevel === 2 && (
        <circle r={w / 2 + 10} fill="none" stroke={c.glow} strokeWidth={1.5}>
          <animate attributeName="r" values={`${w/2+8};${w/2+16};${w/2+8}`} dur="2s" repeatCount="indefinite" />
        </circle>
      )}
      <ellipse rx={w / 2} ry={24} fill={`url(#${gid})`} stroke={c.stroke} strokeWidth={attentionLevel === 2 ? 2.5 : 1.5} />
      <text textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={14} fontWeight={fontWeight || "900"} fontFamily={fontFamily || "'Courier New', monospace"}>{text}</text>
    </AW>
  );
};

export const LabelText = ({ x, y, label, content, color, attentionLevel, layoutId, animation, styles = {} }) => {
  const c = resolve(color || "white");
  const text = content || label || "";
  const opacity = attentionLevel === 0 ? 0.2 : attentionLevel === 2 ? 1 : 0.75;
  return (
    <AW attentionLevel={attentionLevel} layoutId={layoutId} animation={animation} cx={x} cy={y}>
      {styles.backgroundColor && styles.backgroundColor !== 'transparent' && (
        <rect x={-((text.length * (styles.fontSize || 14) * 0.6) / 2) - 4} y={-(styles.fontSize || 14) / 1.5} width={(text.length * (styles.fontSize || 14) * 0.6) + 8} height={(styles.fontSize || 14) * 1.4} fill={styles.backgroundColor} rx={4} opacity={opacity} />
      )}
      <text textAnchor="middle" dominantBaseline="central" fill={styles.color || c.stroke} fontSize={styles.fontSize || 14} fontWeight={styles.fontWeight || "600"} opacity={opacity} fontFamily={styles.fontFamily || "system-ui, sans-serif"}>{text}</text>
    </AW>
  );
};
