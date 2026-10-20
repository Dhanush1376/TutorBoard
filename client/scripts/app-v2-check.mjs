// End-to-end check of Engine v2 in the app: guest mode → ask in the chat box →
// screenshots while the lesson streams in and plays.
//   node scripts/app-v2-check.mjs <outDir> "question" [seconds=70] ["follow-up question"]
// With a follow-up ("@click" clicks the main element on the board; "@check" answers the lesson's check wrong and asks for the explanation): asked once the lesson has played for <seconds>, then
// the answer is watched on the board and "Back to the lesson" is clicked.
// Needs the app dev server (scripts/dev-v2.mjs, :5199) and the Engine v2 backend (:5055).
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve('playwright', { paths: [path.resolve(process.cwd(), '..'), process.cwd()] }));

const [outDir, question = 'Visualize how binary search finds 23 in [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]', secs = '70', followUp] = process.argv.slice(2);
if (!outDir) { console.error('usage: node scripts/app-v2-check.mjs <outDir> "question" [seconds]'); process.exit(1); }
mkdirSync(outDir, { recursive: true });
const base = process.env.APP_URL ?? 'http://localhost:5199/';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const log = [];
page.on('console', (m) => { if (m.type() === 'error' || /EngineV2|scene_v2|Scene/i.test(m.text())) log.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => log.push(`[pageerror] ${e.message}`));

// guest mode, straight into the workspace (what the landing page's "Try Free" button does)
await page.addInitScript(() => sessionStorage.setItem('tb-is-guest', 'true'));
await page.goto(new URL('session', base).href, { waitUntil: 'load', timeout: 120000 });
// guest mode only — never touch the sign-up / sign-in form
if (!/\/session/.test(page.url())) {
  await page.getByRole('button', { name: /Skip and try free|Try Free/i }).first().click({ timeout: 15000 });
}
const intro = page.getByText(/Skip Introduction/i);
try { await intro.first().click({ timeout: 8000 }); } catch { /* no intro */ }
await page.waitForURL(/\/session/, { timeout: 15000 });
const box = page.locator('textarea').last(); // the chat composer
await box.waitFor({ timeout: 15000 });
if (!/\/session/.test(page.url())) throw new Error(`not on the workspace (${page.url()}) — stopping`);
await box.click();
await box.fill(question);
await box.press('Enter');
const t0 = Date.now();

for (let i = 0; (Date.now() - t0) / 1000 < Number(secs); i++) {
  await page.waitForTimeout(5000);
  const s = ((Date.now() - t0) / 1000).toFixed(0).padStart(3, '0');
  const info = await page.evaluate(() => {
    const st = document.querySelector('.scene-v2-stage');
    return { v2: !!st, svg: !!st?.querySelector('svg[data-engine="v2"]') };
  });
  await page.screenshot({ path: path.join(outDir, `t${s}.png`) });
  console.log(`${s}s  v2 stage: ${info.v2 ? 'yes' : 'no'}  scene drawn: ${info.svg ? 'yes' : 'no'}`);
}
if (followUp === '@check') {
  // "predict the next step": wait for the card, answer wrong on purpose, ask for the explanation
  const card = page.getByText('Predict the next step');
  await card.waitFor({ timeout: 120000 });
  await page.screenshot({ path: path.join(outDir, 'check-1-question.png') });
  const q = await page.locator('[aria-label="Predict the next step"]').first();
  const choices = q.locator('button');
  // answers are final, so one pick: the last choice (models usually put the right answer first)
  await choices.nth((await choices.count()) - 1).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(outDir, 'check-2-answered.png') });
  const right = (await page.getByText('Right!').count()) > 0;
  console.log(`check answered: ${right ? 'right' : 'wrong'}`);
  if (!right) {
    await page.getByText('Show me on the board').click();
    let branch = false;
    for (let i = 0; i < 12 && !branch; i++) { await page.waitForTimeout(4000); branch = (await page.getByText(/Back to the lesson/).count()) > 0; }
    await page.screenshot({ path: path.join(outDir, 'check-3-explained.png') });
    console.log(`explained on the board: ${branch ? 'yes' : 'no'}`);
    if (branch) await page.getByText(/Back to the lesson/).first().click();
  }
  await page.waitForTimeout(1500);
  const cont = page.getByText('Continue');
  if (await cont.count()) { await cont.first().click(); console.log('continued'); }
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(outDir, 'check-4-after.png') });
} else if (followUp) {
  if (followUp === '@click') {
    // "ask about this": click an element on the board (the largest one — the main structure)
    const id = await page.evaluate(() => {
      const els = [...document.querySelectorAll('.scene-v2-stage [data-entity]')];
      const area = (el) => { const r = el.getBoundingClientRect(); return r.width * r.height; };
      const el = els.sort((x, y) => area(y) - area(x))[0];
      return el?.getAttribute('data-entity') ?? null;
    });
    if (!id) throw new Error('no element on the board to click');
    await page.locator(`.scene-v2-stage [data-entity="${id}"]`).first().click({ force: true });
    console.log(`clicked board element "${id}"`);
  } else {
    const ask = page.locator('textarea').last();
    await ask.click();
    await ask.fill(followUp);
    await ask.press('Enter');
    console.log(`asked: "${followUp}"`);
  }
  const t1 = Date.now();
  let branch = false;
  for (let i = 0; (Date.now() - t1) / 1000 < 45; i++) {
    await page.waitForTimeout(4000);
    const s = ((Date.now() - t1) / 1000).toFixed(0).padStart(3, '0');
    branch = (await page.getByText(/Back to the lesson/).count()) > 0;
    const pill = branch ? await page.getByText(/Your question · /).first().textContent().catch(() => '') : '';
    await page.screenshot({ path: path.join(outDir, `q${s}.png`) });
    console.log(`${s}s  answer on the board: ${branch ? `yes (${pill.trim()})` : 'no'}`);
  }
  if (branch) {
    await page.getByText(/Back to the lesson/).first().click();
    await page.waitForTimeout(3000);
    const still = (await page.getByText(/Back to the lesson/).count()) > 0;
    await page.screenshot({ path: path.join(outDir, 'back.png') });
    console.log(`back to the lesson: ${still ? 'NO (pill still there)' : 'yes'}`);
  }
}
writeFileSync(path.join(outDir, 'console.txt'), log.join('\n'));
console.log(`console: ${log.length} relevant line(s) → ${path.join(outDir, 'console.txt')}`);
await browser.close();
