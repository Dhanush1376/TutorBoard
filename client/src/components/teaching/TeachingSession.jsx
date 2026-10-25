import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, PanelRight, PanelRightClose, PanelLeft, PanelLeftClose, ChevronLeft, ArrowUp, Loader2, Sparkles,
  RotateCcw, RefreshCw, Dices, Crosshair, Volume2, VolumeX, AlertTriangle, BookOpen,
  Minimize2, Maximize2, Clock, CornerUpLeft, ZoomIn, ZoomOut
} from 'lucide-react';
import { useElapsedTime } from '../../hooks/useElapsedTime';

const AgentCanvasRenderer = React.lazy(() => import('../canvas/AgentCanvasRenderer'));
const FixedTeachingStage = lazy(() => import('../canvas/FixedTeachingStage'));
const CinematicStage = lazy(() => import('../canvas/CinematicStage'));
const SceneV2Stage = lazy(() => import('../canvas/SceneV2Stage'));
import CheckCard from './CheckCard';
import FloatingSidebar from './FloatingSidebar';
import ProgressArc from './ProgressArc';

import InteractiveControlPanel from './InteractiveControlPanel';
import UnifiedControlBar from './UnifiedControlBar';
import { SessionGuide } from './SessionGuide';
import SessionResumeOverlay from './SessionResumeOverlay';
import ShortcutsHUD from './ShortcutsHUD';

const StepFilmstrip = lazy(() => import('./StepFilmstrip'));
import { isDSAContent } from '../../engine/RendererRouter';
import useTeachingMachine, { STATES } from '../../hooks/useTeachingMachine';
import useVoiceNarrator from '../../hooks/useVoiceNarrator';
import useTutorStore, { CANVAS_MODE } from '../../store/tutorStore';
import { DOMAIN_STYLES, PANEL_VISIBLE_STATES as PANEL_VISIBLE_STATES_ARR, formatTopicTitle, checkKey } from '../../lib/teaching';

const PANEL_VISIBLE_STATES = new Set(PANEL_VISIBLE_STATES_ARR);

function Btn({ onClick, children, disabled, active, danger, className = '', title }) {
  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.08 }}
      whileTap={{ scale: disabled ? 1 : 0.92 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      onClick={onClick}
      disabled={disabled}
      title={title}
      type="button"
      className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors pointer-events-auto select-none ${className} ${
        disabled ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer'
      } ${
        active 
          ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] shadow-sm' 
          : 'bg-transparent text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
      }`}
      style={{
        color: (danger && !active) ? '#ef4444' : undefined,
        border: 'none',
      }}>
      {children}
    </motion.button>
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
    playbackSpeed: storePlaybackSpeed,
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

  // Engine v2: a question answered on the board, played as a branch of the lesson
  const sceneBranch = useTutorStore((s) => s.sceneBranch);
  const branchStep = sceneBranch ? sceneBranch.steps?.[sceneBranch.at - sceneBranch.from - 1] ?? null : null;

  // "predict the next step" (5.1): shown once the step's beat has played
  const stepCheck = timeline?.renderer === 'scene-v2' ? (timeline?.steps || [])[currentStepIndex]?.check : null;
  const stepCheckKey = checkKey(timeline, currentStepIndex);
  const checkAnswer = useTutorStore((s) => s.checkAnswers[stepCheckKey]);
  const beatPlayed = useTutorStore((s) => s.stepPlayback?.index === currentStepIndex && s.stepPlayback?.animDone);
  const showCheck = !!stepCheck && !sceneBranch && (beatPlayed || checkAnswer !== undefined);

  const isOpen = machineState !== STATES.IDLE || canvasLayout !== 'inline';
  const isGenerating = machineState === STATES.GENERATING;
  // FIX: Also show the canvas body when viewing a snapshot (canvasLayout !== 'inline' but machineState === IDLE)
  const isSnapshotView = canvasLayout !== 'inline' && machineState === STATES.IDLE;
  // The lesson must stay on screen while a doubt is being answered and while
  // paused (server state 'PAUSED') — the doubt is *about* what's on the canvas.
  const isTeaching = machineState === STATES.TEACHING || machineState === STATES.RESPONDING || machineState === STATES.RESUMING
    || machineState === STATES.DOUBT_TRIGGERED || machineState === 'PAUSED' || isGenerating || isSnapshotView;
  
  const domain = timeline?.domain?.toLowerCase() || 'general';
  const ds = DOMAIN_STYLES[domain] || DOMAIN_STYLES.general;
  const domainColor = ds.accent || '#3b82f6';
  // Engine v2 lessons (Scene Language) play on their own stage, with the narration bar
  const isSceneV2 = timeline?.renderer === 'scene-v2' && !!timeline?.sceneV2;
  const isAlgo = !isSceneV2 && isDSAContent(timeline);
  const useAlgoPanel = isAlgo;

  const stepType = currentStep?.type || (
    currentStep?.title?.toLowerCase().includes("intro") ? "Intro" : 
    currentStep?.title?.toLowerCase().includes("example") ? "Example" : 
    currentStep?.title?.toLowerCase().includes("summary") ? "Summary" : 
    currentStep?.title?.toLowerCase().includes("practice") ? "Practice" :
    currentStep?.title?.toLowerCase().includes("test") ? "Test" :
    currentStep?.title?.toLowerCase().includes("deep dive") ? "Deep Dive" :
    "Core"
  );

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const [panelOpen, setPanelOpen] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setPanelOpen(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [isDoubtExpanded, setIsDoubtExpanded] = useState(false);
  const [loadingError, setLoadingError] = useState(null);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [isResettingCamera, setIsResettingCamera] = useState(false);
  const [isClosingSession, setIsClosingSession] = useState(false);

  const rootRef = useRef(null);
  const canvasRef = useRef(null);

  const handleResetCamera = useCallback(() => {
    setIsResettingCamera(true);
    canvasRef.current?.resetCamera?.();
    setTimeout(() => setIsResettingCamera(false), 700);
  }, []);
  const { narrateStep, cancel } = useVoiceNarrator();

  // Auto-open side guide when a prediction check arrives so questions are always on the side, never on canvas
  useEffect(() => {
    if (showCheck) {
      setPanelOpen(true);
    }
  }, [showCheck]);


  // Voice narration trigger — narrateStep resolves the step's voiceDone
  // signal when speech genuinely ends (or after a reading-time estimate when
  // muted), which is what gates auto-advancement. No more fixed timers
  // cutting narration off mid-sentence.
  useEffect(() => {
    if (isTeaching && currentStep && !isGenerating) {
      const text = branchStep?.narration || currentStep.narration || currentStep.explanation;
      narrateStep(currentStepIndex, text || '');
    } else {
      cancel();
    }
  }, [currentStepIndex, isTeaching, isGenerating, narrateStep, cancel, currentStep, branchStep]);

  // Engine v2: click an element on the board → send question to input box
  // so the user can review and edit before sending (instead of submitting automatically)
  const handleAskAbout = useCallback((entity, verbatim = false) => {
    const label = String(entity.label ?? entity.text ?? entity.latex ?? entity.id).slice(0, verbatim ? 240 : 60);
    const question = verbatim ? label : `What is "${label}" showing at this point?`;
    
    // 1. Populate the UnifiedControlBar doubt input
    window.dispatchEvent(new CustomEvent('set-doubt-input', { detail: question }));

    // 2. Also populate the main chat input so it is ready if user opens chat/left panel
    useTutorStore.getState().setChatInputText(question);
    window.dispatchEvent(new CustomEvent('focus-input-bar'));

    // 3. Inform the user with a subtle toast
    showToast({ 
      message: `Query set in input for "${label}". Edit or press enter to ask!`, 
      type: 'info', 
      duration: 2500 
    });
  }, [showToast]);

  const handleElementClick = useCallback((id, event, data) => {
    if (event === 'click') {
      const question = `Can you explain what the element "${id}" representing ${data.type} is doing in this step?`;
      window.dispatchEvent(new CustomEvent('set-doubt-input', { detail: question }));
      useTutorStore.getState().setChatInputText(question);
      window.dispatchEvent(new CustomEvent('focus-input-bar'));
      showToast({ 
        message: `Query for "${id}" copied to input. Edit or press enter to send!`, 
        type: 'info', 
        duration: 2500 
      });
    }
  }, [showToast]);

  // ── Handlers ──────────────────────────────────────────────

  const handleClose = useCallback(() => {
    if (isClosingSession) return;
    setIsClosingSession(true);
    setTimeout(() => {
      // FIX: If we're in a snapshot view (not a live teaching session),
      // just close the canvas layout without calling endSession which clears session IDs.
      if (isSnapshotView) {
        useTutorStore.getState().setCanvasLayout('inline');
        useTutorStore.getState().setActiveSnapshotId(null);
      } else {
        endSession();
        // Also ensure canvas layout is reset
        useTutorStore.getState().setCanvasLayout('inline');
      }
      setIsClosingSession(false);
    }, 280);
  }, [isClosingSession, endSession, isSnapshotView]);

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
        setIsTimedOut(false);
        setLoadingError(null);
        return;
      }
      const same = topic?.toLowerCase() === initialTopic.toLowerCase();
      if (!same && machineState !== STATES.GENERATING) endSession();
    }
  }, [isOpen, initialTopic, machineState, startSession, timeline, topic, endSession, setCanvasMode]);

  // Loading Timeout (Bug 13)
  useEffect(() => {
    let timer;
    if (machineState === STATES.GENERATING) {
      timer = setTimeout(() => {
        setIsTimedOut(true);
        setLoadingError("The AI is taking longer than usual to generate this lesson. You can wait a bit longer or try re-initializing.");
      }, 45000); // 45s timeout
    } else {
      setIsTimedOut(false);
      setLoadingError(null);
    }
    return () => clearTimeout(timer);
  }, [machineState]);



  // ── Keyboard Navigation ──────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const fn = (e) => {
      // Never hijack keys while the student is typing (e.g. a doubt) —
      // arrows move the caret, Escape belongs to the field.
      if (e.target?.matches?.('input, textarea, select, [contenteditable="true"]')) return;
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
  const { formatted, formatTime, seconds, setSeconds } = useElapsedTime(isPlaying, machineState === STATES.GENERATING);
  const totalSeconds = Math.max(totalSteps * 8, 1); // Estimated 8s per step
  const totalFormatted = formatTime(totalSeconds);

  // Sync elapsed seconds when navigating steps
  useEffect(() => {
    if (totalSteps > 0) {
      const stepTargetSeconds = currentStepIndex * 8;
      // If manually jumped or stepped beyond current seconds, align seconds
      setSeconds(stepTargetSeconds);
    }
  }, [currentStepIndex, setSeconds, totalSteps]);

  // ── Bail ──────────────────────────────────────────────────
  if (!isOpen) return null;

  if (machineState === STATES.ERROR || isTimedOut) {
    return (
      <div className="teaching-session flex items-center justify-center p-6 bg-[var(--bg-primary)]">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="liquid-glass p-10 rounded-[32px] flex flex-col items-center gap-8 max-w-md text-center border border-red-500/20"
          style={{ boxShadow: '0 32px 80px -16px rgba(0,0,0,0.3)' }}
        >
           <div className={`w-20 h-20 rounded-3xl ${isTimedOut ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'} flex items-center justify-center mb-2 border`}>
             {isTimedOut ? <Clock size={40} strokeWidth={1.5} /> : <AlertTriangle size={40} strokeWidth={1.5} />}
           </div>
           <div className="space-y-3">
             <h2 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
               {isTimedOut ? "Taking its time..." : "Session Interrupted"}
             </h2>
             <p className="text-[13px] text-[var(--text-secondary)] opacity-70 leading-relaxed">
               {loadingError || error || "TutorBoard encountered an unexpected glitch while orchestrating your lesson."}
             </p>
             {!isTimedOut && (
               <p className="text-[11px] text-red-400/60 font-mono bg-red-500/5 py-2 px-3 rounded-lg border border-red-500/10">
                 {typeof error === 'string' && error.startsWith('{') ? 'JSON_PAYLOAD_ERROR' : (error || 'UNKNOWN_SESSION_FAILURE')}
               </p>
             )}
           </div>
           <div className="flex flex-col gap-3 w-full">
             <button 
               onClick={() => startSession(topic, topic)}
               className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-[var(--text-primary)] text-[var(--bg-primary)] font-bold text-sm hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-black/20"
             >
               <RefreshCw size={16} />
               {isTimedOut ? "Retry Generation" : "Re-initialize Lesson"}
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



  // ── Minimized pill handled via portal with fluid enter/exit transitions ──

  return (
    <motion.div
      ref={rootRef}
      className="teaching-session"
      role="dialog"
      aria-modal="true"
      aria-labelledby="teaching-session-title"
      tabIndex="-1"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{
        opacity: (isMinimized || isClosingSession) ? 0 : 1,
        scale: (isMinimized || isClosingSession) ? 0.96 : 1,
        y: isMinimized ? 24 : (isClosingSession ? -12 : 0),
      }}
      transition={{
        duration: 0.32,
        ease: [0.16, 1, 0.3, 1],
      }}
      style={{
        pointerEvents: (isMinimized || isClosingSession) ? 'none' : 'auto',
      }}
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
          </div>

          {/* Canvas Area (Flex sibling for dynamic adjustment) */}
          <motion.div layout className="teaching-canvas-area" style={{ background: 'transparent' }}>
            <div className="absolute inset-0 overflow-visible">
              {isSceneV2 ? (
              <Suspense fallback={null}>
                <SceneV2Stage
                  ref={canvasRef}
                  scene={timeline.sceneV2}
                  stepIndex={currentStepIndex}
                  onAskAbout={handleAskAbout}
                  // keep clear of the toolbar, step pill, narration + controls and preserve consistent element sizing
                  insets={{ 
                    top: isMobile ? 64 : 76, 
                    bottom: isMobile ? 80 : 124, 
                    left: isMobile ? 16 : (panelOpen ? 60 : 160), 
                    right: isMobile ? 16 : (panelOpen ? 392 : 160) 
                  }}
                />
              </Suspense>
              ) : (
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
              )}
            </div>



            {/* ── Engine v2: answering a question on the board → back to the lesson ── */}
            <AnimatePresence>
              {isSceneV2 && sceneBranch && (
                <motion.div
                  key="scene-branch"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-[84px] left-0 z-[60] flex justify-center pointer-events-none"
                  style={{ right: panelOpen ? 380 : 0 }}
                >
                <div className="pointer-events-auto flex items-center gap-3 pl-4 pr-1.5 py-1.5 rounded-full liquid-glass shadow-premium">
                  <span className="text-xs font-medium text-[var(--text-secondary)] whitespace-nowrap">
                    Your question · {Math.min(sceneBranch.beats, sceneBranch.at - sceneBranch.from)}/{sceneBranch.beats}
                  </span>
                  <button
                    type="button"
                    onClick={() => useTutorStore.getState().exitSceneBranch()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] text-[11px] font-semibold hover:opacity-90 active:scale-95 transition-all"
                  >
                    <CornerUpLeft size={12} />
                    Back to the lesson · step {currentStepIndex + 1}
                  </button>
                </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Step Orientation Pill (Floating Context) ── */}
            <div className="absolute top-[72px] md:top-[80px] left-3 md:left-6 z-[30] pointer-events-none flex flex-col gap-2 md:gap-3">
              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                key={`step-pill-${currentStepIndex}`}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--st-line-strong)] bg-[var(--bg-primary)]/90 shadow-[0_1px_2px_rgba(0,0,0,0.05),0_12px_32px_-18px_rgba(0,0,0,0.4)] backdrop-blur-xl"
              >
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: stepType?.toLowerCase() === 'summary' ? '#ca8a04' :
                      stepType?.toLowerCase() === 'example' ? '#16a34a' :
                        stepType?.toLowerCase() === 'intro' ? '#3b82f6' : 'var(--text-primary)'
                  }}
                />
                <span className="text-[11px] md:text-xs font-medium text-[var(--text-secondary)]">
                  {stepType ? `${stepType} · ` : ''}{currentStepIndex + 1}
                </span>
              </motion.div>
              {/* Progress HUD integrated below the pill */}
              {!isAlgo && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="pointer-events-auto ml-1 hidden sm:block"
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
                      <h3 className="text-xs font-medium text-[var(--text-primary)]">
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
                      key={machine.generationProgress?.label || 'init'}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs font-medium text-[var(--text-primary)]"
                    >
                      {machine.generationProgress?.label || 'Initializing Neural Canvas'}
                    </motion.p>
                    
                    {machine.generationProgress?.totalStages > 0 ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex gap-1.5">
                          {Array.from({ length: machine.generationProgress.totalStages }).map((_, i) => (
                            <motion.div
                              key={i}
                              initial={false}
                              animate={{ 
                                scale: i < machine.generationProgress.stage ? 1 : 0.8,
                                opacity: i < machine.generationProgress.stage ? 1 : 0.2,
                                backgroundColor: i < machine.generationProgress.stage ? '#3b82f6' : 'rgba(255,255,255,0.2)'
                              }}
                              className="w-1.5 h-1.5 rounded-full"
                            />
                          ))}
                        </div>
                        <span className="text-[10px] font-medium text-[var(--text-tertiary)] opacity-70">
                          Stage {machine.generationProgress.stage} of {machine.generationProgress.totalStages}
                        </span>
                      </div>
                    ) : (
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
                    )}
                  </div>
                </motion.div>
              </div>
            )}


            {/* ── Canvas Navigation Pill (Zoom / Reset) - Left Docked ── */}
            <motion.div 
              className="absolute bottom-4 sm:bottom-5 left-3 sm:left-5 z-[60] flex flex-col items-center gap-1 p-1.5 rounded-full border border-[var(--st-line-strong)] bg-[var(--bg-primary)]/90 shadow-[0_1px_2px_rgba(0,0,0,0.05),0_12px_32px_-18px_rgba(0,0,0,0.4)] backdrop-blur-xl pointer-events-auto"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <button
                type="button"
                onClick={() => canvasRef.current?.zoomIn?.()}
                title="Zoom In (+)"
                className="grid h-8 w-8 cursor-pointer place-items-center rounded-full text-[var(--text-secondary)] transition-all hover:bg-[var(--st-fill)] hover:text-[var(--text-primary)] active:scale-95"
              >
                <ZoomIn size={15} strokeWidth={1.8} />
              </button>
              <button
                type="button"
                onClick={() => canvasRef.current?.zoomOut?.()}
                title="Zoom Out (-)"
                className="grid h-8 w-8 cursor-pointer place-items-center rounded-full text-[var(--text-secondary)] transition-all hover:bg-[var(--st-fill)] hover:text-[var(--text-primary)] active:scale-95"
              >
                <ZoomOut size={15} strokeWidth={1.8} />
              </button>
              <div className="h-px w-4 bg-[var(--st-line-strong)] my-0.5" />
              <button
                type="button"
                onClick={handleResetCamera}
                title="Reset View"
                className={`grid h-8 w-8 cursor-pointer place-items-center rounded-full transition-all active:scale-95 ${
                  isResettingCamera
                    ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--st-fill)] hover:text-[var(--text-primary)]'
                }`}
              >
                <motion.div
                  animate={isResettingCamera ? { rotate: 360, scale: [1, 1.15, 1] } : { rotate: 0, scale: 1 }}
                  transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-center justify-center w-full h-full"
                >
                  <Crosshair size={15} strokeWidth={1.8} />
                </motion.div>
              </button>
            </motion.div>

            {/* ── Unified Playback Bar & Timeline - Centered on Desktop / Laptop ── */}
            <motion.div 
              className="absolute bottom-4 sm:bottom-5 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center pointer-events-none max-w-[calc(100vw-1.5rem)] md:max-w-[calc(100vw-6rem)]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
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
              
              <div className="pointer-events-auto">
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
                  playbackSpeed={storePlaybackSpeed ?? machine?.playbackSpeed ?? 1}
                  onAskDoubt={askDoubt}
                  isVoiceEnabled={isVoiceEnabled}
                  onToggleVoice={toggleVoice}
                  elapsedTime={formatted}
                  totalTime={totalFormatted}
                  elapsedSeconds={seconds}
                  totalDurationSeconds={totalSeconds}
                  isDoubtExpanded={isDoubtExpanded}
                  onDoubtExpandedChange={setIsDoubtExpanded}
                />
              </div>
            </motion.div>

            {/* Expand Panel Handle (Appears when panel is closed) */}
            <AnimatePresence>
              {!panelOpen && (
                <motion.button
                  initial={{ x: 30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 30, opacity: 0 }}
                  transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
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

            {/* Premium Liquid Glass Right Panel (Drawer on Mobile, Float Panel on Desktop) */}
            <AnimatePresence>
              {panelOpen && (
                <motion.div
                  initial={{ opacity: 0, x: isMobile ? 0 : 50, y: isMobile ? 60 : 0, scale: 0.96 }}
                  animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: isMobile ? 0 : 50, y: isMobile ? 60 : 0, scale: 0.96 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="fixed md:absolute right-3 md:right-6 bottom-20 md:bottom-auto md:top-20 w-[calc(100vw-1.5rem)] md:w-[360px] max-w-[380px] max-h-[calc(100vh-160px)] md:max-h-[calc(100vh-120px)] z-[75] md:z-[50] pointer-events-auto flex flex-col mx-auto left-3 md:left-auto"
                >
                  <div className="w-full liquid-glass flex flex-col overflow-hidden shadow-2xl transition-all duration-300" 
                       style={{ 
                         borderRadius: 24,
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
                      onReplay={() => { goToStep(currentStepIndex); useTutorStore.getState().replayStep(); }}
                      onClose={() => setPanelOpen(false)}
                      checkCard={showCheck ? (
                        <CheckCard
                          check={stepCheck}
                          answered={checkAnswer}
                          onAnswer={(choice, correct) => useTutorStore.getState().answerCheck(stepCheckKey, choice, correct)}
                          onContinue={() => {
                            const next = currentStepIndex + 1;
                            if (next < (timeline?.steps || []).length) useTutorStore.getState().setCurrentStep(next);
                          }}
                          onExplain={() => handleAskAbout({ label: `${stepCheck.question} — why is the answer "${stepCheck.choices[stepCheck.answer]}"`, id: 'check' }, true)}
                        />
                      ) : null}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* If the side guide is collapsed, dock the question on the right side — never on the visual canvas */}
            <AnimatePresence>
              {showCheck && !panelOpen && (
                <motion.div
                  key={`check-side-${stepCheckKey}`}
                  initial={{ opacity: 0, x: 40, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 40, scale: 0.95 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute right-6 top-24 w-[360px] max-w-[calc(100vw-3rem)] z-[65] pointer-events-auto"
                >
                  <CheckCard
                    check={stepCheck}
                    answered={checkAnswer}
                    onAnswer={(choice, correct) => useTutorStore.getState().answerCheck(stepCheckKey, choice, correct)}
                    onContinue={() => {
                      const next = currentStepIndex + 1;
                      if (next < (timeline?.steps || []).length) useTutorStore.getState().setCurrentStep(next);
                    }}
                    onExplain={() => handleAskAbout({ label: `${stepCheck.question} — why is the answer "${stepCheck.choices[stepCheck.answer]}"`, id: 'check' }, true)}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}

      <SessionResumeOverlay />
      {/* ShortcutsHUD removed as requested */}
      {/* Removed old timeline since it's now a floating pill in the canvas area */}

      <FloatingSidebar />

      {/* ── 4. Top Toolbar & Minimized Pill (Portals for guaranteed top z-index) ── */}
      {createPortal(
        <AnimatePresence>
          {isTeaching && isMinimized && !isClosingSession && (
            <motion.div
              key="minimized-pill"
              initial={{ y: 60, opacity: 0, scale: 0.88, filter: 'blur(4px)' }}
              animate={{ y: 0, opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ y: 50, opacity: 0, scale: 0.9, filter: 'blur(4px)' }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="fixed bottom-6 right-6 z-[var(--z-portal,100)] liquid-glass rounded-2xl shadow-2xl border border-white/15 overflow-hidden backdrop-blur-xl"
            >
              <motion.button
                whileHover={{ scale: 1.03, backgroundColor: 'rgba(255, 255, 255, 0.08)' }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setIsMinimized(false)}
                className="flex items-center gap-3 px-4 py-2.5 group cursor-pointer"
                title="Click to restore lesson"
              >
                <div className="relative flex items-center justify-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping absolute opacity-75" />
                  <span className="w-2 h-2 rounded-full bg-emerald-500 relative" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-400 font-mono">
                    Session Active
                  </span>
                  <span className="text-[12px] font-medium text-[var(--text-primary)] truncate max-w-[150px]">
                    {formatTopicTitle(timeline?.title || topic || 'Lesson')}
                  </span>
                </div>
                <div className="w-px h-5 bg-white/10 mx-0.5" />
                <div className="p-1 rounded-lg bg-white/5 text-[var(--text-secondary)] group-hover:text-white group-hover:bg-white/15 transition-all">
                  <Maximize2 size={13} />
                </div>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {createPortal(
        <AnimatePresence>
          {isTeaching && !isMinimized && !isClosingSession && (
            <motion.div 
              key="teaching-top-toolbar-container"
              initial={{ y: -32, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -28, opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="fixed top-3 md:top-4 z-[var(--z-portal)] pointer-events-auto transition-[left] duration-300 flex items-center gap-2 md:gap-3.5 max-w-[calc(100vw-1.5rem)]"
              style={{ left: isMobile ? 12 : toolbarLeft }}
            >
              {/* Separate Workspace / Sidebar Toggle Pill (only shown when sidebar is closed) */}
              <AnimatePresence>
                {!isSidebarOpen && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ duration: 0.2 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => setSidebarOpen(true)}
                    className="w-10 h-10 md:w-[54px] md:h-[54px] flex items-center justify-center rounded-full liquid-glass shadow-lg hover:ring-1 hover:ring-white/20 transition-all text-[var(--text-primary)] cursor-pointer shrink-0"
                    title="Open Workspace"
                    aria-label="Open Workspace"
                  >
                    <PanelLeft size={isMobile ? 15 : 18} />
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Main Session Pill */}
              <div
                className="flex items-center gap-2 md:gap-3.5 pl-3.5 md:pl-6 pr-2 md:pr-5 py-1.5 md:py-2 rounded-full liquid-glass transition-all hover:ring-1 hover:ring-white/10 max-w-[calc(100vw-4.5rem)]"
                style={{ 
                  height: isMobile ? '44px' : '54px', 
                }}
              >
                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                  <button 
                    onClick={() => setPanelOpen(!panelOpen)}
                    className="flex flex-col text-left group cursor-pointer min-w-0"
                  >
                    <span style={{ color: 'var(--text-primary)' }} className="text-[12px] md:text-[13px] font-sans font-bold tracking-tight group-hover:text-indigo-400 transition-colors truncate max-w-[140px] sm:max-w-[200px] md:max-w-[280px]">
                      {formatTopicTitle(timeline?.title || topic)}
                    </span>
                    <span className="text-[10px] md:text-[11px] font-medium text-[var(--text-tertiary)] opacity-70 truncate max-w-[140px] sm:max-w-[200px]">
                       {isAlgo ? 'Algorithm Session' : (timeline?.domain || 'Interactive Guide')}
                    </span>
                  </button>
                </div>

                <div className="w-px h-4 bg-[var(--border-color)] opacity-40 shrink-0" />

                <div className="flex items-center gap-0.5 shrink-0">
                  <span style={{ color: 'var(--text-tertiary)' }} className="hidden sm:block px-1.5 text-[10px] md:text-[11px] font-mono font-semibold tabular-nums">
                    {currentStepIndex + 1}/{canvasSteps.length || 1}
                  </span>

                  <Btn 
                    onClick={() => setIsMinimized(true)} 
                    title="Minimize to Pill" 
                    className="w-7 h-7 md:w-8 md:h-8 rounded-full hover:!bg-white/10"
                  >
                    <motion.div
                      whileHover={{ scale: 0.82 }}
                      whileTap={{ scale: 0.72 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                    >
                      <Minimize2 size={isMobile ? 11 : 13} />
                    </motion.div>
                  </Btn>
                  <Btn 
                    onClick={handleClose} 
                    danger 
                    title="Close Session" 
                    className="w-7 h-7 md:w-8 md:h-8 rounded-full hover:!bg-red-500/15 hover:!text-red-400"
                  >
                    <motion.div
                      whileHover={{ rotate: 90, scale: 1.15 }}
                      whileTap={{ scale: 0.85, rotate: 180 }}
                      transition={{ type: 'spring', stiffness: 450, damping: 18 }}
                    >
                      <X size={isMobile ? 11 : 13} />
                    </motion.div>
                  </Btn>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </motion.div>
  );
};



// BTN helper removed or moved if needed

export default TeachingSession;
