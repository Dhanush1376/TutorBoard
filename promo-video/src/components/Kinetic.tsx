import React from 'react';
import { useCurrentFrame } from 'remotion';
import { easeIn, easeOut, prog } from '../lib/anim';
import { color, fonts } from '../theme';

type Word = string | { text: string; color?: string; italic?: boolean };

/**
 * A line that arrives word by word (rise + unblur) and leaves as one piece.
 * `inAt` / `outAt` are frames relative to the enclosing Sequence.
 */
export const Line: React.FC<{
  words: Word[];
  inAt: number;
  outAt?: number;
  size?: number;
  weight?: number;
  stagger?: number;
  tracking?: number;
  align?: 'center' | 'left';
  style?: React.CSSProperties;
  dim?: number;
}> = ({ words, inAt, outAt = 1e9, size = 84, weight = 500, stagger = 4, tracking = -0.035, align = 'center', style, dim = 1 }) => {
  const frame = useCurrentFrame();
  const out = prog(frame, outAt, 14, easeIn);
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: align === 'center' ? 'center' : 'flex-start',
        gap: `0 ${size * 0.26}px`,
        fontFamily: fonts.sans,
        fontSize: size,
        fontWeight: weight,
        letterSpacing: `${tracking}em`,
        lineHeight: 1.08,
        color: color.ink,
        opacity: (1 - out) * dim,
        transform: `translateY(${-out * size * 0.18}px)`,
        filter: out > 0.01 ? `blur(${out * 10}px)` : undefined,
        ...style,
      }}
    >
      {words.map((w, i) => {
        const t = prog(frame, inAt + i * stagger, 22, easeOut);
        const word = typeof w === 'string' ? { text: w } : w;
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              opacity: t,
              transform: `translateY(${(1 - t) * size * 0.32}px)`,
              filter: t < 0.99 ? `blur(${(1 - t) * 12}px)` : undefined,
              color: word.color,
              fontStyle: word.italic ? 'italic' : undefined,
            }}
          >
            {word.text}
          </span>
        );
      })}
    </div>
  );
};

/** Small uppercase label, tracked wide — TutorBoard's microcopy voice. */
export const Label: React.FC<{ children: React.ReactNode; opacity?: number; style?: React.CSSProperties }> = ({
  children, opacity = 1, style,
}) => (
  <div
    style={{
      fontFamily: fonts.sans,
      fontSize: 15,
      fontWeight: 600,
      letterSpacing: '0.32em',
      textTransform: 'uppercase',
      color: color.inkDim,
      opacity,
      ...style,
    }}
  >
    {children}
  </div>
);
