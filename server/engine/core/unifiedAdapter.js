/**
 * Unified Adapter v2.0
 * 
 * Translates the Master Prompt's semantic schema into the Cartesian coordinate
 * objects and timeline steps required by the React CanvasRenderer.
 * 
 * Input schema:  { topic, steps: [{ step, title, explanation, visual: { type, elements, highlight, pointers, action } }] }
 * Output schema: { mode, title, objects: [{ id, shape, x, y, ... }], steps: [{ index, title, narration, objectIds, ... }] }
 */

// ─── Layout Constants ────────────────────────────────────────────────────────
const CANVAS_W = 800;
const CANVAS_H = 600;
const SAFE_PAD = 80;
const USABLE_W = CANVAS_W - (SAFE_PAD * 2); // 640
const USABLE_H = CANVAS_H - (SAFE_PAD * 2); // 440

// ─── Color Palettes ──────────────────────────────────────────────────────────
const PALETTE = {
  algorithm: ['#3b82f6', '#60a5fa', '#2563eb', '#1d4ed8', '#93c5fd'],
  process:   ['#10b981', '#34d399', '#059669', '#047857', '#6ee7b7'],
  system:    ['#8b5cf6', '#a78bfa', '#7c3aed', '#6d28d9', '#c4b5fd'],
  structure: ['#f59e0b', '#fbbf24', '#d97706', '#b45309', '#fcd34d'],
  cycle:     ['#ec4899', '#f472b6', '#db2777', '#be185d', '#f9a8d4'],
  default:   ['#6366f1', '#818cf8', '#4f46e5', '#4338ca', '#a5b4fc']
};

function getPalette(visualType) {
  if (visualType?.includes('array') || visualType?.includes('pointer')) return PALETTE.algorithm;
  if (visualType?.includes('flow'))     return PALETTE.process;
  if (visualType?.includes('network') || visualType?.includes('component')) return PALETTE.system;
  if (visualType?.includes('tree') || visualType?.includes('hierarchy'))    return PALETTE.structure;
  if (visualType?.includes('cycle') || visualType?.includes('circular'))    return PALETTE.cycle;
  return PALETTE.default;
}

// ─── ID Helper ───────────────────────────────────────────────────────────────
const toId = (name) => String(name).toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 30);

// ─── Layout Strategies ───────────────────────────────────────────────────────

function layoutHorizontal(elements, startY = 300) {
  const spacing = Math.min(120, USABLE_W / (elements.length + 1));
  return elements.map((el, i) => ({
    x: SAFE_PAD + spacing * (i + 1),
    y: startY
  }));
}

function layoutGrid(elements) {
  const cols = Math.ceil(Math.sqrt(elements.length));
  const spacingX = USABLE_W / (cols + 1);
  const rows = Math.ceil(elements.length / cols);
  const spacingY = USABLE_H / (rows + 1);
  return elements.map((el, i) => ({
    x: SAFE_PAD + spacingX * ((i % cols) + 1),
    y: SAFE_PAD + spacingY * (Math.floor(i / cols) + 1)
  }));
}

function layoutTree(elements) {
  if (elements.length === 0) return [];
  // Root at top center, children fan out
  const positions = [{ x: CANVAS_W / 2, y: SAFE_PAD + 40 }]; // root
  const levels = Math.ceil(Math.log2(elements.length + 1));
  for (let i = 1; i < elements.length; i++) {
    const level = Math.floor(Math.log2(i + 1));
    const posInLevel = i - (Math.pow(2, level) - 1);
    const nodesInLevel = Math.pow(2, level);
    const xSpacing = USABLE_W / (nodesInLevel + 1);
    positions.push({
      x: SAFE_PAD + xSpacing * (posInLevel + 1),
      y: SAFE_PAD + 40 + level * (USABLE_H / (levels + 1))
    });
  }
  return positions;
}

function layoutCircular(elements) {
  const cx = CANVAS_W / 2;
  const cy = CANVAS_H / 2;
  const radius = Math.min(USABLE_W, USABLE_H) / 3;
  return elements.map((el, i) => {
    const angle = (2 * Math.PI * i / elements.length) - Math.PI / 2;
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle)
    };
  });
}

// ─── Main Translator ─────────────────────────────────────────────────────────

export function translateUnifiedToTimeline(unifiedJson) {
  const { topic, steps } = unifiedJson;

  if (!steps || steps.length === 0) {
    throw new Error('Adapter received 0 steps.');
  }

  const canvasObjects = new Map();
  const timelineSteps = [];

  for (let si = 0; si < steps.length; si++) {
    const step = steps[si];
    const vis = step.visual || step.visual_object || {};
    const elements = vis.elements || [];
    const highlight = vis.highlight || [];
    const pointers = vis.pointers || {};
    const connections = vis.connections || [];
    const action = vis.action || '';
    const visType = vis.type || '';

    const palette = getPalette(visType);
    const stepObjectIds = [];
    const newIds = [];

    // ── Choose Layout Strategy ──
    let positions;
    if (visType.includes('tree') || visType.includes('hierarchy')) {
      positions = layoutTree(elements);
    } else if (visType.includes('cycle') || visType.includes('circular')) {
      positions = layoutCircular(elements);
    } else if (visType.includes('flow') || visType.includes('array')) {
      positions = layoutHorizontal(elements);
    } else {
      positions = layoutGrid(elements);
    }

    // ── Map Elements to Canvas Objects ──
    elements.forEach((el, idx) => {
      const id = toId(el);
      stepObjectIds.push(id);

      if (!canvasObjects.has(id)) {
        newIds.push(id);
        const pos = positions[idx] || { x: 400, y: 300 };
        const isRect = visType.includes('array') || visType.includes('flow');

        canvasObjects.set(id, {
          id,
          shape: isRect ? 'rect' : 'circle',
          x: Math.round(pos.x),
          y: Math.round(pos.y),
          label: el,
          color: palette[idx % palette.length],
          appearsAtStep: si
        });
      }
    });

    // ── Map Pointers ──
    Object.entries(pointers).forEach(([ptrLabel, targetEl]) => {
      const targetId = toId(targetEl);
      const ptrId = `ptr_${toId(ptrLabel)}`;
      stepObjectIds.push(ptrId);

      const targetObj = canvasObjects.get(targetId);
      if (targetObj && !canvasObjects.has(ptrId)) {
        newIds.push(ptrId);
        canvasObjects.set(ptrId, {
          id: ptrId,
          shape: 'pointer',
          x: targetObj.x,
          y: targetObj.y - 55,
          label: ptrLabel,
          color: '#f59e0b',
          appearsAtStep: si
        });
      } else if (targetObj && canvasObjects.has(ptrId)) {
        // Move existing pointer to new target
        const ptr = canvasObjects.get(ptrId);
        ptr.x = targetObj.x;
        ptr.y = targetObj.y - 55;
      }
    });

    // ── Map Connections ──
    (connections || []).forEach(conn => {
      const parts = conn.split('->').map(s => s.trim());
      if (parts.length === 2) {
        const [srcName, tgtName] = parts;
        const srcId = toId(srcName);
        const tgtId = toId(tgtName);
        const connId = `conn_${srcId}_${tgtId}`;
        stepObjectIds.push(connId);

        if (!canvasObjects.has(connId)) {
          newIds.push(connId);
          const srcObj = canvasObjects.get(srcId);
          const tgtObj = canvasObjects.get(tgtId);
          canvasObjects.set(connId, {
            id: connId,
            shape: 'arrow',
            x1: srcObj?.x || 400,
            y1: srcObj?.y || 300,
            x2: tgtObj?.x || 500,
            y2: tgtObj?.y || 300,
            color: '#94a3b8',
            appearsAtStep: si
          });
        }
      }
    });

    // ── Highlight IDs ──
    const highlightIds = highlight.map(h => toId(h)).filter(id => canvasObjects.has(id));

    // ── Timeline Step ──
    timelineSteps.push({
      index: si,
      title: step.title || `Step ${si + 1}`,
      narration: step.explanation || '',
      objectIds: stepObjectIds,
      highlightIds,
      newIds,
      action,
      durationMs: 4000
    });
  }

  return {
    mode: 'explain',
    title: `Understanding ${topic}`,
    domain: 'general',
    difficulty: 'beginner',
    teaching_format: 'minimalist_pedagogy',
    estimatedTime: `${Math.ceil(timelineSteps.length / 2)} minutes`,
    professorNote: `Here is the step-by-step breakdown of ${topic}.`,
    learningNodes: [
      { type: 'hook', title: 'Introduction', content: 'Let us begin.', stepSpan: [0, Math.floor(steps.length / 2)] },
      { type: 'result', title: 'Summary', content: 'Key takeaways.', stepSpan: [Math.ceil(steps.length / 2), steps.length - 1] }
    ],
    totalSteps: timelineSteps.length,
    objects: Array.from(canvasObjects.values()),
    steps: timelineSteps
  };
}
