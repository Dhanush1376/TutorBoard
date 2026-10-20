// Frame-accurate capture of the "any subject" sequence: for each subject, the
// question typed into the real composer (one frame per keystroke) and the real
// lesson's payoff step animating on the board (virtual clock, 4K, GPU).
//
// Output: ../public/capture/subjects/<key>/{typing,payoff}/NNNN.jpg + subjects.json
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, '../public/capture/subjects');
const BASE = 'http://localhost:5174';
const FPS = 30;
const FRAME_MS = 1000 / FPS;
const DSF = 2;

// `step`: the lesson step whose animation is the payoff. `reveal`: the payoff
// is the lesson's first step, which animates in as the lesson opens.
const SUBJECTS = [
  { key: 'math', label: 'Mathematics', q: 'Where does y = x² − 4x + 3 cross the x-axis?', step: 3 },
  { key: 'physics', label: 'Physics', q: 'How does a ball thrown at 45° travel through the air?', step: 1 },
  { key: 'ml', label: 'Machine learning', q: 'How does gradient descent find the bottom of a loss curve?', step: 0, reveal: true },
  { key: 'chem', label: 'Chemistry', q: 'How are the electrons arranged in a carbon atom?', step: 0, reveal: true },
];
const only = process.argv[2];

const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
fs.mkdirSync(OUT, { recursive: true });
const manifestPath = path.join(OUT, 'subjects.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { fps: FPS, dsf: DSF, subjects: {} };

const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });

for (const S of SUBJECTS.filter((s) => !only || s.key === only)) {
  const dir = path.join(OUT, S.key);
  fs.rmSync(dir, { recursive: true, force: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: DSF, colorScheme: 'dark' });
  await ctx.addInitScript(() => { try { localStorage.setItem('tb-notif-completion', 'false'); localStorage.setItem('tb-notif-sound', 'false'); } catch {} });
  const page = await ctx.newPage();
  await page.clock.install();
  const events = [];
  page.on('websocket', (ws) => ws.on('framereceived', (f) => {
    const m = String(f.payload).match(/^\d+(?:\/[^,]*,)?(\[.*)$/s);
    if (m) { try { const [ev, data] = JSON.parse(m[1]); events.push({ ev, data }); } catch {} }
  }));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: DSF, mobile: false });
  const snap = async (shot, i) => {
    const d = path.join(dir, shot);
    fs.mkdirSync(d, { recursive: true });
    for (let attempt = 1; ; attempt++) {
      try {
        const { data } = await Promise.race([
          cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92 }),
          new Promise((_, r) => setTimeout(() => r(new Error('screenshot timed out')), 20000)),
        ]);
        fs.writeFileSync(path.join(d, `${String(i).padStart(4, '0')}.jpg`), Buffer.from(data, 'base64'));
        return;
      } catch (e) {
        if (attempt >= 4) throw e;
        await new Promise((r) => setTimeout(r, 400));
      }
    }
  };
  const box = async (sel) => page.locator(sel).first().boundingBox().catch(() => null);
  const clickBox = async (b) => { await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); };
  const textOnPage = (re) => page.evaluate((src) => new RegExp(src, 'i').test(document.body.innerText), re.source);
  const info = { label: S.label, question: S.q };

  try {
    // guest entry (tolerates an existing guest session redirecting to /session)
    for (let attempt = 1; ; attempt++) {
      try {
        await page.goto(BASE, { waitUntil: 'domcontentloaded' });
        const skip = page.getByText('Skip and try free').first();
        await Promise.race([skip.waitFor({ timeout: 45000 }), page.waitForURL('**/session', { timeout: 45000 })]);
        if (!page.url().includes('/session')) await skip.click({ timeout: 15000 });
        await page.waitForURL('**/session', { timeout: 45000 });
        break;
      } catch (e) { if (attempt >= 3) throw e; }
    }
    await page.waitForTimeout(3000);
    await clickBox(await box('[aria-label="Toggle teaching modes and tools"]'));
    await page.waitForTimeout(500);
    await clickBox(await page.getByText('Deep Visual Dive').first().boundingBox());
    await page.waitForTimeout(500);
    const ta = await box('textarea');
    await page.mouse.click(ta.x + 40, ta.y + ta.height / 2);
    await page.mouse.move(1900, 1000);
    info.composer = { x: ta.x, y: ta.y, w: ta.width, h: ta.height };

    // typing — one frame per keystroke
    await snap('typing', 0);
    for (let i = 0; i < S.q.length; i++) {
      await page.keyboard.type(S.q[i]);
      await page.waitForTimeout(30);
      await snap('typing', i + 1);
    }
    info.typing = S.q.length + 1;
    const send = await box('[aria-label="Send message"]');
    info.send = { x: send.x, y: send.y, w: send.width, h: send.height };
    if (S.reveal) {
      // freeze time before the lesson arrives so its opening animation is captured
      const n0 = await page.evaluate(() => Date.now());
      await page.clock.pauseAt(n0 + 250);
    }
    await clickBox(send);
    const tl = await (async () => {
      const end = Date.now() + 240000;
      while (Date.now() < end) {
        const hit = events.find((e) => e.ev === 'teaching:timeline');
        if (hit) return hit.data;
        await page.waitForTimeout(300);
      }
      throw new Error('no lesson');
    })();
    info.title = tl.title;
    info.steps = (tl.steps || []).map((s) => s.title);
    if (S.reveal) {
      await page.waitForTimeout(900); // real time for React to mount the lesson
    } else {
      await page.waitForTimeout(2500);
      const mute = await box('[title="Mute Narration"]');
      if (mute) await clickBox(mute);
      // freeze time, then reach the payoff step
      const now = await page.evaluate(() => Date.now());
      await page.clock.pauseAt(now + 250);
      await clickBox(await box('[title="Play (Space)"]'));
      await page.mouse.move(1900, 1000);
      const re = new RegExp(`STEP\\s*${S.step}\\s*\\/`);
      for (let k = 0; k < 400; k++) {
        await page.clock.runFor(250);
        if (await textOnPage(re)) break; // one step before the payoff
      }
      // advance until the payoff step label appears, then record from there
      const target = new RegExp(`STEP\\s*${S.step + 1}\\s*\\/`);
      for (let k = 0; k < 600; k++) {
        await page.clock.runFor(FRAME_MS);
        if (await textOnPage(target)) break;
      }
    }
    // payoff animation at 1x
    const N = 110;
    for (let i = 0; i < N; i++) {
      await page.clock.runFor(FRAME_MS);
      await snap('payoff', i);
    }
    info.payoff = N;
    // where the content sits (for the camera)
    info.content = await page.evaluate(() => {
      const els = [...document.querySelectorAll('.content-element, .node-element')];
      const rs = els.map((e) => e.getBoundingClientRect()).filter((r) => r.width > 2 && r.height > 2 && r.x > 360 && r.right < 1560);
      if (!rs.length) return null;
      const x = Math.min(...rs.map((r) => r.x)); const y = Math.min(...rs.map((r) => r.y));
      const r2 = Math.max(...rs.map((r) => r.right)); const b2 = Math.max(...rs.map((r) => r.bottom));
      return { x, y, w: r2 - x, h: b2 - y };
    });
    manifest.subjects[S.key] = info;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    log(`${S.key}: "${tl.title}" typing ${info.typing}, payoff ${N}, content ${JSON.stringify(info.content)}`);
  } catch (e) {
    log(`${S.key} FAILED: ${e.message.slice(0, 200)}`);
  }
  await ctx.close();
}
await browser.close();
log('done');
