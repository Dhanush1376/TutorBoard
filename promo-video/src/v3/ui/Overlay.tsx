import React from 'react';
import { useCurrentFrame } from 'remotion';
import { Cam, toScreen } from '../../components/UIShot';
import { easeIn, easeOut, prog } from '../../lib/anim';
import { fonts } from '../../theme';

/**
 * Lower-third caption: a short line that rises in word by word and leaves as
 * one piece. Screen space, so it stays put while the camera moves.
 */
export const Caption: React.FC<{
  text: string; inAt: number; outAt: number; x?: number; y?: number; size?: number; align?: 'left' | 'center'; dim?: string[];
}> = ({ text, inAt, outAt, x = 118, y = 900, size = 58, align = 'left', dim = [] }) => {
  const frame = useCurrentFrame();
  if (frame < inAt - 2 || frame > outAt + 14) return null;
  const out = prog(frame, outAt, 12, easeIn);
  const words = text.split(' ');
  return (
    <div
      style={{
        position: 'absolute', left: align === 'center' ? 0 : x, right: align === 'center' ? 0 : undefined, top: y - size,
        display: 'flex', justifyContent: align === 'center' ? 'center' : 'flex-start', gap: size * 0.24,
        fontFamily: fonts.sans, fontSize: size, fontWeight: 600, letterSpacing: '-0.035em', color: '#F4F3EE',
        opacity: 1 - out, transform: `translateY(${-out * 14}px)`, filter: out > 0.01 ? `blur(${out * 8}px)` : undefined,
        textShadow: '0 4px 30px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.6)',
      }}
    >
      {words.map((w, i) => {
        const t = prog(frame, inAt + i * 3, 16, easeOut);
        return (
          <span key={i} style={{ display: 'inline-block', opacity: t, transform: `translateY(${(1 - t) * size * 0.35}px)`, filter: t < 0.98 ? `blur(${(1 - t) * 10}px)` : undefined, color: dim.includes(w) ? 'rgba(244,243,238,0.55)' : undefined }}>
            {w}
          </span>
        );
      })}
    </div>
  );
};

/** Soft dark gradient that keeps lower-third captions legible over the UI. */
export const CaptionScrim: React.FC<{ opacity: number }> = ({ opacity }) => (
  <div style={{ position: 'absolute', inset: 0, opacity, background: 'linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,0.62) 100%)', pointerEvents: 'none' }} />
);

/**
 * Product-tour label: a hairline from an app-px anchor to a mono label.
 * Used to name the controls the first time we see them.
 */
export const Callout: React.FC<{ cam: Cam; anchor: { x: number; y: number }; dx: number; dy: number; text: string; inAt: number; outAt: number }> = ({
  cam, anchor, dx, dy, text, inAt, outAt,
}) => {
  const frame = useCurrentFrame();
  const t = prog(frame, inAt, 14, easeOut) * (1 - prog(frame, outAt, 10, easeIn));
  if (t <= 0.001) return null;
  const a = toScreen(cam, anchor);
  const b = { x: a.x + dx, y: a.y + dy };
  const len = Math.hypot(dx, dy);
  return (
    <>
      <svg style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} width={1} height={1}>
        <circle cx={a.x} cy={a.y} r={5 * t} fill="#F4F3EE" opacity={0.95} />
        <circle cx={a.x} cy={a.y} r={5 + 10 * t} fill="none" stroke="#F4F3EE" strokeOpacity={0.3 * t} />
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#F4F3EE" strokeOpacity={0.7} strokeWidth={1.5} strokeDasharray={`${len * t} ${len}`} />
      </svg>
      <div
        style={{
          position: 'absolute', left: b.x - 200, width: 400, top: b.y + (dy < 0 ? -40 : 10), textAlign: 'center',
          fontFamily: fonts.mono, fontSize: 19, fontWeight: 500, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#F4F3EE',
          opacity: prog(frame, inAt + 6, 10) * (1 - prog(frame, outAt, 10, easeIn)), textShadow: '0 2px 16px rgba(0,0,0,0.9)',
        }}
      >
        {text}
      </div>
    </>
  );
};
