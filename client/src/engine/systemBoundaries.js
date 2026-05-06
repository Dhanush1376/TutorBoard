/**
 * systemBoundaries.js — Architectural Contract Enforcement
 *
 * Explicit system rules that prevent cross-system pollution:
 *   - Artifact: Persistent educational object (versioned, stored in MongoDB)
 *   - Canvas: Runtime rendering environment (ephemeral, GPU-accelerated)
 *   - Renderer: Converts scene graph → visual output (stateless transform)
 *   - SessionManager: Lifecycle + memory (manages CanvasSession, PlatformMemory)
 *   - AIEngine: Generates scripts/scenes (never touches DOM or renderer)
 *
 * These guards are active in development mode for runtime protection.
 * Static enforcement is handled via ESLint (no-restricted-imports) in eslint.config.js.
 */

const IS_DEV = typeof process !== 'undefined'
  ? process.env.NODE_ENV !== 'production'
  : (typeof import.meta !== 'undefined' ? import.meta.env?.DEV : true);

// ─── System Responsibilities (Documentation) ────────────────────────────────

export const SYSTEM_RESPONSIBILITIES = {
  Artifact:        'Persistent educational object (versioned, stored in MongoDB). Never contains renderer state, DOM refs, or animation handles.',
  Canvas:          'Runtime rendering environment (ephemeral, GPU-accelerated). Never persisted directly — snapshots go through serialization.',
  Renderer:        'Converts scene graph → visual output (stateless transform). Never mutates source data. Never persists state.',
  SessionManager:  'Lifecycle + memory (CanvasSession, PlatformMemory). Owns the session lifecycle. Never renders.',
  AIEngine:        'Generates scripts/scenes (never touches DOM or renderer). Output is always serializable JSON.',
};

// ─── Boundary Validators ─────────────────────────────────────────────────────

/**
 * Assert that an artifact object does NOT contain renderer state.
 * Artifacts are for persistence — they should never hold DOM refs,
 * animation handles, or renderer-specific state.
 */
export function assertArtifactBoundary(obj, label = 'Artifact') {
  if (!IS_DEV || !obj) return;

  const forbidden = ['_gsap', '_timeline', '_d3Selection', '_container', '_renderer', '_domRef', 'element', 'ref'];
  for (const key of forbidden) {
    if (obj[key] !== undefined) {
      console.error(
        `[SystemBoundary] ❌ ${label} contains renderer state: "${key}". ` +
        `Artifacts must be pure data objects. Strip renderer state before persisting.`
      );
    }
  }

  // Check for non-serializable values
  try {
    JSON.stringify(obj);
  } catch (err) {
    console.error(
      `[SystemBoundary] ❌ ${label} is not JSON-serializable. ` +
      `Artifacts must be fully serializable for MongoDB persistence. Error: ${err.message}`
    );
  }
}

/**
 * Assert that canvas state does NOT leak into persistence layers.
 * Canvas state is ephemeral — only serialized snapshots should be persisted.
 */
export function assertCanvasBoundary(obj, label = 'CanvasState') {
  if (!IS_DEV || !obj) return;

  const forbidden = ['_svgElement', '_canvasContext', '_webglContext', '_physicsEngine', '_matterWorld'];
  for (const key of forbidden) {
    if (obj[key] !== undefined) {
      console.error(
        `[SystemBoundary] ❌ ${label} contains non-persistable state: "${key}". ` +
        `Canvas state must be serialized through CanvasStateSnapshot before persistence.`
      );
    }
  }
}

/**
 * Assert that a renderer function does NOT mutate its source data.
 * Renderers are stateless transforms: input → visual output.
 *
 * Usage: Wrap renderer input data with Object.freeze in dev mode.
 */
export function freezeForRenderer(data, label = 'RendererInput') {
  if (!IS_DEV || !data) return data;

  try {
    return Object.freeze(JSON.parse(JSON.stringify(data)));
  } catch {
    console.warn(`[SystemBoundary] ⚠️ Could not freeze ${label} for renderer boundary check.`);
    return data;
  }
}

/**
 * Assert that AI engine output is pure JSON (no DOM, no functions).
 * AI output should always be serializable and renderer-agnostic.
 */
export function assertAIOutputBoundary(output, label = 'AIOutput') {
  if (!IS_DEV || !output) return;

  if (typeof output === 'function') {
    console.error(`[SystemBoundary] ❌ ${label} is a function. AI output must be pure data.`);
    return;
  }

  const checkDeep = (obj, path = '') => {
    if (!obj || typeof obj !== 'object') return;
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'function') {
        console.error(`[SystemBoundary] ❌ ${label}.${path}${key} is a function. AI output must be pure data.`);
      }
      if (value instanceof HTMLElement || value instanceof SVGElement) {
        console.error(`[SystemBoundary] ❌ ${label}.${path}${key} is a DOM element. AI output must not contain DOM refs.`);
      }
      if (typeof value === 'object' && value !== null && !(value instanceof Date) && !Array.isArray(value)) {
        checkDeep(value, `${path}${key}.`);
      }
    }
  };

  checkDeep(output);
}

// ─── Validation Helpers ──────────────────────────────────────────────────────

/**
 * Validate that the correct system is handling a given operation.
 * Used as a development-time guard to catch architectural violations.
 */
export function assertSystemOwnership(operation, expectedSystem, actualContext) {
  if (!IS_DEV) return;

  const rules = {
    'persist_artifact': 'Artifact',
    'render_scene': 'Canvas',
    'generate_script': 'AIEngine',
    'manage_session': 'SessionManager',
    'transform_data': 'Renderer',
  };

  const owner = rules[operation];
  if (owner && owner !== expectedSystem) {
    console.warn(
      `[SystemBoundary] ⚠️ Operation "${operation}" should be handled by ${owner}, ` +
      `but "${actualContext}" is performing it. Context: ${expectedSystem}`
    );
  }
}

export default {
  assertArtifactBoundary,
  assertCanvasBoundary,
  freezeForRenderer,
  assertAIOutputBoundary,
  assertSystemOwnership,
  SYSTEM_RESPONSIBILITIES,
};
