/**
 * engineSmoke.js — runtime smoke test for the animation engine.
 *
 * Drives a multi-subject scene (DSA arrays/pointers/swaps, concept nodes and
 * edges, a chart, a history timeline) through the real SceneOrchestrator with
 * narration-gated advancement, and audits after every step:
 *   - layout overlap audit (LayoutEngine claims)
 *   - DOM bbox overlap audit (visible top-level elements)
 *   - orphan tween audit (all motion must live in the master timeline)
 *   - FPS
 *
 * Open /engine-smoke.html with `npm run dev`.
 */

import { SceneOrchestrator } from '../engine/SceneOrchestrator';
import { D3Renderer } from '../renderers/D3Renderer';
import { estimateReadingMs, smartPauseMs } from '../engine/narrationTiming';
import gsap from 'gsap';

const stage = document.getElementById('stage');
const statusEl = document.getElementById('status');
const fpsEl = document.getElementById('fps');
const logEl = document.getElementById('log');

const log = (msg, cls = '') => {
  const line = document.createElement('div');
  if (cls) line.className = cls;
  line.textContent = msg;
  logEl.appendChild(line);
  console.log(`[smoke] ${msg}`);
};

// ── FPS meter ───────────────────────────────────────────────────────────────
let frames = 0;
let fpsWindowStart = performance.now();
let minFps = Infinity;
const tickFps = (now) => {
  frames++;
  if (now - fpsWindowStart >= 1000) {
    const fps = Math.round((frames * 1000) / (now - fpsWindowStart));
    if (fps < minFps) minFps = fps;
    fpsEl.textContent = `fps: ${fps} (min ${minFps === Infinity ? '—' : minFps})`;
    frames = 0;
    fpsWindowStart = now;
  }
  requestAnimationFrame(tickFps);
};
requestAnimationFrame(tickFps);

// ── Scene: deliberately crowded to provoke collisions ───────────────────────
const scene = {
  id: 'smoke-1',
  title: 'Engine Smoke Test',
  renderer: 'd3',
  totalSteps: 6,
  steps: [
    {
      title: 'Arrays + boundary + stacked pointers',
      narration: 'We search a sorted array. Low starts at the first index, high at the last, and the search range covers everything.',
      commands: [
        { cmd: 'array', id: 'arr', values: [2, 5, 8, 12, 16, 23, 38, 56, 72, 91] },
        { cmd: 'draw_boundary', atIndex: 0, endIndex: 9, label: 'Search range', targetArrayId: 'arr' },
        { cmd: 'pointer', id: 'lo', atIndex: 0, label: 'low', color: '#8b5cf6', targetArrayId: 'arr' },
        { cmd: 'pointer', id: 'hi', atIndex: 9, label: 'high', color: '#14b8a6', targetArrayId: 'arr' },
        { cmd: 'pointer', id: 'mid', atIndex: 0, label: 'mid', color: '#f59e0b', targetArrayId: 'arr' },
      ],
    },
    {
      title: 'Pointer motion + highlight + annotate',
      narration: 'The midpoint lands on sixteen. We compare it with our target and highlight the cell while an annotation explains the comparison in a longer sentence that must wrap.',
      commands: [
        { cmd: 'move_pointer', id: 'mid', atIndex: 4, targetArrayId: 'arr' },
        { cmd: 'highlight', id: 'arr[4]', color: '#f59e0b' },
        { cmd: 'annotate', target: 'arr[4]', text: 'mid = (low + high) / 2 → index 4 holds 16, smaller than target 23' },
      ],
    },
    {
      title: 'Swap + boundary replace + result',
      narration: 'We move low past the midpoint, the range narrows, and two cells swap places along an arc.',
      commands: [
        { cmd: 'move_pointer', id: 'lo', atIndex: 5, targetArrayId: 'arr' },
        { cmd: 'draw_boundary', atIndex: 5, endIndex: 9, label: 'New range', targetArrayId: 'arr' },
        { cmd: 'swap', id1: 'arr[5]', id2: 'arr[7]', duration: 700 },
        { cmd: 'result', text: 'Range narrowed to [5, 9] — the target must be on the right side' },
      ],
    },
    {
      title: 'Concept nodes with overlapping AI coordinates',
      narration: 'Now a concept map. The model placed several nodes at nearly identical coordinates; the layout engine must separate them without any overlap.',
      commands: [
        { cmd: 'node', id: 'sun', title: 'Sunlight Energy Source', subtitle: 'Input', x: 0.5, y: 0.55, color: '#FBBF24', glow: true, shape: 'circle' },
        { cmd: 'node', id: 'leaf', title: 'Leaf Chloroplast Reaction Site', subtitle: 'Site', x: 0.52, y: 0.57, color: '#22C55E', shape: 'rect' },
        { cmd: 'node', id: 'water', title: 'H₂O', x: 0.5, y: 0.56, color: '#3B82F6', shape: 'pill' },
        { cmd: 'edge', id: 'e1', from: 'sun', to: 'leaf', label: 'photons', type: 'arrow' },
        { cmd: 'edge', id: 'e2', from: 'water', to: 'leaf', label: 'transport', type: 'dashed' },
        { cmd: 'circumscribe', id: 'leaf', color: '#22C55E' },
      ],
    },
    {
      title: 'Chart',
      narration: 'A bar chart rises from the baseline, each bar animating inside the same master timeline.',
      commands: [
        { cmd: 'chart', id: 'growth', type: 'bar', data: [ { label: 'Q1', value: 12 }, { label: 'Q2', value: 28 }, { label: 'Q3', value: 19 }, { label: 'Q4', value: 41 } ] },
      ],
    },
    {
      title: 'History timeline + flash',
      narration: 'Finally a history timeline with long labels that must wrap instead of colliding, and a flash of attention on the result.',
      commands: [
        { cmd: 'timeline', id: 'hist', events: [
          { year: '1928', label: 'Penicillin discovered by Alexander Fleming' },
          { year: '1943', label: 'Mass production for allied troops' },
          { year: '1945', label: 'Nobel Prize in Medicine awarded' },
          { year: '1961', label: 'Methicillin resistance first observed' },
        ] },
        { cmd: 'flash', id: 'hist', color: '#fbbf24' },
        { cmd: 'result', text: 'Timeline complete' },
      ],
    },
  ],
};

// ── Boot ────────────────────────────────────────────────────────────────────
const orchestrator = new SceneOrchestrator(stage, {
  onNarrate: () => {},
});
const d3r = new D3Renderer(stage);
orchestrator.setRenderers({ d3: d3r });
orchestrator.loadScene(scene);

let failures = 0;

// Root-level GSAP animation count. Exactly 0–1 is expected once a step's
// timeline finishes (the master timeline itself); raw gsap.to() calls fired
// by plugins would linger here as extra root-level tweens.
const auditOrphanTweens = () => gsap.globalTimeline.getChildren(false, true, true).length;

const auditStep = (index, stepTitle) => {
  const layout = d3r.engine.layout;

  // 1. Layout claim overlaps
  const overlaps = layout.auditOverlaps(0);
  if (overlaps.length > 0) {
    failures++;
    log(`✗ step ${index} "${stepTitle}": layout overlaps → ${overlaps.map(p => p.join('×')).join(', ')}`, 'bad');
  } else {
    log(`✓ step ${index} "${stepTitle}": no layout overlaps`, 'ok');
  }

  // 2. DOM-level bbox overlap audit for major structures
  const groups = [...stage.querySelectorAll('.canvas-main-layer > g[id]')]
    .filter(el => el.getBBox && getComputedStyle(el).visibility !== 'hidden');
  const rects = groups.map(el => {
    const b = el.getBBox();
    const m = /translate\(([-\d.]+)[,\s]+([-\d.]+)/.exec(el.getAttribute('transform') || '');
    return { id: el.id, x: (m ? +m[1] : 0) + b.x, y: (m ? +m[2] : 0) + b.y, w: b.width, h: b.height };
  });
  let domOverlaps = 0;
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      // Ignore intentional overlays: pointers/boundaries live in their array's zone; edges connect nodes.
      const isPointerOrBoundary = (r) => ['lo','hi','mid'].includes(r.id) || r.id.startsWith('boundary');
      const isEdge = (r) => r.id.startsWith('e');
      if (isPointerOrBoundary(a) || isPointerOrBoundary(b) || isEdge(a) || isEdge(b)) continue;
      const overlap = a.x < b.x + b.w - 2 && a.x + a.w - 2 > b.x && a.y < b.y + b.h - 2 && a.y + a.h - 2 > b.y;
      if (overlap) {
        domOverlaps++;
        log(`  ⚠ DOM bbox overlap: ${a.id} × ${b.id}`, 'bad');
      }
    }
  }
  if (domOverlaps === 0) log(`  ✓ DOM bboxes clean (${rects.length} elements)`, 'ok');
  else failures++;

  // 3. Root tween audit
  const rootCount = auditOrphanTweens();
  log(`  root-level GSAP animations while idle: ${rootCount} (0–1 expected)`, rootCount <= 1 ? 'ok' : 'bad');
  if (rootCount > 1) failures++;
};

// ── Narration-gated step driver (mirrors useSceneAutoplay) ──────────────────
let stepIndex = 0;
const playNext = () => {
  if (stepIndex >= scene.steps.length) {
    // Test backward seek: jump to step 1 instantly, then forward to the end.
    log('— seek test: jumping back to step 1 —');
    orchestrator.playStep(1, {
      animate: false,
      onComplete: () => {
        auditStep('seek-1', 'backward jump rebuild');
        orchestrator.playStep(scene.steps.length - 1, {
          animate: false,
          onComplete: () => {
            auditStep('seek-end', 'forward jump rebuild');
            statusEl.textContent = failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`;
            statusEl.className = failures === 0 ? 'ok' : 'bad';
            log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`, failures === 0 ? 'ok' : 'bad');
            window.__SMOKE_DONE__ = true;
            window.__SMOKE_FAILURES__ = failures;
          },
        });
      },
    });
    return;
  }

  const step = scene.steps[stepIndex];
  const index = stepIndex;
  statusEl.textContent = `step ${index + 1}/${scene.steps.length}: ${step.title}`;

  let animDone = false;
  let voiceDone = false;
  const tryAdvance = () => {
    if (!animDone || !voiceDone) return;
    auditStep(index, step.title);
    stepIndex++;
    setTimeout(playNext, smartPauseMs(step, 2)); // speed 2 to keep the test brisk
  };

  orchestrator.playStep(index, {
    onComplete: () => { animDone = true; tryAdvance(); },
  });
  setTimeout(() => { voiceDone = true; tryAdvance(); }, estimateReadingMs(step.narration, 4));
};

orchestrator.setSpeed(1.5);
document.getElementById('pauseBtn').onclick = (e) => {
  if (e.target.textContent === 'pause') { orchestrator.pause(); e.target.textContent = 'resume'; }
  else { orchestrator.resume(); e.target.textContent = 'pause'; }
};
document.getElementById('speedBtn').onclick = () => orchestrator.setSpeed(2);

log('booting scene with 6 steps…');
playNext();
