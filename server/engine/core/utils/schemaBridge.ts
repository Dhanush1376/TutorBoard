/**
 * Schema Bridge v2.0 — Normalizes all agent output formats into renderer-ready scene graphs
 *
 * Handles THREE distinct output formats:
 *   1. LEGACY format: { elements: [...], timeline: [...] }
 *   2. PARALLEL ARRAYS format: { narrations: [...], visual_steps: [...], animation_steps: [...] }
 *   3. VISUALSCRIPT format: visual_steps[n] = { renderer, scene, script: [{ cmd, id, ... }] }
 *
 * The Visualizer Agent (v11) outputs VisualScript commands per step.
 * Each command declares or manipulates a scene entity (array, pointer, tree, etc.).
 * This bridge extracts renderable elements FROM those commands and builds
 * a proper SceneGraph with elements + timeline + connections.
 */

// ─── Element-producing commands (these DECLARE scene entities) ────────────────
const ELEMENT_COMMANDS = new Set([
  'array', 'pointer', 'tree', 'chart', 'timeline', 'physics_body',
  'equation', 'result', 'draw_boundary', 'annotate',
  'interactive_controls', 'code', 'block', 'orb', 'badge',
  'data_block', 'list', 'comparator', 'codeline',
  // Cinematic commands
  'node', 'callout', 'group'
]);

// ─── Commands that produce narration text ────────────────────────────────────
const NARRATION_COMMANDS = new Set(['narrate']);

// ─── Commands that produce visual edges/connections ─────────────────────────
const EDGE_COMMANDS = new Set(['edge']);

// ─── Commands that are purely animation actions ─────────────────────────────
const ACTION_COMMANDS = new Set([
  'highlight', 'color_to', 'fade_in', 'fade_out', 'swap',
  'compare', 'move_pointer', 'remove_annotation', 'force',
  'wait', 'annotate', 'draw_boundary'
]);

/**
 * Extracts renderable elements, edges, and narration from a VisualScript command array.
 */
function extractFromScript(script: any[]): { elements: any[], edges: any[], narration: string, actions: any[] } {
  const elements: any[] = [];
  const edges: any[] = [];
  const actions: any[] = [];
  let narration = '';

  if (!Array.isArray(script)) return { elements, edges, narration, actions };

  for (const cmd of script) {
    if (!cmd || typeof cmd !== 'object') continue;

    const command = cmd.cmd || cmd.command || cmd.action;
    if (!command) continue;

    if (NARRATION_COMMANDS.has(command)) {
      narration = cmd.text || cmd.content || cmd.narration || '';
      continue;
    }

    // Edge-producing commands → extract to connections
    if (EDGE_COMMANDS.has(command)) {
      edges.push({
        id: cmd.id || `edge_${edges.length}`,
        from: cmd.from,
        to: cmd.to,
        label: cmd.label,
        type: cmd.type || 'arrow',
        color: cmd.color,
        animated: cmd.animated ?? false,
      });
      continue;
    }

    // Element-producing commands → convert to element objects
    if (ELEMENT_COMMANDS.has(command)) {
      const element: any = {
        id: cmd.id || `${command}_${elements.length}`,
        type: command,
        label: cmd.label || cmd.text || cmd.title || cmd.id || command,
      };

      // Transfer all command-specific properties
      if (cmd.title !== undefined) element.title = cmd.title;
      if (cmd.subtitle !== undefined) element.subtitle = cmd.subtitle;
      if (cmd.values !== undefined) element.values = cmd.values;
      if (cmd.data !== undefined) element.data = cmd.data;
      if (cmd.atIndex !== undefined) element.atIndex = cmd.atIndex;
      if (cmd.color !== undefined) element.color = cmd.color;
      if (cmd.x !== undefined) element.x = cmd.x;
      if (cmd.y !== undefined) element.y = cmd.y;
      if (cmd.mass !== undefined) element.mass = cmd.mass;
      if (cmd.formula !== undefined) element.formula = cmd.formula;
      if (cmd.controls !== undefined) element.controls = cmd.controls;
      if (cmd.events !== undefined) element.events = cmd.events;
      if (cmd.endIndex !== undefined) element.endIndex = cmd.endIndex;
      if (cmd.type !== undefined && cmd.type !== command) element.subtype = cmd.type;
      // Cinematic properties
      if (cmd.glow !== undefined) element.glow = cmd.glow;
      if (cmd.importance !== undefined) element.importance = cmd.importance;
      if (cmd.shape !== undefined) element.shape = cmd.shape;
      if (cmd.icon !== undefined) element.icon = cmd.icon;
      if (cmd.children !== undefined) element.children = cmd.children;
      if (cmd.targetId !== undefined) element.targetId = cmd.targetId;
      if (cmd.style !== undefined) element.calloutStyle = cmd.style;

      elements.push(element);
    }

    // Also keep as an animation action for the timeline
    if (ACTION_COMMANDS.has(command) || !NARRATION_COMMANDS.has(command)) {
      actions.push(cmd);
    }
  }

  return { elements, edges, narration, actions };
}

/**
 * Detects if visual_steps are in VisualScript format (have `script` arrays or `cmd` fields)
 */
function isVisualScriptFormat(visualSteps: any[]): boolean {
  if (!Array.isArray(visualSteps) || visualSteps.length === 0) return false;
  return visualSteps.some(step => {
    if (!step || typeof step !== 'object') return false;
    // 1. Per-step script/commands array: { renderer, scene, script/commands: [...] }
    if (Array.isArray(step.script) || Array.isArray(step.commands)) return true;
    // 2. Direct command: { cmd: "array", ... } or { type: "equation", ... }
    if (step.cmd || (step.type && ELEMENT_COMMANDS.has(step.type))) return true;
    // 3. Elements array inside step (even if no cmd field)
    if (Array.isArray(step.elements) && step.elements.length > 0) return true;
    return false;
  });
}

/**
 * Converts VisualScript format visual_steps into elements + timeline entries
 */
function convertVisualScriptToSceneGraph(
  visualSteps: any[],
  narrations: any[],
  animationSteps: any[]
): { elements: any[], timeline: any[], renderer: string, connections: any[] } {
  const allElements: any[] = [];
  const allEdges: any[] = [];
  const timeline: any[] = [];
  const seenIds = new Set<string>();
  const seenEdgeIds = new Set<string>();
  let renderer = 'cinematic';

  const maxLen = Math.max(visualSteps.length, narrations.length, animationSteps.length);

  for (let i = 0; i < maxLen; i++) {
    const vs = visualSteps[i];
    const nar = narrations[i];
    const anim = animationSteps[i];

    let stepElements: any[] = [];
    let stepEdges: any[] = [];
    let stepNarration = '';
    let stepActions: any[] = [];

    // Extract from VisualScript
    if (vs && typeof vs === 'object') {
      // Detect renderer from first valid step
      if (vs.renderer && i === 0) renderer = vs.renderer;

      const scriptArray = vs.script || vs.commands || vs.elements || (vs.cmd ? [vs] : []);
      const extracted = extractFromScript(Array.isArray(scriptArray) ? scriptArray : []);
      stepElements = extracted.elements;
      stepEdges = extracted.edges;
      stepNarration = extracted.narration;
      stepActions = extracted.actions;
    }

    // Merge narration from Narrator agent
    if (nar) {
      const narText = typeof nar === 'string' ? nar
        : (nar.text || nar.narration || nar.explanation || '');
      if (narText) stepNarration = narText;
    }

    // Merge animation actions from Animator agent
    if (anim && typeof anim === 'object') {
      const animActions = anim.actions || [];
      // Extract narration from animator if present
      const animNarrate = animActions.find((a: any) => a?.cmd === 'narrate');
      if (animNarrate && !stepNarration) stepNarration = animNarrate.text || '';
      
      stepActions = [...stepActions, ...animActions.filter((a: any) => a?.cmd !== 'narrate')];
    }

    // Deduplicate and collect all elements
    for (const el of stepElements) {
      if (!seenIds.has(el.id)) {
        seenIds.add(el.id);
        allElements.push(el);
      }
    }

    // Collect edges (deduplicated)
    for (const edge of stepEdges) {
      if (!seenEdgeIds.has(edge.id)) {
        seenEdgeIds.add(edge.id);
        allEdges.push(edge);
      }
    }

    // Build timeline entry
    const objectIds = stepElements.map(e => e.id);
    // Also reference any elements targeted by animation actions
    for (const action of stepActions) {
      const targetId = action.id || action.id1 || action.body;
      if (targetId && seenIds.has(targetId) && !objectIds.includes(targetId)) {
        objectIds.push(targetId);
      }
    }

    timeline.push({
      index: i,
      step: i + 1,
      title: (nar && typeof nar === 'object' ? nar.title : null) || `Step ${i + 1}`,
      narration: stepNarration || '...',
      explanation: stepNarration || '...',
      objectIds: objectIds.length > 0 ? objectIds : [...seenIds],
      highlightIds: [],
      mutations: [],
      animation: {
        type: stepActions.length > 0 ? 'scripted' : 'fade',
        duration: 0.8,
        actions: stepActions
      },
      // Attach per-step study panel data from narrator
      ...(nar && typeof nar === 'object' ? {
        howItWorks: nar.howItWorks,
        pseudocode: nar.pseudocode,
        timeComplexity: nar.timeComplexity,
        spaceComplexity: nar.spaceComplexity,
        variables: nar.variables,
        activeStates: nar.activeStates,
        highlight_terms: nar.highlight_terms,
        callout: nar.callout,
      } : {}),
      // Preserve the raw script for the D3/VisualScript renderer
      commands: vs?.script || vs?.commands || (vs?.cmd ? [vs] : undefined),
      durationMs: 5000,
    });
  }

  return { elements: allElements, timeline, renderer, connections: allEdges };
}


export function unwrapValidatorOutput(raw: any) {
  if (!raw) return null;

  // Case A: Already has elements AND timeline in legacy format
  if ((raw.elements || raw.objects) && (raw.timeline || raw.steps)) {
    console.log('[SchemaBridge] Output already in legacy format — passing through.');
    return raw;
  }

  // Case B: Unwrap final_output wrapper
  const inner = raw.final_output || raw;
  if (typeof inner !== 'object' || inner === null) {
    console.warn('[SchemaBridge] Validator returned invalid structure:', raw);
    return null;
  }

  // Check for already-resolved legacy format inside final_output
  if ((inner.elements || inner.objects) && (inner.timeline || inner.steps)) {
    console.log('[SchemaBridge] final_output already in legacy format — passing through.');
    return inner;
  }

  const narrations = inner.narrations || [];
  const visualSteps = inner.visual_steps || [];
  const animationSteps = inner.animation_steps || [];

  // ─── CASE C: VisualScript Format Detection ──────────────────────────────
  if (isVisualScriptFormat(visualSteps)) {
    console.log(`[SchemaBridge] 🎬 Detected VisualScript format — converting ${visualSteps.length} steps`);
    const { elements, timeline, renderer, connections } = convertVisualScriptToSceneGraph(
      visualSteps, narrations, animationSteps
    );

    if (elements.length === 0 && timeline.length === 0) {
      console.warn('[SchemaBridge] VisualScript conversion produced empty scene. Passing through raw.');
      // Fall through to parallel array zipping
    } else {
      const result: any = {
        elements,
        timeline,
        connections,
        scene: inner.meta || inner.scene || { type: 'linear' },
        renderer: inner.meta?.renderer || (renderer === 'math' ? 'katex' : renderer),
        // Preserve original arrays for renderers that want raw VisualScript
        _raw: { narrations, visual_steps: visualSteps, animation_steps: animationSteps }
      };
      console.log(`[SchemaBridge] ✅ Converted: ${elements.length} elements, ${timeline.length} steps, renderer: ${result.renderer}`);
      return result;
    }
  }

  // ─── CASE D: Parallel Array Zipping (flat narrations/visual_steps/animation_steps) ─
  let timeline = (inner.timeline || inner.steps || []).filter(Boolean);

  if (timeline.length === 0 && (narrations.length > 0 || visualSteps.length > 0 || animationSteps.length > 0)) {
    const maxLen = Math.max(narrations.length, visualSteps.length, animationSteps.length);
    if (maxLen > 0) {
      console.log(`[SchemaBridge] 🗜️ Zipping parallel arrays from Validator (Length: ${maxLen})`);
      timeline = Array.from({ length: maxLen }).map((_, i) => {
        const nar = narrations[i];
        const narText = typeof nar === 'string' ? nar : (nar?.text || nar?.narration || nar?.explanation || '');
        const narTitle = typeof nar === 'object' ? nar?.title : null;

        return {
          narration: narText || '...',
          explanation: narText || '...',
          title: narTitle || `Step ${i + 1}`,
          ...((typeof visualSteps[i] === 'object' && visualSteps[i] !== null) ? visualSteps[i] : {}),
          ...((typeof animationSteps[i] === 'object' && animationSteps[i] !== null) ? animationSteps[i] : {}),
          // Attach narrator metadata
          ...(typeof nar === 'object' && nar !== null ? {
            howItWorks: nar.howItWorks,
            pseudocode: nar.pseudocode,
            timeComplexity: nar.timeComplexity,
            spaceComplexity: nar.spaceComplexity,
            variables: nar.variables,
            highlight_terms: nar.highlight_terms,
            callout: nar.callout,
          } : {}),
          index: i
        };
      });
    }
  }

  // Extract unique elements from visualSteps if they contain nested elements
  let elements = (inner.elements || inner.objects || []).filter(Boolean);
  if (elements.length === 0 && visualSteps.length > 0) {
    const allElements: any[] = [];
    visualSteps.forEach((st: any) => {
      if (!st) return;
      if (st.elements && Array.isArray(st.elements)) {
        // Nested elements array within each step
        allElements.push(...st.elements.filter((e: any) => e && (e.type || e.cmd || e.id)));
      } else if (st.id && (st.type || st.cmd || st.label)) {
        // Step itself is an element-like object
        allElements.push(st);
      }
      // Also extract elements from script/commands commands within each step
      const scriptArr = st.script || st.commands || (st.cmd ? [st] : null);
      if (scriptArr && Array.isArray(scriptArr)) {
        const extracted = extractFromScript(scriptArr);
        allElements.push(...extracted.elements);
      }
    });
    const seen = new Set();
    elements = allElements.filter(el => {
      const id = String(el?.id || '');
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  const result: any = {
    elements: elements,
    timeline: timeline,
    scene: inner.meta || inner.scene || { type: 'linear' },
    renderer: inner.meta?.renderer || (inner.renderer === 'math' ? 'katex' : (inner.renderer || 'cinematic'))
  };

  // Preserve renderer info from meta
  if (inner.meta?.renderer) {
    result.renderer = inner.meta.renderer;
  }

  // Last resort: if elements are still empty, try extracting from timeline entries
  if (result.elements.length === 0 && result.timeline.length > 0) {
    const timelineElements: any[] = [];
    const seen = new Set();
    for (const step of result.timeline) {
      // Check commands array
      if (step.commands && Array.isArray(step.commands)) {
        const extracted = extractFromScript(step.commands);
        for (const el of extracted.elements) {
          if (!seen.has(el.id)) {
            seen.add(el.id);
            timelineElements.push(el);
          }
        }
      }
      // Check actions array
      if (step.animation?.actions && Array.isArray(step.animation.actions)) {
        const extracted = extractFromScript(step.animation.actions);
        for (const el of extracted.elements) {
          if (!seen.has(el.id)) {
            seen.add(el.id);
            timelineElements.push(el);
          }
        }
      }
    }
    if (timelineElements.length > 0) {
      console.log(`[SchemaBridge] 🔍 Extracted ${timelineElements.length} elements from timeline entries`);
      result.elements = timelineElements;
    }
  }

  // Final fallback: convert visual_steps themselves to elements if nothing else worked
  if (inner.visual_steps && result.elements.length === 0) {
    console.warn('[SchemaBridge] ⚠️ All extraction methods failed. Using visual_steps as raw elements.');
    result.elements = inner.visual_steps;
  }

  return result;
}
