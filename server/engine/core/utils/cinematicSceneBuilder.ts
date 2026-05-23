/**
 * CinematicSceneBuilder v2.0 — Aggressive Motion Density Engine
 *
 * Every node MUST animate. Every edge MUST draw progressively.
 * Camera MUST move continuously. Scene MUST evolve over time.
 * Canvas must NEVER look inactive.
 *
 * Pipeline: postProcessTimeline → THIS → socket emit
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const REVEAL_STAGGER = 0.25;
const BASE_STEP_DURATION = 6;
const CAMERA_TRANSITION = 1.0;
const EDGE_DRAW_AFTER_NODE = 0.3;
const MIN_NODES = 5;

const AMBIENT_MOTIONS = [
  { type: 'float', amplitude: 4, frequency: 0.4, phase: 0 },
  { type: 'breathe', scaleMin: 0.96, scaleMax: 1.04, period: 3 },
  { type: 'orbit', radius: 3, speed: 0.3, center: 'self' },
  { type: 'shimmer', opacity: [0.85, 1], period: 2.5 },
  { type: 'pulse', scaleMin: 0.98, scaleMax: 1.06, period: 2 },
] as const;

const REVEAL_ANIMS = [
  'fadeScaleUp', 'slideFromLeft', 'dropIn', 'rippleIn',
  'glowReveal', 'spiralIn', 'elasticPop', 'blurFadeIn',
];

const EDGE_DRAW_STYLES = [
  { draw: 'progressive', particleCount: 6, particleSpeed: 1.2 },
  { draw: 'trace', particleCount: 4, particleSpeed: 0.8 },
  { draw: 'burst', particleCount: 8, particleSpeed: 1.5 },
];

const BACKGROUNDS = [
  'radial-gradient(ellipse at center, #0f172a 0%, #020617 70%)',
  'radial-gradient(ellipse at top left, #1e1b4b 0%, #020617 60%)',
  'radial-gradient(ellipse at bottom right, #0c1a3a 0%, #020617 70%)',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

function centroid(nodes: { x: number; y: number }[]) {
  if (!nodes.length) return { x: 0.5, y: 0.5 };
  return {
    x: nodes.reduce((s, n) => s + n.x, 0) / nodes.length,
    y: nodes.reduce((s, n) => s + n.y, 0) / nodes.length,
  };
}

function zoomForSpread(nodes: { x: number; y: number }[]) {
  if (nodes.length < 2) return 1.4;
  const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
  const spread = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  if (spread < 0.25) return 1.6;
  if (spread < 0.45) return 1.3;
  if (spread < 0.65) return 1.05;
  return 0.85;
}

function extractEdges(elements: any[], timeline: any[]) {
  const edges: any[] = [], seen = new Set<string>();
  const scan = (items: any[]) => {
    for (const it of items) {
      if (!it || typeof it !== 'object') continue;
      const isEdge = it.type === 'edge' || it.cmd === 'edge';
      if (isEdge && it.from && it.to && !seen.has(it.id)) {
        seen.add(it.id);
        edges.push({
          id: it.id || `edge_${edges.length}`,
          from: it.from, to: it.to,
          label: it.label, type: it.type === 'edge' ? (it.edgeType || it.subtype || 'arrow') : (it.type || 'arrow'),
          color: it.color, animated: it.animated ?? true,
        });
      }
    }
  };
  scan(elements);
  for (const step of timeline) {
    const cmds = step.commands || step.animation?.actions || [];
    if (Array.isArray(cmds)) scan(cmds);
  }
  return edges;
}

function extractGroups(elements: any[], timeline: any[]) {
  const groups: any[] = [], seen = new Set<string>();
  const scan = (items: any[]) => {
    for (const it of items) {
      if ((it?.cmd === 'group' || it?.type === 'group') && !seen.has(it.id)) {
        seen.add(it.id);
        groups.push({ id: it.id, label: it.label || 'Group', children: it.children || [], color: it.color });
      }
    }
  };
  scan(elements);
  for (const step of timeline) {
    const cmds = step.commands || step.animation?.actions || [];
    if (Array.isArray(cmds)) scan(cmds);
  }
  return groups;
}

// ─── Validation Gate ──────────────────────────────────────────────────────────

function validateSceneDensity(elements: any[], connections: any[], timeline: any[]) {
  const issues: string[] = [];
  if (elements.length < MIN_NODES) issues.push(`Only ${elements.length} nodes (need ≥${MIN_NODES})`);
  if (connections.length === 0 && elements.length > 1) issues.push('No edges between nodes');
  if (timeline.length === 0) issues.push('Empty timeline');

  const hasPositions = elements.every(e => typeof e.x === 'number' && typeof e.y === 'number');
  if (!hasPositions && elements.length > 0) issues.push('Missing node positions');

  const hasAnimations = timeline.some(s => s.animation || s.commands?.length > 0);
  if (!hasAnimations && timeline.length > 0) issues.push('No animation data in timeline');

  return { valid: issues.length === 0, issues };
}

// ─── Main Builder ─────────────────────────────────────────────────────────────

export function buildCinematicScene(processedScene: any): any {
  if (!processedScene) return processedScene;

  const elements = processedScene.elements || [];
  const timeline = processedScene.timeline || processedScene.steps || [];
  const connections = processedScene.connections || [];
  const title = processedScene.title || 'Lesson';
  const renderer = processedScene.renderer || 'cinematic';
  const id = processedScene.id || `scene_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  if (elements.length === 0 && timeline.length === 0) return processedScene;

  // ── Extract edges & groups ──────────────────────────────────────────────
  const edges = extractEdges(elements, timeline);
  const groups = extractGroups(elements, timeline);

  // Separate nodes from edge/group elements
  const nodeElements = elements.filter((el: any) =>
    el.type !== 'edge' && el.type !== 'group' && el.cmd !== 'edge' && el.cmd !== 'group'
  );

  // ── Validate scene density ─────────────────────────────────────────────
  const allConnections = [...connections, ...edges];
  const validation = validateSceneDensity(nodeElements, allConnections, timeline);
  if (!validation.valid) {
    console.warn(`[CinematicBuilder] ⚠️ Scene density issues: ${validation.issues.join(', ')}`);
  }

  // ── 1. Semantic layers by importance ────────────────────────────────────
  const maxImp = Math.max(...nodeElements.map((e: any) => e.importance || 3), 1);
  nodeElements.forEach((el: any) => {
    el.cinematicLayer = maxImp - (el.importance || 3);
  });
  const layerCount = new Set(nodeElements.map((e: any) => e.cinematicLayer)).size || 1;

  // ── 2. AGGRESSIVE per-node animation ───────────────────────────────────
  const sorted = [...nodeElements].sort((a: any, b: any) => {
    if (a.cinematicLayer !== b.cinematicLayer) return a.cinematicLayer - b.cinematicLayer;
    return (a.y + a.x * 0.1) - (b.y + b.x * 0.1);
  });

  let revealT = 0;
  sorted.forEach((el: any, i: number) => {
    // Staggered reveal
    el.revealDelay = revealT;
    el.revealDuration = 0.5;
    el.revealAnimation = REVEAL_ANIMS[i % REVEAL_ANIMS.length];
    revealT += REVEAL_STAGGER;

    // MANDATORY ambient motion — every node floats/breathes/orbits
    const motionSeed = AMBIENT_MOTIONS[i % AMBIENT_MOTIONS.length];
    el.ambientMotion = {
      ...motionSeed,
      phase: (i * 0.7) % (Math.PI * 2), // Offset phase so nodes don't move in sync
    };

    // Active pulse for high-importance nodes
    el.pulseOnActive = (el.importance || 3) >= 4;
    el.glowIntensity = el.glow ? clamp((el.importance || 3) / 5, 0.3, 1.0) : 0;

    // Interaction enrichment
    const childGroup = groups.find((g: any) => g.children?.includes(el.id));
    el.interactionState = {
      hoverable: true,
      clickable: true,
      expandable: !!childGroup || (el.importance || 3) >= 3,
      expandChildren: childGroup?.children || [],
      hoverEffect: 'liftGlow',        // Node lifts + glows on hover
      clickEffect: 'rippleFocus',      // Ripple + camera focus on click
      hoverTooltip: el.subtitle || el.label || el.title || '',
    };
  });

  // ── 3. Progressive edge drawing ────────────────────────────────────────
  const enrichedEdges = edges.map((edge: any, i: number) => {
    const sourceNode = sorted.find((n: any) => n.id === edge.from);
    const drawStyle = EDGE_DRAW_STYLES[i % EDGE_DRAW_STYLES.length];
    return {
      ...edge,
      animated: true, // ALL edges animate
      revealDelay: (sourceNode?.revealDelay || 0) + EDGE_DRAW_AFTER_NODE,
      revealDuration: 0.6,
      drawStyle: drawStyle.draw,
      particleCount: drawStyle.particleCount,
      particleSpeed: drawStyle.particleSpeed,
      flowDirection: 'forward' as const,
      pulseOnStep: true, // Edge pulses when its step is active
    };
  });

  // ── 4. Continuous camera choreography ──────────────────────────────────
  const cam: any[] = [];

  // Opening: dramatic zoom from far out
  cam.push({ time: 0, x: 0.5, y: 0.5, zoom: 0.55, ease: 'easeInOutCubic', duration: 0, label: 'init_far' });
  cam.push({ time: 0.1, x: 0.5, y: 0.5, zoom: 0.9, ease: 'easeOutQuart', duration: 2.0, label: 'opening_zoom' });

  // Subtle drift during reveal phase
  const revealEnd = Math.max(revealT + 1, 2.5);
  cam.push({
    time: revealEnd,
    x: 0.48 + Math.random() * 0.04,
    y: 0.48 + Math.random() * 0.04,
    zoom: 0.95,
    ease: 'easeInOutSine',
    duration: 1.5,
    label: 'post_reveal_drift',
  });

  // Per-step: focus + micro-drift between steps
  let tAcc = revealEnd + 1.5;
  timeline.forEach((step: any, idx: number) => {
    const stepNodeIds = new Set(step.objectIds || []);
    const stepNodes = nodeElements.filter((n: any) => stepNodeIds.has(n.id));
    const focus = stepNodes.length > 0 ? centroid(stepNodes) : { x: 0.5, y: 0.5 };
    const zoom = stepNodes.length > 0 ? zoomForSpread(stepNodes) : 1.0;

    // Focus shot
    cam.push({
      time: tAcc,
      x: clamp(focus.x, 0.15, 0.85),
      y: clamp(focus.y, 0.15, 0.85),
      zoom: clamp(zoom, 0.7, 1.8),
      ease: idx === 0 ? 'easeOutCubic' : 'easeInOutQuart',
      duration: CAMERA_TRANSITION,
      label: `step_${idx}_focus`,
    });

    // Mid-step micro-drift (keeps camera alive between steps)
    const driftX = focus.x + (Math.random() - 0.5) * 0.06;
    const driftY = focus.y + (Math.random() - 0.5) * 0.06;
    cam.push({
      time: tAcc + BASE_STEP_DURATION * 0.5,
      x: clamp(driftX, 0.15, 0.85),
      y: clamp(driftY, 0.15, 0.85),
      zoom: clamp(zoom + (Math.random() - 0.5) * 0.15, 0.7, 1.8),
      ease: 'easeInOutSine',
      duration: BASE_STEP_DURATION * 0.4,
      label: `step_${idx}_drift`,
    });

    tAcc += BASE_STEP_DURATION;
  });

  // Final: cinematic pullback
  cam.push({ time: tAcc, x: 0.5, y: 0.5, zoom: 0.85, ease: 'easeInOutCubic', duration: 2.0, label: 'closing_wide' });

  // ── 5. Narration timeline ──────────────────────────────────────────────
  const narration: any[] = [];
  let narT = 1.5;
  timeline.forEach((step: any, idx: number) => {
    const text = step.narration || step.explanation || '';
    if (text && text !== '...') {
      const words = text.split(/\s+/).length;
      const dur = Math.max(3, words / 2.5);
      narration.push({
        time: narT, text, stepIndex: idx, duration: dur,
        voiceHint: idx === 0 ? 'calm' : idx === timeline.length - 1 ? 'thoughtful' : 'analytical',
      });
      narT += dur + 0.8;
    } else {
      narT += BASE_STEP_DURATION;
    }
  });

  // ── 6. Playback timeline with transitions ──────────────────────────────
  const totalDuration = Math.max(tAcc + 2, narT);
  const stepTimings = timeline.map((_: any, idx: number) => {
    const start = revealEnd + 1.5 + idx * BASE_STEP_DURATION;
    return { stepIndex: idx, startTime: start, endTime: start + BASE_STEP_DURATION };
  });

  // Inject transition type per step
  const transitionTypes = ['crossfade', 'slide', 'zoom', 'morph', 'wipe'];
  timeline.forEach((step: any, idx: number) => {
    if (!step.transition) {
      step.transition = transitionTypes[idx % transitionTypes.length];
    }
    // Ensure EVERY step has an animation block
    if (!step.animation) {
      step.animation = { type: 'scripted', duration: 0.8, actions: [] };
    }
    if (!step.animation.actions) step.animation.actions = [];
    // Add per-step camera focus as an animation action
    step.animation.actions.push({
      cmd: 'camera_focus',
      stepIndex: idx,
      duration: CAMERA_TRANSITION,
    });
  });

  // ── 7. Interaction states ──────────────────────────────────────────────
  const interactions = nodeElements.map((el: any) => ({
    nodeId: el.id,
    events: {
      hover: {
        action: 'showTooltip',
        data: { text: el.subtitle || el.label || '', icon: el.icon, importance: el.importance },
        animation: { scale: 1.12, glow: true, duration: 0.25 },
      },
      click: {
        action: el.interactionState?.expandable ? 'expandBranch' : 'focusNode',
        data: { targetId: el.id, children: el.interactionState?.expandChildren },
        animation: { ripple: true, cameraZoom: 1.5, duration: 0.6 },
      },
    },
  }));

  // ── 8. Expansion graph ─────────────────────────────────────────────────
  const expansionGraph = groups.map((g: any) => ({
    parentId: g.id,
    childIds: g.children,
    expandTrigger: 'click' as const,
    collapseOnOtherExpand: true,
    expansionAnimation: {
      childReveal: 'staggeredFan',
      edgeDraw: 'progressive',
      cameraPan: true,
      duration: 0.8,
    },
  }));

  // Also make high-importance nodes expandable even without explicit groups
  nodeElements.forEach((el: any) => {
    if ((el.importance || 3) >= 4 && !expansionGraph.find((eg: any) => eg.parentId === el.id)) {
      expansionGraph.push({
        parentId: el.id,
        childIds: [],
        expandTrigger: 'click' as const,
        collapseOnOtherExpand: true,
        expansionAnimation: {
          childReveal: 'staggeredFan',
          edgeDraw: 'progressive',
          cameraPan: true,
          duration: 0.8,
        },
      });
    }
  });

  // ── 9. Merge & deduplicate connections ──────────────────────────────────
  const allConns = [...connections, ...enrichedEdges];
  const connSeen = new Set<string>();
  const dedupedConns = allConns.filter(c => {
    if (!c.id || connSeen.has(c.id)) return false;
    connSeen.add(c.id);
    return true;
  });

  // ── 10. Scene metadata ─────────────────────────────────────────────────
  const scene = {
    ...processedScene.scene,
    title: processedScene.scene?.title || title,
    background: BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)],
    ambientAnimation: 'particleFloat',
    particleField: true,
    ambientConfig: {
      particleCount: 40,
      particleSize: [1, 3],
      particleSpeed: 0.3,
      particleColor: 'rgba(139, 92, 246, 0.15)',
      glowOrbs: true,
      orbCount: 3,
      orbRadius: [60, 120],
      orbColor: 'rgba(59, 130, 246, 0.06)',
    },
  };

  const meta = {
    totalNodes: nodeElements.length,
    totalEdges: enrichedEdges.length,
    semanticLayers: layerCount,
    revealPhases: sorted.length,
    estimatedDuration: Math.ceil(totalDuration),
    cameraKeyframes: cam.length,
    hasProgressiveReveal: true,
    hasCamera: true,
    hasInteractions: true,
    hasAmbientMotion: true,
    hasEdgeAnimation: enrichedEdges.length > 0,
    motionDensity: 'aggressive',
    validationResult: validation,
  };

  console.log(
    `[CinematicBuilder] 🎬 v2.0 | ${meta.totalNodes} nodes, ${meta.totalEdges} edges, ` +
    `${meta.cameraKeyframes} cam keys, ${meta.semanticLayers} layers, ~${meta.estimatedDuration}s`
  );

  return {
    ...processedScene,
    id,
    elements: nodeElements,
    connections: dedupedConns,
    scene,
    cameraTimeline: cam,
    narrationTimeline: narration,
    playbackTimeline: {
      totalDuration: Math.ceil(totalDuration),
      stepTimings,
      autoAdvance: true,
      loopable: false,
      transitionDuration: 0.6,
    },
    interactions,
    viewportState: {
      initialZoom: 0.55,
      minZoom: 0.3,
      maxZoom: 3.0,
      panBounds: { x: [-0.5, 1.5], y: [-0.5, 1.5] },
      enableGestures: true,
      momentumPan: true,
      smoothZoom: true,
    },
    expansionGraph,
    cinematicMeta: meta,
  };
}

// ─── Interactive Expansion Builder ────────────────────────────────────────────
// Called when a user clicks a node to generate a deeper branch.

export function buildExpansionPayload(
  parentNode: any,
  childData: { id: string; title: string; subtitle?: string; color?: string }[],
  existingElements: any[]
) {
  const parentX = parentNode.x ?? 0.5;
  const parentY = parentNode.y ?? 0.5;
  const count = childData.length || 3;

  // Fan children around parent in a semicircle below
  const arcStart = -Math.PI * 0.7;
  const arcEnd = Math.PI * 0.7;
  const radius = 0.15;

  const newNodes = childData.map((child, i) => {
    const angle = count === 1 ? 0 : arcStart + (arcEnd - arcStart) * (i / (count - 1));
    const cx = clamp(parentX + Math.sin(angle) * radius, 0.08, 0.92);
    const cy = clamp(parentY + Math.cos(angle) * radius + 0.1, 0.08, 0.92);

    return {
      id: child.id,
      type: 'node',
      title: child.title,
      subtitle: child.subtitle || '',
      label: child.title,
      x: cx,
      y: cy,
      color: child.color || parentNode.color || '#8B5CF6',
      importance: Math.max((parentNode.importance || 3) - 1, 1),
      shape: 'pill',
      glow: false,
      revealDelay: i * 0.15,
      revealDuration: 0.4,
      revealAnimation: 'elasticPop',
      ambientMotion: { type: 'float', amplitude: 3, frequency: 0.35, phase: i * 1.2 },
      interactionState: {
        hoverable: true, clickable: true, expandable: false,
        hoverEffect: 'liftGlow', clickEffect: 'rippleFocus',
        hoverTooltip: child.subtitle || child.title,
      },
      _parentId: parentNode.id,
      _isExpansion: true,
    };
  });

  const newEdges = newNodes.map((node, i) => ({
    id: `exp_edge_${parentNode.id}_${node.id}`,
    from: parentNode.id,
    to: node.id,
    type: 'arrow',
    animated: true,
    revealDelay: node.revealDelay + 0.2,
    revealDuration: 0.4,
    drawStyle: 'progressive',
    particleCount: 4,
    particleSpeed: 1.0,
    color: node.color,
    _isExpansion: true,
  }));

  const focusCenter = centroid(newNodes);

  return {
    newNodes,
    newEdges,
    expansionAnimation: {
      type: 'staggeredFan',
      originId: parentNode.id,
      stagger: 0.15,
      totalDuration: count * 0.15 + 0.6,
      parentPulse: true,
    },
    cameraTransition: {
      x: clamp((parentX + focusCenter.x) / 2, 0.15, 0.85),
      y: clamp((parentY + focusCenter.y) / 2, 0.15, 0.85),
      zoom: 1.4,
      duration: 0.8,
      ease: 'easeOutCubic',
    },
    playbackUpdate: {
      pauseAutoAdvance: true,
      focusNodeId: parentNode.id,
      expandedChildIds: newNodes.map((n: any) => n.id),
    },
  };
}
