import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../../context/useTheme';

/**
 * Loader Component - Redesigned
 * A minimalist, text-free, premium loading overlay.
 * Uses a morphing hexagonal sigil that aligns with the TutorBoard/Visai brand.
 */
const Loader = ({ fullScreen = true, glass = true, size = 80 }) => {
  const { mode } = useTheme();
  const isDark = mode === 'dark';

  return (
    <div
      className={`
        ${fullScreen ? "fixed inset-0 flex items-center justify-center" : "relative flex items-center justify-center"} 
        z-[1000] transition-opacity duration-300
      `}
      style={{
        backgroundColor: fullScreen ? (glass
          ? `rgba(var(--bg-primary-rgb), ${isDark ? 0.15 : 0.1})`
          : 'var(--bg-primary)') : 'transparent',
        backdropFilter: fullScreen && glass ? 'blur(40px) saturate(180%) brightness(1.05)' : 'none',
        WebkitBackdropFilter: fullScreen && glass ? 'blur(40px) saturate(180%) brightness(1.05)' : 'none',
      }}
    >
      <div className="relative" style={{ width: size, height: size }}>
        {/* Ambient Glow */}
        {size > 40 && (
          <motion.div
            className="absolute inset-[-40px] rounded-full blur-[50px] opacity-20"
            style={{ background: 'var(--text-primary)' }}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.1, 0.2, 0.1],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        )}

        {/* Morphing Hexagonal Sigil */}
        <motion.div
          className="relative z-10 w-full h-full flex items-center justify-center"
          animate={{
            rotate: [0, 60, 120, 180, 240, 300, 360],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "linear"
          }}
        >
          <svg viewBox="0 0 100 100" className="w-full h-full">
            {/* Outer Hexagon Shell */}
            <motion.polygon
              points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5"
              fill="none"
              stroke="var(--text-primary)"
              strokeWidth="1.5"
              strokeLinejoin="round"
              animate={{
                strokeDasharray: ["1, 300", "100, 300", "1, 300"],
                strokeDashoffset: [0, -100, -200],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />

            {/* Inner Morphing Core */}
            <motion.polygon
              points="50,25 72,37.5 72,62.5 50,75 28,62.5 28,37.5"
              fill="var(--text-primary)"
              animate={{
                scale: [0.8, 1.1, 0.8],
                opacity: [0.4, 0.8, 0.4],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
          </svg>
        </motion.div>

        {/* Pulsing Ring */}
        {size > 40 && (
          <motion.div
            className="absolute inset-[-10px] border border-[var(--text-primary)] rounded-full opacity-10"
            animate={{
              scale: [0.9, 1.3, 0.9],
              opacity: [0, 0.15, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeOut"
            }}
          />
        )}
      </div>

      {/* Global CSS for smooth unmounting if needed */}
      <style>{`
        .loader-exit {
          opacity: 0;
          filter: blur(10px);
          transition: all 0.5s ease;
        }
      `}</style>
    </div>
  );
};

export default Loader;
