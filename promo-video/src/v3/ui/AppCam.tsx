import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Cam } from '../../components/UIShot';
import { HEIGHT, WIDTH } from '../../theme';

/**
 * Virtual camera over a DOM-rendered app screen (app CSS px). Because the UI
 * is vector, Chrome re-rasterises it at the final scale — macro shots stay
 * razor sharp. Same camera model as UIShot, so the two cut together.
 */
export const AppCam: React.FC<{
  cam: Cam;
  rotX?: number;
  rotY?: number;
  opacity?: number;
  blur?: number;
  brightness?: number;
  radius?: number;
  /** screen-space motion blur (px) along x for whip pans */
  whip?: number;
  children: React.ReactNode;
  over?: React.ReactNode;
}> = ({ cam, rotX = 0, rotY = 0, opacity = 1, blur = 0, brightness = 1, radius = 14, whip = 0, children, over }) => {
  const tilted = rotX !== 0 || rotY !== 0;
  const filters: string[] = [];
  if (blur > 0.05) filters.push(`blur(${blur}px)`);
  if (brightness !== 1) filters.push(`brightness(${brightness})`);
  const id = React.useId().replace(/[^a-zA-Z0-9_-]/g, '');
  if (whip > 0.3) filters.push(`url(#whip${id})`);
  return (
    <AbsoluteFill style={{ perspective: 2600, perspectiveOrigin: '50% 50%', opacity }}>
      {whip > 0.3 && (
        <svg width={0} height={0} style={{ position: 'absolute' }}>
          <filter id={`whip${id}`} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation={`${whip} 0`} />
          </filter>
        </svg>
      )}
      <AbsoluteFill
        style={{
          transformOrigin: `${WIDTH / 2}px ${HEIGHT / 2}px`,
          transform: tilted ? `rotateX(${rotX}deg) rotateY(${rotY}deg)` : undefined,
          transformStyle: 'preserve-3d',
          filter: filters.length ? filters.join(' ') : undefined,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: WIDTH,
            height: HEIGHT,
            transformOrigin: '0 0',
            transform: `translate(${WIDTH / 2 - cam.x * cam.z}px, ${HEIGHT / 2 - cam.y * cam.z}px) scale(${cam.z})`,
            borderRadius: radius,
            overflow: 'hidden',
            boxShadow: cam.z < 1
              ? '0 60px 160px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.14), 0 0 180px rgba(242,240,234,0.07)'
              : undefined,
          }}
        >
          {children}
        </div>
      </AbsoluteFill>
      {over}
    </AbsoluteFill>
  );
};
