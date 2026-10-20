/* Runs one instrumented JavaScript program and posts back its trace.
   A dedicated worker: no page, no DOM, and the network is switched off below. */
import { instrumentJavaScript, InstrumentError } from './jsInstrument.js';
import { createRecorder, StepLimit, formatForConsole } from './jsRecorder.js';

const NO_NETWORK = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts', 'indexedDB', 'caches', 'BroadcastChannel'];

self.onmessage = async (e) => {
  const { source, maxSteps } = e.data || {};
  let code;
  let usesAsync = false;
  try {
    ({ code, usesAsync } = instrumentJavaScript(source));
  } catch (err) {
    const line = err instanceof InstrumentError ? err.line : 1;
    self.postMessage({ type: 'trace', result: { steps: [], stdout: '', truncated: false, usesAsync, error: { kind: 'compile', message: err.message, line } } });
    return;
  }

  const tb = createRecorder({ maxSteps });
  const print = (...args) => tb.print(`${args.map(formatForConsole).join(' ')}\n`);
  const console = { log: print, info: print, warn: print, error: print, debug: print, table: print };
  // The learner's code (or code from an AI answer) gets no network access from here.
  for (const key of NO_NETWORK) {
    try {
      Object.defineProperty(self, key, { value: undefined, configurable: false, writable: false });
    } catch {
      /* already locked */
    }
  }

  let error = null;
  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    await new AsyncFunction('__tb', 'console', code)(tb, console);
    await new Promise((r) => setTimeout(r, 30)); // let short timers finish
  } catch (err) {
    if (!(err instanceof StepLimit)) {
      const steps = tb.result().steps;
      const last = steps[steps.length - 1];
      error = {
        kind: 'runtime',
        message: err && err.name ? `${err.name}: ${err.message}` : `Uncaught ${String(err)}`,
        line: last ? last.line : 1,
      };
    }
  }
  if (!error) {
    try {
      tb.finish();
    } catch {
      /* step limit */
    }
  }
  const { steps, stdout } = tb.result();
  self.postMessage({
    type: 'trace',
    result: {
      steps,
      stdout,
      usesAsync,
      truncated: tb.truncated,
      error: error || (tb.truncated ? { kind: 'limit', message: `Stopped after ${maxSteps} steps.` } : null),
    },
  });
};
