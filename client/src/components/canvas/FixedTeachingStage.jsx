import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, Pause, SkipBack, SkipForward, 
  Settings, Maximize2, Minimize2, 
  ChevronLeft, ChevronRight, Volume2, VolumeX 
} from 'lucide-react';

/**
 * FixedTeachingStage replaces the InfiniteCanvas.
 * It provides a focused, fixed-aspect-ratio container for AI explanations.
 * It removes all pan/zoom/drag complexity while providing a premium playback experience.
 */
const FixedTeachingStage = ({ 
  children,
  currentStepIndex = 0,
  totalSteps = 0,
  onNext,
  onPrev,
  onPlay,
  onPause,
  isPlaying = false,
  playbackSpeed = 1,
  onSpeedChange,
  isVoiceEnabled = false,
  onToggleVoice,
  topic = "Learning Session"
}) => {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef(null);

  // Responsive scaling to fit 800x600 into the available space
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      const padding = 40;
      const availableWidth = clientWidth - padding;
      const availableHeight = clientHeight - padding;
      
      const scaleX = availableWidth / 800;
      const scaleY = availableHeight / 600;
      const newScale = Math.min(scaleX, scaleY, 1.2); // Don't scale up too much
      setScale(newScale);
    };

    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) observer.observe(containerRef.current);
    handleResize();

    return () => observer.disconnect();
  }, []);

  // Auto-hide controls
  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [isPlaying]);

  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [resetControlsTimeout]);

  const progress = totalSteps > 0 ? ((currentStepIndex + 1) / totalSteps) * 100 : 0;

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full bg-[var(--bg-primary)] overflow-hidden flex items-center justify-center group"
      onMouseMove={resetControlsTimeout}
      onClick={resetControlsTimeout}
    >
      {/* ── Background Decorative Elements ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-[var(--info)] opacity-[0.03] blur-[120px] rounded-full" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] bg-[var(--success)] opacity-[0.03] blur-[120px] rounded-full" />
      </div>

      {/* ── The Stage ── */}
      <motion.div 
        className="relative bg-[var(--bg-secondary)] overflow-hidden rounded-[2.5rem] p-[2px]"
        style={{
          width: 800,
          height: 600,
          scale,
          transformOrigin: 'center center',
          // Premium 3D Glassy Effect
          boxShadow: `
            0 0 0 1px var(--border-color),
            0 20px 50px -10px rgba(0,0,0,0.5),
            0 10px 30px -15px rgba(0,0,0,0.3),
            inset 0 1px 1px rgba(255,255,255,0.1),
            inset 0 0 0 1px rgba(255,255,255,0.05)
          `
        }}
        animate={{ scale }}
        transition={{ type: 'spring', damping: 25, stiffness: 120 }}
      >
        {/* Subtle Inner Glass Border (Rim Light) */}
        <div className="absolute inset-0 rounded-[2.5rem] border border-white/[0.03] pointer-events-none z-[60]" />
        
        <div className="absolute inset-0 pointer-events-auto bg-[var(--bg-secondary)] rounded-[2.5rem] overflow-hidden">
          {children}
        </div>

        {/* Scene Transition Overlay */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStepIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 bg-[var(--bg-primary)] pointer-events-none z-50"
          />
        </AnimatePresence>
      </motion.div>

      {/* ── Top Header Info ── */}
      <AnimatePresence>
        {showControls && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-6 left-8 right-8 flex items-center justify-between z-[100]"
          >
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-[0.3em] text-[var(--text-tertiary)] font-medium">Topic Explanation</span>
              <h2 className="text-sm text-[var(--text-primary)] font-light tracking-wide truncate max-w-[300px]">{topic}</h2>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-full backdrop-blur-md shadow-sm">
                <span className="text-[10px] font-medium text-[var(--text-secondary)]">{currentStepIndex + 1}</span>
                <span className="text-[10px] text-[var(--text-tertiary)] opacity-30">/</span>
                <span className="text-[10px] font-medium text-[var(--text-tertiary)]">{totalSteps}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Floating Controls ── */}
      <AnimatePresence>
        {showControls && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-4 w-full max-w-xl px-8"
          >
            {/* Control Bar */}
            <div className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] backdrop-blur-2xl rounded-2xl p-2 flex items-center justify-between gap-4 shadow-xl">
              <div className="flex items-center gap-1">
                <button 
                  onClick={onPrev}
                  disabled={currentStepIndex === 0}
                  className="p-2.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-xl transition-all disabled:opacity-20 disabled:pointer-events-none"
                >
                  <SkipBack size={18} fill="currentColor" />
                </button>
                <button 
                  onClick={isPlaying ? onPause : onPlay}
                  className="w-12 h-12 flex items-center justify-center bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-xl hover:scale-105 active:scale-95 transition-all shadow-md"
                >
                  {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} className="ml-1" fill="currentColor" />}
                </button>
                <button 
                  onClick={onNext}
                  disabled={currentStepIndex >= totalSteps - 1}
                  className="p-2.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-xl transition-all disabled:opacity-20 disabled:pointer-events-none"
                >
                  <SkipForward size={18} fill="currentColor" />
                </button>
              </div>

              {/* Progress Slider */}
              <div className="flex-1 px-4 group/progress relative">
                <div className="h-1.5 w-full bg-[var(--border-subtle)] rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-[var(--text-primary)] relative"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                  >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-[var(--text-primary)] rounded-full shadow-lg opacity-0 group-hover/progress:opacity-100 transition-opacity" />
                  </motion.div>
                </div>
              </div>

              <div className="flex items-center gap-1 pr-1">
                <button 
                  onClick={onToggleVoice}
                  className="p-2.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-xl transition-all"
                >
                  {isVoiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                </button>
                <div className="h-4 w-[1px] bg-[var(--border-color)] mx-1" />
                <button 
                  onClick={() => onSpeedChange?.(playbackSpeed === 1 ? 1.5 : playbackSpeed === 1.5 ? 2 : 1)}
                  className="min-w-[40px] px-2 py-1 text-[10px] font-bold text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  {playbackSpeed}x
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Side Next/Prev Hover Areas ── */}
      <div className="absolute inset-y-0 left-0 w-32 flex items-center justify-start pl-8 pointer-events-none group-hover:pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={onPrev}
          disabled={currentStepIndex === 0}
          className="p-4 bg-[var(--bg-secondary)] backdrop-blur-md border border-[var(--border-color)] rounded-full text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:scale-110 transition-all disabled:opacity-0 shadow-lg"
        >
          <ChevronLeft size={24} />
        </button>
      </div>
      <div className="absolute inset-y-0 right-0 w-32 flex items-center justify-end pr-8 pointer-events-none group-hover:pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={onNext}
          disabled={currentStepIndex >= totalSteps - 1}
          className="p-4 bg-[var(--bg-secondary)] backdrop-blur-md border border-[var(--border-color)] rounded-full text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:scale-110 transition-all disabled:opacity-0 shadow-lg"
        >
          <ChevronRight size={24} />
        </button>
      </div>
    </div>
  );
};

export default FixedTeachingStage;
