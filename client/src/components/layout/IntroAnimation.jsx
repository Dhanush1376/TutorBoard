import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import BrandDraw from './BrandDraw';

const EASE = [0.22, 1, 0.36, 1];

/**
 * First-visit intro (about 2 s, unmounted by App): the Stroke Tile draws itself,
 * then the name settles in beside it, in the same lockup used across the app.
 */
const IntroAnimation = () => {
  const reduce = useReducedMotion();
  return (
    <motion.div
      role="status"
      aria-label="Loading TutorBoard"
      className="fixed inset-0 z-[2000] grid select-none place-items-center overflow-hidden bg-[var(--bg-primary)] font-sans text-[var(--text-primary)]"
      initial={{ opacity: 1 }}
      animate={{ opacity: reduce ? 1 : [1, 1, 0] }}
      transition={{ duration: 2, times: [0, 0.82, 1], ease: 'easeInOut' }}
    >
      <div className="relative flex items-center gap-4 sm:gap-5">
        <BrandDraw size={56} delay={0.05} />
        <motion.span
          className="text-[clamp(1.6rem,3.6vw,2.3rem)] font-medium leading-none tracking-[-0.03em]"
          initial={reduce ? false : { opacity: 0, x: -10, clipPath: 'inset(0 100% 0 0)' }}
          animate={{ opacity: 1, x: 0, clipPath: 'inset(0 0% 0 0)' }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.75 }}
        >
          TutorBoard
        </motion.span>
      </div>
    </motion.div>
  );
};

export default IntroAnimation;
