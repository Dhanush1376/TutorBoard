// Builds src/timeline.json — the single source of truth shared by the film
// (Remotion) and the score (audio/build_score.py): scene boundaries, the
// frame-by-frame mapping of captured footage onto film time, cursor clicks,
// keystrokes and every sound cue.
//
// Inputs: public/capture/manifest.json (film-capture.mjs)
//         public/capture/analysis.json (scripts/analyze_capture.py)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CAP = path.join(ROOT, 'public', 'capture');
const manifest = JSON.parse(fs.readFileSync(path.join(CAP, 'manifest.json'), 'utf8'));
const analysis = JSON.parse(fs.readFileSync(path.join(CAP, 'analysis.json'), 'utf8'));
const subjectsPath = path.join(CAP, 'subjects', 'subjects.json');
const subjects = fs.existsSync(subjectsPath) ? JSON.parse(fs.readFileSync(subjectsPath, 'utf8')).subjects : {};
const SUBJECT_ORDER = ['math', 'physics', 'ml', 'chem'].filter((k) => subjects[k]?.payoff);

const FPS = 30;
const BPM = 90; // one beat = 20 frames
const S = {
  words: [0, 240],
  ask: [240, 560],
  think: [560, 800],
  unfold: [800, 1360],
  doubt: [1360, 2000],
  range: [2000, 2000 + 80 + SUBJECT_ORDER.length * 160 + 80],
};
S.brand = [S.range[1], S.range[1] + 320];
const total = S.brand[1];

// Deterministic jitter so typing has a human cadence.
const rand = (seed) => { const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };

/** Keystroke schedule: film frame (scene-local) at which char i appears. */
function typingSchedule(text, start, end) {
  const weights = [...text].map((c, i) => (c === ' ' ? 1.7 : /[,?\]]/.test(c) ? 1.4 : 1) * (0.7 + rand(i + text.length) * 0.6));
  const sum = weights.reduce((a, b) => a + b, 0);
  const span = end - start;
  let acc = 0;
  return weights.map((w) => { acc += w; return Math.round(start + (acc / sum) * span); });
}

/**
 * Time-remap a captured shot onto `filmLen` frames: real motion plays at 1x,
 * static holds are sped up (eased speed changes, never below 1x).
 */
function remap(shot, from, to, filmLen, { thresh = 0.18, pad = 10, maxSpeed = 6 } = {}) {
  // The board is the subject: panel typewriter text counts only lightly.
  const e = analysis[shot].canvas.map((c, i) => Math.max(c, analysis[shot].panel[i] * 0.25));
  const n = to - from;
  const active = new Array(n).fill(false);
  for (let i = 0; i < n; i++) {
    if (e[from + i] > thresh) for (let k = Math.max(0, i - pad); k < Math.min(n, i + pad); k++) active[k] = true;
  }
  const act = active.filter(Boolean).length;
  const idle = n - act;
  let fast = idle > 0 ? idle / Math.max(1, filmLen - act) : 1;
  fast = Math.min(maxSpeed, Math.max(1, fast));
  // smooth per-frame speed
  const speed = active.map((a) => (a ? 1 : fast));
  const smooth = speed.map((_, i) => {
    let s = 0, c = 0;
    for (let k = -8; k <= 8; k++) { const j = i + k; if (j >= 0 && j < n) { s += speed[j]; c++; } }
    return s / c;
  });
  // walk capture time with that speed
  const map = [];
  let pos = 0;
  while (map.length < filmLen) {
    map.push(from + Math.min(n - 1, Math.round(pos)));
    const sp = smooth[Math.min(n - 1, Math.floor(pos))] || fast;
    pos += sp;
    if (pos >= n - 1) pos = n - 1;
  }
  return { map, fast: +fast.toFixed(2), activeFrames: act };
}

/** Capture frames where the canvas changes a lot (step transitions). */
function bursts(shot, from, to, thresh = 1.2, gap = 45) {
  const e = analysis[shot].canvas;
  const out = [];
  for (let i = from; i < to; i++) {
    if (e[i] > thresh && (out.length === 0 || i - out[out.length - 1] > gap)) out.push(i);
  }
  return out;
}

// ── Scene 2: Ask ────────────────────────────────────────────────────────────
const askLocal = {
  enter: 0,
  clickModes: 70,
  clickDeep: 102,
  pushIn: [104, 150],
  typing: typingSchedule(manifest.question, 152, 248),
  clickSend: 292,
};

// ── Scene 3: Think ──────────────────────────────────────────────────────────
const thinkLocal = {
  pullBack: [0, 34],
  stages: [44, 92, 140],
  numbersRise: 64,
  numbersLand: [168, 206],
  revealStart: 200, // real lesson frames begin under the landed cells
};

// ── Scene 4: Unfold (real playback, remapped) ───────────────────────────────
const playFrames = manifest.shots.play.frames;
const step3At = manifest.shots.play.step3At ?? playFrames - 60;
const unfoldLocal = { revealTail: [0, 64], clickPlay: 70, playStart: 72, playEnd: 548 };
const playEndCap = Math.min(playFrames, step3At + 56);
const playBursts = bursts('play', 8, playEndCap, 0.8);
// Ramp each step separately so steps get similar screen time (the real step 1
// held far longer than the others); every transition itself plays at 1x.
const playFilmLen = unfoldLocal.playEnd - unfoldLocal.playStart;
const cuts = [8, ...playBursts.map((b) => b - 6), playEndCap];
const shares = cuts.slice(1).map((_, i) => [1, 0.75][i] ?? 0.3);
const shareSum = shares.reduce((a, b) => a + b, 0);
const playMap = { map: [], fast: 0 };
let used = 0;
for (let i = 0; i < cuts.length - 1; i++) {
  const len = i === cuts.length - 2 ? playFilmLen - used : Math.round((shares[i] / shareSum) * playFilmLen);
  const seg = remap('play', cuts[i], cuts[i + 1], len);
  playMap.map.push(...seg.map);
  playMap.fast = Math.max(playMap.fast, seg.fast);
  used += len;
}
const toFilm = (mapArr, offset, captureFrame) => {
  const i = mapArr.findIndex((c) => c >= captureFrame);
  return i < 0 ? null : offset + i;
};
const stepChangesFilm = playBursts.map((b) => toFilm(playMap.map, unfoldLocal.playStart, b)).filter((x) => x != null);

// ── Scene 5: Doubt ──────────────────────────────────────────────────────────
// The real answer can land within a few virtual frames of Enter (the clock is
// paused while the AI works in real time). Hold the genuine "Looking at this
// step on your canvas…" frame so the wait reads, then play on at 1x.
const waitFrames = manifest.shots['doubt-wait'].frames;
const amberInWait = analysis['doubt-wait']?.amberFrame;
const amberInAnswer = analysis.answer?.amberFrame;
const PENDING_HOLD = 40;
const doubtLocal = {
  clickPause: 12,
  stuck: [32, 100],
  clickDoubt: 118,
  doubtOpen: 120,
  typing: typingSchedule(manifest.doubt, 140, 212),
  enter: 218,
  waitStart: 220, // then answerSeq (doubt-wait → answer) until resumeStart
  clickResume: 478,
  resumeStart: 482,
  resumeEnd: 640,
};
const answerFrames = manifest.shots.answer.frames;
// film-frame → [shot, frame] from waitStart until resumeStart
const answerSeq = [];
const holdAt = amberInWait != null ? Math.max(0, amberInWait - 1) : Math.min(12, waitFrames - 1);
for (let i = 0; i <= holdAt; i++) answerSeq.push(['doubt-wait', i]);
for (let i = 0; i < PENDING_HOLD; i++) answerSeq.push(['doubt-wait', holdAt]);
for (let i = holdAt + 1; i < waitFrames; i++) answerSeq.push(['doubt-wait', i]);
for (let i = 0; i < answerFrames; i++) answerSeq.push(['answer', i]);
const seqLen = doubtLocal.resumeStart - doubtLocal.waitStart;
answerSeq.length = Math.min(answerSeq.length, seqLen);
while (answerSeq.length < seqLen) answerSeq.push(answerSeq[answerSeq.length - 1]);
const amberSeq = amberInWait != null
  ? holdAt + 1 + PENDING_HOLD
  : holdAt + 1 + PENDING_HOLD + (waitFrames - holdAt - 1) + (amberInAnswer ?? 20);
doubtLocal.highlight = doubtLocal.waitStart + amberSeq;
const resumeFrames = manifest.shots.resume.frames;
const step4At = manifest.shots.resume.step4At ?? resumeFrames - 80;
const resumeMap = remap('resume', 0, step4At >= 0 ? Math.min(resumeFrames, step4At + 70) : resumeFrames, doubtLocal.resumeEnd - doubtLocal.resumeStart, { maxSpeed: 12 });

// ── Scene 6: Brand ──────────────────────────────────────────────────────────
const brandLocal = { lift: 36, cube: 74, wordmark: 140, tagline: 172, cta: 236, fadeOut: [296, 320] };

// ── Scene 6: Any subject ────────────────────────────────────────────────────
// Each subject is two bars: question typed in the composer, a whip to the
// board, the real lesson's payoff at 1x.
const SEG = 160;
const rangeLocal = {
  intro: [0, 80],
  outro: [80 + SUBJECT_ORDER.length * SEG, 80 + SUBJECT_ORDER.length * SEG + 80],
  subjects: SUBJECT_ORDER.map((key, k) => {
    const sj = subjects[key];
    const start = 80 + k * SEG;
    // type fast, then hold the full question long enough to read
    const typing = typingSchedule(sj.question, start + 4, start + 30);
    return {
      key, label: sj.label, question: sj.question, start, typing,
      whip: [start + 46, start + 56],
      payoffStart: start + 52,
      end: start + SEG,
      composer: sj.composer, content: sj.content, payoffFrames: sj.payoff, typingFrames: sj.typing,
    };
  }),
};

// ── Cues (absolute frames) ──────────────────────────────────────────────────
const A = (scene, f) => S[scene][0] + f;
const cues = {
  keys: [
    ...askLocal.typing.map((f) => A('ask', f)),
    ...doubtLocal.typing.map((f) => A('doubt', f)),
    // fast typing in the montage: a tick every few characters, not a buzz
    ...rangeLocal.subjects.flatMap((sj) => sj.typing.filter((_, i) => i % 4 === 0).map((f) => A('range', f))),
  ],
  clicks: [
    A('ask', askLocal.clickModes), A('ask', askLocal.clickDeep),
    A('unfold', unfoldLocal.clickPlay),
    A('doubt', doubtLocal.clickPause), A('doubt', doubtLocal.clickDoubt), A('doubt', doubtLocal.clickResume),
  ],
  sends: [A('ask', askLocal.clickSend), A('doubt', doubtLocal.enter)],
  whooshes: [
    { f: A('words', 214), dur: 40, gain: 0.12 },
    { f: A('think', thinkLocal.pullBack[0]) - 4, dur: 36, gain: 0.1, up: false },
    { f: A('think', thinkLocal.numbersLand[0]) - 6, dur: 40, gain: 0.12 },
    { f: A('brand', brandLocal.lift), dur: 44, gain: 0.13 },
    ...rangeLocal.subjects.map((sj) => ({ f: A('range', sj.whip[0]) - 4, dur: 22, gain: 0.12 })),
    { f: A('range', 0), dur: 34, gain: 0.1, up: false },
  ],
  pops: [
    ...[5, 1, 4, 2, 8].map((v, i) => ({ f: A('think', thinkLocal.numbersLand[0]) + 18 + i * 3, value: v })),
    ...stepChangesFilm.flatMap((f, k) => {
      const vals = [[1, 5, 4, 2, 8], [1, 4, 2, 5, 8], [1, 2, 4, 5, 8]][k % 3];
      return vals.map((v, i) => ({ f: A('unfold', f) + i * 2, value: v }));
    }),
    ...[1, 2, 4, 5, 8].map((v, i) => ({ f: A('brand', brandLocal.lift) + 8 + i * 4, value: v })),
  ],
  impacts: [
    { f: A('think', thinkLocal.revealStart), gain: 0.35 },
    ...rangeLocal.subjects.map((sj) => ({ f: A('range', sj.payoffStart), gain: 0.22, shimmer: true })),
    { f: A('brand', brandLocal.cube) + 26, gain: 0.5 },
  ],
  bells: [
    { f: A('doubt', doubtLocal.highlight), note: 'A5', gain: 0.17, pan: -0.15 },
    { f: A('doubt', doubtLocal.highlight) + 7, note: 'E6', gain: 0.13, pan: 0.15 },
    { f: A('brand', brandLocal.tagline) + 6, note: 'D6', gain: 0.09 },
    { f: A('brand', brandLocal.tagline) + 14, note: 'A6', gain: 0.06 },
  ],
};

const timeline = {
  fps: FPS,
  bpm: BPM,
  totalFrames: total,
  scenes: S,
  ask: askLocal,
  think: thinkLocal,
  unfold: { ...unfoldLocal, playMap: playMap.map, playSpeed: playMap.fast, stepChanges: stepChangesFilm },
  doubt: { ...doubtLocal, answerFrames, answerSeq, resumeMap: resumeMap.map, resumeSpeed: resumeMap.fast },
  range: rangeLocal,
  brand: brandLocal,
  music: {
    motif: [S.ask[0], S.think[0]],
    build: [S.think[0], S.unfold[0]],
    groove: [S.unfold[0]],
    doubtDrop: S.doubt[0],
    resume: 1840,
    outro: S.range[0] + rangeLocal.outro[0],
    brand: S.brand[0],
  },
  cues,
};

fs.writeFileSync(path.join(ROOT, 'src', 'timeline.json'), JSON.stringify(timeline));
console.log(`timeline: ${total} frames (${(total / FPS).toFixed(1)} s)`);
console.log(`play: ${playFrames} captured → speed ${playMap.fast}x on holds; step changes at film ${stepChangesFilm.join(', ')}`);
console.log(`resume: ${resumeFrames} captured → speed ${resumeMap.fast}x; highlight at doubt+${doubtLocal.highlight}`);
