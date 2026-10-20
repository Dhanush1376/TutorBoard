// Headless screenshots of Engine v2 scenes from the Scene Lab (QC + eval rendering).
//
// usage: node scripts/scene-shots.mjs <outDir> <scene>:<beat>[:<seconds into beat>|end] ...
//   e.g. node scripts/scene-shots.mjs ./shots bubble-sort:2:1.5 projectile-45:3:end
// Needs the client dev server running (npm run dev). Base URL: SCENE_LAB_URL
// (default http://localhost:5199/scene-lab.html).
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// Playwright lives in the repo root's devDependencies.
const { chromium } = require(require.resolve('playwright', { paths: [path.resolve(process.cwd(), '..'), process.cwd()] }));

const [outDir, ...specs] = process.argv.slice(2);
if (!outDir || !specs.length) {
  console.error('usage: node scripts/scene-shots.mjs <outDir> <scene>:<beat>[:<sec>|end] ...');
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });
const base = process.env.SCENE_LAB_URL ?? 'http://localhost:5199/scene-lab.html';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
let current = '';
for (const spec of specs) {
  // "file=<path.json>:<beat>[:<sec>|end]" plays a scene from disk (e.g. one the AI generated)
  let [scene, beatStr, at = 'end'] = spec.split(/:(?![\/])/);
  if (scene.startsWith('file=')) {
    const { readFileSync } = await import('node:fs');
    const raw = JSON.parse(readFileSync(scene.slice(5), 'utf8'));
    const json = raw.scene ?? raw;
    if (!current) {
      await page.goto(base);
      await page.waitForFunction(() => !!window.__lab?.engine?.beats?.length, null, { timeout: 30000 });
    }
    scene = await page.evaluate(async (s) => { const n = window.__lab.addGenerated(s); await window.__lab.open(n); return n; }, json);
    current = scene;
  }
  if (scene !== current) {
    if (!current) {
      await page.goto(`${base}#${scene}`);
      await page.waitForFunction(() => !!window.__lab?.engine?.beats?.length, null, { timeout: 30000 });
    }
    await page.evaluate(async (name) => { if (window.__lab.name !== name) await window.__lab.open(name); }, scene);
    await page.waitForFunction((name) => window.__lab?.name === name, scene, { timeout: 30000 });
    await page.waitForTimeout(400);
    current = scene;
  }
  const beat = Number(beatStr);
  await page.evaluate(({ beat, at }) => {
    const e = window.__lab.engine;
    if (at === 'end') e.seekBeat(beat, 'end');
    else { e.seekBeat(beat, 'start'); e.tl.seek(e.beats[beat].start + Number(at), false); }
  }, { beat, at });
  await page.waitForTimeout(150);
  const file = path.join(outDir, `${scene}_${beat}_${at}.png`);
  await page.locator('main').screenshot({ path: file });
  console.log(file);
}
await browser.close();
