// Benchmarks doubts on golden lessons (latency, branch vs new-topic, the moment chosen).
//   node scripts/doubt-bench.mjs [outDir] [runs=default,low]   (a run is a reasoning effort, or "lite" for the fast model)
// Needs the Engine v2 dev backend (scripts/scene-lab-backend.mjs) on SCENE_LAB_API (default :5055).
// Each branch is saved as <outDir>/<id>-<effort>.json — a scene the Scene Lab / scene-shots can play.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API = process.env.SCENE_LAB_API ?? 'http://localhost:5055';
const here = path.dirname(fileURLToPath(import.meta.url));
const [outDir = path.join(here, '../../docs/eval/doubts'), effortsArg = 'default,low'] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const fixture = (name) => JSON.parse(readFileSync(path.join(here, '../engine/scene/fixtures', name), 'utf8'));

const CASES = [
  { id: 'heap', scene: 'heap-insert.json', beatIndex: 0, question: 'Why does 3 swap with 7 and not with 9?' },
  { id: 'bubble', scene: 'bubble-sort.json', beatIndex: 2, question: 'Why does 5 keep moving to the right?' },
  { id: 'projectile', scene: 'projectile-45.json', beatIndex: 1, question: 'Why is the path a curve and not a straight line?' },
  { id: 'water', scene: 'water-molecule.json', beatIndex: 1, question: 'Why is the molecule bent instead of straight?' },
];

const r = await fetch(`${API}/api/csrf-token`);
const cookie = (r.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
const { csrfToken } = await r.json();

const rows = [];
for (const effort of effortsArg.split(',')) {
  for (const c of CASES) {
    const t0 = Date.now();
    const res = await fetch(`${API}/api/scene/doubt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken, Cookie: cookie },
      body: JSON.stringify({ question: c.question, scene: fixture(c.scene), beatIndex: c.beatIndex, ...(effort === 'lite' ? { quality: 'fast' } : effort === 'default' ? {} : { reasoning: effort }) }),
    });
    const d = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
    const s = ((d.ms ?? Date.now() - t0) / 1000).toFixed(1);
    const what = d.ok ? (d.kind === 'branch' ? `branch from beat ${d.from + 1}, ${d.beats} beat(s)` : `new-topic: ${d.answer}`) : `FAILED: ${d.errors?.[0]?.message ?? d.error}`;
    if (d.ok && d.kind === 'branch') writeFileSync(path.join(outDir, `${c.id}-${effort}.json`), JSON.stringify(d.scene, null, 1));
    rows.push({ effort, id: c.id, s: Number(s), attempts: d.attempts ?? 0, what, answer: d.answer ?? '' });
    console.log(`${effort.padEnd(8)} ${c.id.padEnd(11)} ${s.padStart(5)} s  ${d.attempts ?? 0} attempt(s)  ${what}`);
  }
}
writeFileSync(path.join(outDir, 'bench.json'), JSON.stringify(rows, null, 1));
