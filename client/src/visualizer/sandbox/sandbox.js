/**
 * Where untrusted code runs in the browser: a learner's program, or code that
 * came from an AI answer. It never runs in the page itself.
 *
 *   page ──postMessage──▶ hidden <iframe sandbox="allow-scripts"> ──▶ Web Worker (the program)
 *
 * The iframe has no origin of its own (no allow-same-origin), so the program
 * can't read TutorBoard's cookies or storage and any request it makes is
 * cross-origin to TutorBoard. Its page — client/public/sandbox/{js,python}.html —
 * carries a Content-Security-Policy that allows no network at all for
 * JavaScript (fetch, XHR, WebSocket, import(), importScripts) and only the
 * Pyodide CDN for Python, and a worker made from a blob inherits that policy.
 * The worker also hides the network APIs, as a second layer. (The pages are
 * real files, not srcdoc: a srcdoc frame would inherit the app's own policy,
 * which rightly forbids what the sandbox needs — see vercel.json.)
 *
 * One iframe (and one worker, kept warm: Pyodide takes seconds to load) per
 * kind. A run that overstays its time limit has its worker killed.
 */

export const SANDBOX_KINDS = ['js', 'python'];

const hosts = new Map(); // kind → { frame, ready: Promise }
let nextId = 1;

function hostFor(kind) {
  const existing = hosts.get(kind);
  if (existing && existing.frame.isConnected) return existing;
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.setAttribute('aria-hidden', 'true');
  frame.setAttribute('tabindex', '-1');
  frame.title = 'Code sandbox';
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none;';
  // The page posts back only to this origin, and only listens to it.
  frame.src = `/sandbox/${kind}.html?parent=${encodeURIComponent(window.location.origin)}`;
  const ready = new Promise((resolve) => {
    const onReady = (e) => {
      if (e.source !== frame.contentWindow || e.data?.tb !== 'ready') return;
      window.removeEventListener('message', onReady);
      resolve();
    };
    window.addEventListener('message', onReady);
  });
  document.body.appendChild(frame);
  const host = { frame, ready };
  hosts.set(kind, host);
  return host;
}

/**
 * Run `message` through a worker built from `workerSource` inside the `kind`
 * sandbox. Every message the worker posts goes to onMessage(data, finish,
 * startClock); call finish(result) to end the run. A run that outlasts
 * `limitMs` (counted from startClock(), or from the start when `waitForClock`
 * is false) is killed and resolves to onTimeout('run' | 'load'). `fresh` starts
 * a new worker, so nothing a previous program left behind is visible.
 */
export function runSandboxed(kind, workerSource, message, { onMessage, onError, onTimeout, limitMs, waitForClock = false, loadLimitMs = 60000, fresh = false }) {
  if (!SANDBOX_KINDS.includes(kind)) throw new Error(`No sandbox for ${kind}`);
  const host = hostFor(kind);
  const id = nextId++;
  return new Promise((resolve) => {
    let timer = null;
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      window.removeEventListener('message', onPageMessage);
      resolve(result);
    };
    const kill = (result) => {
      host.frame.contentWindow?.postMessage({ tb: 'kill' }, '*');
      finish(result);
    };
    const startClock = () => {
      clearTimeout(timer);
      timer = setTimeout(() => kill(onTimeout()), limitMs);
    };
    function onPageMessage(e) {
      if (e.source !== host.frame.contentWindow) return;
      const m = e.data || {};
      if (m.id !== id) return;
      if (m.tb === 'error') return finish(onError(m.message));
      if (m.tb === 'msg') onMessage(m.data, finish, startClock);
    }
    window.addEventListener('message', onPageMessage);
    // Waiting on a download (Pyodide) gets its own, longer limit.
    timer = setTimeout(() => kill(onTimeout(waitForClock ? 'load' : 'run')), waitForClock ? loadLimitMs : limitMs);
    host.ready.then(() => {
      if (!done) host.frame.contentWindow.postMessage({ tb: 'run', id, source: workerSource, message, fresh }, '*');
    });
  });
}

/**
 * `__lockNetwork()`: hides the network APIs from the program, on the worker
 * itself and on every prototype it inherits from (so
 * `Object.getPrototypeOf(self).fetch` finds nothing either). Defense in depth
 * behind the iframe's Content-Security-Policy. Shared by the worker sources.
 */
export const LOCK_NETWORK = `
function __lockNetwork() {
  const names = ['fetch', 'XMLHttpRequest', 'WebSocket', 'WebSocketStream', 'EventSource', 'importScripts', 'indexedDB',
    'caches', 'BroadcastChannel', 'Worker', 'SharedWorker', 'WebTransport', 'RTCPeerConnection'];
  for (let o = self; o; o = Object.getPrototypeOf(o)) {
    for (const n of names) {
      if (!Object.prototype.hasOwnProperty.call(o, n)) continue;
      try { Object.defineProperty(o, n, { value: undefined, configurable: false, writable: false }); } catch (e) { /* not ours to lock */ }
    }
  }
  for (const n of names) {
    try { Object.defineProperty(self, n, { value: undefined, configurable: false, writable: false }); } catch (e) { /* locked */ }
  }
}
`;
