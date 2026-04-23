import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';

/**
 * Loader Component - Redesigned
 * A minimalist, text-free, premium loading overlay.
 * Uses a morphing hexagonal sigil that aligns with the TutorBoard/Visai brand.
 */
const Loader = ({ fullScreen = true, glass = true }) => {
  const { mode } = useTheme();
  const isDark = mode === 'dark';

  return (
    <div 
      className={`
        ${fullScreen ? "fixed inset-0" : "relative w-full py-16"} 
        flex items-center justify-center z-[1000]
        transition-opacity duration-300
      `}
      style={{
        backgroundColor: glass 
          ? `rgba(var(--bg-primary-rgb), ${isDark ? 0.45 : 0.6})` 
          : 'var(--bg-primary)',
        backdropFilter: glass ? 'blur(16px) saturate(120%) brightness(0.9)' : 'none',
        WebkitBackdropFilter: glass ? 'blur(16px) saturate(120%) brightness(0.9)' : 'none',
      }}
    >
      <div className="relative">
        {/* Ambient Glow */}
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

        {/* Morphing Hexagonal Sigil */}
        <motion.div
          className="relative z-10 w-20 h-20 flex items-center justify-center"
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
