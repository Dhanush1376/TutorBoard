import React from 'react';
import { AbsoluteFill, Img } from 'remotion';
import { color, HEIGHT, WIDTH } from '../theme';

/** Virtual camera over the captured UI: the UI point (x, y) in CSS px of the
 *  1920×1080 app sits at the centre of frame, magnified by z. */
export type Cam = { x: number; y: number; z: number };

export const FULL: Cam = { x: WIDTH / 2, y: HEIGHT / 2, z: 1 };

/** Map a point in app CSS px to composition px for a camera (no tilt). */
export const toScreen = (cam: Cam, p: { x: number; y: number }) => ({
  x: WIDTH / 2 + (p.x - cam.x) * cam.z,
  y: HEIGHT / 2 + (p.y - cam.y) * cam.z,
});

export const lerpCam = (a: Cam, b: Cam, t: number): Cam => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  // zoom interpolates in log space so push-ins feel constant-speed
  z: Math.exp(Math.log(a.z) + (Math.log(b.z) - Math.log(a.z)) * t),
});

/** Camera that frames a rect (app CSS px) with some breathing room. */
export const frameRect = (r: { x: number; y: number; w: number; h: number }, fill = 0.7): Cam => {
  const z = Math.min((WIDTH * fill) / r.w, (HEIGHT * fill) / r.h);
  return { x: r.x + r.w / 2, y: r.y + r.h / 2, z };
};

type Props = {
  src: string;
  cam: Cam;
  /** degrees; tilt pivots around the camera centre */
  rotX?: number;
  rotY?: number;
  /** corner radius of the app "screen" in app px (scaled with zoom) */
  radius?: number;
  opacity?: number;
  /** soft focus for depth-of-field moments */
  blur?: number;
  brightness?: number;
  children?: React.ReactNode;
};

/**
 * Real-interface layer. Zoom is applied through layout size rather than a CSS
 * scale so Chrome samples the 4K capture directly — macro shots stay sharp.
 */
export const UIShot: React.FC<Props> = ({
  src, cam, rotX = 0, rotY = 0, radius = 14, opacity = 1, blur = 0, brightness = 1, children,
}) => {
  const w = WIDTH * cam.z;
  const h = HEIGHT * cam.z;
  const left = WIDTH / 2 - cam.x * cam.z;
  const top = HEIGHT / 2 - cam.y * cam.z;
  const tilted = rotX !== 0 || rotY !== 0;
  return (
    <AbsoluteFill style={{ perspective: 2600, perspectiveOrigin: '50% 50%', opacity }}>
      <AbsoluteFill
        style={{
          transformOrigin: `${WIDTH / 2}px ${HEIGHT / 2}px`,
          transform: tilted ? `rotateX(${rotX}deg) rotateY(${rotY}deg)` : undefined,
          transformStyle: 'preserve-3d',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left,
            top,
            width: w,
            height: h,
            borderRadius: radius * cam.z,
            overflow: 'hidden',
            boxShadow: cam.z < 1
              ? `0 ${60 * cam.z}px ${160 * cam.z}px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.14), 0 0 ${180 * cam.z}px rgba(242,240,234,0.07)`
              : undefined,
            filter: blur > 0.05 || brightness !== 1 ? `blur(${blur}px) brightness(${brightness})` : undefined,
            backgroundColor: color.bg,
          }}
        >
          <Img src={src} style={{ width: w, height: h, display: 'block' }} />
        </div>
      </AbsoluteFill>
      {children}
    </AbsoluteFill>
  );
};
