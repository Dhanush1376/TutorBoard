import React, { useId } from 'react';
import { STROKE_PATH } from './VisaiLogo';

/**
 * TutorBoard loader: the Stroke Tile, looping. The line is drawn through the
 * tile, the amber point lands, then the line lifts off and is drawn again.
 * Flat ink and one amber point; no glow, blur or gradients.
 * Runs on CSS keyframes (see `.tb-loader` in index.css), so it keeps moving
 * while the main thread is busy loading.
 *
 * `autoFade` is accepted for older callers and ignored.
 */
// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
const Loader = ({ fullScreen = true, glass = true, size = 56, autoFade, label = 'Loading' }) => {
  const id = `tb-loader-${useId().replace(/:/g, '')}`;
  const showTrack = size >= 40;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={`${fullScreen ? 'fixed inset-0 z-[1000]' : 'relative'} flex items-center justify-center text-[var(--text-primary)]`}
      style={{
        backgroundColor: fullScreen ? (glass ? 'rgba(var(--bg-primary-rgb), 0.9)' : 'var(--bg-primary)') : 'transparent',
      }}
    >
      <div className="tb-loader flex flex-col items-center gap-5">
        <svg width={size} height={size} viewBox="4 4 56 56" aria-hidden="true" className="block overflow-visible">
          <defs>
            <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
              <rect width="64" height="64" fill="white" />
              <path className="tb-loader-line" d={STROKE_PATH} pathLength="1" fill="none" stroke="black" strokeWidth="5.2" strokeLinecap="round" />
            </mask>
          </defs>
          <rect x="5" y="5" width="54" height="54" rx="16" fill="currentColor" mask={`url(#${id})`} />
          <circle className="tb-loader-dot" cx="46.5" cy="23" r="4.6" fill="var(--mk-accent, #e08a0b)" />
        </svg>
        {showTrack && (
          <span className="relative block h-px overflow-hidden bg-[var(--st-line-strong)]" style={{ width: Math.round(size * 0.9) }}>
            <span className="tb-loader-track absolute inset-y-0 left-0 w-1/3 bg-[var(--text-primary)]" />
          </span>
        )}
      </div>
    </div>
  );
};

export default Loader;
