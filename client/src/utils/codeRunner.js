/**
 * Unified Code Execution Engine for TutorBoard
 * Supports:
 * - JavaScript (Local Sandbox)
 * - Python (Local Pyodide)
 * - Java, C++, C (Remote Piston API)
 */

// Piston API Configuration
const PISTON_ENDPOINTS = [
  'https://piston.pydis.com/api/v2',      // Python Discord mirror
  'https://piston.engineer/api/v2',       // Community mirror
  'https://emkc.org/api/v2/piston',       // Original (Publicly Restricted)
];

const PISTON_LANG_MAP = {
  python: { language: 'python', version: '3.10.0' },
  java: { language: 'java', version: '15.0.2' },
  cpp: { language: 'c++', version: '10.2.0' },
  c: { language: 'c', version: '10.2.0' },
};

// ─── JavaScript (Local) ───────────────────────────────────────────────────────
export function executeJavaScript(code, onLog) {
  const logs = [];
  const fakeConsole = {
    log: (...args) => {
      const text = args.map(a => {
        if (a === null) return 'null';
        if (a === undefined) return 'undefined';
        if (typeof a === 'object') {
          try { return JSON.stringify(a, null, 2); } catch { return String(a); }
        }
        return String(a);
      }).join(' ');
      logs.push({ type: 'log', text });
      onLog?.({ type: 'log', text });
    },
    error: (...args) => {
      const text = args.map(a => String(a)).join(' ');
      logs.push({ type: 'error', text });
      onLog?.({ type: 'error', text });
    },
    warn: (...args) => {
      const text = args.map(a => String(a)).join(' ');
      logs.push({ type: 'warn', text: `⚠ ${text}` });
      onLog?.({ type: 'warn', text: `⚠ ${text}` });
    },
    info: (...args) => {
      const text = args.map(a => String(a)).join(' ');
      logs.push({ type: 'info', text });
      onLog?.({ type: 'info', text });
    },
  };

  try {
    const fn = new Function('console', code);
    const result = fn(fakeConsole);
    if (result !== undefined) {
      onLog?.({ type: 'log', text: `→ ${typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)}` });
    }
    return { success: true, logs };
  } catch (err) {
    const errorMsg = `${err.name}: ${err.message}`;
    onLog?.({ type: 'error', text: errorMsg });
    return { success: false, logs, error: errorMsg };
  }
}

// ─── Python (Local Pyodide) ───────────────────────────────────────────────────
let pyodideInstance = null;
export async function executePythonLocal(code, onLog) {
  try {
    if (!pyodideInstance) {
      onLog?.({ type: 'info', text: '📥 Loading Python Engine (Pyodide)...' });
      if (!window.loadPyodide) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }
      pyodideInstance = await window.loadPyodide();
    }

    onLog?.({ type: 'info', text: '🐍 Executing Python locally...' });
    
    pyodideInstance.setStdout({
      batched: (text) => onLog?.({ type: 'log', text })
    });
    pyodideInstance.setStderr({
      batched: (text) => onLog?.({ type: 'error', text })
    });

    await pyodideInstance.runPythonAsync(code);
    return { success: true };
  } catch (err) {
    onLog?.({ type: 'error', text: `Python Error: ${err.message}` });
    return { success: false, error: err.message };
  }
}

// ─── Remote Execution (Piston API) ───────────────────────────────────────────
export async function executePistonAPI(code, lang, onLog) {
  let config = PISTON_LANG_MAP[lang];
  if (!config) {
    onLog?.({ type: 'error', text: `No compiler available for ${lang}` });
    return { success: false };
  }

  for (const endpoint of PISTON_ENDPOINTS) {
    try {
      onLog?.({ type: 'info', text: `⚙ Connecting to ${endpoint.split('/')[2]}...` });

      const response = await fetch(`${endpoint}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: config.language,
          version: config.version,
          files: [{ 
            name: lang === 'java' ? 'Main.java' : `main.${lang === 'cpp' ? 'cpp' : lang}`, 
            content: code 
          }],
        }),
      });

      if (!response.ok) continue;

      const data = await response.json();
      if (data.run) {
        if (data.run.stdout) data.run.stdout.trim().split('\n').forEach(line => onLog?.({ type: 'log', text: line }));
        if (data.run.stderr) data.run.stderr.trim().split('\n').forEach(line => onLog?.({ type: 'error', text: line }));
        return { success: data.run.code === 0 };
      }
    } catch (err) {
      console.warn(`Mirror ${endpoint} failed:`, err);
    }
  }

  onLog?.({ type: 'error', text: `❌ All remote compilers are currently unreachable.` });
  return { success: false };
}

// ─── Unified Dispatcher ──────────────────────────────────────────────────────
export async function executeCode(code, lang, onLog) {
  if (lang === 'javascript') {
    return executeJavaScript(code, onLog);
  }
  if (lang === 'python') {
    return await executePythonLocal(code, onLog);
  }
  if (PISTON_LANG_MAP[lang]) {
    return await executePistonAPI(code, lang, onLog);
  }
  
  onLog?.({ type: 'error', text: `Language "${lang}" is not supported for execution yet.` });
  return { success: false };
}
