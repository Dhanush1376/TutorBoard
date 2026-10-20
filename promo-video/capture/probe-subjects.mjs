// Scouting run: what does the real app render for each subject? Real-time,
// 1080p screenshots + a summary of the lesson the server returned.
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const OUT = process.env.SCOUT_OUT || 'out/scout2';
fs.mkdirSync(OUT, { recursive: true });
const SUBJECTS = [
  { key: 'stackqueue', q: 'What is the difference between a stack and a queue?' },
  { key: 'geometry', q: 'Why do the angles of a triangle always add up to 180°?' },
  { key: 'physics', q: 'Show the path of a ball kicked at 45 degrees.' },
  { key: 'chem', q: 'What does a water molecule look like, and why is it bent?' },
  { key: 'ml', q: 'How does a neural network recognise a cat in a photo?' },
];
const only = process.argv[2];

const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const s of SUBJECTS.filter((x) => !only || x.key === only)) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, colorScheme: 'dark' });
  await ctx.addInitScript(() => { try { localStorage.setItem('tb-notif-completion', 'false'); } catch {} });
  const page = await ctx.newPage();
  const events = [];
  page.on('websocket', (ws) => ws.on('framereceived', (f) => {
    const m = String(f.payload).match(/^\d+(?:\/[^,]*,)?(\[.*)$/s);
    if (m) { try { const [ev, data] = JSON.parse(m[1]); events.push({ ev, data }); } catch {} }
  }));
  const t0 = Date.now();
  try {
    await page.goto('http://localhost:5174', { waitUntil: 'domcontentloaded' });
    const skip = page.getByText('Skip and try free').first();
    await Promise.race([skip.waitFor({ timeout: 45000 }), page.waitForURL('**/session', { timeout: 45000 })]);
    if (!page.url().includes('/session')) await skip.click();
    await page.waitForURL('**/session', { timeout: 45000 });
    await page.waitForTimeout(2500);
    if (s.viaUrl) {
      await page.goto(`http://localhost:5174/session?prompt=${encodeURIComponent(s.q)}`, { waitUntil: 'domcontentloaded' });
    } else {
      await page.locator('[aria-label="Toggle teaching modes and tools"]').click();
      await page.getByText('Deep Visual Dive').first().click();
      await page.locator('textarea').first().fill(s.q);
      await page.locator('[aria-label="Send message"]').click();
    }
    const end = Date.now() + 240000;
    while (Date.now() < end && !events.some((e) => /teaching:(timeline|error|greeting)/.test(e.ev))) await page.waitForTimeout(1000);
    const tl = events.find((e) => e.ev === 'teaching:timeline')?.data;
    const err = events.find((e) => e.ev === 'teaching:error')?.data;
    console.log(`\n[${s.key}] ${((Date.now() - t0) / 1000).toFixed(0)}s`, tl ? `domain=${tl.domain} renderer=${tl.renderer} steps=${tl.totalSteps}` : `NO LESSON ${JSON.stringify(err || {})}`);
    if (tl) {
      const types = {};
      (tl.elements || []).forEach((e) => { types[e.type] = (types[e.type] || 0) + 1; });
      console.log('  element types', JSON.stringify(types), '| simulator', !!tl.simulationHtml);
      (tl.steps || []).forEach((st, i) => console.log(`  ${i + 1}. ${st.title}`));
      fs.writeFileSync(`${OUT}/${s.key}-timeline.json`, JSON.stringify(tl, null, 1));
    }
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${OUT}/${s.key}-0.png` });
    const play = page.locator('[title="Play (Space)"]');
    if (await play.count()) await play.first().click().catch(() => {});
    for (let k = 1; k <= 4; k++) { await page.waitForTimeout(5000); await page.screenshot({ path: `${OUT}/${s.key}-${k}.png` }); }
  } catch (e) {
    console.log(`[${s.key}] failed: ${e.message.slice(0, 160)}`);
  }
  await ctx.close();
}
await browser.close();
