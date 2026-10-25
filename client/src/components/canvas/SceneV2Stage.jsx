import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { SceneEngine } from '../../scene/engine';
import { readingSeconds } from '../../scene/tokens';

/** Learners who ask the OS for less motion get each step's end state, not its animation. */
const prefersReducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
import { RotateCcw, MessageSquareQuote, Edit3 } from 'lucide-react';
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
  const [navState, setNavState] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const draggedUntilRef = useRef(0);
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
    resetCamera: () => {
      engineRef.current?.resetNav(true);
    },
    zoomIn: () => engineRef.current?.zoomBy(1.25, undefined, undefined, true),
    zoomOut: () => engineRef.current?.zoomBy(0.8, undefined, undefined, true),
  }), []);

  // one engine per mount
  useEffect(() => {
    const engine = new SceneEngine(hostRef.current, {
      insets,
      onNavChange: (t) => setNavState({ ...t }),
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

  // interactive pan & zoom navigation
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    let isPointerDown = false;
    let startX = 0;
    let startY = 0;
    let startNav = { x: 0, y: 0, scale: 1 };
    let hasMoved = false;
    const activePointers = new Map();
    let pinchDist = 0;
    let pinchScale = 1;

    // Wheel Zoom
    const onWheel = (e) => {
      e.preventDefault();
      const rect = host.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const factor = Math.exp(-e.deltaY * 0.0018);
      engineRef.current?.zoomBy(factor, cx, cy, false);
    };

    // Pointer Events for Pan & Pinch-Zoom
    const onPointerDown = (e) => {
      if (e.target.closest('button')) return;
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (activePointers.size === 1) {
        isPointerDown = true;
        hasMoved = false;
        startX = e.clientX;
        startY = e.clientY;
        startNav = { ...(engineRef.current?.navTransform || { x: 0, y: 0, scale: 1 }) };
        try { host.setPointerCapture(e.pointerId); } catch {}
      } else if (activePointers.size === 2) {
        const pts = [...activePointers.values()];
        pinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        pinchScale = engineRef.current?.navTransform?.scale || 1;
        startNav = { ...(engineRef.current?.navTransform || { x: 0, y: 0, scale: 1 }) };
      }
    };

    const onPointerMove = (e) => {
      if (!activePointers.has(e.pointerId)) return;
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // Handle 2-finger pinch zoom
      if (activePointers.size === 2) {
        const pts = [...activePointers.values()];
        const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (pinchDist > 0 && currentDist > 0) {
          const ratio = currentDist / pinchDist;
          const rect = host.getBoundingClientRect();
          const midX = (pts[0].x + pts[1].x) / 2 - rect.left;
          const midY = (pts[0].y + pts[1].y) / 2 - rect.top;
          const targetScale = Math.min(4.0, Math.max(0.4, Number((pinchScale * ratio).toFixed(3))));
          const curr = engineRef.current?.navTransform || { x: 0, y: 0, scale: 1 };
          const sRatio = targetScale / curr.scale;
          const nextX = midX - (midX - curr.x) * sRatio;
          const nextY = midY - (midY - curr.y) * sRatio;
          engineRef.current?.setNavTransform({ x: nextX, y: nextY, scale: targetScale }, false);
          hasMoved = true;
        }
        return;
      }

      if (!isPointerDown) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!hasMoved && Math.hypot(dx, dy) > 4) {
        hasMoved = true;
        setIsDragging(true);
      }

      if (hasMoved) {
        engineRef.current?.setNavTransform({
          x: startNav.x + dx,
          y: startNav.y + dy,
          scale: startNav.scale,
        }, false);
      }
    };

    const onPointerUp = (e) => {
      activePointers.delete(e.pointerId);
      try { host.releasePointerCapture(e.pointerId); } catch {}

      if (activePointers.size === 0) {
        isPointerDown = false;
        setIsDragging(false);
        if (hasMoved) {
          draggedUntilRef.current = Date.now() + 150;
        }
      }
    };

    const onDblClick = (e) => {
      if (e.target.closest('button')) return;
      engineRef.current?.resetNav(true);
    };

    host.addEventListener('wheel', onWheel, { passive: false });
    host.addEventListener('pointerdown', onPointerDown);
    host.addEventListener('pointermove', onPointerMove);
    host.addEventListener('pointerup', onPointerUp);
    host.addEventListener('pointercancel', onPointerUp);
    host.addEventListener('dblclick', onDblClick);

    return () => {
      host.removeEventListener('wheel', onWheel);
      host.removeEventListener('pointerdown', onPointerDown);
      host.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('pointerup', onPointerUp);
      host.removeEventListener('pointercancel', onPointerUp);
      host.removeEventListener('dblclick', onDblClick);
    };
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
    if (stepChanged) {
      engine.resetNav(true);
    }
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

  // Hover Popover state for previewing the query before click
  const [hoverPopover, setHoverPopover] = useState(null); // { x, y, entity, question, label }
  const hoverHideTimerRef = useRef(null);
  const isOverPopoverRef = useRef(false);

  // click an element on the board → ask about it
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !onAskAbout) return undefined;
    const area = (r) => r.width * r.height;

    const isElementVisible = (elementNode) => {
      if (!elementNode) return false;
      const style = window.getComputedStyle(elementNode);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      if (parseFloat(style.opacity || '1') < 0.05) return false;

      // Check the child .fx container or svg graphics
      const fx = elementNode.querySelector?.('.fx');
      if (fx) {
        const fxStyle = window.getComputedStyle(fx);
        if (fxStyle.display === 'none' || fxStyle.visibility === 'hidden') return false;
        if (parseFloat(fxStyle.opacity || '1') < 0.05) return false;
      }

      // Check if bounding client rect has positive dimensions
      const rect = elementNode.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;

      return true;
    };

    const findEntityFromTarget = (target, clientX, clientY) => {
      let el = target.closest?.('[data-entity]');
      if (el && !isElementVisible(el)) {
        el = null;
      }

      if (!el && clientX !== undefined && clientY !== undefined) {
        el = [...host.querySelectorAll('[data-entity]')]
          .filter((n) => isElementVisible(n))
          .map((n) => ({ n, r: n.getBoundingClientRect() }))
          .filter(({ r }) => clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom)
          .sort((a, b) => area(a.r) - area(b.r))[0]?.n;
      }

      const id = el?.getAttribute('data-entity');
      const shown = branchRef.current?.scene ?? sceneRef.current;
      const entity = id && shown?.entities?.find((x) => x.id === id);
      return { el, entity };
    };

    const onClick = (e) => {
      if (Date.now() < draggedUntilRef.current) return;
      if (e.target.closest?.('[data-hover-capsule]')) return;
      const { entity } = findEntityFromTarget(e.target, e.clientX, e.clientY);
      if (entity) {
        onAskAbout(entity);
        setHoverPopover(null);
      }
    };

    const onPointerMove = (e) => {
      if (isDragging || Date.now() < draggedUntilRef.current) {
        setHoverPopover(null);
        return;
      }

      // If pointer is moving inside the popover capsule itself, keep it open!
      if (e.target.closest?.('[data-hover-capsule]') || isOverPopoverRef.current) {
        if (hoverHideTimerRef.current) clearTimeout(hoverHideTimerRef.current);
        return;
      }

      const { el, entity } = findEntityFromTarget(e.target, e.clientX, e.clientY);
      if (entity && el) {
        if (hoverHideTimerRef.current) {
          clearTimeout(hoverHideTimerRef.current);
          hoverHideTimerRef.current = null;
        }

        const rect = el.getBoundingClientRect();
        const hostRect = host.getBoundingClientRect();
        const label = String(entity.label ?? entity.text ?? entity.latex ?? entity.id).slice(0, 60);
        const question = `What is "${label}" showing at this point?`;
        
        // Position capsule right above the element with comfortable distance
        const top = rect.top - hostRect.top - 10;
        const left = rect.left + rect.width / 2 - hostRect.left;
        
        setHoverPopover({
          top: Math.max(16, top),
          left: Math.max(120, Math.min(hostRect.width - 120, left)),
          entity,
          question,
          label,
          below: top < 50,
        });
      } else {
        // Debounce hiding so user can easily move cursor into the popover capsule without it vanishing
        if (!hoverHideTimerRef.current) {
          hoverHideTimerRef.current = setTimeout(() => {
            if (!isOverPopoverRef.current) {
              setHoverPopover(null);
            }
            hoverHideTimerRef.current = null;
          }, 240);
        }
      }
    };

    const onPointerLeave = (e) => {
      // If moving out of canvas completely
      if (!isOverPopoverRef.current) {
        if (hoverHideTimerRef.current) clearTimeout(hoverHideTimerRef.current);
        hoverHideTimerRef.current = setTimeout(() => {
          if (!isOverPopoverRef.current) {
            setHoverPopover(null);
          }
        }, 150);
      }
    };

    const onKey = (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (!e.target.closest?.('[data-entity]')) return;
      e.preventDefault();
      onClick(e);
    };

    host.addEventListener('click', onClick);
    host.addEventListener('pointermove', onPointerMove);
    host.addEventListener('pointerleave', onPointerLeave);
    host.addEventListener('keydown', onKey);
    return () => { 
      if (hoverHideTimerRef.current) clearTimeout(hoverHideTimerRef.current);
      host.removeEventListener('click', onClick); 
      host.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('pointerleave', onPointerLeave);
      host.removeEventListener('keydown', onKey); 
    };
  }, [onAskAbout, isDragging]);

  // what a screen reader hears: the board as an image, and each step's narration as it comes
  const beat = sceneBranch
    ? sceneBranch.scene?.beats?.[sceneBranch.at]
    : scene?.beats?.[Math.max(0, stepIndex)];
  const where = sceneBranch ? 'Answer to your question' : `Step ${stepIndex + 1} of ${scene?.beats?.length ?? 0}`;
  const said = beat ? `${where}: ${beat.title}. ${beat.narration}` : '';

  const isNavActive = Math.abs(navState.scale - 1) > 0.02 || Math.abs(navState.x) > 4 || Math.abs(navState.y) > 4;

  return (
    <div
      ref={hostRef}
      className="scene-v2-stage"
      data-engine="v2"
      role="img"
      aria-label={scene ? `${scene.title} — ${said}` : 'Visual lesson'}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      <style>{`
        .scene-v2-stage {
          user-select: none;
          -webkit-user-select: none;
        }
        .scene-v2-stage [data-entity] {
          cursor: pointer !important;
          transition: filter 0.15s ease;
        }
        .scene-v2-stage [data-entity]:hover {
          filter: brightness(1.15) drop-shadow(0 0 6px rgba(99, 102, 241, 0.45));
        }
        .scene-v2-stage [data-entity] .fx[opacity="0"],
        .scene-v2-stage [data-entity][opacity="0"] {
          pointer-events: none !important;
        }
      `}</style>

      {/* Floating Zoom & Pan Reset HUD */}
      {isNavActive && (
        <div
          className="absolute top-5 right-5 z-20 flex items-center gap-2.5 px-3 py-1.5 rounded-full liquid-glass shadow-premium pointer-events-auto select-none transition-all animate-in fade-in zoom-in-95 duration-200"
        >
          <span className="font-mono text-[11px] font-semibold text-[var(--text-secondary)]">
            {Math.round(navState.scale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => engineRef.current?.resetNav(true)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/5 hover:bg-white/10 text-[11px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
            title="Reset to default view"
          >
            <RotateCcw size={11} />
            <span>Reset</span>
          </button>
        </div>
      )}

      <div aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
        {said}
      </div>

      {/* ── Hover Capsule Popover (Matching Photo 2 style) ── */}
      <AnimatePresence>
        {hoverPopover && !isDragging && (
          <motion.div
            data-hover-capsule="true"
            initial={{ opacity: 0, y: hoverPopover.below ? -4 : 4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: 'absolute',
              top: hoverPopover.top,
              left: hoverPopover.left,
              transform: `translate(-50%, ${hoverPopover.below ? '0%' : '-100%'})`,
              zIndex: 70,
              pointerEvents: 'auto',
            }}
            onPointerEnter={() => {
              isOverPopoverRef.current = true;
              if (hoverHideTimerRef.current) {
                clearTimeout(hoverHideTimerRef.current);
                hoverHideTimerRef.current = null;
              }
            }}
            onPointerLeave={() => {
              isOverPopoverRef.current = false;
              if (hoverHideTimerRef.current) clearTimeout(hoverHideTimerRef.current);
              hoverHideTimerRef.current = setTimeout(() => {
                setHoverPopover(null);
                hoverHideTimerRef.current = null;
              }, 220);
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (hoverPopover.entity) {
                onAskAbout(hoverPopover.entity);
                setHoverPopover(null);
              }
            }}
            className="flex items-center gap-1 rounded-full bg-[var(--text-primary)] p-1 text-[var(--bg-primary)] shadow-[0_16px_40px_-12px_rgba(0,0,0,0.5)] border border-white/10 select-none cursor-pointer group hover:scale-[1.02] transition-transform"
          >
            {/* Ask Action Button with amber accent */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold tracking-tight text-[var(--bg-primary)] hover:bg-white/10 dark:hover:bg-black/10 transition-colors">
              <MessageSquareQuote size={14} className="shrink-0 text-amber-500" strokeWidth={2.2} />
              <span>Ask</span>
            </div>

            <div className="w-px h-4 bg-current opacity-20 shrink-0" />

            {/* Query Preview */}
            <div className="flex items-center gap-1.5 px-2 text-[12px] opacity-85 group-hover:opacity-100 transition-opacity max-w-[280px] truncate">
              <span className="truncate font-medium">"{hoverPopover.question}"</span>
            </div>

            <div className="w-px h-4 bg-current opacity-20 shrink-0" />

            {/* Edit Hint Pill */}
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium opacity-80 group-hover:opacity-100 hover:bg-white/10 dark:hover:bg-black/10 transition-colors shrink-0">
              <Edit3 size={11} strokeWidth={2} />
              <span>Edit</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default SceneV2Stage;
