import { BASE_URL as API_BASE } from '../services/api';

/**
 * Unified Code Execution Engine for TutorBoard
 * Supports:
 * - JavaScript (Local Sandbox)
 * - Python (Local Pyodide)
 * - Java, C++, C (Remote Piston API)
 */

// Piston API Configuration (Mirrors for redundancy)
const PISTON_ENDPOINTS = [
  'https://emkc.org/api/v2/piston',       // Primary
  'https://piston.engineer/api/v2',       // Backup 1
  'https://piston.pydis.com/api/v2',      // Backup 2
];

const PISTON_LANG_MAP = {
  python: { language: 'python3', version: '*' },
  java: { language: 'java', version: '*' },
  cpp: { language: 'cpp', version: '*' },
  c: { language: 'c', version: '*' },
  ruby: { language: 'ruby', version: '*' },
  go: { language: 'go', version: '*' },
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
      if (!window.loadPyodide) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.0/full/pyodide.js';
          // SEC-13: Subresource Integrity (SRI)
          script.integrity = 'sha384-KQtL+EUxNlEbNm6gFVMiDz6Glmgq4QV4VZdSHIrcpw4tCRUGtjUeLJbuQAIfxFfM';
          script.crossOrigin = 'anonymous';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }
      pyodideInstance = await window.loadPyodide();
    }

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

// ─── Remote Execution (Piston API + Backend Proxy) ───────────────────────────
export async function executePistonAPI(code, lang, onLog) {
  let config = PISTON_LANG_MAP[lang];
  if (!config) {
    onLog?.({ type: 'error', text: `No compiler available for ${lang}` });
    return { success: false };
  }

  if (!import.meta.env.VITE_API_BASE_URL && import.meta.env.PROD) {
    throw new Error("VITE_API_BASE_URL must be set in production to enable remote code execution.");
  }
  const API_URL = API_BASE || 'http://localhost:5000';
  
  // 1. Try our own backend proxy first (More reliable, bypasses CORS)
  try {
    const response = await fetch(`${API_URL}/api/compiler/execute`, {
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

    if (response.ok) {
      const data = await response.json();
      if (data.run) {
        if (data.run.stdout) data.run.stdout.trim().split('\n').forEach(line => onLog?.({ type: 'log', text: line }));
        if (data.run.stderr) data.run.stderr.trim().split('\n').forEach(line => onLog?.({ type: 'error', text: line }));
        return { success: data.run.code === 0 };
      }
    }
    throw new Error('Proxy returned non-ok response');
  } catch (err) {
    console.warn('[codeRunner] Backend proxy failed:', err.message);
  }

  // 2. Fallback to direct public mirrors (Note: many are now restricted)
  for (const endpoint of PISTON_ENDPOINTS) {
    try {
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
          compile_timeout: 10000,
          run_timeout: 3000,
          memory_limit: -1
        }),
      });

      if (!response.ok) {
        console.warn(`[Piston] Mirror ${endpoint} returned ${response.status}`);
        continue;
      }

      const data = await response.json();
      if (data.run) {
        // Log compilation issues first
        if (data.compile && data.compile.stderr) {
          data.compile.stderr.trim().split('\n').forEach(line => onLog?.({ type: 'error', text: `[Compile] ${line}` }));
        }
        
        // Log standard output
        if (data.run.stdout) data.run.stdout.trim().split('\n').forEach(line => onLog?.({ type: 'log', text: line }));
        if (data.run.stderr) data.run.stderr.trim().split('\n').forEach(line => onLog?.({ type: 'error', text: line }));
        
        if (data.run.signal) {
          onLog?.({ type: 'error', text: `Process terminated by signal: ${data.run.signal}` });
        }

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
    const localResult = await executePythonLocal(code, onLog);
    if (localResult.success) return localResult;
    // Fallthrough to Piston
  }
  
  if (PISTON_LANG_MAP[lang] || lang === 'python') {
    return await executePistonAPI(code, lang === 'python' ? 'python' : lang, onLog);
  }
  
  onLog?.({ type: 'error', text: `Language "${lang}" is not supported for execution yet.` });
  return { success: false };
}
