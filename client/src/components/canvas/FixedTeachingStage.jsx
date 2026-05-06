import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, Pause, SkipBack, SkipForward, 
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import VisaiLogo from '../layout/VisaiLogo';
import useTutorStore from '../../store/tutorStore';

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
  
  const { 
    isPlaying, play, pause, nextStep, prevStep
  } = useTutorStore();

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

        {/* Cinematic Transport Bar */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[120] opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-4 group-hover:translate-y-0">
          <div className="flex items-center gap-4 px-6 py-3 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
            {/* Step Controls */}
            <div className="flex items-center gap-1">
              <button 
                onClick={prevStep}
                disabled={currentStepIndex === 0}
                className="p-2 text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-transparent rounded-lg transition-all"
              >
                <SkipBack size={18} fill="currentColor" />
              </button>
              
              <button 
                onClick={isPlaying ? pause : play}
                className="w-10 h-10 flex items-center justify-center bg-white text-black rounded-full hover:scale-105 active:scale-95 transition-all shadow-lg"
              >
                {isPlaying ? <Pause size={20} fill="black" /> : <Play size={20} fill="black" className="ml-0.5" />}
              </button>

              <button 
                onClick={nextStep}
                disabled={currentStepIndex === totalSteps - 1}
                className="p-2 text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-transparent rounded-lg transition-all"
              >
                <SkipForward size={18} fill="currentColor" />
              </button>
            </div>

            <div className="w-[1px] h-6 bg-white/10 mx-1" />

            {/* Progress Info */}
            <div className="flex flex-col min-w-[80px]">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest leading-tight">Progress</span>
              <span className="text-[13px] font-medium text-white tabular-nums">
                Step {currentStepIndex + 1} <span className="text-white/40 font-normal">/ {totalSteps}</span>
              </span>
            </div>

            <div className="w-[1px] h-6 bg-white/10 mx-1" />


          </div>
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
