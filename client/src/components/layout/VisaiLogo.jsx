import React, { useId } from 'react';

/**
 * TutorBoard mark: "Stroke Tile". A solid tile is the canvas, a single fluid
 * line is drawn through it, and it ends at an amber point.
 * The tile takes `currentColor`; the stroke is cut out, so it shows whatever
 * sits behind the mark.
 */
const DIMENSIONS = {
  xxs: 16,
  xs: 22,
  sm: 26,
  md: 32,
  lg: 44,
  xl: 72,
};

export const STROKE_PATH = 'M15 43 C 23 43, 25 22, 33 23 S 39 39, 46 24';

const VisaiLogo = ({ className = '', size = 'md', title }) => {
  const id = `tb-mark-${useId().replace(/:/g, '')}`;
  const px = typeof size === 'number' ? size : DIMENSIONS[size] || DIMENSIONS.md;

  return (
    <span className={`inline-flex shrink-0 items-center justify-center ${className}`}>
      <svg
        width={px}
        height={px}
        viewBox="4 4 56 56"
        xmlns="http://www.w3.org/2000/svg"
        role={title ? 'img' : undefined}
        aria-label={title}
        aria-hidden={title ? undefined : true}
        className="block"
      >
        <defs>
          <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
            <rect width="64" height="64" fill="white" />
            <path d={STROKE_PATH} fill="none" stroke="black" strokeWidth="5.2" strokeLinecap="round" />
          </mask>
        </defs>
        <rect x="5" y="5" width="54" height="54" rx="16" fill="currentColor" mask={`url(#${id})`} />
        <circle cx="46.5" cy="23" r="4.6" fill="var(--mk-accent, #e08a0b)" />
      </svg>
    </span>
  );
};

export default VisaiLogo;
