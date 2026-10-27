import { useCallback, useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useTutorStore from '../store/tutorStore';
import API, { BASE_URL, getAuthHeaders } from '../services/api';
import { isLessonComplete, isPlayableLesson } from '../lib/lessonProgress';

/** Step changes within this window are saved as one write (skimming through steps). */
const SAVE_DELAY_MS = 800;

/**
 * Save `position` ({ step, totalSteps, completed, savedAt, params? }) for the lesson
 * saved as `artifactId`. `keepalive` lets the request outlive the page (used
 * when the tab is being hidden or closed).
 * → { ok, stale, lessonProgress } | { changed: true } (the lesson was regenerated)
 */
export async function saveLessonPosition(artifactId, position, { keepalive = false } = {}) {
  if (keepalive && typeof fetch === 'function') {
    const res = await fetch(`${BASE_URL}/api/artifact/${artifactId}/progress`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(position),
      credentials: 'include',
      keepalive: true,
    });
    if (res.status === 409) return { changed: true };
    if (!res.ok) throw new Error(`save failed (${res.status})`);
    return res.json();
  }
  try {
    const { data } = await API.patch(`/api/artifact/${artifactId}/progress`, position);
    return data;
  } catch (err) {
    if (err?.response?.status === 409) return { changed: true };
    throw err;
  }
}

/**
 * useLessonProgress — keeps the learner's place in the lesson on screen.
 *
 * Every meaningful step change of a saved lesson (one with an artifact id) is
 * remembered at once in the store (so reopening it in this session is
 * instant) and written to the server shortly after (debounced, so skimming
 * steps is one write, and never per animation frame). A pending write is sent
 * immediately when the learner switches lesson, closes the canvas, hides or
 * leaves the page. Writes carry the client time of the change, so a late or
 * stale write never replaces a newer position (server check). A failed write
 * keeps the lesson usable and stays queued: the next save point (another step,
 * leaving the lesson, hiding the page) sends it again.
 *
 * What is saved is the last VIEWED step; `completed` becomes true once the
 * last step has actually played, and stays true. An Engine v2 lesson with
 * sliders also saves their values (`params`), written the same way.
 */
export default function useLessonProgress() {
  const { scene, step, total, stepPlayback, inBranch, params } = useTutorStore(useShallow((s) => ({
    scene: s.activeScene,
    params: s.activeScene?.artifactId ? s.lessonParams[s.activeScene.artifactId] : undefined,
    step: s.currentStepIndex,
    total: s.totalSteps,
    stepPlayback: s.stepPlayback,
    inBranch: !!s.sceneBranch,
  })));
  const artifactId = scene?.artifactId || null;

  const pendingRef = useRef(null); // { artifactId, position } not yet written
  const timerRef = useRef(null);

  const flush = useCallback((opts = {}) => {
    clearTimeout(timerRef.current);
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    saveLessonPosition(pending.artifactId, pending.position, opts)
      .then((res) => {
        // the server holds a newer position (another tab / device): adopt it
        if (res?.stale && res.lessonProgress) {
          useTutorStore.getState().rememberLessonPosition(pending.artifactId, res.lessonProgress);
        }
      })
      .catch(() => {
        // keep it for the next save point unless something newer is already queued
        if (!pendingRef.current) pendingRef.current = pending;
      });
  }, []);

  // Record each step change of a saved, fully arrived lesson
  useEffect(() => {
    if (!artifactId || !scene || scene.streaming || inBranch || !isPlayableLesson(scene)) return;
    if (!(total > 0) || step < 0 || step >= total) return;
    const store = useTutorStore.getState();
    const prev = store.lessonPositions[artifactId];
    const justCompleted = !scene.cancelled && isLessonComplete({ currentStepIndex: step, totalSteps: total, stepPlayback, streaming: scene.streaming });
    const completed = justCompleted || (!!prev?.completed && prev.totalSteps === total);
    const paramsKey = params ? JSON.stringify(params) : '';
    if (prev && prev.step === step && prev.totalSteps === total && !!prev.completed === completed
      && (prev.params ? JSON.stringify(prev.params) : '') === paramsKey) return;
    if (!prev && step === 0 && !completed && !params) return; // the default position: nothing to save
    const position = { step, totalSteps: total, completed, savedAt: Date.now(), ...(params ? { params } : {}) };
    store.rememberLessonPosition(artifactId, position);
    pendingRef.current = { artifactId, position };
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => flush(), SAVE_DELAY_MS);
  }, [artifactId, scene, step, total, stepPlayback, inBranch, params, flush]);

  // Leaving this lesson (another one opened, canvas cleared): write it now
  useEffect(() => () => flush(), [artifactId, flush]);

  // Hiding / leaving the page: write it with keepalive so it survives unload
  useEffect(() => {
    const onHide = () => flush({ keepalive: true });
    const onVisibility = () => { if (document.visibilityState === 'hidden') onHide(); };
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVisibility);
      clearTimeout(timerRef.current);
    };
  }, [flush]);
}
