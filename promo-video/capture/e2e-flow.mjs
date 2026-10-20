// End-to-end check of the real product flow used in the film:
// question -> lesson -> step navigation -> contextual doubt -> resume.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const DIR = process.argv[2] || 'out/e2e';
const QUESTION = 'How does Bubble Sort work on [5, 1, 4, 2, 8]?';
const DOUBT = process.argv[3] || 'Why does 5 keep moving to the right?';
fs.mkdirSync(DIR, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, colorScheme: 'dark' });
const page = await ctx.newPage();
const events = []; const t0 = Date.now();
const log = (...a) => console.log(`${((Date.now() - t0) / 1000).toFixed(1)}s`, ...a);
page.on('pageerror', (e) => log('[pageerror]', e.message.slice(0, 200)));
page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !t.includes('401')) log('[console.error]', t.slice(0, 200)); });
page.on('websocket', (ws) => {
  const grab = (dir) => (f) => {
    const s = typeof f.payload === 'string' ? f.payload : '';
    const m = s.match(/^\d+(?:\/[^,]*,)?(\[.*)$/s);
    if (!m) return;
    try { const [ev, data] = JSON.parse(m[1]); events.push({ t: Date.now() - t0, dir, ev, data }); if (!/tokens|canvas:sync|guest:status/.test(ev)) log(dir === 'in' ? '<-' : '->', ev, ev === 'teaching:progress' ? data?.message : ''); } catch {}
  };
  ws.on('framereceived', grab('in')); ws.on('framesent', grab('out'));
});
const shot = (n) => page.screenshot({ path: `${DIR}/${n}.png` });
const waitEvent = async (re, ms) => { const end = Date.now() + ms; while (Date.now() < end) { if (events.some(e => re.test(e.ev))) return true; await page.waitForTimeout(500); } return false; };

await page.goto('http://localhost:5174', { waitUntil: 'domcontentloaded' });
await page.getByText('Skip and try free').first().click();
await page.waitForURL('**/session', { timeout: 30000 });
await page.waitForTimeout(2500);
await page.locator('[aria-label="Toggle teaching modes and tools"]').click();
await page.getByText('Deep Visual Dive').first().click();
await page.locator('textarea').first().fill(QUESTION);
await page.locator('[aria-label="Send message"]').click();
log('sent question');
if (!(await waitEvent(/teaching:timeline|teaching:error/, 240000))) throw new Error('no lesson');
await page.waitForTimeout(3500); await shot('01-lesson-step1');
for (let s = 2; s <= 3; s++) { await page.locator('[title="Next Step"]').first().click(); await page.waitForTimeout(3500); await shot(`02-step${s}`); }
await page.locator('[title="Ask a Doubt"]').first().click();
await page.waitForTimeout(500);
const doubtInput = page.locator('input[placeholder="Ask a doubt..."]');
await doubtInput.type(DOUBT, { delay: 25 });
await shot('03-doubt-typed');
await doubtInput.press('Enter');
log('sent doubt');
for (let i = 0; i < 6; i++) { await page.waitForTimeout(1500); await shot(`04-doubt-wait-${i}`); if (process.env.PROBE) console.log(JSON.stringify(await page.evaluate(() => { const a = document.querySelector('[id^="annotate_"]'); const arr = document.querySelector('g.canvas-array'); const ml = document.querySelector('.canvas-main-layer'); return { ann: a && a.getAttribute('transform'), arr: arr && [arr.id, arr.getAttribute('transform')], ml: ml && ml.getAttribute('transform'), vb: ml && ml.ownerSVGElement.getAttribute('viewBox') }; }))); }
const ok = await waitEvent(/teaching:doubt-(delta|response)/, 90000);
log('doubt answered:', ok);
for (let i = 0; i < 6; i++) { await page.waitForTimeout(1500); await shot(`05-doubt-answer-${i}`); }
const resume = page.getByText('RESUME', { exact: false }).first();
if (await resume.isVisible().catch(() => false)) { await resume.click(); log('clicked resume'); }
for (let i = 0; i < 6; i++) { await page.waitForTimeout(2000); await shot(`06-resumed-${i}`); }
fs.writeFileSync(`${DIR}/events.json`, JSON.stringify(events, null, 1));
await browser.close();
