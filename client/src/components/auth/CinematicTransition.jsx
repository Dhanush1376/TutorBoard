import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import BrandDraw from '../layout/BrandDraw';

const EASE = [0.22, 1, 0.36, 1];
const HOLD = 3000; // ms on screen before leaving
const LEAVE = 450; // ms exit

/**
 * Shown once, right after sign-in or sign-up, while the workspace loads.
 * Two text groups sit on a diagonal (greeting top-left, progress bottom-right)
 * with the TutorBoard mark drawing itself between them.
 */
const CinematicTransition = ({ userName, isLogin, onComplete }) => {
  const reduce = useReducedMotion();
  const [leaving, setLeaving] = useState(false);
  const [pct, setPct] = useState(0);
  const done = useRef(false);

  // First name only; email-style names ("alex.morgan42") become "Alex".
  const first = String(userName || '').trim().split(/[\s._\-+@]+/)[0].replace(/\d+$/, '') || 'Explorer';
  const name = first.charAt(0).toUpperCase() + first.slice(1);

  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    setLeaving(true);
    setTimeout(() => onComplete?.(), LEAVE);
  }, [onComplete]);

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / HOLD);
      setPct(Math.round((1 - Math.pow(1 - t, 2.2)) * 100));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const timer = setTimeout(finish, HOLD);
    const onKey = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [finish]);

  const rise = (delay) => ({
    initial: reduce ? false : { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, ease: EASE, delay },
  });

  return (
    <motion.div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[99999] select-none overflow-hidden bg-[var(--bg-primary)] font-sans text-[var(--text-primary)]"
      initial={{ opacity: 0 }}
      animate={leaving ? { opacity: 0, scale: 1.015 } : { opacity: 1, scale: 1 }}
      transition={{ duration: leaving ? LEAVE / 1000 : 0.5, ease: EASE }}
    >
      {/* Canvas: a dot grid that fades out toward the edges. */}
      <div
        aria-hidden="true"
        className="mk-dots absolute inset-0 opacity-70"
        style={{
          maskImage: 'radial-gradient(ellipse 55% 50% at 50% 50%, #000 0%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 55% 50% at 50% 50%, #000 0%, transparent 75%)',
        }}
      />

      {/* The mark, drawing itself, with one ripple when the amber point lands. */}
      <div className="absolute inset-0 grid place-items-center">
        <div className="relative grid place-items-center">
          {!reduce && (
            <motion.span
              aria-hidden="true"
              className="absolute rounded-[34%] border border-[var(--mk-line-strong)]"
              style={{ width: 'clamp(112px, 15vw, 172px)', height: 'clamp(112px, 15vw, 172px)' }}
              initial={{ opacity: 0, scale: 1 }}
              animate={{ opacity: [0, 0.9, 0], scale: [1, 1.9, 2.4] }}
              transition={{ duration: 1.6, ease: 'easeOut', delay: 1.2 }}
            />
          )}
          <motion.div
            animate={leaving ? { scale: 0.92, opacity: 0 } : { scale: 1, opacity: 1 }}
            transition={{ duration: LEAVE / 1000, ease: EASE }}
            className="[&_svg]:h-[clamp(112px,15vw,172px)] [&_svg]:w-[clamp(112px,15vw,172px)]"
          >
            <BrandDraw size={172} delay={0.15} />
          </motion.div>
        </div>
      </div>

      {/* Top-left: who and where. */}
      <div className="absolute left-6 right-6 top-[max(env(safe-area-inset-top),28px)] sm:left-12 sm:top-12 lg:left-16 lg:top-16">
        <motion.div {...rise(0.55)} className="flex items-center gap-2 text-[12px] font-medium text-[var(--text-tertiary)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--mk-accent)]" />
          {isLogin ? 'Signed in' : 'Account created'}
        </motion.div>
        <motion.h1
          {...rise(0.7)}
          className="mt-4 max-w-[14ch] text-[clamp(2.1rem,5vw,4.2rem)] font-[450] leading-[1.02] tracking-[-0.045em]"
        >
          {isLogin ? 'Welcome back,' : 'Welcome,'}
          <span className="block truncate text-[var(--text-tertiary)]">{name}.</span>
        </motion.h1>
      </div>

      {/* Bottom-right: what is happening, and a way out. */}
      <motion.div
        {...rise(0.9)}
        className="absolute bottom-[max(env(safe-area-inset-bottom),28px)] right-6 w-[min(300px,calc(100vw-48px))] sm:bottom-12 sm:right-12 lg:bottom-16 lg:right-16"
      >
        <div className="flex items-baseline justify-between text-[12px] font-medium text-[var(--text-tertiary)]">
          <span>Preparing your canvas</span>
          <span className="tabular-nums text-[var(--text-primary)]">{String(pct).padStart(2, '0')}%</span>
        </div>
        <div className="mt-3 h-px w-full overflow-hidden bg-[var(--mk-line-strong)]">
          <div className="h-full origin-left bg-[var(--mk-accent)]" style={{ transform: `scaleX(${pct / 100})` }} />
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={finish}
            className="group inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-[var(--mk-line-strong)] px-4 text-[13px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--mk-ink-soft)] hover:text-[var(--text-primary)]"
          >
            Skip
            <kbd className="hidden font-mono sm:inline text-[10px] text-[var(--text-tertiary)]">Esc</kbd>
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default CinematicTransition;
