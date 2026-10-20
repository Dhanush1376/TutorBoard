import React from 'react';
import { useCurrentFrame } from 'remotion';
import { easeOut, prog } from '../lib/anim';

// Geometry of TutorBoard's isometric cube mark (client/src/components/layout/VisaiLogo.jsx).
const OUTER = [
  { pts: '340,90 427,140 340,190 253,140', a: 0.1, from: [0, -70] },
  { pts: '253,140 340,190 340,290 253,240', a: 0.3, from: [-80, 40] },
  { pts: '340,190 427,140 427,240 340,290', a: 0.5, from: [80, 40] },
];
const INNER = [
  { pts: '340,158 376,179 340,200 304,179', a: 0.2 },
  { pts: '304,179 340,200 340,242 304,221', a: 0.4 },
  { pts: '340,200 376,179 376,221 340,242', a: 0.8 },
];

/**
 * The cube assembles: three outer faces fold in from the directions they
 * face, then the inner cube — the "knowledge inside" — rises and lights.
 * `at` is the frame the assembly starts (relative to the Sequence).
 */
export const CubeLogo: React.FC<{ at: number; size?: number; glow?: number; fill?: string }> = ({
  at, size = 220, glow = 1, fill = '#F2F0EA',
}) => {
  const frame = useCurrentFrame();
  const inner = prog(frame, at + 26, 26, easeOut);
  const shine = prog(frame, at + 44, 30);
  return (
    <svg width={size} height={size * 1.3} viewBox="240 60 200 260" style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id="cubeGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#F5A524" stopOpacity={0.55 * glow * shine} />
          <stop offset="100%" stopColor="#F5A524" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="340" cy="205" r="120" fill="url(#cubeGlow)" />
      {OUTER.map((f, i) => {
        const t = prog(frame, at + i * 7, 28, easeOut);
        return (
          <polygon
            key={i}
            points={f.pts}
            fill={fill}
            fillOpacity={f.a * t}
            stroke={fill}
            strokeOpacity={0.35 * t * (1 - shine * 0.6)}
            strokeWidth={0.8}
            transform={`translate(${f.from[0] * (1 - t)} ${f.from[1] * (1 - t)})`}
          />
        );
      })}
      <g transform={`translate(0 ${18 * (1 - inner)})`} opacity={inner}>
        {INNER.map((f, i) => (
          <polygon key={i} points={f.pts} fill={fill} fillOpacity={f.a + (i === 2 ? 0.2 * shine : 0)} />
        ))}
      </g>
    </svg>
  );
};
