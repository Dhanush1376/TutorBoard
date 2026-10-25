import API from '../services/api';
import { tracePython } from '../utils/codeRunner';
import { TRACE_VERSION, assertTrace, sourceHash } from './traceModel';
import pythonTracer from './adapters/pythonTracer.py?raw';
import { instrumentJavaScript, InstrumentError } from './adapters/jsInstrument';
import recorderSource from './adapters/jsRecorder.js?raw';
import traceWorkerBody from './adapters/jsTraceWorker.js?raw';
import { runSandboxed, LOCK_NETWORK } from './sandbox/sandbox';

/**
 * One entry point for every language: run the program for real and get its
 * step-by-step trace (format in traceModel.js).
 *   Python      → Pyodide in a sandboxed worker, watched with sys.settrace   (mode 'traced')
 *   JavaScript  → instrumented here, run in a sandboxed worker, no network   (mode 'instrumented')
 *   C, C++, Java → instrumented on the server, run in the Judge0 sandbox      (mode 'instrumented')
 * "Sandboxed worker": visualizer/sandbox — never in this page.
 */

export const TRACEABLE = ['javascript', 'python', 'java', 'cpp', 'c'];
const BROWSER_MAX_STEPS = 1000;
const JS_LIMIT_MS = 6000;

const NOTES = {
  python: ['Code inside list comprehensions and generator expressions runs as one step.'],
  javascript: ['Only an object\'s own data fields are shown; getters are not run.'],
};

// The recorder module's text as a plain script, then the worker's own body.
const JS_TRACE_WORKER = `${LOCK_NETWORK}\n__lockNetwork();\n${recorderSource.replace(/^export\s+/gm, '')}\n${traceWorkerBody}`;
const emptyRun = (error) => ({ steps: [], stdout: '', truncated: false, error });

function finish(language, source, raw, mode, extraNotes = []) {
  const trace = {
    version: TRACE_VERSION,
    language,
    mode,
    source,
    steps: raw.steps || [],
    stdout: raw.stdout || '',
    error: raw.error || null,
    truncated: !!raw.truncated,
    maxSteps: BROWSER_MAX_STEPS,
    notes: [...(NOTES[language] || []), ...extraNotes],
  };
  return assertTrace(trace);
}

function traceJavaScript(source) {
  let code;
  try {
    ({ code } = instrumentJavaScript(source));
  } catch (err) {
    return Promise.resolve(emptyRun({ kind: 'compile', message: err.message, line: err instanceof InstrumentError ? err.line : 1 }));
  }
  return runSandboxed('js', JS_TRACE_WORKER, { code, maxSteps: BROWSER_MAX_STEPS }, {
    limitMs: JS_LIMIT_MS,
    fresh: true,
    onMessage: (data, finish) => data?.type === 'trace' && finish(data.result),
    onError: (message) => emptyRun({ kind: 'setup', message: message || 'The step-through could not start.' }),
    onTimeout: () => emptyRun({ kind: 'timeout', message: `Stopped after ${JS_LIMIT_MS / 1000}s. Is there an endless loop?` }),
  });
}

/** Run `source` and return its trace. Never throws for problems in the learner's code — they come back in trace.error. */
export async function traceCode(source, language, { stdin = '', onStatus } = {}) {
  const src = String(source || '').replace(/\r\n/g, '\n');
  if (!TRACEABLE.includes(language)) throw new Error(`${language} can't be stepped through.`);
  if (language === 'javascript') {
    onStatus?.('Running your code…');
    const raw = await traceJavaScript(src);
    return finish(language, src, raw, 'instrumented', raw.notes || []);
  }
  if (language === 'python') {
    onStatus?.('Running your code…');
    const raw = await tracePython(src, pythonTracer, { maxSteps: BROWSER_MAX_STEPS, stdin, onStatus });
    return finish(language, src, raw, 'traced');
  }
  onStatus?.('Compiling and running…');
  try {
    const { data } = await API.post('/api/visualizer/trace', { language, source: src, stdin });
    return assertTrace(data.trace);
  } catch (err) {
    const status = err?.response?.status;
    const message =
      status === 429
        ? 'You are running code very fast. Wait a moment and try again.'
        : err?.response?.data?.error || (err?.response ? `The compiler is unavailable right now (error ${status}).` : 'Could not reach the TutorBoard server. Check your connection and try again.');
    return finish(language, src, { steps: [], stdout: '', error: { kind: 'setup', message } }, 'instrumented');
  }
}

/* ── Saving and finding walkthroughs ────────────────────────────────────── */

const isGuest = () => {
  try {
    if (sessionStorage.getItem('tb-is-guest') === 'true') return true;
    const t = localStorage.getItem('tb-token');
    return !t || t === 'guest';
  } catch {
    return true;
  }
};

// Guests (and anyone offline) keep the last few walkthroughs in this browser.
const LOCAL_KEY = 'tb-walkthroughs';
const LOCAL_MAX = 8;
function localGet(key) {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}')[key] || null;
  } catch {
    return null;
  }
}
function localSetStep(key, step) {
  try {
    const all = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
    if (!all[key]) return;
    all[key].lastStep = step;
    localStorage.setItem(LOCAL_KEY, JSON.stringify(all));
  } catch {
    /* storage blocked */
  }
}
function localPut(key, trace) {
  try {
    const all = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
    all[key] = { trace, at: Date.now(), lastStep: all[key]?.lastStep || 0 };
    const keys = Object.keys(all).sort((a, b) => all[b].at - all[a].at);
    keys.slice(LOCAL_MAX).forEach((k) => delete all[k]);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(all));
  } catch {
    /* storage full or blocked: not saved locally */
  }
}

export const walkthroughKey = ({ sessionId, messageId, language, source, stdin }) => ({
  sessionId: sessionId || 'scratch',
  messageId: messageId || null,
  hash: sourceHash(language, source, stdin),
});

/** A walkthrough saved earlier for exactly this code in this place, or null. */
export async function findWalkthrough(where) {
  const key = walkthroughKey(where);
  const localKey = `${key.sessionId}:${key.messageId || ''}:${key.hash}`;
  if (!isGuest()) {
    try {
      const { data } = await API.get('/api/visualizer/lookup', { params: { sessionId: key.sessionId, messageId: key.messageId || undefined, hash: key.hash } });
      const v = data.visualization;
      if (v) return { id: v._id, trace: v.trace, followUps: v.followUps || [], lastStep: v.lastStep || 0 };
    } catch {
      /* fall through to this browser's copy */
    }
  }
  const local = localGet(localKey);
  return local ? { id: null, trace: local.trace, followUps: [], lastStep: local.lastStep || 0, localKey } : null;
}

/**
 * Remember the step the learner is on: on the server for a saved walkthrough,
 * in this browser otherwise. Fire-and-forget; the caller debounces it.
 */
export async function rememberStep({ id, where }, step) {
  if (where) {
    const key = walkthroughKey(where);
    localSetStep(`${key.sessionId}:${key.messageId || ''}:${key.hash}`, step);
  }
  if (!id || isGuest()) return;
  try {
    await API.patch(`/api/visualizer/${id}/state`, { lastStep: step });
  } catch {
    /* offline or expired: the local copy still has it */
  }
}

/** Save a walkthrough (one per session + message + program). Resolves to its id, or null when kept only locally. */
export async function saveWalkthrough(where, trace, title) {
  const key = walkthroughKey(where);
  localPut(`${key.sessionId}:${key.messageId || ''}:${key.hash}`, trace);
  if (isGuest()) return null;
  try {
    const { data } = await API.post('/api/visualizer/save', {
      sessionId: key.sessionId,
      messageId: key.messageId,
      sourceHash: key.hash,
      stdin: where.stdin || '',
      title,
      trace,
    });
    return data.id || null;
  } catch {
    return null;
  }
}

/** Ask the tutor about the current step. */
export async function explainStep(payload) {
  try {
    const { data } = await API.post('/api/visualizer/explain', payload);
    return { answer: data.answer };
  } catch (err) {
    return { error: err?.response?.data?.error || 'The explanation could not be written right now. Try again in a moment.' };
  }
}
