import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import VisaiLogo from '../layout/VisaiLogo';

/**
 * FixedTeachingStage provides a focused, fixed-aspect-ratio container for AI explanations.
 * It removes all pan/zoom/drag complexity while providing a premium playback experience.
 */
const FixedTeachingStage = ({ 
  children,
  currentStepIndex = 0,
  totalSteps = 0,
  topic = "Learning Session"
}) => {
  const { user } = useAuth();
  const isGuest = !user;
  
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);

  // Responsive scaling to fit 800x600 into the available space
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      const padding = 0;
      const availableWidth = clientWidth;
      const availableHeight = clientHeight;
      
      const scaleX = availableWidth / 800;
      const scaleY = availableHeight / 600;
      const newScale = Math.min(scaleX, scaleY, 2.0); // Allow more scaling on large screens
      setScale(newScale);
    };

    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) observer.observe(containerRef.current);
    handleResize();

    return () => observer.disconnect();
  }, []);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full bg-transparent overflow-hidden flex items-center justify-center group"
    >
      {/* ── The Stage ── */}
      <div 
        className="relative bg-transparent overflow-visible"
        style={{
          width: 800,
          height: 600,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        <div className="absolute inset-0 pointer-events-auto bg-transparent overflow-visible">
          {children}

          {/* Guest Mode Watermark */}
          {isGuest && (
            <div className="absolute top-6 right-6 z-[110] pointer-events-none opacity-[0.15] mix-blend-overlay">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm">
                <VisaiLogo size="xxs" />
                <span className="text-[10px] font-medium tracking-[0.2em] uppercase">Guest Mode</span>
              </div>
            </div>
          )}
        </div>

        {/* Scene Transition Overlay (Cinematic Wipe) */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStepIndex}
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="absolute inset-0 bg-[var(--bg-primary)] pointer-events-none z-50"
          />
        </AnimatePresence>
      </div>
    </div>
  );
};

export default FixedTeachingStage;
