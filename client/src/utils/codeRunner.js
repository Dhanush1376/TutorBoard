import { BASE_URL as API_BASE, getAuthHeaders, getCookie, fetchCsrfToken } from '../services/api';

/**
 * TutorBoard code runner. Five languages, each with a path that really runs:
 *   JavaScript  → a Web Worker in the browser (5 s limit, async/await allowed)
 *   Python      → Pyodide in a Web Worker (CPython compiled to WebAssembly)
 *   Java, C++, C → the TutorBoard server, which compiles and runs them (Judge0)
 *
 * Every runner reports output through onLog({ type, text }) and resolves to
 * { success, error? }. A runaway program is stopped, never left to freeze the page.
 */

export const RUNNABLE = ['javascript', 'python', 'java', 'cpp', 'c'];

const JS_LIMIT_MS = 5000;
const PY_LIMIT_MS = 10000;

/* ── JavaScript ─────────────────────────────────────────────────────────── */

const JS_WORKER = `
const fmt = (a) => {
  if (a === null) return 'null';
  if (a === undefined) return 'undefined';
  if (typeof a === 'string') return a;
  if (typeof a === 'function') return a.toString();
  if (a instanceof Error) return a.name + ': ' + a.message;
  try { return JSON.stringify(a, null, 2); } catch { return String(a); }
};
const send = (type, args) => postMessage({ type, text: args.map(fmt).join(' ') });
const console = {
  log: (...a) => send('log', a), info: (...a) => send('info', a), debug: (...a) => send('log', a),
  warn: (...a) => send('warn', a), error: (...a) => send('error', a),
  table: (d) => send('log', [d]),
};
self.console = console;
onmessage = async (e) => {
  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    await new AsyncFunction('console', e.data)(console);
    // let pending timers (setTimeout etc.) print before we finish
    setTimeout(() => postMessage({ type: 'done', ok: true }), 30);
  } catch (err) {
    postMessage({ type: 'error', text: (err && err.name ? err.name + ': ' : '') + (err && err.message ? err.message : String(err)) });
    postMessage({ type: 'done', ok: false });
  }
};`;

function runInWorker(source, message, onLog, limitMs, { onStatus, keep, onData } = {}) {
  return new Promise((resolve) => {
    const worker = keep?.worker || new Worker(URL.createObjectURL(new Blob([source], { type: 'text/javascript' })));
    if (keep) keep.worker = worker;
    let timer = null;
    let finished = false;
    const finish = (result) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      worker.onmessage = null;
      if (!keep) worker.terminate();
      resolve(result);
    };
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        worker.terminate();
        if (keep) keep.worker = null; // a fresh one next time
        onLog?.({ type: 'error', text: `Stopped after ${limitMs / 1000}s. Is there an endless loop?` });
        finish({ success: false, error: 'Time limit reached' });
      }, limitMs);
    };
    worker.onmessage = (e) => {
      const m = e.data || {};
      if (m.type === 'status') {
        onStatus?.(m.text);
        return;
      }
      if (m.type === 'ready') {
        arm(); // the clock starts once the language has loaded
        return;
      }
      if (m.type === 'trace') {
        onData?.(m);
        return;
      }
      if (m.type === 'done') return finish(m.ok ? { success: true } : { success: false, error: m.error || 'Your program stopped with an error.' });
      onLog?.({ type: m.type, text: m.text });
    };
    worker.onerror = (e) => {
      onLog?.({ type: 'error', text: e.message || 'The program could not start.' });
      finish({ success: false, error: e.message });
    };
    if (!onStatus) arm();
    else {
      // The language itself has to download first; give it a minute, then give up clearly.
      timer = setTimeout(() => {
        worker.terminate();
        if (keep) keep.worker = null;
        onLog?.({ type: 'error', text: 'Python could not load. Check your connection and try again.' });
        finish({ success: false, error: 'Python could not load' });
      }, 60000);
    }
    worker.postMessage(message);
  });
}

export function executeJavaScript(code, onLog) {
  return runInWorker(JS_WORKER, code, onLog, JS_LIMIT_MS);
}

/* ── Python (Pyodide in a worker) ───────────────────────────────────────── */

const PY_WORKER = `
let py = null;
onmessage = async (e) => {
  try {
    if (!py) {
      postMessage({ type: 'status', text: 'Loading Python…' });
      importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js');
      py = await loadPyodide();
    }
    py.setStdout({ batched: (t) => postMessage({ type: 'log', text: t }) });
    py.setStderr({ batched: (t) => postMessage({ type: 'error', text: t }) });
    py.setStdin({ stdin: () => { throw new Error('input() is not supported here. Put the values in your code instead.'); } });
    postMessage({ type: 'ready' });
    if (e.data && typeof e.data === 'object') {
      // Step-by-step trace: define the tracer, run the program under it, hand back its JSON.
      py.runPython(e.data.tracer);
      const trace = py.globals.get('__tb_trace');
      const json = trace(e.data.source, e.data.maxSteps, e.data.stdin || '');
      trace.destroy();
      postMessage({ type: 'trace', json });
      postMessage({ type: 'done', ok: true });
      return;
    }
    await py.runPythonAsync(e.data);
    postMessage({ type: 'done', ok: true });
  } catch (err) {
    const msg = String(err && err.message ? err.message : err);
    const lines = msg.trim().split('\\n');
    const last = lines.filter(Boolean).pop();
    // Keep only the learner's own frames: drop Pyodide's internals, call the file main.py.
    const start = lines.findIndex((l) => l.includes('"<exec>"'));
    const text = start >= 0
      ? ['Traceback (most recent call last):', ...lines.slice(start)].join('\\n').split('"<exec>"').join('"main.py"')
      : last;
    postMessage({ type: 'error', text });
    postMessage({ type: 'done', ok: false, error: last });
  }
};`;

const pyKeep = { worker: null };

export function executePython(code, onLog) {
  let announced = false;
  return runInWorker(PY_WORKER, code, onLog, PY_LIMIT_MS, {
    keep: pyKeep,
    onStatus: (text) => {
      if (!announced) {
        announced = true;
        onLog?.({ type: 'info', text });
      }
    },
  });
}

/**
 * Run a Python program under the step tracer (visualizer/adapters/pythonTracer.py).
 * Resolves to the tracer's raw result, or { error } when Python itself failed.
 */
export function tracePython(source, tracer, { maxSteps, stdin, onStatus } = {}) {
  let json = null;
  const problems = [];
  return runInWorker(
    PY_WORKER,
    { source, tracer, maxSteps, stdin },
    (log) => log.type === 'error' && problems.push(log.text),
    PY_LIMIT_MS,
    { keep: pyKeep, onStatus: (t) => onStatus?.(t), onData: (m) => (json = m.json) },
  ).then((r) => {
    if (json) return JSON.parse(json);
    const timedOut = /Time limit/.test(r.error || '');
    return {
      steps: [],
      stdout: '',
      truncated: false,
      error: { kind: timedOut ? 'timeout' : 'setup', message: timedOut ? `Stopped after ${PY_LIMIT_MS / 1000}s. Is there an endless loop?` : problems[0] || r.error || 'Python could not start.' },
    };
  });
}

/* ── Java, C++, C (TutorBoard server) ───────────────────────────────────── */

const SERVER_LANG = { java: 'java', cpp: 'cpp', c: 'c' };

export async function executeOnServer(code, lang, onLog) {
  const language = SERVER_LANG[lang];
  onLog?.({ type: 'info', text: 'Compiling…' });
  let res;
  try {
    // The server checks a CSRF token on every POST; get one first if this page has none yet.
    if (!getCookie('tb-csrf-token')) await fetchCsrfToken(1);
    res = await fetch(`${API_BASE}/api/compiler/execute`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ language, code }),
    });
  } catch {
    const msg = 'Could not reach the TutorBoard server. Check your connection and try again.';
    onLog?.({ type: 'error', text: msg });
    return { success: false, error: msg };
  }

  let data = {};
  try {
    data = await res.json();
  } catch {
    /* not JSON */
  }

  if (!res.ok) {
    const msg =
      res.status === 429
        ? 'You are running code very fast. Wait a moment and try again.'
        : res.status === 401
          ? 'Please sign in again to run this language.'
          : data.error || `The compiler is unavailable right now (error ${res.status}).`;
    onLog?.({ type: 'error', text: msg });
    return { success: false, error: msg };
  }

  const run = data.run || {};
  const out = (run.stdout || '').replace(/\n$/, '');
  const err = (run.stderr || '').replace(/\n$/, '');
  if (out) out.split('\n').forEach((line) => onLog?.({ type: 'log', text: line }));
  if (err) err.split('\n').forEach((line) => onLog?.({ type: 'error', text: line }));
  if (run.code !== 0 && !err && run.signal && run.signal !== 'Accepted') {
    onLog?.({ type: 'error', text: run.signal }); // e.g. "Time Limit Exceeded", "Compilation Error"
  }
  return run.code === 0 ? { success: true } : { success: false, error: run.signal || 'Your program stopped with an error.' };
}

/* ── Dispatcher ─────────────────────────────────────────────────────────── */

export async function executeCode(code, lang, onLog) {
  if (lang === 'javascript') return executeJavaScript(code, onLog);
  if (lang === 'python') return executePython(code, onLog);
  if (SERVER_LANG[lang]) return executeOnServer(code, lang, onLog);
  const msg = `${lang} can't be run here.`;
  onLog?.({ type: 'error', text: msg });
  return { success: false, error: msg };
}
