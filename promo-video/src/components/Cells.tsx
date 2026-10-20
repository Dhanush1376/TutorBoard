import React from 'react';
import { color, fonts } from '../theme';

/**
 * A single array cell drawn in the canvas engine's own style
 * (client/src/engine/canvas/ArrayPlugin.ts): glassy dark tile, faint stroke.
 * Used only for transitions that carry the real cells in or out of a shot.
 */
export const CellTile: React.FC<{
  x: number; y: number; size: number; value: string | number;
  frameOpacity?: number; textScale?: number; glow?: number; opacity?: number;
}> = ({ x, y, size, value, frameOpacity = 1, textScale = 1, glow = 0, opacity = 1 }) => (
  <div
    style={{
      position: 'absolute',
      left: x - size / 2,
      top: y - size / 2,
      width: size,
      height: size,
      opacity,
    }}
  >
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: size * 0.22,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.02))',
        border: `${Math.max(1, size / 80)}px solid rgba(255,255,255,0.14)`,
        boxShadow: `0 ${size * 0.12}px ${size * 0.3}px rgba(0,0,0,0.5)${glow > 0 ? `, 0 0 ${size * 0.6}px rgba(245,165,36,${0.45 * glow})` : ''}`,
        opacity: frameOpacity,
      }}
    />
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: fonts.sans,
        fontWeight: 500,
        fontSize: size * 0.36 * textScale,
        color: color.ink,
        letterSpacing: '-0.02em',
      }}
    >
      {value}
    </div>
  </div>
);
