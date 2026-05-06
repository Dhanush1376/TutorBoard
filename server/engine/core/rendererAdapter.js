/**
 * RendererAdapter v1.0 — VisualScript → Renderer Command Translator
 *
 * Bridges portable VisualScript semantic actions to renderer-specific commands.
 * Each renderer gets its own adapter function that translates generic actions
 * into the exact command format that renderer expects.
 *
 * Pipeline position:
 *   VisualScript (semantic) → RendererAdapter → RendererCommands (specific)
 *
 * This keeps renderer-specific logic isolated from educational logic.
 * The existing VisualScriptInterpreter.ts on the client handles execution;
 * this adapter ensures the script is renderer-ready before streaming.
 */

// ─── Action → Command Maps ──────────────────────────────────────────────────

/**
 * Maps semantic actions to D3 renderer commands.
 * The D3 renderer is the most feature-rich (arrays, trees, charts, timelines).
 */
const D3_ACTION_MAP = {
  create_array:       (a) => ({ cmd: 'array', id: a.id, values: a.values || a.params?.values || [] }),
  create_pointer:     (a) => ({ cmd: 'pointer', id: a.id, atIndex: a.position ?? a.params?.position ?? 0, label: a.label || a.params?.label || '', color: a.color || a.params?.color }),
  create_tree:        (a) => ({ cmd: 'tree', id: a.id, data: a.data || a.params?.data }),
  create_graph:       (a) => ({ cmd: 'graph', id: a.id, nodes: a.nodes || a.params?.nodes || [], edges: a.edges || a.params?.edges || [] }),
  create_chart:       (a) => ({ cmd: 'chart', id: a.id, data: a.data || a.params?.data, type: a.chartType || a.params?.chartType || 'bar' }),
  create_timeline_viz:(a) => ({ cmd: 'timeline', id: a.id, events: a.events || a.params?.events || [] }),
  highlight:          (a) => ({ cmd: 'highlight', id: a.targets?.[0] || a.id, color: styleToColor(a.style || a.params?.style) }),
  swap:               (a) => ({ cmd: 'swap', id1: a.target1 || a.targets?.[0], id2: a.target2 || a.targets?.[1] }),
  move_pointer:       (a) => ({ cmd: 'move_pointer', id: a.id, atIndex: a.toPosition ?? a.params?.toPosition }),
  annotate:           (a) => ({ cmd: 'annotate', id: a.targetId || a.id, text: a.text || a.params?.text }),
  remove_annotation:  (a) => ({ cmd: 'remove_annotation', id: a.targetId || a.id }),
  show_result:        (a) => ({ cmd: 'result', text: a.text || a.params?.text }),
  show_equation:      (a) => ({ cmd: 'equation', formula: a.formula || a.params?.formula }),
  show_code:          (a) => ({ cmd: 'code', code: a.code || a.params?.code }),
  narrate:            (a) => ({ cmd: 'narrate', text: a.text || a.params?.text }),
  wait:               (a) => ({ cmd: 'wait', ms: a.durationMs || a.params?.durationMs || 1000 }),
  camera_focus:       (a) => ({ cmd: 'camera', target: a.target || a.params?.target, zoom: a.zoom || a.params?.zoom }),
  set_boundary:       (a) => ({ cmd: 'draw_boundary', atIndex: a.start ?? a.params?.start, endIndex: a.end ?? a.params?.end, label: a.label || a.params?.label }),
  mark_sorted:        (a) => ({ cmd: 'color_to', id: a.targetId || a.id, color: '#22c55e' }), // Green for sorted
  insert:             (a) => ({ cmd: 'annotate', id: a.targetId || a.id, text: `Insert ${a.value}` }),
  remove:             (a) => ({ cmd: 'remove', id: a.targetId || a.id }),
  update_value:       (a) => ({ cmd: 'annotate', id: a.targetId || a.id, text: `→ ${a.newValue}` }),
};

/**
 * Maps semantic actions to Physics (Matter.js) renderer commands.
 */
const PHYSICS_ACTION_MAP = {
  create_body:        (a) => ({ cmd: 'physics_body', id: a.id, type: a.type || a.params?.type || 'circle', x: a.position?.x ?? 0.5, y: a.position?.y ?? 0.5, mass: a.mass ?? a.params?.mass ?? 1 }),
  apply_force:        (a) => ({ cmd: 'force', body: a.targetId || a.id, fx: a.force?.x ?? a.params?.fx ?? 0, fy: a.force?.y ?? a.params?.fy ?? 0 }),
  narrate:            (a) => ({ cmd: 'narrate', text: a.text || a.params?.text }),
  wait:               (a) => ({ cmd: 'wait', ms: a.durationMs || a.params?.durationMs || 1000 }),
  show_equation:      (a) => ({ cmd: 'equation', formula: a.formula || a.params?.formula }),
  annotate:           (a) => ({ cmd: 'annotate', id: a.targetId || a.id, text: a.text || a.params?.text }),
  camera_focus:       (a) => ({ cmd: 'camera', target: a.target || a.params?.target, zoom: a.zoom || a.params?.zoom }),
};

/**
 * Maps semantic actions to Math (KaTeX) renderer commands.
 */
const MATH_ACTION_MAP = {
  show_equation:      (a) => ({ cmd: 'equation', formula: a.formula || a.params?.formula }),
  narrate:            (a) => ({ cmd: 'narrate', text: a.text || a.params?.text }),
  annotate:           (a) => ({ cmd: 'annotate', id: a.targetId || a.id, text: a.text || a.params?.text }),
  wait:               (a) => ({ cmd: 'wait', ms: a.durationMs || a.params?.durationMs || 1000 }),
};

// Renderer map registry
const ADAPTER_MAP = {
  d3: D3_ACTION_MAP,
  cinematic: D3_ACTION_MAP,      // Cinematic uses D3 under the hood
  algorithm: D3_ACTION_MAP,
  dsa: D3_ACTION_MAP,
  sorting: D3_ACTION_MAP,
  physics: PHYSICS_ACTION_MAP,
  matter: PHYSICS_ACTION_MAP,
  mechanics: PHYSICS_ACTION_MAP,
  math: MATH_ACTION_MAP,
  katex: MATH_ACTION_MAP,
  equation: MATH_ACTION_MAP,
};

// ─── Main Adapter Function ──────────────────────────────────────────────────

/**
 * Adapt a VisualScript into renderer-specific commands.
 *
 * @param {Object} visualScript - The portable visual script
 * @param {string} rendererType - Target renderer (d3, physics, math, etc.)
 * @returns {Object} Adapted timeline in the format SceneOrchestrator expects
 */
export function adaptScriptToRenderer(visualScript, rendererType) {
  if (!visualScript?.steps) {
    console.warn('[RendererAdapter] No steps in visual script');
    return null;
  }

  const adapterMap = ADAPTER_MAP[rendererType?.toLowerCase()] || D3_ACTION_MAP;

  const steps = visualScript.steps.map((step, idx) => {
    const commands = [];

    for (const action of (step.actions || [])) {
      const adapter = adapterMap[action.action];
      if (adapter) {
        try {
          const cmd = adapter(action);
          if (cmd) commands.push(cmd);
        } catch (err) {
          console.warn(`[RendererAdapter] Failed to adapt action "${action.action}": ${err.message}`);
        }
      } else {
        // Fallback: try D3 adapter for unknown actions
        const fallback = D3_ACTION_MAP[action.action];
        if (fallback) {
          try {
            commands.push(fallback(action));
          } catch (e) {
            console.warn(`[RendererAdapter] No adapter for action: "${action.action}"`);
          }
        }
      }
    }

    // Ensure every step has a narration command
    if (step.narration && !commands.some(c => c.cmd === 'narrate')) {
      commands.unshift({ cmd: 'narrate', text: step.narration });
    }

    return {
      index: idx,
      title: step.stepId || `Step ${idx + 1}`,
      narration: step.narration || '',
      explanation: step.narration || '',
      commands,
      durationMs: step.durationMs || 3000,
      transition: step.transition || 'crossfade',
    };
  });

  // Build the complete timeline object that SceneOrchestrator expects
  return {
    title: visualScript.topic,
    domain: visualScript.domain || 'general',
    renderer: rendererType || 'cinematic',
    totalSteps: steps.length,
    steps,
    timeline: steps,
    elements: extractElements(visualScript),
    objects: extractElements(visualScript),
    metadata: visualScript.metadata,
    _source: 'visual_script_generator',
    _scriptVersion: visualScript.scriptVersion,
  };
}

// ─── Element Extraction ──────────────────────────────────────────────────────

/**
 * Extract initial scene elements from the visual script.
 * Scans all steps for create_* actions and builds the element list.
 */
function extractElements(script) {
  const elements = [];
  const seenIds = new Set();

  for (const step of (script.steps || [])) {
    for (const action of (step.actions || [])) {
      if (action.action?.startsWith('create_') && action.id && !seenIds.has(action.id)) {
        seenIds.add(action.id);
        elements.push({
          id: action.id,
          type: action.action.replace('create_', ''),
          values: action.values || action.params?.values,
          data: action.data || action.params?.data,
          label: action.label || action.params?.label || action.id,
          x: action.position?.x ?? 0.5,
          y: action.position?.y ?? 0.5,
        });
      }
    }
  }

  return elements;
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function styleToColor(style) {
  const styleColors = {
    compare: '#fbbf24',  // Amber
    active: '#3b82f6',   // Blue
    found: '#22c55e',    // Green
    sorted: '#22c55e',   // Green
    pivot: '#ef4444',    // Red
    highlight: '#a78bfa', // Purple
    default: '#60a5fa',  // Light blue
  };
  return styleColors[style] || styleColors.default;
}

export default { adaptScriptToRenderer };
