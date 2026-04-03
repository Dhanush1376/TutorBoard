/**
 * TeachingSession — Full-screen immersive real-time teaching experience
 * 
 * Integrates:
 *   - InfiniteCanvas with CanvasRenderer (visual scene)
 *   - CanvasControls + Minimap (navigation)
 *   - DoubtPanel (real-time doubt chat)
 *   - SessionOverlay (state-aware screens)
 *   - useTeachingMachine (state + actions)
 *   - Step playback controls
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, 
  ChevronLeft, ChevronRight, GraduationCap, Wifi, WifiOff,
  ArrowLeft
} from 'lucide-react';

import InfiniteCanvas from '../canvas/InfiniteCanvas';
import CanvasRenderer from '../canvas/CanvasRenderer';
import CanvasControls from '../canvas/CanvasControls';
import CanvasMinimap from '../canvas/CanvasMinimap';
import DoubtPanel from './DoubtPanel';
import SessionOverlay from './SessionOverlay';
import useTeachingMachine, { STATES } from '../../hooks/useTeachingMachine';

// Domain badge styling
const DOMAIN_STYLES = {
  dsa: { bg: 'rgba(5, 150, 105, 0.15)', border: 'rgba(5, 150, 105, 0.3)', text: '#059669', label: 'DSA' },
  mathematics: { bg: 'rgba(124, 58, 237, 0.15)', border: 'rgba(124, 58, 237, 0.3)', text: '#7c3aed', label: 'Math' },
  physics: { bg: 'rgba(37, 99, 235, 0.15)', border: 'rgba(37, 99, 235, 0.3)', text: '#2563eb', label: 'Physics' },
  chemistry: { bg: 'rgba(220, 38, 38, 0.15)', border: 'rgba(220, 38, 38, 0.3)', text: '#dc2626', label: 'Chemistry' },
  biology: { bg: 'rgba(22, 163, 74, 0.15)', border: 'rgba(22, 163, 74, 0.3)', text: '#16a34a', label: 'Biology' },
  general: { bg: 'rgba(107, 114, 128, 0.15)', border: 'rgba(107, 114, 128, 0.3)', text: '#6b7280', label: 'General' },
};

const TeachingSession = ({ isOpen, onClose, initialTopic }) => {
  const machine = useTeachingMachine();
  const {
    machineState, isConnected, connectionError,
    timeline, currentStep, currentStepIndex, totalSteps,
    doubtResponse, isDoubtProcessing, doubtHistory,
    error, greetingMessage,
    isPlaying, isPaused,
    startSession, askDoubt, goToStep, nextStep, prevStep,
    play, pause, resume, setSpeed, endSession,
  } = machine;

  // Local UI state
  const [canvasTransform, setCanvasTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [showMinimap, setShowMinimap] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showDoubtVisuals, setShowDoubtVisuals] = useState(false);
  const canvasRef = useRef(null);

  // Start session when opened with a topic
  useEffect(() => {
    if (isOpen && initialTopic && machineState === STATES.IDLE) {
      startSession(initialTopic);
    }
  }, [isOpen, initialTopic, machineState, startSession]);

  // Voice narration
  useEffect(() => {
    if (voiceEnabled && currentStep?.narration && machineState === STATES.TEACHING) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(currentStep.narration || currentStep.description);
      utterance.rate = playbackSpeed;
      utterance.pitch = 1;
      utterance.volume = 0.8;
      window.speechSynthesis.speak(utterance);
    } else {
      window.speechSynthesis.cancel();
    }
    return () => window.speechSynthesis.cancel();
  }, [currentStepIndex, voiceEnabled, currentStep, machineState, playbackSpeed]);

  // Auto-focus canvas on step change
  useEffect(() => {
    if (currentStep?.focusPoint && canvasRef.current) {
      // Center canvas on the step's focus point (smooth transition handled by CSS)
    }
  }, [currentStep]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      const tag = e.target.tagName.toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;
      
      if (e.key === 'Escape') {
        handleClose();
        return;
      }

      if (isTyping) return;

      switch (e.key) {
        case 'ArrowRight':
        case 'l':
          e.preventDefault();
          nextStep();
          break;
        case 'ArrowLeft':
        case 'h':
          e.preventDefault();
          prevStep();
          break;
        case ' ':
          e.preventDefault();
          isPlaying ? pause() : play();
          break;
        case '?':
          // Focus the doubt input
          const doubtInput = document.querySelector('[data-doubt-input]');
          doubtInput?.focus();
          break;
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, isPlaying, nextStep, prevStep, play, pause]);

  // Handle speed change
  const handleSpeedChange = useCallback((speed) => {
    setPlaybackSpeed(speed);
    setSpeed(speed);
  }, [setSpeed]);

  // Handle close
  const handleClose = useCallback(() => {
    endSession();
    onClose();
  }, [endSession, onClose]);

  // Handle doubt visual display
  useEffect(() => {
    if (doubtResponse?.hasVisuals && doubtResponse?.visualUpdate) {
      setShowDoubtVisuals(true);
    }
  }, [doubtResponse]);

  const handleReturnToLesson = useCallback(() => {
    setShowDoubtVisuals(false);
    resume();
  }, [resume]);

  // Handle retry
  const handleRetry = useCallback(() => {
    if (initialTopic) {
      startSession(initialTopic);
    }
  }, [initialTopic, startSession]);

  if (!isOpen) return null;

  const domain = timeline?.domain?.toLowerCase();
  const domainStyle = domain ? DOMAIN_STYLES[domain] : null;

  // Determine what objects/steps to show
  const displayObjects = showDoubtVisuals 
    ? (doubtResponse?.visualUpdate?.objects || [])
    : (timeline?.objects || []);
  const displaySteps = showDoubtVisuals
    ? (doubtResponse?.visualUpdate?.steps || [])
    : (timeline?.steps || []);
  const displayStepIndex = showDoubtVisuals ? 0 : currentStepIndex;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[200] flex flex-col bg-[var(--bg-primary)] overflow-hidden"
        >
          {/* ─── STATE OVERLAYS ─── */}
          <SessionOverlay
            machineState={machineState}
            error={error}
            topic={initialTopic}
            totalSteps={totalSteps}
            doubtHistory={doubtHistory}
            onRetry={handleRetry}
            onNewTopic={handleClose}
            onClose={handleClose}
          />

          {/* ─── CANVAS LAYER ─── */}
          <div className="absolute inset-0 z-0">
            <InfiniteCanvas
              ref={canvasRef}
              onZoomChange={(scale) => setCanvasTransform(prev => ({ ...prev, scale }))}
              onViewportChange={setCanvasTransform}
              className="bg-[var(--bg-primary)]"
            >
              <CanvasRenderer
                objects={displayObjects}
                steps={displaySteps}
                currentStepIndex={displayStepIndex}
              />
            </InfiniteCanvas>

            {/* Canvas Controls */}
            {timeline && (
              <>
                <CanvasControls
                  transform={canvasTransform}
                  onZoomIn={() => setCanvasTransform(prev => ({ ...prev, scale: Math.min(5, prev.scale * 1.3) }))}
                  onZoomOut={() => setCanvasTransform(prev => ({ ...prev, scale: Math.max(0.15, prev.scale / 1.3) }))}
                  onFitToContent={() => setCanvasTransform({ x: 0, y: 0, scale: 1 })}
                  onResetView={() => setCanvasTransform({ x: 0, y: 0, scale: 1 })}
                  onToggleMinimap={() => setShowMinimap(prev => !prev)}
                  showMinimap={showMinimap}
                />
                <CanvasMinimap
                  visible={showMinimap}
                  objects={displayObjects}
                  transform={canvasTransform}
                />
              </>
            )}
          </div>

          {/* ─── TOP BAR ─── */}
          <div className="relative z-10 flex items-center justify-between px-5 pt-5">
            {/* Left: Title + Domain */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="flex items-center gap-3 bg-[var(--bg-secondary)]/80 backdrop-blur-2xl border border-[var(--border-color)] px-5 py-2.5 rounded-2xl shadow-xl"
            >
              {/* Connection indicator */}
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-400'}`} />
              
              {domainStyle && (
                <span
                  className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-[0.1em]"
                  style={{
                    backgroundColor: domainStyle.bg,
                    borderWidth: '1px',
                    borderColor: domainStyle.border,
                    color: domainStyle.text,
                  }}
                >
                  {domainStyle.label}
                </span>
              )}
              <span className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-[0.12em] max-w-[300px] truncate">
                {timeline?.title || initialTopic || 'Teaching Session'}
              </span>
              
              {/* Live indicator */}
              <span className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded-full text-[9px] font-bold text-red-400 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                Live
              </span>
            </motion.div>

            {/* Return to Lesson Button (when viewing doubt visuals) */}
            <AnimatePresence>
              {showDoubtVisuals && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={handleReturnToLesson}
                  className="absolute left-1/2 -translate-x-1/2 px-5 py-2 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-full text-[10px] font-bold uppercase tracking-widest shadow-xl hover:opacity-90 active:scale-95 transition-all z-20"
                >
                  ← Return to Lesson
                </motion.button>
              )}
            </AnimatePresence>

            {/* Right: Controls */}
            <div className="flex items-center gap-2">
              {/* Connection status */}
              {!isConnected && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-xl text-[10px] font-bold text-red-400">
                  <WifiOff size={12} />
                  Offline
                </div>
              )}
              
              {/* Voice */}
              <button
                onClick={() => setVoiceEnabled(v => !v)}
                className={`p-2.5 rounded-xl border transition-all ${
                  voiceEnabled
                    ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] border-transparent'
                    : 'bg-[var(--bg-secondary)]/80 backdrop-blur-xl border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>

              {/* Close */}
              <button
                onClick={handleClose}
                className="p-2.5 rounded-xl bg-[var(--bg-secondary)]/80 backdrop-blur-xl border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* ─── STEP EXPLANATION PANEL ─── */}
          <AnimatePresence mode="wait">
            {currentStep && machineState === STATES.TEACHING && !showDoubtVisuals && (
              <motion.div
                key={`step-${currentStepIndex}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10 ml-5 mt-5 max-w-sm"
              >
                <div className="bg-[var(--bg-secondary)]/80 backdrop-blur-2xl border border-[var(--border-color)] rounded-2xl p-5 shadow-2xl">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">
                      Step {currentStepIndex + 1} of {totalSteps}
                    </span>
                    {currentStep.transition && (
                      <span className="px-2 py-0.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-full text-[8px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
                        {currentStep.transition}
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-[var(--text-primary)] mb-1">
                    {currentStep.title || currentStep.label || `Step ${currentStepIndex + 1}`}
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {currentStep.description || currentStep.narration || ''}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── Doubt Processing Indicator ─── */}
          <AnimatePresence>
            {(machineState === STATES.DOUBT_TRIGGERED || machineState === STATES.RESPONDING) && !showDoubtVisuals && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30"
              >
                <div className="flex items-center gap-3 px-6 py-3 bg-[var(--bg-secondary)]/90 backdrop-blur-2xl border border-[var(--border-color)] rounded-2xl shadow-2xl">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-5 h-5 border-2 border-[var(--text-tertiary)] border-t-[var(--text-primary)] rounded-full"
                  />
                  <span className="text-xs font-semibold text-[var(--text-primary)]">
                    {machineState === STATES.DOUBT_TRIGGERED ? 'Processing your doubt...' : 'Preparing visual response...'}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── BOTTOM CONTROL DOCK ─── */}
          <div className="relative z-10 mt-auto w-full flex flex-col items-center gap-3 pb-5 pt-6 bg-gradient-to-t from-[var(--bg-primary)] via-[var(--bg-primary)]/70 to-transparent">
            
            {/* Doubt Panel */}
            <div className="w-full px-5">
              <DoubtPanel
                onAskDoubt={askDoubt}
                isProcessing={isDoubtProcessing}
                doubtResponse={doubtResponse}
                doubtHistory={doubtHistory}
                currentStepTitle={currentStep?.title}
                disabled={machineState === STATES.GENERATING || machineState === STATES.IDLE}
              />
            </div>

            {/* Progress Bar */}
            {timeline && totalSteps > 0 && (
              <div className="w-full max-w-xl px-6">
                <div className="flex gap-1">
                  {Array.from({ length: totalSteps }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => goToStep(i)}
                      className={`flex-1 h-1.5 rounded-full transition-all duration-300 hover:h-2.5 ${
                        i < currentStepIndex
                          ? 'bg-[var(--text-primary)]'
                          : i === currentStepIndex
                          ? 'bg-[var(--text-primary)] shadow-[0_0_8px_rgba(0,0,0,0.2)]'
                          : 'bg-[var(--border-color)]'
                      }`}
                      title={`Step ${i + 1}: ${displaySteps[i]?.title || ''}`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Playback Controls */}
            {timeline && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex items-center gap-2"
              >
                {/* Speed */}
                <div className="flex items-center gap-1 bg-[var(--bg-secondary)]/80 backdrop-blur-xl border border-[var(--border-color)] rounded-xl px-2 py-1">
                  {[0.5, 1, 1.5, 2].map(speed => (
                    <button
                      key={speed}
                      onClick={() => handleSpeedChange(speed)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                        playbackSpeed === speed
                          ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]'
                          : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {speed}×
                    </button>
                  ))}
                </div>

                {/* Main controls */}
                <div className="flex items-center gap-1 bg-[var(--bg-secondary)]/80 backdrop-blur-xl border border-[var(--border-color)] rounded-2xl px-3 py-1.5">
                  <button
                    onClick={prevStep}
                    disabled={currentStepIndex <= 0}
                    className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all disabled:opacity-20"
                  >
                    <SkipBack size={16} />
                  </button>

                  <button
                    onClick={isPlaying ? pause : play}
                    className="p-3 rounded-xl bg-[var(--text-primary)] text-[var(--bg-primary)] hover:opacity-90 transition-all active:scale-90 mx-1"
                  >
                    {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
                  </button>

                  <button
                    onClick={nextStep}
                    disabled={currentStepIndex >= totalSteps - 1}
                    className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all disabled:opacity-20"
                  >
                    <SkipForward size={16} />
                  </button>
                </div>

                {/* Step counter */}
                <div className="px-3 py-2 bg-[var(--bg-secondary)]/80 backdrop-blur-xl border border-[var(--border-color)] rounded-xl">
                  <span className="text-[11px] font-bold text-[var(--text-tertiary)] tabular-nums">
                    {currentStepIndex + 1} / {totalSteps}
                  </span>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TeachingSession;
