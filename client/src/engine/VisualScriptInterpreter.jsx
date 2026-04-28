import React, { useEffect, useMemo, useRef } from 'react';
import GSAPExecutor from './GSAPExecutor';
import CanvasStateSnapshot from './CanvasStateSnapshot';
import useTutorStore from '../store/tutorStore';

/**
 * VisualScriptInterpreter v3.1 (React Component)
 * 
 * Orchestrates GSAP animations within the React lifecycle.
 * Executes VisualScript actions from both step transitions AND doubt-deltas.
 */
export default function VisualScriptInterpreter({ actions, currentStepIndex, children }) {
  const executor = useMemo(() => new GSAPExecutor(), []);
  const lastActionsRef = useRef(null);

  // Read deltaState from store
  const deltaState = useTutorStore(s => s.deltaState);
  const setDeltaRunning = useTutorStore(s => s.setDeltaRunning);
  const play = useTutorStore(s => s.play);


  // ─── Phase 3: Surgical Delta Execution ───────────────────────────────────
  useEffect(() => {
    if (!deltaState || !deltaState.actions || deltaState.actions.length === 0) return;

    console.log(`[VisualScript] 🚀 Executing Surgical Delta (${deltaState.actions.length} actions)`);

    setDeltaRunning(true);
    const tl = executor.runDelta(deltaState.actions);

    if (tl) {
      tl.eventCallback('onComplete', () => {
        setDeltaRunning(false);
        // Automatically resume the lesson after the surgical intervention
        play();
      });

    }


    return () => {
      if (executor.deltaTimeline) executor.deltaTimeline.kill();
    };
  }, [deltaState, executor, setDeltaRunning]);

  // ─── Main Timeline Execution ─────────────────────────────────────────────
  useEffect(() => {
    if (!actions || actions.length === 0) return;
    if (lastActionsRef.current === actions) return;
    lastActionsRef.current = actions;

    console.log(`[VisualScript] 🎬 Step ${currentStepIndex}: Executing ${actions.length} actions`);

    executor.run(actions);
  }, [actions, currentStepIndex, executor]);


  // Handle session reset / unmount
  useEffect(() => {
    return () => {
      executor.killAll();
    };
  }, [executor]);

  return <>{children}</>;
}
