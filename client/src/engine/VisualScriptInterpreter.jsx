import React, { useEffect, useMemo } from 'react';
import GSAPExecutor from './GSAPExecutor';
import CanvasStateSnapshot from './CanvasStateSnapshot';

/**
 * VisualScriptInterpreter v3.0 (React Component)
 * 
 * Orchestrates GSAP animations within the React lifecycle.
 * Executes VisualScript actions whenever they change.
 */
export default function VisualScriptInterpreter({ actions, currentStepIndex, children }) {
  // Memoize executor and snapshot to persist across renders
  const executor = useMemo(() => new GSAPExecutor(), []);
  const snapshot = useMemo(() => new CanvasStateSnapshot(), []);

  useEffect(() => {
    if (!actions || actions.length === 0) return;

    console.log(`[VisualScript] 🎬 Step ${currentStepIndex}: Executing ${actions.length} actions`);
    
    // 1. Capture current positions for continuity
    snapshot.capture();

    // 2. Run the animation sequence
    executor.run(actions);

    // Cleanup: stop animations if step changes rapidly
    return () => {
      // executor.killAll(); // Optional: keeps animations playing if they are long
    };
  }, [actions, currentStepIndex, executor, snapshot]);

  // Handle session reset / unmount
  useEffect(() => {
    return () => {
      executor.killAll();
      snapshot.clear();
    };
  }, [executor, snapshot]);

  return <>{children}</>;
}
