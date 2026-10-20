import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { color } from '../theme';

/** TutorBoard's dot-grid canvas texture, breathing very slightly. */
export const DotGrid: React.FC<{ opacity?: number; spacing?: number; drift?: number; alpha?: number }> = ({
  opacity = 1, spacing = 30, drift = 0.15, alpha = 0.16,
}) => {
  const frame = useCurrentFrame();
  const id = React.useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const off = (frame * drift) % spacing;
  return (
    <AbsoluteFill style={{ opacity }}>
      <svg width="100%" height="100%">
        <defs>
          <pattern id={`dots${id}`} width={spacing} height={spacing} patternUnits="userSpaceOnUse" x={off} y={off * 0.5}>
            <circle cx={spacing / 2} cy={spacing / 2} r={1.15} fill={`rgba(242,240,234,${alpha})`} />
          </pattern>
          <radialGradient id={`dm${id}`} cx="50%" cy="50%" r="62%">
            <stop offset="0%" stopColor="#fff" stopOpacity="1" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id={`m${id}`}>
            <rect width="100%" height="100%" fill={`url(#dm${id})`} />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill={`url(#dots${id})`} mask={`url(#m${id})`} />
      </svg>
    </AbsoluteFill>
  );
};

/** Base background: near-black with a soft top light and vignette. */
export const Backdrop: React.FC<{ dots?: number; glow?: number; dotAlpha?: number }> = ({ dots = 1, glow = 1, dotAlpha }) => (
  <AbsoluteFill style={{ backgroundColor: color.bg }}>
    <AbsoluteFill
      style={{
        opacity: glow,
        background: 'radial-gradient(ellipse 70% 55% at 50% 38%, rgba(242,240,234,0.055) 0%, rgba(0,0,0,0) 70%)',
      }}
    />
    <DotGrid opacity={dots} alpha={dotAlpha} />
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)' }} />
  </AbsoluteFill>
);

/** Fine animated grain — keeps large dark fields from banding. */
export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.06 }) => {
  const frame = useCurrentFrame();
  const id = React.useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <AbsoluteFill style={{ opacity, mixBlendMode: 'overlay', pointerEvents: 'none' }}>
      <svg width="100%" height="100%">
        <filter id={`grain${id}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={frame % 24} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain${id})`} />
      </svg>
    </AbsoluteFill>
  );
};
