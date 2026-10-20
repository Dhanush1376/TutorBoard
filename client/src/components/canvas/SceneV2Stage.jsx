import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { SceneEngine } from '../../scene/engine';
import { readingSeconds } from '../../scene/tokens';

/** Learners who ask the OS for less motion get each step's end state, not its animation. */
const prefersReducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
import useTutorStore from '../../store/tutorStore';

/**
 * Engine v2 stage for lessons whose timeline has `renderer: 'scene-v2'`.
 *
 * One step = one beat. Entering a step plays its beat; the beat's end marks the
 * step's animation done, which (with the narration) gates auto-advance exactly
 * like the v1 canvas. While the scene is still streaming in, later beats are
 * spliced into the running engine without interrupting playback.
 *
 * Doubts: when the store holds a `sceneBranch` (a question answered on this
 * board), the stage plays the answer's beats one after another; leaving the
 * branch restores the lesson at the step it was on. Clicking an element on the
 * board asks about it (`onAskAbout`).
 */
const SceneV2Stage = forwardRef(function SceneV2Stage({ scene, stepIndex, insets, onAskAbout }, ref) {
  const hostRef = useRef(null);
  const engineRef = useRef(null);
  const loadedRef = useRef(null);
  const [loadedBeats, setLoadedBeats] = useState(0);
  const reducedMotion = useRef(prefersReducedMotion()).current;
  const branchTimer = useRef(null);

  const { isPaused, playbackSpeed, replayNonce, sceneBranch } = useTutorStore(useShallow((s) => ({
    isPaused: s.isPaused,
    playbackSpeed: s.playbackSpeed,
    replayNonce: s.replayNonce,
    sceneBranch: s.sceneBranch,
  })));

  // latest values for async callbacks
  const sceneRef = useRef(scene);
  const stepRef = useRef(stepIndex);
  const replayRef = useRef(replayNonce);
  sceneRef.current = scene;
  stepRef.current = stepIndex;
  replayRef.current = replayNonce;
  /** the doubt being played on the board, or null */
  const branchRef = useRef(null);
  /** true while the lesson is being rebuilt after a doubt */
  const restoringRef = useRef(false);
  const lastRef = useRef({ step: -1, replay: replayNonce, paused: isPaused });

  // keyboard learners reach every element on the board and ask about it with Enter / Space
  const makeAskable = useCallback(() => {
    const host = hostRef.current;
    if (!host || !onAskAbout) return;
    const shown = branchRef.current?.scene ?? sceneRef.current;
    host.querySelectorAll('[data-entity]').forEach((el) => {
      const e = shown?.entities?.find((x) => x.id === el.getAttribute('data-entity'));
      if (!e) return;
      el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', `Ask about ${String(e.label ?? e.text ?? e.latex ?? e.id).slice(0, 60)}`);
    });
  }, [onAskAbout]);

  useImperativeHandle(ref, () => ({
    resetCamera: () => engineRef.current?.refit(),
  }), []);

  // one engine per mount
  useEffect(() => {
    const engine = new SceneEngine(hostRef.current, {
      insets,
      onBeatEnd: (i) => {
        if (!branchRef.current) {
          useTutorStore.getState().markStepAnimDone(i);
          return;
        }
        // a doubt plays its beats one after another
        if (i + 1 < engine.beatCount) {
          useTutorStore.getState().setBranchBeat(i + 1);
          engine.playBeat(i + 1);
        }
      },
    });
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
      loadedRef.current = null;
    };
    // insets are applied by their own effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // load a new lesson, or extend the one that is streaming in (not while a doubt is on the board)
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !scene?.beats?.length || branchRef.current || restoringRef.current) return;
    const prev = loadedRef.current;
    const sameLesson = prev && prev.title === scene.title && prev.firstBeat === scene.beats[0]?.title && scene.beats.length >= prev.beats;
    if (sameLesson && scene.beats.length === prev.beats && prev.scene === scene) return;
    loadedRef.current = { scene, title: scene.title, firstBeat: scene.beats[0]?.title, beats: scene.beats.length };
    (sameLesson ? engine.extend(scene) : engine.load(scene)).then(() => {
      if (engineRef.current === engine && !branchRef.current) { setLoadedBeats(engine.beatCount); makeAskable(); }
    });
  }, [scene]);

  // a doubt: play the answer on the board — and come back to the lesson after
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const prev = branchRef.current;
    if (sceneBranch && sceneBranch.scene !== prev?.scene) {
      branchRef.current = sceneBranch;
      clearTimeout(branchTimer.current);
      engine.load(sceneBranch.scene).then((r) => {
        if (!r || branchRef.current !== sceneBranch) return;
        makeAskable();
        engine.seekBeat(sceneBranch.from, 'end');
        if (!reducedMotion) { engine.playBeat(sceneBranch.from + 1); return; }
        const show = (i) => {
          if (branchRef.current !== sceneBranch || i >= engine.beatCount) return;
          engine.seekBeat(i, 'end');
          useTutorStore.getState().setBranchBeat(i);
          const said = sceneBranch.steps?.[i - sceneBranch.from - 1]?.narration ?? '';
          branchTimer.current = setTimeout(() => show(i + 1), readingSeconds(said) * 1000);
        };
        show(sceneBranch.from + 1);
      });
    } else if (!sceneBranch && prev) {
      branchRef.current = null;
      clearTimeout(branchTimer.current);
      restoringRef.current = true;
      const lesson = sceneRef.current;
      loadedRef.current = { scene: lesson, title: lesson.title, firstBeat: lesson.beats[0]?.title, beats: lesson.beats.length };
      engine.load(lesson).then((r) => {
        restoringRef.current = false;
        if (!r || branchRef.current) return;
        setLoadedBeats(engine.beatCount);
        makeAskable();
        const step = Math.min(stepRef.current, engine.beatCount - 1);
        const moved = lastRef.current.step !== step || lastRef.current.replay !== replayRef.current;
        lastRef.current = { ...lastRef.current, step, replay: replayRef.current };
        // the learner picked another step (or Replay) meanwhile: play it; otherwise carry on from where it was
        if (moved) engine.playBeat(step);
        else engine.seekBeat(step, 'end');
      });
    }
  }, [sceneBranch]);

  // Entering a step (or Replay) plays its beat, once that beat has arrived —
  // even while paused, like the v1 canvas: jumping to a step shows it happen.
  // Pause/resume with no step change holds or continues the beat in progress.
  // One effect for both, because goToStep changes step and pause together.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || stepIndex < 0 || restoringRef.current) return;
    const last = lastRef.current;
    const stepChanged = last.step !== stepIndex || last.replay !== replayNonce;
    if (branchRef.current) {
      // moving the lesson (step list, next, Replay) leaves the answer
      if (stepChanged) useTutorStore.getState().exitSceneBranch();
      else if (last.paused !== isPaused) {
        lastRef.current = { ...last, paused: isPaused };
        if (isPaused) engine.pause(); else engine.resume();
      }
      return;
    }
    if (stepIndex >= loadedBeats) return;
    lastRef.current = { step: stepIndex, replay: replayNonce, paused: isPaused };
    if (stepChanged && reducedMotion) {
      engine.seekBeat(stepIndex, 'end');
      useTutorStore.getState().markStepAnimDone(stepIndex);
    } else if (stepChanged) engine.playBeat(stepIndex);
    else if (last.paused !== isPaused) { if (isPaused) engine.pause(); else engine.resume(); }
  }, [stepIndex, loadedBeats, replayNonce, isPaused]);

  useEffect(() => { engineRef.current?.setSpeed(Math.max(0.25, playbackSpeed || 1)); }, [playbackSpeed, loadedBeats]);

  // room changes (side panel) and host resizes re-fit the camera in place
  const insetsKey = JSON.stringify(insets || {});
  useEffect(() => {
    if (loadedBeats) engineRef.current?.setInsets(insets || {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insetsKey]);
  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === 'undefined') return undefined;
    let timer;
    let first = true;
    const ro = new ResizeObserver(() => {
      if (first) { first = false; return; } // initial observation, not a resize
      clearTimeout(timer);
      timer = setTimeout(() => engineRef.current?.refit(), 160);
    });
    ro.observe(host);
    return () => { ro.disconnect(); clearTimeout(timer); };
  }, []);

  // click an element on the board → ask about it
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !onAskAbout) return undefined;
    const area = (r) => r.width * r.height;
    const onClick = (e) => {
      let el = e.target.closest?.('[data-entity]');
      if (!el) {
        // SVG groups only take clicks on painted pixels (not the gaps between cells or nodes):
        // fall back to the smallest element whose box holds the pointer
        el = [...host.querySelectorAll('[data-entity]')]
          .map((n) => ({ n, r: n.getBoundingClientRect() }))
          .filter(({ r }) => e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom)
          .sort((a, b) => area(a.r) - area(b.r))[0]?.n;
      }
      const id = el?.getAttribute('data-entity');
      const shown = branchRef.current?.scene ?? sceneRef.current;
      const entity = id && shown?.entities?.find((x) => x.id === id);
      if (entity) onAskAbout(entity);
    };
    const onKey = (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (!e.target.closest?.('[data-entity]')) return;
      e.preventDefault();
      onClick(e);
    };
    host.addEventListener('click', onClick);
    host.addEventListener('keydown', onKey);
    return () => { host.removeEventListener('click', onClick); host.removeEventListener('keydown', onKey); };
  }, [onAskAbout]);

  // what a screen reader hears: the board as an image, and each step's narration as it comes
  const beat = sceneBranch
    ? sceneBranch.scene?.beats?.[sceneBranch.at]
    : scene?.beats?.[Math.max(0, stepIndex)];
  const where = sceneBranch ? 'Answer to your question' : `Step ${stepIndex + 1} of ${scene?.beats?.length ?? 0}`;
  const said = beat ? `${where}: ${beat.title}. ${beat.narration}` : '';

  return (
    <div
      ref={hostRef}
      className="scene-v2-stage"
      data-engine="v2"
      role="img"
      aria-label={scene ? `${scene.title} — ${said}` : 'Visual lesson'}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}
    >
      {onAskAbout && <style>{'.scene-v2-stage [data-entity]{cursor:help}'}</style>}
      <div aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
        {said}
      </div>
    </div>
  );
});

export default SceneV2Stage;
