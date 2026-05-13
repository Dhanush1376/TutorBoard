import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Menu, PanelRight, PanelRightClose, ChevronLeft, ArrowUp, Loader2, Sparkles,
  RotateCcw, RefreshCw, Dices, Crosshair, Volume2, VolumeX, AlertTriangle, BookOpen,
  Minimize2
} from 'lucide-react';
import { useElapsedTime } from '../../hooks/useElapsedTime';

const AgentCanvasRenderer = React.lazy(() => import('../canvas/AgentCanvasRenderer'));
const FixedTeachingStage = lazy(() => import('../canvas/FixedTeachingStage'));
const CinematicStage = lazy(() => import('../canvas/CinematicStage'));
import FloatingSidebar from './FloatingSidebar';
import StepPanel from './StepPanel';
import NarrationBar from './NarrationBar';
import ProgressArc from './ProgressArc';
import InteractiveControlPanel from './InteractiveControlPanel';
import UnifiedControlBar from './UnifiedControlBar';
import { SessionGuide } from './SessionGuide';
import SessionResumeOverlay from './SessionResumeOverlay';
import ShortcutsHUD from './ShortcutsHUD';

const StepFilmstrip = lazy(() => import('./StepFilmstrip'));
import ParticleWaves from '../canvas/ParticleWaves';
import { isDSAContent } from '../../engine/RendererRouter';
import useTeachingMachine, { STATES } from '../../hooks/useTeachingMachine';
import useVoiceNarrator from '../../hooks/useVoiceNarrator';
import useTutorStore, { CANVAS_MODE } from '../../store/tutorStore';
import { DOMAIN_STYLES, PANEL_VISIBLE_STATES as PANEL_VISIBLE_STATES_ARR, formatTopicTitle } from '../../lib/teaching';

const PANEL_VISIBLE_STATES = new Set(PANEL_VISIBLE_STATES_ARR);

function Btn({ onClick, children, disabled, active, danger, className = '', title }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      type="button"
      className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all active:scale-90 pointer-events-auto select-none ${className} ${
        disabled ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer'
      } ${
        active 
          ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' 
          : 'bg-transparent text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
      }`}
      style={{
        color: (danger && !active) ? '#ef4444' : undefined,
        border: 'none',
      }}>
      {children}
    </button>
  );
}

const TeachingSession = ({ initialTopic }) => {
  const machine = useTeachingMachine(true, false);
  const {
    machineState, isConnected,
    timeline, learningNodes, mode, difficulty, professorNote, memoryAnchor, keyFormula,
    currentStep, currentStepIndex, totalSteps,
    canvasObjects, canvasConnections, canvasSteps,
    isDoubtProcessing, doubtHistory,
    error, topic, isPlaying,
    startSession, askDoubt, goToStep, nextStep, prevStep,
    play, pause, resume, setSpeed, endSession, cancelSession,
  } = machine;

  const {
    setCanvasMode,
    setPlaybackSpeed: storeSetSpeed,
    levelUpEvent, setLevelUpEvent, showToast,
    isExplainMinimized: isMinimized,
    setExplainMinimized: setIsMinimized,
    canvasLayout,
    isVoiceEnabled,
    toggleVoice,
    isSidebarOpen,
    setSidebarOpen,
  } = useTutorStore();

  const toolbarLeft = isSidebarOpen ? 350 + 16 : 16;

  const isOpen = machineState !== STATES.IDLE || canvasLayout !== 'inline';
  const isGenerating = machineState === STATES.GENERATING;
  // FIX: Also show the canvas body when viewing a snapshot (canvasLayout !== 'inline' but machineState === IDLE)
  const isSnapshotView = canvasLayout !== 'inline' && machineState === STATES.IDLE;
  const isTeaching = machineState === STATES.TEACHING || machineState === STATES.RESPONDING || machineState === STATES.RESUMING || isGenerating || isSnapshotView;
  
  const domain = timeline?.domain?.toLowerCase() || 'general';
  const ds = DOMAIN_STYLES[domain] || DOMAIN_STYLES.general;
  const domainColor = ds.accent || '#6366f1';
  const isAlgo = isDSAContent(timeline);
  const useAlgoPanel = isAlgo;

  const stepType = currentStep?.type || (
    currentStep?.title?.toLowerCase().includes("intro") ? "Intro" : 
    currentStep?.title?.toLowerCase().includes("example") ? "Example" : 
    currentStep?.title?.toLowerCase().includes("summary") ? "Summary" : 
    "Core"
  );

  const [panelOpen, setPanelOpen] = useState(true);

  const rootRef = useRef(null);
  const canvasRef = useRef(null);
  const { speak, cancel } = useVoiceNarrator();


  // Voice narration trigger
  useEffect(() => {
    if (isTeaching && currentStep && !isGenerating) {
      const text = currentStep.narration || currentStep.explanation;
      if (text) speak(text);
    } else {
      cancel();
    }
  }, [currentStepIndex, isTeaching, isGenerating, speak, cancel, currentStep]);

  const handleElementClick = useCallback((id, event, data) => {
    if (event === 'click') {
      const question = `Can you explain what the element "${id}" representing ${data.type} is doing in this step?`;
      showToast({ message: `Inquiring about ${id}...`, type: 'info', duration: 2000 });
      askDoubt(question);
    }
  }, [askDoubt, showToast]);

  // ── Handlers ──────────────────────────────────────────────

  const handleClose = useCallback(() => {
    // FIX: If we're in a snapshot view (not a live teaching session),
    // just close the canvas layout without calling endSession which clears session IDs.
    if (isSnapshotView) {
      useTutorStore.getState().setCanvasLayout('inline');
      useTutorStore.getState().setActiveSnapshotId(null);
      return;
    }
    endSession();
    // Also ensure canvas layout is reset
    useTutorStore.getState().setCanvasLayout('inline');
  }, [endSession, isSnapshotView]);

  const handleSpeed = useCallback((s) => {
    storeSetSpeed(s);
    setSpeed(s);
  }, [setSpeed, storeSetSpeed]);

  // ── Effects ───────────────────────────────────────────────

  useEffect(() => {
    if (isOpen && initialTopic) {
      if (machineState === STATES.IDLE && !timeline) {
        startSession(initialTopic, initialTopic);
        setCanvasMode(CANVAS_MODE.FULLSCREEN);
        return;
      }
      const same = topic?.toLowerCase() === initialTopic.toLowerCase();
      if (!same && machineState !== STATES.GENERATING) endSession();
    }
  }, [isOpen, initialTopic, machineState, startSession, timeline, topic, endSession, setCanvasMode]);



  // ── Keyboard Navigation ──────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const fn = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === 'ArrowRight') {
        nextStep();
      } else if (e.key === 'ArrowLeft') {
        prevStep();

      } else if (e.key === ' ' && !e.target.matches('input, textarea, button, select, [role=button]')) {
        e.preventDefault();
        isPlaying ? pause() : play();
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [isOpen, handleClose, nextStep, prevStep, isPlaying, play, pause]);

  // Level-up toast
  useEffect(() => {
    if (levelUpEvent) {
      showToast({ message: levelUpEvent.message, type: 'success', duration: 4000 });
      const t = setTimeout(() => setLevelUpEvent(null), 4000);
      return () => clearTimeout(t);
    }
  }, [levelUpEvent, showToast, setLevelUpEvent]);

  // ── Focus Trap & Accessibility ────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    const previousActiveElement = document.activeElement;

    // Set initial focus to the close button or first interactive element
    const initialFocus = rootRef.current?.querySelector('button[title="Close"]');
    if (initialFocus) initialFocus.focus();

    const handleFocusTrap = (e) => {
      if (e.key !== 'Tab') return;

      const focusableElements = Array.from(rootRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) || []);

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) { // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else { // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    window.addEventListener('keydown', handleFocusTrap);
    return () => {
      window.removeEventListener('keydown', handleFocusTrap);
      previousActiveElement?.focus();
    };
  }, [isOpen]);

  // Time
  const { formatted, formatTime } = useElapsedTime(isPlaying, machineState === STATES.GENERATING);
  const totalFormatted = formatTime(totalSteps * 8); // Estimated 8s per step

  // ── Bail ──────────────────────────────────────────────────
  if (!isOpen) return null;

  if (machineState === STATES.ERROR) {
    return (
      <div className="teaching-session flex items-center justify-center p-6 bg-[var(--bg-primary)]">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="liquid-glass p-10 rounded-[32px] flex flex-col items-center gap-8 max-w-md text-center border border-red-500/20"
          style={{ boxShadow: '0 32px 80px -16px rgba(0,0,0,0.3)' }}
        >
           <div className="w-20 h-20 rounded-3xl bg-red-500/10 flex items-center justify-center text-red-500 mb-2 border border-red-500/20">
             <AlertTriangle size={40} strokeWidth={1.5} />
           </div>
           <div className="space-y-3">
             <h2 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Session Interrupted</h2>
             <p className="text-[13px] text-[var(--text-secondary)] opacity-70 leading-relaxed">
               {error || "TutorBoard encountered an unexpected glitch while orchestrating your lesson."}
             </p>
             <p className="text-[11px] text-red-400/60 font-mono bg-red-500/5 py-2 px-3 rounded-lg border border-red-500/10">
               {typeof error === 'string' && error.startsWith('{') ? 'JSON_PAYLOAD_ERROR' : (error || 'UNKNOWN_SESSION_FAILURE')}
             </p>
           </div>
           <div className="flex flex-col gap-3 w-full">
             <button 
               onClick={() => startSession(topic, topic)}
               className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-[var(--text-primary)] text-[var(--bg-primary)] font-bold text-sm hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-black/20"
             >
               <RefreshCw size={16} />
               Re-initialize Lesson
             </button>
             <button 
               onClick={handleClose}
               className="w-full px-6 py-3.5 rounded-2xl bg-transparent border border-[var(--border-color)] text-[var(--text-tertiary)] font-semibold text-[13px] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] active:scale-[0.98] transition-all cursor-pointer"
             >
               Return to Workspace
             </button>
           </div>
        </motion.div>
      </div>
    );
  }



  // ── Minimized pill ────────────────────────────────────────
  if (isMinimized && isTeaching) {
    return (
      <motion.div
        initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
        className="fixed bottom-6 right-6 z-[60] liquid-glass rounded-xl shadow-premium overflow-hidden"
      >
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-[var(--bg-tertiary)] active:scale-95 transition-all group"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-[10px] font-bold tracking-wider uppercase text-[var(--text-primary)] truncate max-w-[140px]">
            {topic || 'Active Session'}
          </span>
          <ChevronLeft size={12} className="text-[var(--text-tertiary)] group-hover:translate-x-0.5 transition-transform rotate-180" />
        </button>
      </motion.div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="teaching-session"
      role="dialog"
      aria-modal="true"
      aria-labelledby="teaching-session-title"
      tabIndex="-1"
    >
      {/* ── 1. Floating Toolbar (Top Level for max interactivity) ── */}


      {/* ── 2. Body ─────────────────────────────────────────── */}
       {isTeaching && (
        <div 
          className="teaching-body"
          style={{
            '--theme-color': domainColor,
            '--theme-color-light': `${domainColor}20`,
            '--theme-color-glow': `${domainColor}40`,
          }}
        >
          {/* Global Ambient Background */}
          <div className="absolute inset-0 z-0 pointer-events-none">
            {/* ── Subtle Grid Pattern ── */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundSize: '40px 40px',
                backgroundImage: `
                  linear-gradient(to right, var(--border-color) 1px, transparent 1px),
                  linear-gradient(to bottom, var(--border-color) 1px, transparent 1px)
                `,
                opacity: 0.15,
                maskImage: 'radial-gradient(ellipse 120% 120% at 50% 50%, black, transparent)',
                WebkitMaskImage: 'radial-gradient(ellipse 120% 120% at 50% 50%, black, transparent)',
                pointerEvents: 'none',
                zIndex: 0,
              }}
            />
            <ParticleWaves opacity={0.3} />
          </div>

          {/* Canvas Area (Flex sibling for dynamic adjustment) */}
          <motion.div layout className="teaching-canvas-area" style={{ background: 'transparent' }}>
            <div className="absolute inset-0 overflow-visible">
              <Suspense fallback={null}>
                <CinematicStage
                  topic={topic}
                  currentStepIndex={currentStepIndex}
                  totalSteps={canvasSteps.length}
                  domain={timeline?.domain || 'general'}
                  isGenerating={isGenerating}
                  hideControls={true}
                  activeScene={timeline}
                >
                  <React.Suspense fallback={null}>
                    <AgentCanvasRenderer
                      ref={canvasRef}
                      width={800} height={600}
                      timeline={timeline} objects={canvasObjects || []} steps={canvasSteps}
                      currentStepIndex={currentStepIndex} onGoToStep={goToStep}
                      doubtHistory={doubtHistory} isDoubtProcessing={isDoubtProcessing}
                      activeDoubtId={machine.activeDoubtId} onJumpToDoubt={machine.jumpToDoubt}
                      onPinDoubt={machine.pinDoubtToCanvas} onResume={resume} onAskDoubt={askDoubt}
                      onElementClick={handleElementClick}
                      hideAlgoPanel={true}
                    />
                  </React.Suspense>
                </CinematicStage>
              </Suspense>
            </div>

            {/* ── Step Orientation Pill (Floating Context) ── */}
            <div className="absolute top-[80px] left-6 z-[30] pointer-events-none flex flex-col gap-3">
              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                key={`step-pill-${currentStepIndex}`}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full liquid-glass shadow-premium"
              >
                <div
                  className="w-1.5 h-1.5 rounded-full animate-pulse shadow-[0_0_8px_rgba(var(--theme-color-rgb),0.5)]"
                  style={{
                    background: stepType?.toLowerCase() === 'summary' ? '#ca8a04' :
                      stepType?.toLowerCase() === 'example' ? '#16a34a' :
                        stepType?.toLowerCase() === 'intro' ? '#2563eb' : 'var(--text-primary)'
                  }}
                />
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--text-secondary)]">
                  {stepType ? `${stepType} · ` : ''}{currentStepIndex + 1}
                </span>
              </motion.div>
              {/* Progress HUD integrated below the pill */}
              {!isAlgo && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="pointer-events-auto ml-1"
                >
                  <ProgressArc />
                </motion.div>
              )}
            </div>



            {/* ── Canvas Empty State Placeholder (Redesigned as Playbar) ── */}
            {(!isGenerating && !canvasSteps?.length && !canvasObjects?.length) && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[40]">
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0, x: panelOpen ? -160 : 0 }}
                  transition={{ type: 'spring', damping: 30, stiffness: 200 }}
                  className="flex flex-col items-center gap-12"
                >
                  <div className="flex flex-col items-center gap-4">
                    <motion.div
                      animate={{ opacity: [0.2, 0.4, 0.2] }}
                      transition={{ duration: 4, repeat: Infinity }}
                      className="flex flex-col items-center"
                    >
                      <h3 className="text-[11px] font-black tracking-[0.6em] text-[var(--text-primary)] uppercase">
                        {topic ? topic : "TutorBoard AI"}
                      </h3>
                    </motion.div>
                    
                    {/* The Premium Playbar Component */}
                    <div className="relative w-[380px] group">
                      {/* Outer Glow */}
                      <div className="absolute inset-[-10px] blur-2xl bg-indigo-500/5 rounded-full opacity-50" />
                      
                      {/* The Track */}
                      <div className="relative h-[2px] w-full bg-white/[0.04] rounded-full overflow-hidden border border-white/[0.02]">
                        {/* Moving Scanning Beam (Holographic) */}
                        <motion.div 
                          animate={{ 
                            x: ['-120%', '250%'],
                          }}
                          transition={{ 
                            duration: 2.8, 
                            repeat: Infinity, 
                            ease: [0.4, 0, 0.2, 1] 
                          }}
                          className="absolute top-0 bottom-0 w-2/5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent opacity-90"
                          style={{ 
                            boxShadow: '0 0 20px 4px rgba(99, 102, 241, 0.3)',
                            filter: 'contrast(1.5) brightness(1.2)'
                          }}
                        />

                        {/* Secondary trailing beam */}
                        <motion.div 
                          animate={{ 
                            x: ['-150%', '220%'],
                          }}
                          transition={{ 
                            duration: 2.8, 
                            repeat: Infinity, 
                            ease: [0.4, 0, 0.2, 1],
                            delay: 0.1
                          }}
                          className="absolute top-0 bottom-0 w-1/4 bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent"
                        />
                      </div>

                      {/* Edge Flares */}
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-indigo-500/20 blur-[1px]" />
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-indigo-500/20 blur-[1px]" />
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-3">
                    <motion.p 
                      animate={{ opacity: [0.1, 0.25, 0.1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="text-[9px] font-bold text-[var(--text-primary)] tracking-[0.8em] uppercase ml-[0.8em]"
                    >
                      Initializing Neural Canvas
                    </motion.p>
                    
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <motion.div
                          key={i}
                          animate={{ scale: [1, 1.5, 1], opacity: [0.1, 0.4, 0.1] }}
                          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                          className="w-1 h-1 rounded-full bg-indigo-500"
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              </div>
            )}

            {/* 1. Narration Subtitle (Fixed Position Above Controls) */}
            {!useAlgoPanel && !isAlgo && (
              <div className="absolute bottom-[140px] left-1/2 -translate-x-1/2 z-[60] flex justify-center w-full max-w-[90%] md:max-w-3xl pointer-events-none">
                <div className="pointer-events-auto w-full flex justify-center">
                  <NarrationBar 
                    text={currentStep?.narration || currentStep?.explanation} 
                    isGenerating={isGenerating} 
                    onCancel={cancelSession}
                  />
                </div>
              </div>
            )}

            {/* ── Vertical Session Actions Pill (Bottom Left) ── */}
            <div className="absolute bottom-8 left-6 z-[40] pointer-events-none">
              <motion.div 
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex flex-col gap-2 p-1.5 rounded-2xl liquid-glass shadow-premium pointer-events-auto"
              >
                <Btn onClick={() => goToStep(0)} title="Reset to Start" className="rounded-xl">
                  <RotateCcw size={13} />
                </Btn>
                <Btn onClick={() => goToStep(currentStepIndex)} title="Replay Step" className="rounded-xl">
                  <RefreshCw size={12} />
                </Btn>
                <Btn onClick={() => canvasRef.current?.resetCamera()} title="Reset View" className="rounded-xl">
                  <Crosshair size={13} />
                </Btn>
                <Btn onClick={() => startSession(topic, topic)} title="New Example" className="rounded-xl">
                  <Dices size={13} />
                </Btn>
              </motion.div>
            </div>

            {/* ── Unified Floating Controls (Bottom Center) ── */}
            <motion.div 
              className="absolute bottom-8 left-1/2 z-[60] flex flex-col items-center pointer-events-none w-full"
              animate={{ 
                x: panelOpen ? -160 : 0 
              }}
              transition={{ type: 'spring', damping: 30, stiffness: 200 }}
              style={{ translateX: '-50%' }}
            >
              {/* ── Visual Timeline (Filmstrip) ── */}
              {isAlgo && canvasSteps.length > 1 && (
                <div className="mb-3 pointer-events-auto">
                  <Suspense fallback={null}>
                    <StepFilmstrip 
                      steps={canvasSteps} 
                      currentStepIndex={currentStepIndex} 
                      goToStep={goToStep} 
                    />
                  </Suspense>
                </div>
              )}
              
              <div className="relative pointer-events-auto">
                <UnifiedControlBar
                  currentStepIndex={currentStepIndex}
                  totalSteps={totalSteps}
                  isPlaying={isPlaying}
                  onPlay={play}
                  onPause={pause}
                  onPrevStep={prevStep}
                  onNextStep={nextStep}
                  onGoToStep={goToStep}
                  onSpeedChange={handleSpeed}
                  onAskDoubt={askDoubt}
                  isVoiceEnabled={isVoiceEnabled}
                  onToggleVoice={toggleVoice}
                  elapsedTime={formatted}
                  totalTime={totalFormatted}
                />
              </div>
            </motion.div>

            {/* Expand Panel Handle (Appears when panel is closed) */}
            <AnimatePresence>
              {!panelOpen && (
                <motion.button
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 20, opacity: 0 }}
                  onClick={() => setPanelOpen(true)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-[30] flex items-center justify-center w-7 h-20 pointer-events-auto transition-all liquid-glass group hover:w-9"
                  style={{
                    borderRight: 'none',
                    borderTopLeftRadius: '20px',
                    borderBottomLeftRadius: '20px',
                    boxShadow: '-4px 0 20px rgba(0,0,0,0.1)',
                  }}
                  title="Open Session Guide"
                >
                  <ChevronLeft size={18} className="opacity-50 group-hover:opacity-100 group-hover:-translate-x-0.5 transition-all" style={{ color: 'var(--text-primary)' }} />
                  {/* Active indicator dot */}
                  <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-info opacity-40 group-hover:opacity-100 transition-opacity" />
                </motion.button>
              )}
            </AnimatePresence>

            {/* Premium Liquid Glass Right Panel */}
            <AnimatePresence>
              {panelOpen && (
                <motion.div
                  layout
                  initial={{ opacity: 0, x: 20, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 20, scale: 0.95 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                  className="absolute right-6 top-24 bottom-24 w-[340px] z-[50] pointer-events-auto"
                >
                  <div className="h-full w-full liquid-glass flex flex-col overflow-hidden" 
                       style={{ 
                         borderRadius: 32,
                       }}>
                    <SessionGuide
                      step={{ 
                        ...currentStep, 
                        narration: currentStep?.narration || currentStep?.explanation || canvasSteps[currentStepIndex]?.narration 
                      }}
                      stepIndex={currentStepIndex} 
                      totalSteps={totalSteps}
                      variables={canvasSteps[currentStepIndex]?.variables || currentStep?.variables}
                      activeStates={canvasSteps[currentStepIndex]?.activeStates || currentStep?.activeStates}
                      algorithmName={timeline?.title || topic} 
                      timeline={timeline} 
                      professorNote={timeline?.professorNote || professorNote}
                      onGoToStep={goToStep}
                      doubtHistory={doubtHistory} 
                      isDoubtProcessing={isDoubtProcessing}
                      activeDoubtId={machine.activeDoubtId} 
                      onJumpToDoubt={machine.jumpToDoubt}
                      onPinDoubt={machine.pinDoubtToCanvas} 
                      onResume={resume} 
                      onAskDoubt={askDoubt}
                      isAlgo={isAlgo}
                      onReplay={() => goToStep(currentStepIndex)}
                      onClose={() => setPanelOpen(false)}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}

      <SessionResumeOverlay />
      <ShortcutsHUD />
      {/* Removed old timeline since it's now a floating pill in the canvas area */}

      <FloatingSidebar />

      {/* ── 4. Top Toolbar (Last in DOM to stay on top) ── */}
      {isTeaching && createPortal(
        <div 
          className="fixed top-4 z-[var(--z-portal)] pointer-events-auto transition-all duration-300"
          style={{ left: toolbarLeft }}
        >
          <div
            className="flex items-center gap-3 px-5 py-2 rounded-full liquid-glass transition-all hover:ring-1 hover:ring-white/10"
            style={{ 
              height: '54px', 
            }}
          >
            <div className="flex items-center gap-3 shrink-0">
              <button 
                onClick={() => setSidebarOpen(!isSidebarOpen)} 
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 transition-all text-[var(--text-primary)]"
                title={isSidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
              >
                <Menu size={16} />
              </button>
              <div className="w-px h-5 bg-white/10" />
              <button 
                onClick={() => setPanelOpen(!panelOpen)}
                className="flex flex-col text-left group cursor-pointer"
              >
                <span style={{ color: 'var(--text-primary)' }} className="text-[13px] font-sans font-bold tracking-tight group-hover:text-indigo-400 transition-colors">
                  {formatTopicTitle(timeline?.title || topic)}
                </span>
                <span className="text-[9px] font-medium text-[var(--text-tertiary)] uppercase tracking-widest opacity-60">
                   {isAlgo ? 'Algorithm Session' : 'Pedagogical Guide'}
                </span>
              </button>
            </div>

            <div className="w-px h-4 bg-[var(--border-color)] opacity-40 shrink-0" />

            <div className="flex items-center gap-0.5 shrink-0">
              <span style={{ color: 'var(--text-tertiary)' }} className="hidden md:block px-1.5 text-[11px] font-mono font-semibold tabular-nums">
                {currentStepIndex + 1}/{canvasSteps.length || 1}
              </span>


              <Btn onClick={() => setIsMinimized(true)} title="Minimize to Pill" className="rounded-full">
                <Minimize2 size={13} />
              </Btn>
              <Btn onClick={handleClose} danger title="Close" className="rounded-full"><X size={13} /></Btn>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};



// BTN helper removed or moved if needed

export default TeachingSession;
