/**
 * chatTimings.js — how long each part of a chat request takes to reach the
 * screen, measured in the browser.
 *
 * Marks (ms since the question was submitted):
 *   query_submitted, user_message_rendered, assistant_request_started,
 *   first_assistant_token_received, first_assistant_token_rendered,
 *   artifact_specification_received, first_artifact_frame_rendered,
 *   assistant_response_completed, artifact_ready
 * plus `outcome` (completed / cancelled / failed).
 *
 * Only timings and the request id are kept — never the question, the answer
 * or any lesson content. Each mark is recorded once per request (the first
 * time it happens). Results are kept in memory, exposed for tests and devtools
 * as `window.__tbChatTimings`, logged in development, and emitted as
 * `performance.mark('tb:<name>')` for the browser's performance panel.
 */

const MAX_RUNS = 20;
const runs = new Map(); // requestId -> { t0, marks, outcome }

const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

function publish(requestId) {
  const run = runs.get(requestId);
  if (!run || typeof window === 'undefined') return;
  const summary = { requestId, outcome: run.outcome };
  for (const [name, at] of Object.entries(run.marks)) summary[name] = Math.round(at - run.t0);
  window.__tbChatTimings = window.__tbChatTimings || {};
  window.__tbChatTimings[requestId] = summary;
  const ids = Object.keys(window.__tbChatTimings);
  if (ids.length > MAX_RUNS) delete window.__tbChatTimings[ids[0]];
}

export const chatTimings = {
  /** The question was submitted (a retry with the same id starts over). */
  start(requestId) {
    if (!requestId) return;
    runs.set(requestId, { t0: now(), marks: { query_submitted: now() }, outcome: null, pending: new Set() });
    if (runs.size > MAX_RUNS) runs.delete(runs.keys().next().value);
    try { performance.mark?.('tb:query_submitted'); } catch { /* unsupported */ }
    publish(requestId);
  },

  has(requestId, name) {
    return !!runs.get(requestId)?.marks[name];
  },

  /** Record `name` now (first time only). */
  mark(requestId, name) {
    const run = runs.get(requestId);
    if (!run || run.marks[name]) return;
    run.marks[name] = now();
    // the final lesson can arrive without partial steps before it
    if (name === 'artifact_ready' && !run.marks.artifact_specification_received) {
      run.marks.artifact_specification_received = run.marks[name];
    }
    try { performance.mark?.(`tb:${name}`); } catch { /* unsupported */ }
    publish(requestId);
  },

  /** Record `name` once the browser has painted the frame that shows it. */
  markAfterPaint(requestId, name) {
    const run = runs.get(requestId);
    if (!run || run.marks[name] || run.pending.has(name)) return;
    run.pending.add(name);
    const done = () => { run.pending.delete(name); chatTimings.mark(requestId, name); };
    if (typeof requestAnimationFrame === 'function') {
      // rAF runs before the paint; the task queued from it runs after it
      requestAnimationFrame(() => setTimeout(done, 0));
    } else {
      setTimeout(done, 0);
    }
  },

  /** The text answer ended (artifact marks may still follow). */
  finish(requestId, outcome) {
    const run = runs.get(requestId);
    if (!run) return;
    run.outcome = outcome;
    if (outcome === 'completed') chatTimings.mark(requestId, 'assistant_response_completed');
    else publish(requestId);
    if (import.meta.env?.DEV) {
      // eslint-disable-next-line no-console
      console.info('[chat timings]', window.__tbChatTimings?.[requestId]);
    }
  },

  get(requestId) {
    return typeof window !== 'undefined' ? window.__tbChatTimings?.[requestId] || null : null;
  },
};

export default chatTimings;
