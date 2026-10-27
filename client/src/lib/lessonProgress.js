/**
 * lessonProgress.js — where the learner is in a visual lesson, and whether
 * they finished it. Pure functions; saving and restoring live in
 * hooks/useLessonProgress.js.
 *
 * The saved position is the step the learner last VIEWED (not the last one
 * they finished). A lesson is complete only once its final step has actually
 * played — showing the last step for a moment (e.g. while it loads) is not
 * completing it.
 */

/** Does this scene have content a lesson can start on (at least one real step)? */
export function isPlayableLesson(scene) {
  if (!scene) return false;
  const steps = scene.steps || scene.timeline || [];
  if (scene.renderer === 'scene-v2') {
    const beats = scene.sceneV2?.beats;
    return !!scene.sceneV2 && Array.isArray(steps) && steps.length > 0 && (!Array.isArray(beats) || beats.length > 0);
  }
  return Array.isArray(steps) && steps.some((s) => s && typeof s === 'object' && Object.keys(s).length > 0);
}

/** Is there anything meaningful on the canvas (a lesson, or drawn objects)? */
export function hasCanvasContent({ scene, canvasObjects = [], canvasSteps = [] } = {}) {
  if (isPlayableLesson(scene)) return true;
  if (Array.isArray(canvasObjects) && canvasObjects.length > 0) return true;
  return Array.isArray(canvasSteps) && canvasSteps.some((s) => s && typeof s === 'object' && Object.keys(s).length > 0);
}

/**
 * Where to open a lesson with `totalSteps` steps, given what was saved.
 *   → { step, completed, changed }
 * `changed`: a position was saved but no longer fits this lesson (it was
 * regenerated with a different number of steps), so it starts from the top.
 */
export function resolveStartStep(saved, totalSteps) {
  const total = Math.max(0, Number(totalSteps) || 0);
  if (!saved || total === 0 || !Number.isInteger(saved.step) || saved.step < 0) {
    return { step: 0, completed: false, changed: false };
  }
  if (saved.totalSteps && saved.totalSteps !== total) {
    return { step: 0, completed: false, changed: saved.step > 0 || !!saved.completed };
  }
  const step = Math.min(saved.step, total - 1);
  return { step, completed: !!saved.completed && step === total - 1, changed: false };
}

/**
 * Has the learner finished the lesson? Only when its last step is on screen
 * AND that step's animation has finished playing, and no more steps are
 * still streaming in.
 */
export function isLessonComplete({ currentStepIndex, totalSteps, stepPlayback, streaming = false }) {
  if (streaming || !(totalSteps > 1)) return false;
  const last = totalSteps - 1;
  return currentStepIndex === last && stepPlayback?.index === last && !!stepPlayback?.animDone;
}

/** Of two saved positions, the one saved later (by its client clock). */
export const newerPosition = (a, b) => {
  if (!a) return b || null;
  if (!b) return a;
  return (b.savedAt || 0) > (a.savedAt || 0) ? b : a;
};
