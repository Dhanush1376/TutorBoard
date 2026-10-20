// Frame-accurate capture of the real TutorBoard app for the launch film.
//
// Playwright's virtual clock drives every timer, requestAnimationFrame and
// performance.now in the page, so the app's own GSAP / framer-motion
// animations are recorded at an exact 30 fps regardless of how long each 4K
// screenshot takes. Network (the AI pipeline) still runs in real time.
//
// Output: ../public/capture/<shot>/<frame>.jpg + ../public/capture/manifest.json
// (UI element rects in CSS px, frame counts, the real lesson + doubt text).

import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, '../public/capture');
const BASE = process.env.TB_CAPTURE_URL || 'http://localhost:5174';
const QUESTION = 'How does Bubble Sort work on [5, 1, 4, 2, 8]?';
const DOUBT = 'Why does 5 keep moving to the right?';
const FPS = 30;
const DSF = 2; // 3840x2160 frames — room for macro crops in the edit
const FRAME_MS = 1000 / FPS;

// CAPTURE_PART=doubt re-records only pause → doubt → answer → resume in a
// fresh session (the lesson is fast-forwarded to step 3 without frames) and
// merges into the existing manifest. The AI's doubt answer varies run to run.
const PART = process.env.CAPTURE_PART || 'all';
const DOUBT_SHOTS = ['pause', 'doubt-open', 'doubt-typing', 'doubt-wait', 'answer', 'resume'];
let manifest = { fps: FPS, dsf: DSF, viewport: { w: 1920, h: 1080 }, question: QUESTION, doubt: DOUBT, shots: {}, rects: {}, data: {} };
if (PART === 'doubt') {
  manifest = JSON.parse(fs.readFileSync(path.join(OUT, 'manifest.json'), 'utf8'));
  for (const shot of DOUBT_SHOTS) {
    fs.rmSync(path.join(OUT, shot), { recursive: true, force: true });
    delete manifest.shots[shot];
  }
} else {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
}
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

// GPU rasterization: the lesson view runs a WebGL background, and headless
// Chrome's default software renderer (SwiftShader) took ~17 s per 4K frame.
const browser = await chromium.launch({
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'],
});
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: DSF, colorScheme: 'dark' });
// Real user preferences: no completion toasts / sounds over the composition.
await ctx.addInitScript(() => {
  try {
    localStorage.setItem('tb-notif-completion', 'false');
    localStorage.setItem('tb-notif-sound', 'false');
  } catch {}
});
const page = await ctx.newPage();
await page.clock.install();
page.on('pageerror', (e) => log('[pageerror]', e.message.slice(0, 160)));

// ── Socket events (what the server actually sent) ───────────────────────────
const events = [];
page.on('websocket', (ws) => {
  ws.on('framereceived', (f) => {
    const s = typeof f.payload === 'string' ? f.payload : '';
    const m = s.match(/^\d+(?:\/[^,]*,)?(\[.*)$/s);
    if (!m) return;
    try { const [ev, data] = JSON.parse(m[1]); events.push({ ev, data }); } catch {}
  });
});
const waitEvent = async (name, ms) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const hit = events.find((e) => e.ev === name);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`timed out waiting for ${name}`);
};

// ── Capture helpers ─────────────────────────────────────────────────────────
const shotDir = (shot) => { const d = path.join(OUT, shot); fs.mkdirSync(d, { recursive: true }); return d; };
// Raw CDP capture is several times faster than page.screenshot, which
// re-stabilises the page first. CDP's screenshot options (optimizeForSpeed,
// clip) reset Playwright's DPR emulation to 1, so pin DPR 2 here and use the
// plain call, which keeps it.
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: DSF, mobile: false });
const snap = async (shot, name) => {
  let data;
  for (let attempt = 1; !data; attempt++) {
    try {
      // Bounded: a GPU readback can hang indefinitely; treat that as a failure.
      ({ data } = await Promise.race([
        cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92 }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('screenshot timed out')), 20000)),
      ]));
    } catch (e) {
      // Occasional transient GPU readback failure — retry the same frame.
      if (attempt >= 4) throw e;
      log(`screenshot retry ${attempt} (${shot}/${name})`);
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  fs.writeFileSync(path.join(shotDir(shot), `${name}.jpg`), Buffer.from(data, 'base64'));
};
let paused = false;
const pause = async () => {
  if (paused) return;
  // The virtual clock keeps running while we read it, so pause slightly ahead.
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 250);
  paused = true;
};
const resume = async () => { if (paused) { await page.clock.resume(); paused = false; } };

// Record `count` frames, advancing the virtual clock one frame per shot.
// `until(i)` may stop early (checked every 10 frames).
const record = async (shot, count, { until, startAt = 0 } = {}) => {
  await pause();
  let i = 0;
  for (; i < count; i++) {
    await page.clock.runFor(FRAME_MS);
    await snap(shot, String(startAt + i).padStart(4, '0'));
    if (until && i % 10 === 9 && (await until(i))) { i++; break; }
  }
  manifest.shots[shot] = { ...(manifest.shots[shot] || {}), frames: startAt + i };
  saveManifest();
  log(`recorded ${shot}: ${startAt + i} frames`);
  return startAt + i;
};

const saveManifest = () => fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));

const rect = async (key, locator) => {
  const b = await locator.first().boundingBox().catch(() => null);
  if (b) manifest.rects[key] = { x: b.x, y: b.y, w: b.width, h: b.height };
  return b;
};
const center = (b) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
const clickAt = async (b) => { const c = center(b); await page.mouse.move(c.x, c.y, { steps: 4 }); await page.mouse.click(c.x, c.y); };

// Screen rects of the lesson's array cells / callout, from the live SVG.
const canvasRects = async (key) => {
  const r = await page.evaluate(() => {
    const out = { cells: [], callout: null };
    document.querySelectorAll('g.canvas-array g.cell').forEach((c) => {
      const b = c.querySelector('rect')?.getBoundingClientRect();
      if (b) out.cells.push({ id: c.id, x: b.x, y: b.y, w: b.width, h: b.height, text: c.querySelector('text')?.textContent });
    });
    const a = document.querySelector('[id^="annotate_"] rect')?.getBoundingClientRect();
    if (a) out.callout = { x: a.x, y: a.y, w: a.width, h: a.height };
    return out;
  });
  manifest.rects[key] = r;
  return r;
};
const textOnPage = (re) => page.evaluate((src) => new RegExp(src, 'i').test(document.body.innerText), re.source);

if (PART === 'all') {
// ── 1. Workspace ────────────────────────────────────────────────────────────
for (let attempt = 1; ; attempt++) {
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    // A previous attempt may already have signed in as guest, in which case
    // the landing page redirects straight to /session.
    const skip = page.getByText('Skip and try free').first();
    await Promise.race([skip.waitFor({ timeout: 45000 }), page.waitForURL('**/session', { timeout: 45000 })]);
    if (!page.url().includes('/session')) await skip.click({ timeout: 15000 });
    await page.waitForURL('**/session', { timeout: 45000 });
    break;
  } catch (e) {
    if (attempt >= 3) throw e;
    log(`guest entry did not reach /session (attempt ${attempt}); retrying`);
  }
}
await page.waitForTimeout(3500);
await page.mouse.move(1900, 1000);
await rect('composer', page.locator('textarea'));
await rect('modesBtn', page.locator('[aria-label="Toggle teaching modes and tools"]'));
await rect('sendBtn', page.locator('[aria-label="Send message"]'));
await snap('stills', 'workspace');
log('workspace');

// ── 2. Mode → Deep Visual Dive ──────────────────────────────────────────────
const modesBtn = await page.locator('[aria-label="Toggle teaching modes and tools"]').boundingBox();
await clickAt(modesBtn);
await page.waitForTimeout(600);
await rect('deepItem', page.getByText('Deep Visual Dive'));
await snap('stills', 'modes-open');
await clickAt(await page.getByText('Deep Visual Dive').first().boundingBox());
await page.waitForTimeout(600);
await page.mouse.move(1900, 1000);
await snap('stills', 'mode-selected');

// ── 3. Typing the question (one frame per keystroke) ────────────────────────
const ta = await page.locator('textarea').first().boundingBox();
await page.mouse.click(ta.x + 40, ta.y + ta.height / 2);
await page.mouse.move(1900, 1000);
await page.waitForTimeout(300);
await snap('typing', '0000');
for (let i = 0; i < QUESTION.length; i++) {
  await page.keyboard.type(QUESTION[i]);
  await page.waitForTimeout(40);
  await snap('typing', String(i + 1).padStart(4, '0'));
}
manifest.shots.typing = { frames: QUESTION.length + 1 };
const send = await rect('sendBtnTyped', page.locator('[aria-label="Send message"]'));
await page.mouse.move(center(send).x, center(send).y, { steps: 6 });
await page.waitForTimeout(250);
await snap('stills', 'send-hover');
log('typed question');

// ── 4. Send → thinking → lesson arrives ─────────────────────────────────────
await pause();
await page.mouse.click(center(send).x, center(send).y);
await record('send', 24);
const timeline = await waitEvent('teaching:timeline', 240000);
log('timeline received:', timeline.data.title);
manifest.data.lesson = {
  title: timeline.data.title,
  steps: (timeline.data.steps || []).map((s) => ({ title: s.title, narration: s.narration })),
};
await page.waitForTimeout(800); // real time for React to commit the lesson
await record('reveal', 105);
await rect('panel', page.getByText('ALGORITHM GUIDE'));
await rect('playBtn', page.locator('[title="Play (Space)"]'));
await rect('nextBtn', page.locator('[title="Next Step"]'));
await rect('doubtBtn', page.locator('[title="Ask a Doubt"]'));
await rect('controlBar', page.locator('[title="Previous Step"]').locator('xpath=..'));
await canvasRects('cellsStep1');
await snap('stills', 'lesson-step1');

// ── 5. Press play — the lesson unfolds ──────────────────────────────────────
// Narration muted with the app's own control: headless Chrome's TTS never
// fires "end", so voiced steps would wait out their ~24 s safety deadline;
// muted steps advance on reading time, as they do for a user with sound off.
const mute = await rect('muteBtn', page.locator('[title="Mute Narration"]'));
if (mute) {
  await page.mouse.click(center(mute).x, center(mute).y);
  await page.clock.runFor(200);
}
const play = manifest.rects.playBtn;
await page.mouse.move(play.x + play.w / 2, play.y + play.h / 2, { steps: 5 });
await record('play', 8);
await page.mouse.click(play.x + play.w / 2, play.y + play.h / 2);
await page.mouse.move(1900, 1000);
// Play through step 3 and let it settle (~1.8 s after the step label appears).
let step3At = -1;
await record('play', 1500, {
  startAt: 8,
  until: async (i) => {
    if (step3At < 0 && (await textOnPage(/STEP\s*3\s*\/\s*4/))) step3At = i;
    return step3At >= 0 && i - step3At > 55;
  },
});
manifest.shots.play.step3At = step3At + 8;
await canvasRects('cellsStep3');

} else {
  // Fast path to the paused-at-step-3 state, no frames recorded.
for (let attempt = 1; ; attempt++) {
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    // A previous attempt may already have signed in as guest, in which case
    // the landing page redirects straight to /session.
    const skip = page.getByText('Skip and try free').first();
    await Promise.race([skip.waitFor({ timeout: 45000 }), page.waitForURL('**/session', { timeout: 45000 })]);
    if (!page.url().includes('/session')) await skip.click({ timeout: 15000 });
    await page.waitForURL('**/session', { timeout: 45000 });
    break;
  } catch (e) {
    if (attempt >= 3) throw e;
    log(`guest entry did not reach /session (attempt ${attempt}); retrying`);
  }
}
  await page.waitForTimeout(3000);
  await clickAt(await page.locator('[aria-label="Toggle teaching modes and tools"]').boundingBox());
  await page.waitForTimeout(500);
  await clickAt(await page.getByText('Deep Visual Dive').first().boundingBox());
  await page.waitForTimeout(400);
  await page.locator('textarea').first().fill(QUESTION);
  await clickAt(await page.locator('[aria-label="Send message"]').boundingBox());
  await waitEvent('teaching:timeline', 240000);
  await page.waitForTimeout(2000);
  const muteBtn = await page.locator('[title="Mute Narration"]').boundingBox();
  if (muteBtn) await clickAt(muteBtn);
  await pause();
  await clickAt(await page.locator('[title="Play (Space)"]').boundingBox());
  await page.mouse.move(1900, 1000);
  let reached = false;
  for (let k = 0; k < 240 && !reached; k++) {
    await page.clock.runFor(500);
    reached = await textOnPage(/STEP\s*3\s*\/\s*4/);
  }
  if (!reached) throw new Error('lesson never reached step 3');
  await page.clock.runFor(1850);
  log('fast-forwarded to step 3');
}

// ── 6. Pause, then ask about what's on the board ────────────────────────────
const pauseBtn = await rect('pauseBtn', page.locator('[title="Pause (Space)"]'));
if (pauseBtn) {
  await page.mouse.move(center(pauseBtn).x, center(pauseBtn).y, { steps: 5 });
  await page.mouse.click(center(pauseBtn).x, center(pauseBtn).y);
}
await record('pause', 18);
const doubtBtn = await rect('doubtBtnLive', page.locator('[title="Ask a Doubt"]'));
await page.mouse.move(center(doubtBtn).x, center(doubtBtn).y, { steps: 5 });
await page.mouse.click(center(doubtBtn).x, center(doubtBtn).y);
await record('doubt-open', 18);
const doubtInput = await rect('doubtInput', page.locator('input[placeholder="Ask a doubt..."]'));
const focused = await page.evaluate(() => document.activeElement?.getAttribute('placeholder') === 'Ask a doubt...');
if (!focused && doubtInput) {
  log('doubt input not focused — clicking into it');
  await page.mouse.click(doubtInput.x + 30, doubtInput.y + doubtInput.height / 2);
  await page.clock.runFor(FRAME_MS);
}
for (let i = 0; i < DOUBT.length; i++) {
  await page.keyboard.type(DOUBT[i]);
  await page.clock.runFor(FRAME_MS);
  await snap('doubt-typing', String(i).padStart(4, '0'));
}
manifest.shots['doubt-typing'] = { frames: DOUBT.length };
await page.keyboard.press('Enter');
await record('doubt-wait', 45);
const delta = await waitEvent('teaching:doubt-delta', 180000).catch(() => waitEvent('teaching:doubt-response', 1000));
log('doubt answered');
manifest.data.doubt = { answer: delta.data.answer, followUp: delta.data.followUp, actions: delta.data.actions };
const cellTargets = (delta.data.actions || []).filter((a) => String(a.id || a.target || '').includes('['));
log(cellTargets.length ? `delta targets cells: ${cellTargets.map((a) => a.id || a.target).join(', ')}` : 'delta does not target a specific cell');
await page.waitForTimeout(500);
let calloutSeen = false;
await record('answer', 210, {
  until: async () => {
    if (!calloutSeen) {
      const r = await canvasRects('cellsAnswer');
      if (r.callout) { calloutSeen = true; manifest.rects.calloutAnswer = r.callout; }
    }
    return false;
  },
});
await rect('answerCard', page.getByText('YOUR QUESTION', { exact: false }));
await snap('stills', 'answer');

// ── 7. Resume — picks up where it left off ──────────────────────────────────
// DOM text is "Resume" (uppercased by CSS), so match case-insensitively.
const resumeBtn = await rect('resumeBtn', page.locator('button', { hasText: /^\s*resume\s*$/i }));
await page.mouse.move(center(resumeBtn).x, center(resumeBtn).y, { steps: 5 });
await page.mouse.click(center(resumeBtn).x, center(resumeBtn).y);
await page.mouse.move(1900, 1000);
let step4At = -1;
await record('resume', 900, {
  until: async (i) => {
    if (step4At < 0 && (await textOnPage(/STEP\s*4\s*\/\s*4/))) step4At = i;
    return step4At >= 0 && i - step4At > 75;
  },
});
manifest.shots.resume.step4At = step4At;
await canvasRects('cellsStep4');
await snap('stills', 'lesson-step4');

manifest.data.events = events.filter((e) => !/tokens|canvas:sync|guest:status/.test(e.ev)).map((e) => e.ev);
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
log('done →', OUT);
await browser.close();
