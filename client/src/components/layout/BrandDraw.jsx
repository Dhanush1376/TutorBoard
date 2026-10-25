import React, { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { STROKE_PATH } from './VisaiLogo';

const EASE = [0.22, 1, 0.36, 1];

/**
 * The Stroke Tile mark, drawing itself: the tile settles in, the line is
 * drawn through it, and the amber point lands where the line ends.
 * `delay` shifts the whole sequence (seconds).
 */
const BrandDraw = ({ size = 120, delay = 0, className = '' }) => {
  const id = `tb-draw-${useId().replace(/:/g, '')}`;
  const reduce = useReducedMotion();
  const d = (t) => (reduce ? 0 : delay + t);

  // Mount path and dot strictly when their animation time arrives, avoiding any sub-millisecond initial cap paint
  const [strokeStarted, setStrokeStarted] = React.useState(reduce);
  const [dotStarted, setDotStarted] = React.useState(reduce);

  React.useEffect(() => {
    if (reduce) return;
    const strokeTimer = setTimeout(() => setStrokeStarted(true), Math.max(0, d(0.35) * 1000));
    const dotTimer = setTimeout(() => setDotStarted(true), Math.max(0, d(1.02) * 1000));
    return () => {
      clearTimeout(strokeTimer);
      clearTimeout(dotTimer);
    };
  }, [delay, reduce]);

  return (
    <span className={`inline-flex shrink-0 text-[var(--text-primary)] ${className}`}>
      <svg width={size} height={size} viewBox="4 4 56 56" aria-hidden="true" className="block overflow-visible">
        <defs>
          <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
            <rect width="64" height="64" fill="white" />
            {strokeStarted && (
              <motion.path
                d={STROKE_PATH}
                fill="none"
                stroke="black"
                strokeWidth="5.2"
                strokeLinecap="round"
                initial={{ pathLength: reduce ? 1 : 0 }}
                animate={{ pathLength: 1 }}
                transition={{
                  duration: reduce ? 0 : 0.75,
                  ease: [0.65, 0, 0.35, 1],
                }}
              />
            )}
          </mask>
        </defs>
        <motion.rect
          x="5"
          y="5"
          width="54"
          height="54"
          rx="16"
          fill="currentColor"
          mask={strokeStarted ? `url(#${id})` : undefined}
          initial={reduce ? false : { opacity: 0, scale: 0.86 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: EASE, delay: d(0) }}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        />
        {dotStarted && (
          <motion.circle
            cx="46.5"
            cy="23"
            r="4.6"
            fill="var(--mk-accent, #e08a0b)"
            initial={reduce ? false : { scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 420, damping: 16 }}
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          />
        )}
      </svg>
    </span>
  );
};

export default BrandDraw;
