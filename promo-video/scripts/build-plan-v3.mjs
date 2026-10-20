// v3 cut (60 s, 120 BPM — one beat = 15 frames).
// Writes src/v3/plan.json: scene boundaries, timings, sound cues and VO lines,
// shared by the film (Remotion), audio/voiceover.py and audio/build_score_v3.py.
// If public/audio/vo/vo.json exists (run voiceover.py once), the hook's word
// slams are locked to the voice's word timings.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const manifest = read('public/capture/manifest.json');
const voPath = path.join(ROOT, 'public/audio/vo/vo.json');
const vo = fs.existsSync(voPath) ? read('public/audio/vo/vo.json') : null;
const rand = (s) => { const x = Math.sin(s * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
const typingSchedule = (text, start, end) => {
  const w = [...text].map((c, i) => (c === ' ' ? 1.6 : 1) * (0.75 + rand(i + text.length) * 0.5));
  const sum = w.reduce((a, b) => a + b, 0);
  let acc = 0;
  return w.map((x) => { acc += x; return Math.round(start + (acc / sum) * (end - start)); });
};

const FPS = 30;
const S = {
  hook: [0, 150],
  hero: [150, 540], // ask → send → lesson → controls → play → pass 1
  doubt: [540, 780], // pause → ask → answer on the board
  finish: [780, 900], // resume → pass 2/3 → sorted
  montage: [900, 1530], // five subjects + the wall
  brand: [1530, 1800],
};
const A = (sc, f) => S[sc][0] + f;

// ── VO script (frames are absolute) ────────────────────────────────────────
const SUBJECTS = [
  { key: 'stackqueue', vo: 'Explore algorithms.', title: 'Stack vs Queue', question: 'What is the difference between a stack and a queue?', kind: 'ALGORITHM SESSION', guide: 'ALGORITHM GUIDE',
    steps: ['Push onto the stack', 'Enqueue at the rear', 'Pop from the top (LIFO)', 'Dequeue from the front (FIFO)'],
    explain: ['A stack only ever touches its top: each push lands on the last one.', 'A queue adds at the rear and serves from the front, like a line at a counter.', 'pop() removes the most recent push — Last In, First Out.', 'dequeue() serves the oldest item first — First In, First Out.'] },
  { key: 'geometry', vo: 'Build geometry.', title: 'Triangle Angle Sum', question: 'Why do the angles of a triangle add up to 180°?', kind: 'CONCEPT SESSION', guide: 'CONCEPT GUIDE',
    steps: ['Construct triangle ABC', 'Mark the three angles', 'Draw a parallel through C', 'They form a straight line'],
    explain: ['Start with any triangle ABC.', 'Call its angles α, β and γ.', 'Draw the line through C parallel to AB. Alternate angles copy α and β up to C.', 'α, γ and β now sit side by side on a straight line — so they add to 180°.'] },
  { key: 'physics', vo: 'Understand physics.', title: 'Projectile Motion at 45°', question: 'How does a ball kicked at 45° actually travel?', kind: 'CONCEPT SESSION', guide: 'CONCEPT GUIDE',
    steps: ['Split the launch velocity', 'Gravity bends the path', 'Maximum height', 'Landing and range'],
    explain: ['At 45° the launch speed splits into equal horizontal and vertical parts.', 'Horizontal speed stays constant; gravity pulls the vertical speed down 9.8 m/s every second.', 'At the top the vertical speed is zero — only vₓ remains.', 'The path is a parabola; 45° gives the longest range on flat ground.'] },
  { key: 'chem', vo: 'Visualize chemistry.', title: 'Why Water Is Bent', question: 'Why is a water molecule bent instead of straight?', kind: 'CONCEPT SESSION', guide: 'CONCEPT GUIDE',
    steps: ['Oxygen bonds two hydrogens', 'Two lone pairs push back', 'The 104.5° bond angle'],
    explain: ['Oxygen shares one electron pair with each hydrogen.', 'Oxygen also keeps two lone pairs. They repel the bonding pairs more strongly.', 'The bonds are squeezed from 109.5° to 104.5° — so water is bent, and polar.'] },
  { key: 'ml', vo: 'Discover how machines learn.', title: 'How a Network Spots a Cat', question: 'How does a neural network recognise a cat?', kind: 'CONCEPT SESSION', guide: 'CONCEPT GUIDE',
    steps: ['Pixels in', 'Features light up', 'Signal flows through the layers', 'Prediction'],
    explain: ['The image enters as a grid of pixel values.', 'Early layers respond to edges; later ones to ears, eyes and whiskers.', 'Each layer weighs the evidence from the one before it.', 'The output with the most evidence wins: cat, 94%.'] },
];
const SEG = 105;
const montage = {
  subjects: SUBJECTS.map((s, k) => ({ ...s, start: 15 + k * SEG, end: 15 + (k + 1) * SEG })),
};
montage.wall = [montage.subjects.at(-1).end, S.montage[1] - S.montage[0]];

const voLines = [
  { f: A('hook', 4), text: "What if AI didn't just answer your questions?" },
  { f: A('hook', 80), text: 'What if it could show you the answer?' },
  { f: A('hero', 24), text: 'Ask anything.' },
  { f: A('hero', 236), text: 'Watch the answer come to life.' },
  { f: A('doubt', 4), text: 'And when you have a doubt? Just ask.' },
  { f: A('doubt', 140), text: 'It answers right on the board.' },
  ...montage.subjects.map((s) => ({ f: A('montage', s.start + 24), text: s.vo })),
  { f: A('brand', 28), text: "TutorBoard. Don't just get the answer. See how it works." },
];
const wordsOf = (i) => {
  const line = vo?.lines?.[i];
  if (!line || line.text !== voLines[i].text) return null; // stale VO — fall back to defaults
  return line.words.map((w) => ({ w: w.w, f: Math.round(voLines[i].f + w.t * FPS) }));
};

// ── Hook (absolute = local; it starts at 0) ────────────────────────────────
const LINE1 = ['What', 'if', 'AI', "didn't", 'just', 'answer', 'your', 'questions?'];
const LINE2 = ['What', 'if', 'it', 'could'];
const w1 = wordsOf(0);
const w2 = wordsOf(1);
const hook = {
  line1: LINE1.map((w, i) => ({ w, f: w1?.[i]?.f ?? 6 + i * 7 })),
  line2: LINE2.map((w, i) => ({ w, f: w2?.[i]?.f ?? 82 + i * 3 })),
  show: w2?.[4]?.f ?? 96,
  tail: [{ w: 'you', f: w2?.[5]?.f ?? 104 }, { w: 'the', f: w2?.[6]?.f ?? 108 }, { w: 'answer?', f: w2?.[7]?.f ?? 112 }],
};
hook.line1Out = Math.max(hook.line1.at(-1).f + 10, hook.line2[0].f - 6);
hook.split = [Math.max(hook.tail.at(-1).f + 8, 122), 150];

// ── Hero (local; the scene is mounted LEAD frames early, behind the split) ──
const hero = {
  lead: S.hook[1] - hook.split[0],
  push: [0, 24],
  typing: typingSchedule(manifest.question, 26, 84),
  clickSend: 102,
  think: [104, 140], // real "send" frames: Thinking → Synthesizing experience
  reveal: [140, 176], // real reveal frames → the lesson appears
  handoff: [174, 182], // real capture → resolution-independent rebuild
  controls: [182, 232],
  clickPlay: 212,
  toBoard: [228, 252],
  pass1: [244, 376],
};

// ── Doubt (local) ───────────────────────────────────────────────────────────
const doubt = {
  toBar: [0, 18],
  clickPause: 14,
  clickDoubt: 32,
  open: [33, 45],
  typing: typingSchedule(manifest.doubt, 48, 94),
  enter: 98,
  toPanel: [100, 128],
  highlight: 134,
  callout: 142,
  answer: [142, 196],
  followUp: 200,
};

// ── Finish (local) ──────────────────────────────────────────────────────────
const finish = { clickResume: 8, pass2: [16, 86], sorted: 88, out: [104, 120] };

// ── Brand (local) ───────────────────────────────────────────────────────────
const wb = wordsOf(voLines.length - 1);
const brand = {
  cube: 0,
  wordmark: wb?.[0]?.f ? wb[0].f - S.brand[0] : 32,
  taglineA: wb?.[1]?.f ? wb[1].f - S.brand[0] : 60,
  taglineB: wb?.[6]?.f ? wb[6].f - S.brand[0] : 104,
  cta: 168,
  fadeOut: [246, 270],
};

// ── Bubble sort choreography (frames local to their scene) ─────────────────
const choreo = (ops, start, len) => {
  const per = len / ops.length;
  return ops.map((o, k) => ({ ...o, at: Math.round(start + k * per), dur: Math.round(per) }));
};
const sort = {
  pass1: choreo([{ i: 0, swap: true }, { i: 1, swap: true }, { i: 2, swap: true }, { i: 3, swap: false }], hero.pass1[0], hero.pass1[1] - hero.pass1[0]),
  pass2: choreo([{ i: 0, swap: false }, { i: 1, swap: true }, { i: 2, swap: false }, { i: 0, swap: false }, { i: 1, swap: false }], finish.pass2[0], finish.pass2[1] - finish.pass2[0]),
};

// ── Sound cues (absolute) ───────────────────────────────────────────────────
const cues = {
  keys: [
    ...hero.typing.filter((_, i) => i % 2 === 0).map((f) => A('hero', f)),
    ...doubt.typing.filter((_, i) => i % 2 === 0).map((f) => A('doubt', f)),
    ...montage.subjects.flatMap((s) => [0, 2, 4, 6, 8, 10, 12, 14].map((d) => A('montage', s.start + 2 + d))),
  ],
  clicks: [A('hero', hero.clickPlay), A('doubt', doubt.clickPause), A('doubt', doubt.clickDoubt), A('finish', finish.clickResume)],
  sends: [A('hero', hero.clickSend), A('doubt', doubt.enter), ...montage.subjects.map((s) => A('montage', s.start + 19))],
  slams: [
    ...hook.line1.map((w, i) => ({ f: w.f, gain: i === hook.line1.length - 1 ? 0.34 : 0.22 + 0.02 * i })),
    ...hook.line2.map((w) => ({ f: w.f, gain: 0.16 })),
    ...hook.tail.map((w) => ({ f: w.f, gain: 0.2 })),
  ],
  impacts: [
    { f: hook.show, gain: 0.85, shimmer: true },
    { f: S.hero[0], gain: 0.5, shimmer: true },
    { f: A('hero', hero.reveal[0]), gain: 0.32, shimmer: false },
    ...montage.subjects.map((s) => ({ f: A('montage', s.start + 26), gain: 0.3, shimmer: false })),
    { f: A('montage', montage.wall[0]), gain: 0.42, shimmer: true },
    { f: A('brand', brand.wordmark), gain: 0.55, shimmer: true },
  ],
  whooshes: [
    { f: hook.split[0] - 2, dur: 30, gain: 0.24 },
    { f: A('hero', hero.reveal[0]) - 6, dur: 22, gain: 0.1 },
    { f: A('hero', hero.toBoard[0]), dur: 20, gain: 0.08 },
    { f: A('doubt', doubt.toPanel[0]), dur: 24, gain: 0.07 },
    ...montage.subjects.flatMap((s) => [{ f: A('montage', s.start) - 4, dur: 14, gain: 0.12 }, { f: A('montage', s.start + 20), dur: 12, gain: 0.1 }]),
    { f: A('montage', montage.wall[0]) - 6, dur: 24, gain: 0.12 },
    { f: A('brand', 0) - 8, dur: 30, gain: 0.12, up: false },
  ],
  risers: [
    { f: hook.show - 22, dur: 22, gain: 0.1 },
    { f: hook.split[0] - 10, dur: 38, gain: 0.12 },
    { f: S.montage[1] - 44, dur: 44, gain: 0.1 },
  ],
  swaps: [
    ...sort.pass1.map((o) => ({ f: A('hero', o.at + Math.round(o.dur * 0.34)), swap: o.swap, cmp: A('hero', o.at) })),
    ...sort.pass2.map((o) => ({ f: A('finish', o.at + Math.round(o.dur * 0.34)), swap: o.swap, cmp: A('finish', o.at) })),
  ],
  bells: [
    { f: A('doubt', doubt.highlight), note: 'A5', gain: 0.17, pan: -0.15 },
    { f: A('doubt', doubt.highlight) + 7, note: 'E6', gain: 0.13, pan: 0.15 },
    { f: A('finish', finish.sorted), note: 'D6', gain: 0.1 },
    { f: A('finish', finish.sorted) + 6, note: 'A6', gain: 0.07 },
    { f: A('brand', brand.taglineB), note: 'A5', gain: 0.07 },
  ],
};

const plan = {
  fps: FPS, bpm: 120, totalFrames: S.brand[1], scenes: S,
  hook, hero, doubt, finish, montage, brand, sort, vo: voLines,
  music: {
    hookEnd: hook.split[0],
    drop: S.hero[0],
    doubt: [A('doubt', 0), A('finish', finish.clickResume)],
    montage: S.montage,
    wall: A('montage', montage.wall[0]),
    brand: S.brand[0],
  },
  cues,
};
fs.mkdirSync(path.join(ROOT, 'src/v3'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'src/v3/plan.json'), JSON.stringify(plan, null, 1));
console.log(`v3 plan: ${plan.totalFrames} frames (${(plan.totalFrames / FPS).toFixed(1)} s); VO word-locked: ${!!(w1 && w2)}; SHOW @${hook.show}; split ${hook.split}; hero lead ${hero.lead}`);
