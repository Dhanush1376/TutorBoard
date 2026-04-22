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
  const snapshot = useMemo(() => new CanvasStateSnapshot(), []);
  const lastActionsRef = useRef(null);

  // Read deltaState timestamp so we re-run when new deltas arrive
  const deltaTimestamp = useTutorStore(s => s.deltaState?.timestamp);

  useEffect(() => {
    if (!actions || actions.length === 0) return;

    // Deduplicate: don't re-run the exact same actions array reference
    if (lastActionsRef.current === actions) return;
    lastActionsRef.current = actions;

    console.log(`[VisualScript] 🎬 Step ${currentStepIndex}: Executing ${actions.length} actions`);
    
    // 1. Capture current positions for continuity
    snapshot.capture();

    // 2. Run the animation sequence
    executor.run(actions);

    // Cleanup: stop animations if step changes rapidly
    return () => {
      // Let current animations finish unless component unmounts
    };
  }, [actions, currentStepIndex, deltaTimestamp, executor, snapshot]);

  // Handle session reset / unmount
  useEffect(() => {
    return () => {
      executor.killAll();
      snapshot.clear();
    };
  }, [executor, snapshot]);

  return <>{children}</>;
}
