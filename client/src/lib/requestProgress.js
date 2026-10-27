/**
 * requestProgress.js — what one chat request is doing, from the server's own
 * `progress` events (server/services/chat/chat.service.ts).
 *
 * Nothing here runs on a timer or guesses from the streamed text: a stage is
 * shown only after the server reports it, a tick only after it reports that
 * stage done. Events from another request are ignored, and a finished stage
 * never goes back to running.
 */

/** Stages, in the order a request runs them. */
export const STAGE_ORDER = ['planning', 'memory', 'web', 'writing', 'lesson'];

const TERMINAL = new Set(['done', 'skipped', 'failed']);
const STATES = new Set(['active', ...TERMINAL]);

/** A fresh record for the request `requestId` (no stage reported yet). */
export const createProgress = (requestId = null) => ({ requestId, stages: {}, outcome: null });

/**
 * Apply one server `progress` event. Returns the same object when the event
 * changes nothing (wrong request, unknown stage, or an out-of-order update).
 */
export function applyProgressEvent(progress, event) {
  const base = progress || createProgress(event?.requestId ?? null);
  if (!event || !STAGE_ORDER.includes(event.stage) || !STATES.has(event.state)) return base;
  if (base.outcome) return base; // the request already ended here (Stop / failure)
  if (base.requestId && event.requestId && event.requestId !== base.requestId) return base;

  const prev = base.stages[event.stage];
  // a finished stage stays finished: a late `active` must not revive it
  if (prev && TERMINAL.has(prev.state) && event.state === 'active') return base;

  const next = {
    state: event.state,
    kind: event.kind ?? prev?.kind,
    count: typeof event.count === 'number' ? event.count : prev?.count,
  };
  if (prev && prev.state === next.state && prev.kind === next.kind && prev.count === next.count) return base;
  return {
    ...base,
    requestId: base.requestId ?? event.requestId ?? null,
    stages: { ...base.stages, [event.stage]: next },
  };
}

/** The request ended on the client (Stop, network failure): nothing is running any more. */
export function endProgress(progress, outcome) {
  if (!progress || progress.outcome) return progress;
  return { ...progress, outcome };
}

const stageLabel = (id, stage) => {
  switch (id) {
    case 'memory': return 'Recalled your earlier sessions';
    case 'web':
      return stage.state === 'done' && stage.count
        ? `Searched the web · ${stage.count} source${stage.count === 1 ? '' : 's'}`
        : 'Searched the web';
    case 'writing': return 'Wrote the explanation';
    case 'lesson': return stage.kind === 'board' ? 'Drew the answer on the board' : 'Built the interactive visualization';
    default: return null;
  }
};

const activeLabel = (id, stage, { hasText }) => {
  switch (id) {
    case 'planning': return 'Planning your explanation…';
    case 'memory': return 'Recalling your earlier sessions…';
    case 'web': return 'Searching the web…';
    case 'writing': return hasText ? 'Writing your explanation…' : 'Starting your explanation…';
    case 'lesson': return stage.kind === 'board' ? 'Drawing the answer on the board…' : 'Preparing your interactive visualization…';
    default: return null;
  }
};

/**
 * What to show for a request: one primary status line and the stages that
 * mean something to the learner (memory, web, writing, lesson). `active` is
 * false once nothing is running.
 *   hasText — answer text has reached the screen
 */
export function describeProgress(progress, { hasText = false } = {}) {
  const stages = progress?.stages || {};
  if (progress?.outcome === 'cancelled') return { label: 'Stopped', active: false, stages: [] };
  if (progress?.outcome === 'failed') return { label: null, active: false, stages: [] };

  const running = STAGE_ORDER.filter((id) => stages[id]?.state === 'active');
  let label;
  const writing = stages.writing;
  const lesson = stages.lesson;
  if (writing?.state === 'done' && lesson?.state === 'active') {
    // the text is finished; the visual lesson that goes with it is not
    label = lesson.kind === 'board' ? 'Finishing the answer on the board…' : 'Finishing your visual walkthrough…';
  } else if (writing?.state === 'active') {
    label = activeLabel('writing', writing, { hasText });
  } else if (running.length) {
    // the most advanced stage that is running (planning < retrieval < lesson)
    const id = running[running.length - 1];
    label = activeLabel(id, stages[id], { hasText });
  } else if (hasText) {
    label = 'Writing your explanation…';
  } else {
    label = 'Getting started…';
  }

  const list = STAGE_ORDER
    .filter((id) => id !== 'planning' && stages[id] && stages[id].state !== 'skipped')
    .map((id) => {
      const s = stages[id];
      const status = s.state === 'done' ? 'done' : s.state === 'failed' ? 'failed' : 'active';
      return {
        id,
        status,
        label: status === 'active'
          ? activeLabel(id, s, { hasText }).replace(/…$/, '')
          : status === 'failed'
            ? (id === 'lesson' ? "Couldn't build the visualization" : id === 'web' ? 'Web search unavailable' : id === 'memory' ? 'Earlier sessions unavailable' : 'Stopped')
            : stageLabel(id, s),
      };
    });

  return { label, active: true, stages: list };
}

/** True while the server reports the request's visual lesson as being prepared. */
export const isLessonPreparing = (progress) =>
  !progress?.outcome && progress?.stages?.lesson?.state === 'active';
