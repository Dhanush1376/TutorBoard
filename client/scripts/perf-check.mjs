// Engine v2 performance (checklist 6.2): build time and frame rate while playing, per golden scene.
//   node scripts/perf-check.mjs [scene …]      (default: every golden scene)
// Needs the client dev server (the Scene Lab at SCENE_LAB_URL, default http://localhost:5199/scene-lab.html).
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve('playwright', { paths: [path.resolve(process.cwd(), '..'), process.cwd()] }));
const base = process.env.SCENE_LAB_URL ?? 'http://localhost:5199/scene-lab.html';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(base, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => !!window.__lab, null, { timeout: 60000 });
const names = process.argv.slice(2).length ? process.argv.slice(2)
  : await page.evaluate(() => [...document.querySelectorAll('.fx')].map((b) => b.dataset.name).filter((n) => n && !n.startsWith('ai-')));

console.log('scene'.padEnd(22), 'build ms', 'fps (2 s of playback)', 'longest frame ms');
for (const name of names) {
  const r = await page.evaluate(async (n) => {
    const t0 = performance.now();
    await window.__lab.open(n);
    const build = performance.now() - t0;
    const engine = window.__lab.engine;
    engine.playBeat(Math.min(1, engine.beatCount - 1));
    const frames = [];
    await new Promise((done) => {
      const start = performance.now();
      const tick = (t) => { frames.push(t); if (t - start < 2000) requestAnimationFrame(tick); else done(); };
      requestAnimationFrame(tick);
    });
    engine.pause();
    const gaps = frames.slice(1).map((t, i) => t - frames[i]);
    return { build, fps: (frames.length - 1) / ((frames.at(-1) - frames[0]) / 1000), worst: Math.max(...gaps) };
  }, name);
  console.log(name.padEnd(22), String(Math.round(r.build)).padStart(8), String(r.fps.toFixed(0)).padStart(10), String(Math.round(r.worst)).padStart(18));
}
await browser.close();
