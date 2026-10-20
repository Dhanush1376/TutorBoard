import React, { useRef } from 'react';
import { flushSync } from 'react-dom';
import { motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/useTheme';

/**
 * Ultra-clean, minimal theme toggle button.
 * Features:
 * - Simple, pure Sun and Moon icons with zero extra graphical clutter (no stars, halos, or particle bursts)
 * - Simultaneous smooth Sun <-> Moon orbital morphing
 * - Slower, buttery-smooth circular ripple reveal transition via document.startViewTransition
 */
const ThemeToggle = ({ className = '' }) => {
  const { mode, toggleMode } = useTheme();
  const isDark = mode === 'dark';
  const isTransitioningRef = useRef(false);

  const handleToggle = (e) => {
    if (isTransitioningRef.current) return;

    // Fallback if View Transitions not supported or user prefers reduced motion
    if (!document.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      toggleMode();
      return;
    }

    isTransitioningRef.current = true;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    // Synchronous View Transition with flushSync for zero-jank frame capture
    const transition = document.startViewTransition(() => {
      flushSync(() => {
        toggleMode();
      });
    });

    transition.ready.then(() => {
      const anim = document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 750, // Luxurious, slow, silky reveal
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)', // Smooth gradual acceleration & velvet deceleration
          pseudoElement: '::view-transition-new(root)',
        }
      );
      anim.onfinish = () => {
        isTransitioningRef.current = false;
      };
    }).catch(() => {
      isTransitioningRef.current = false;
    });

    transition.finished.finally(() => {
      isTransitioningRef.current = false;
    });
  };

  return (
    <motion.button
      type="button"
      onClick={handleToggle}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.94 }}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`group relative w-9 h-9 rounded-full flex items-center justify-center transition-colors duration-500 shadow-xs cursor-pointer select-none overflow-hidden z-[110] ${
        isDark
          ? 'bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-neutral-200 hover:text-white'
          : 'bg-black/[0.04] hover:bg-black/[0.08] border border-[var(--border-color)] text-[var(--text-primary)] hover:text-black'
      } ${className}`}
    >
      {/* Simultaneous Seamless Icon Morph */}
      <div className="relative w-4 h-4 flex items-center justify-center pointer-events-none">
        {/* Sun Icon (Light Mode) */}
        <motion.div
          initial={false}
          animate={{
            rotate: isDark ? 90 : 0,
            scale: isDark ? 0 : 1,
            opacity: isDark ? 0 : 1,
          }}
          transition={{
            duration: 0.65,
            ease: [0.25, 1, 0.4, 1],
          }}
          className="absolute inset-0 flex items-center justify-center text-[var(--text-primary)]"
        >
          <Sun className="w-4 h-4 stroke-[2]" />
        </motion.div>

        {/* Moon Icon (Dark Mode) */}
        <motion.div
          initial={false}
          animate={{
            rotate: isDark ? 0 : -90,
            scale: isDark ? 1 : 0,
            opacity: isDark ? 1 : 0,
          }}
          transition={{
            duration: 0.65,
            ease: [0.25, 1, 0.4, 1],
          }}
          className="absolute inset-0 flex items-center justify-center text-neutral-200"
        >
          <Moon className="w-4 h-4 stroke-[2]" />
        </motion.div>
      </div>
    </motion.button>
  );
};

export default ThemeToggle;
