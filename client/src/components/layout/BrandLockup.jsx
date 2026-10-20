import React from 'react';
import VisaiLogo from './VisaiLogo';

/**
 * The one TutorBoard lockup: Stroke Tile mark + "TutorBoard" in Geist,
 * 14px, medium weight, tight tracking, normal case. Use it wherever the
 * name sits next to the mark so the brand reads the same everywhere.
 */
const BrandLockup = ({ className = '', size = 'sm' }) => (
  <span className={`inline-flex items-center gap-2.5 font-sans text-[var(--text-primary)] ${className}`}>
    <VisaiLogo size={size} />
    <span className="text-[14px] font-medium leading-none tracking-[-0.02em]">TutorBoard</span>
  </span>
);

export default BrandLockup;
