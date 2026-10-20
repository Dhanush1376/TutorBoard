// Eval runner (checklist 0.4): questions → AI scenes → headless render → report.
//
//   node scripts/eval-scenes.mjs [--ids alg-2,math-2] [--domain physics] [--limit 6] [--out ../docs/eval/runs/<stamp>]
//
// Needs: the client dev server (npm run dev -- --port 5199) and the Scene Lab
// backend (node ../server/scripts/scene-lab-backend.mjs). Writes, per run:
//   <id>.json (planner result) · <id>_<beat>.png (end of every beat) · report.json · report.md
// Automatic checks: validity (attempts), latency, overlaps, warnings, beats.
// The rubric's judgement scores (correctness, visual match, pedagogy) are filled in by review.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve('playwright', { paths: [path.resolve(process.cwd(), '..'), process.cwd()] }));

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const API = arg('api', 'http://localhost:5055');
const MODEL = arg('model', undefined); // e.g. gemini-3.5-flash-lite (default: the server's scene model)
const REASONING = arg('reasoning', undefined); // none | minimal | low | medium | high
const LAB = arg('lab', 'http://localhost:5199/scene-lab.html');
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const out = arg('out', path.resolve('..', 'docs', 'eval', 'runs', stamp));
mkdirSync(out, { recursive: true });

const set = JSON.parse(readFileSync(path.resolve('..', 'docs', 'eval', 'questions.json'), 'utf8'));
let questions = set.questions;
if (arg('ids')) { const ids = arg('ids').split(','); questions = questions.filter((q) => ids.includes(q.id)); }
if (arg('domain')) questions = questions.filter((q) => q.domain === arg('domain'));
questions = questions.slice(0, Number(arg('limit', questions.length)));

// CSRF double-submit, like the app's own client
let cookie = '';
const csrf = async () => {
  const r = await fetch(`${API}/api/csrf-token`);
  cookie = (r.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
  return (await r.json()).csrfToken;
};
const token = await csrf();

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(LAB);
await page.waitForFunction(() => !!window.__lab?.engine, null, { timeout: 30000 });

const rows = [];
for (const q of questions) {
  process.stdout.write(`${q.id} … `);
  const t0 = Date.now();
  const ask = () => fetch(`${API}/api/scene/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token, Cookie: cookie },
    body: JSON.stringify({ question: q.question, debug: true, ...(MODEL ? { model: MODEL } : {}), ...(REASONING ? { reasoning: REASONING } : {}) }),
  }).then(async (res) => res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` })));
  let data = await ask();
  // every provider briefly blocked (rate limits): wait it out once rather than fail the question
  const limited = (d) => !d.ok && /CIRCUIT_OPEN|Rate limit|429/i.test(`${d.error ?? ''} ${d.errors?.[0]?.message ?? ''}`);
  if (limited(data)) { process.stdout.write('(rate limited — waiting 60 s) '); await new Promise((r) => setTimeout(r, 60000)); data = await ask(); }
  writeFileSync(path.join(out, `${q.id}.json`), JSON.stringify(data, null, 1));
  const row = { id: q.id, domain: q.domain, question: q.question, model: data.model ?? MODEL ?? '', ok: !!data.ok, attempts: data.attempts ?? 0, seconds: +(((data.ms ?? Date.now() - t0)) / 1000).toFixed(1), beats: 0, overlaps: 0, warnings: data.warnings?.length ?? 0, title: data.scene?.title ?? '', error: data.ok ? '' : (data.errors?.[0] ? `${data.errors[0].path}: ${data.errors[0].message}` : data.error ?? '') };
  if (data.ok) {
    const info = await page.evaluate(async (s) => {
      const name = window.__lab.addGenerated(s);
      await window.__lab.open(name);
      return { beats: window.__lab.engine.beats.length, overlaps: window.__lab.overlaps.length };
    }, data.scene);
    row.beats = info.beats;
    row.overlaps = info.overlaps;
    for (let b = 0; b < info.beats; b++) {
      await page.evaluate((i) => window.__lab.engine.seekBeat(i, 'end'), b);
      await page.waitForTimeout(120);
      await page.locator('main').screenshot({ path: path.join(out, `${q.id}_${b}.png`) });
    }
  }
  rows.push(row);
  console.log(row.ok ? `ok (${row.attempts} att, ${row.seconds}s, ${row.beats} beats, ${row.overlaps} overlaps)` : `FAILED: ${row.error}`);
}
await browser.close();

const ok = rows.filter((r) => r.ok);
const summary = {
  run: stamp,
  questions: rows.length,
  valid: ok.length,
  firstTry: ok.filter((r) => r.attempts === 1).length,
  avgSeconds: ok.length ? +(ok.reduce((s, r) => s + r.seconds, 0) / ok.length).toFixed(1) : 0,
  withOverlaps: ok.filter((r) => r.overlaps > 0).length,
};
writeFileSync(path.join(out, 'report.json'), JSON.stringify({ summary, rows }, null, 1));
const md = [
  `# Scene eval — ${stamp}`,
  '',
  `${summary.valid}/${summary.questions} valid · ${summary.firstTry} on the first try · avg ${summary.avgSeconds}s · ${summary.withOverlaps} with layout overlaps · model ${rows[0]?.model ?? '?'}${REASONING ? ` · reasoning ${REASONING}` : ''}`,
  '',
  '| id | domain | ok | attempts | s | beats | overlaps | warnings | title / error |',
  '|---|---|---|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.id} | ${r.domain} | ${r.ok ? '✓' : '✗'} | ${r.attempts} | ${r.seconds} | ${r.beats} | ${r.overlaps} | ${r.warnings} | ${(r.ok ? r.title : r.error).replace(/\|/g, '/')} |`),
].join('\n');
writeFileSync(path.join(out, 'report.md'), md);
console.log(`\n${md.split('\n')[2]}\nreport: ${path.join(out, 'report.md')}`);
