import React from 'react';
import { useCurrentFrame } from 'remotion';
import { easeInOut, prog } from '../lib/anim';
import { Cam, toScreen } from './UIShot';

export type Waypoint = { f: number; x: number; y: number };

/**
 * Virtual pointer. Headless capture has no cursor, so the film draws one and
 * moves it to the real element positions recorded during capture.
 * Waypoints are app CSS px when `cam` is given (so the pointer stays on its
 * target while the camera moves), otherwise composition px.
 */
export const Cursor: React.FC<{
  path: Waypoint[];
  clicks?: number[];
  opacity?: number;
  scale?: number;
  cam?: Cam;
}> = ({ path, clicks = [], opacity = 1, scale = 1, cam }) => {
  const frame = useCurrentFrame();
  let x = path[0].x;
  let y = path[0].y;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    if (frame >= a.f) {
      const t = prog(frame, a.f, b.f - a.f, easeInOut);
      // gentle arc: hands don't move in straight lines
      const arc = Math.sin(t * Math.PI) * Math.min(60, Math.hypot(b.x - a.x, b.y - a.y) * 0.12);
      x = a.x + (b.x - a.x) * t;
      y = a.y + (b.y - a.y) * t - arc;
    }
  }
  if (cam) ({ x, y } = toScreen(cam, { x, y }));
  const press = clicks.reduce((acc, c) => {
    const d = frame - c;
    return d >= 0 && d < 8 ? Math.max(acc, 1 - Math.abs(d - 2) / 6) : acc;
  }, 0);
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity }}>
      {clicks.map((c) => {
        const d = frame - c;
        if (d < 0 || d > 22) return null;
        const t = d / 22;
        return (
          <div
            key={c}
            style={{
              position: 'absolute',
              left: x - 30 * scale,
              top: y - 30 * scale,
              width: 60 * scale,
              height: 60 * scale,
              borderRadius: '50%',
              border: `${1.5 * scale}px solid rgba(242,240,234,${0.55 * (1 - t)})`,
              transform: `scale(${0.3 + t * 1.1})`,
            }}
          />
        );
      })}
      <svg
        width={30 * scale}
        height={30 * scale}
        viewBox="0 0 24 24"
        style={{
          position: 'absolute',
          left: x - 3 * scale,
          top: y - 2 * scale,
          transform: `scale(${1 - press * 0.16})`,
          transformOrigin: '3px 2px',
          filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.55))',
        }}
      >
        <path
          d="M4.2 2.4 L19.6 13.1 L12.4 14.3 L16.4 21.2 L13.6 22.6 L9.7 15.7 L4.6 20.6 Z"
          fill="#F7F6F2"
          stroke="#0A0A0A"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};
