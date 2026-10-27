/**
 * Code walkthroughs, end to end (isolated backend, mock model, real code runs).
 * Run: npx playwright test -c playwright.viz.config.ts
 *
 * The learner's journey: ask for code → the answer's Step through is suggested →
 * the walkthrough runs the program for real → move through it, jump by clicking a
 * line, read the views, change the input and run again, ask the tutor → leave and
 * come back → reopen it where they left off — with no duplicate conversations,
 * messages or walkthroughs. Guests keep walkthroughs in the browser; a signed-in
 * learner's are saved on the server.
 */
import { test, expect, type Page, type Request } from '@playwright/test';

/** Mock model on chat and tutor requests, plus a log of every request that could create something. */
async function instrument(page: Page) {
  const log: { method: string; url: string }[] = [];
  page.on('request', (r: Request) => {
    if (/\/api\/(chat|visualizer)\//.test(r.url()) && r.method() !== 'GET') log.push({ method: r.method(), url: r.url() });
  });
  for (const pattern of ['**/api/chat/**', '**/api/visualizer/explain']) {
    await page.route(pattern, (route) => route.continue({ headers: { ...route.request().headers(), 'x-e2e-mock-ai': 'true' } }));
  }
  return log;
}

async function composer(page: Page) {
  const box = page.locator('textarea').first();
  if (await box.waitFor({ state: 'visible', timeout: 15000 }).then(() => true, () => false)) return box;
  const open = page.getByRole('button', { name: /^Ask a question|Open workspace/i }).first();
  if (await open.isVisible().catch(() => false)) await open.click();
  await expect(box).toBeVisible();
  return box;
}

// Straight into the workspace as a guest — what the landing page's "Start learning free" does
// (the chat suite covers the landing page itself).
async function enterAsGuest(page: Page) {
  // init scripts run in every frame — the sandbox's origin-less iframe has (rightly) no storage
  await page.addInitScript(() => {
    if (window.top === window) sessionStorage.setItem('tb-is-guest', 'true');
  });
  await page.goto('/session');
  await composer(page);
}

const bubbles = (page: Page) => page.locator('[data-message-id]');

/** Ask, and wait for the answer's code block. Returns the answer bubble. */
async function askForCode(page: Page, question: string) {
  const before = await bubbles(page).count();
  const box = await composer(page);
  await box.fill(question);
  await box.press('Enter');
  await expect(bubbles(page)).toHaveCount(before + 2);
  const answer = bubbles(page).last();
  await expect(answer.locator('.tb-code')).toBeVisible();
  return answer;
}

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Code editor' });
const slider = (page: Page) => dialog(page).getByRole('slider', { name: 'Steps' });
const stepNow = async (page: Page) => Number(await slider(page).getAttribute('aria-valuenow'));
const stepCount = async (page: Page) => Number(await slider(page).getAttribute('aria-valuemax'));

/** Open the walkthrough from the answer's Step through button and wait for the first step. */
async function stepThrough(answer: ReturnType<Page['locator']>, page: Page) {
  await answer.getByRole('button', { name: /^Step through/ }).click();
  await expect(slider(page)).toBeVisible({ timeout: 90000 }); // Python downloads Pyodide the first time
}

async function openTab(page: Page, name: string) {
  await dialog(page).getByRole('tab', { name }).click();
  return dialog(page).getByRole('tabpanel');
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => { throw err; });
});

/* ── A guest, in Python ─────────────────────────────────────────────────── */

test('a guest steps through a Python answer, changes its input, asks the tutor, and comes back to it @mobile', async ({ page, isMobile }) => {
  test.setTimeout(300000); // Pyodide downloads on the first Python run
  const log = await instrument(page);
  await enterAsGuest(page);
  const answer = await askForCode(page, 'Write binary search in Python and step through it line by line');

  // The question asked to step through code, so the answer's button is suggested.
  const button = answer.getByRole('button', { name: /^Step through/ });
  await expect(button).toHaveAttribute('data-suggested', 'true');

  await stepThrough(answer, page);
  await expect(dialog(page).getByText('Real run · traced line by line')).toBeVisible();
  const total = await stepCount(page);
  expect(total).toBeGreaterThan(10);
  expect(await stepNow(page)).toBe(1);

  // forward and back
  await dialog(page).getByRole('button', { name: /^Next step/ }).click();
  await dialog(page).getByRole('button', { name: /^Next step/ }).click();
  expect(await stepNow(page)).toBe(3);
  await dialog(page).getByRole('button', { name: /^Previous step/ }).click();
  expect(await stepNow(page)).toBe(2);

  // clicking a line goes to the next time it runs: line 8 is `lo = mid + 1`
  if (!isMobile) {
    await dialog(page).locator('.monaco-editor .line-numbers', { hasText: /^8$/ }).click();
    await expect(slider(page)).toHaveAttribute('aria-valuetext', /line 8$/);
  }

  // the views read the run: the call and its return value, the variables
  await dialog(page).getByRole('button', { name: 'Last step' }).click();
  await expect(await openTab(page, 'Calls')).toContainText('binary_search(');
  await expect(dialog(page).getByRole('tabpanel')).toContainText('→ 5');
  await expect(await openTab(page, 'Output')).toContainText('5');

  // change the input: look for 8 instead of 23 → index 2, recorded as a new walkthrough
  await dialog(page).getByRole('button', { name: /Give the program input/ }).click();
  await dialog(page).locator('#tb-stdin').fill('8');
  await dialog(page).getByRole('button', { name: 'Run again with this input' }).click();
  await expect(slider(page)).toHaveAttribute('aria-valuenow', '1');
  await dialog(page).getByRole('button', { name: 'Last step' }).click();
  await expect(await openTab(page, 'Output')).toHaveText(/^\s*2\s*$/);

  // ask the tutor about this step: the answer stays in the walkthrough, not the chat
  const ask = await openTab(page, 'Ask');
  await ask.getByRole('button', { name: /Explain this step/ }).click();
  await expect(ask).toContainText('mock response');

  // go back a few steps, leave, start another conversation, come back
  await dialog(page).getByRole('button', { name: /^First step/ }).click();
  await dialog(page).getByRole('button', { name: /^Next step/ }).click();
  await dialog(page).getByRole('button', { name: /^Next step/ }).click();
  await dialog(page).getByRole('button', { name: /^Next step/ }).click();
  await page.waitForTimeout(1200); // the step is remembered after a short pause
  await dialog(page).getByRole('button', { name: 'Close' }).click();
  await expect(dialog(page)).toBeHidden();
  // leave the workspace altogether, then come back to it
  await page.goto('/about');
  await page.goto('/session');
  await composer(page);
  const back = page.getByRole('button', { name: /^Sessions$/ });
  if (await back.isVisible().catch(() => false)) await back.click();
  await page.getByRole('button', { name: /binary search.*python/i }).first().click();
  const again = bubbles(page).last();
  await expect(again.locator('.tb-code')).toBeVisible();

  // reopening the same code with the same input finds the walkthrough: same steps, same place
  await stepThrough(again, page);
  expect(await stepCount(page)).toBe(total);
  // the default-input walkthrough was left on its last step (before the input was changed)
  expect(await stepNow(page)).toBe(total);

  // nothing was duplicated: one question, one answer; one chat request; two walkthroughs (two inputs)
  await expect(bubbles(page)).toHaveCount(2);
  expect(log.filter((r) => /\/api\/chat\/stream/.test(r.url))).toHaveLength(1);
  const saved = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('tb-walkthroughs') || '{}')));
  expect(saved).toHaveLength(2);
});

/* ── Signed in: saved on the server, reopened where the learner left off ── */

test('a signed-in learner\'s walkthrough is saved once and reopens on the same step after a reload', async ({ page }) => {
  const log = await instrument(page);
  // A throwaway account on the isolated in-memory database (never the real one).
  const csrf = (await (await page.request.get('/api/csrf-token')).json()).csrfToken;
  const password = `Viz${Date.now()}A1`;
  const signup = await page.request.post('/api/auth/signup', {
    headers: { 'x-csrf-token': csrf },
    data: { name: 'Viz Tester', email: `viz-e2e-${Date.now()}@example.test`, password, confirmPassword: password },
  });
  expect(signup.ok()).toBe(true);

  await page.goto('/session');
  const answer = await askForCode(page, 'Show me binary search in JavaScript and trace it step by step');
  const saving = page.waitForResponse((r) => r.url().includes('/api/visualizer/save') && r.request().method() === 'POST');
  await stepThrough(answer, page);
  const save = await saving;
  expect(save.status()).toBe(201);
  const { id } = await save.json();

  for (let i = 0; i < 5; i++) await dialog(page).getByRole('button', { name: /^Next step/ }).click();
  expect(await stepNow(page)).toBe(6);
  await page.waitForResponse((r) => r.url().includes(`/api/visualizer/${id}/state`) && r.request().method() === 'PATCH');

  // a full reload, then back to the conversation and the same code
  await page.reload();
  await composer(page);
  const back = page.getByRole('button', { name: /^Sessions$/ });
  if (await back.isVisible().catch(() => false)) await back.click();
  await page.getByRole('button', { name: /binary search.*javascript/i }).first().click();
  const lookup = page.waitForResponse((r) => r.url().includes('/api/visualizer/lookup'));
  await stepThrough(bubbles(page).last(), page);
  const found = await (await lookup).json();
  expect(found.visualization._id).toBe(id);
  expect(await stepNow(page)).toBe(6);

  // one walkthrough on the server for this conversation; the trace was saved once
  const sessionId = new URL((await lookup).url()).searchParams.get('sessionId');
  const list = await (await page.request.get(`/api/visualizer/session/${sessionId}`)).json();
  expect(list.visualizations).toHaveLength(1);
  expect(log.filter((r) => r.url.includes('/api/visualizer/save'))).toHaveLength(1);
  expect(log.filter((r) => r.url.includes('/api/chat/stream'))).toHaveLength(1);
  await expect(bubbles(page)).toHaveCount(2);
});

/* ── The compiled languages, through the Judge0 sandbox ─────────────────── */

for (const [lang, name] of [['c', 'C'], ['cpp', 'C++'], ['java', 'Java']] as const) {
  test(`${name}: an answer's code steps through as a real sandbox run`, async ({ page }) => {
    await instrument(page);
    await enterAsGuest(page);
    const answer = await askForCode(page, `Write binary search in ${name === 'C' ? 'C program' : name} and step through it`);
    await expect(answer.locator(`.tb-code`)).toContainText(lang === 'java' ? 'public class Main' : 'binary');
    await stepThrough(answer, page);
    await expect(dialog(page).getByText('Real run · step markers added to your code')).toBeVisible();
    expect(await stepCount(page)).toBeGreaterThan(10);
    await dialog(page).getByRole('button', { name: 'Last step' }).click();
    await expect(await openTab(page, 'Output')).toContainText('5');
    await expect(await openTab(page, 'Calls')).toContainText('→ 5');
  });
}

/* ── The browser sandbox ────────────────────────────────────────────────── */

/** Put code in the open editor (Monaco's own API: typing would be auto-indented) and step through it. */
async function stepThroughEditorCode(page: Page, code: string) {
  await page.waitForFunction(() => (window as any).monaco?.editor.getModels().length > 0);
  await page.evaluate((src) => (window as any).monaco.editor.getModels()[0].setValue(src), code);
  await dialog(page).getByRole('button', { name: /Step through/ }).click();
  await expect(slider(page)).toBeVisible();
  await dialog(page).getByRole('button', { name: 'Last step' }).click();
}

test('code run in the browser can\'t reach the network, the app\'s storage or its cookies, and an endless loop is stopped', async ({ page }) => {
  await enterAsGuest(page);
  await page.getByRole('button', { name: 'Code editor' }).click();
  await expect(dialog(page)).toBeVisible();
  await stepThroughEditorCode(page, [
    'const r = [];',
    'try { await fetch("/api/health"); r.push("fetch REACHED"); } catch (e) { r.push("fetch blocked"); }',
    'try { await import("https://cdn.jsdelivr.net/npm/lodash-es@4.17.21/lodash.js"); r.push("import REACHED"); } catch (e) { r.push("import blocked"); }',
    'r.push(typeof localStorage === "undefined" ? "no storage" : "STORAGE");',
    'r.push(typeof document === "undefined" ? "no page" : "PAGE");',
    'r.push("origin " + self.origin);',
    'console.log(r.join(", "));',
  ].join('\n'));
  await expect(await openTab(page, 'Output')).toHaveText(/^\s*fetch blocked, import blocked, no storage, no page, origin null\s*$/);

  await dialog(page).getByRole('button', { name: /Edit code/ }).click();
  await stepThroughEditorCode(page, 'let i = 0;\nwhile (true) {\n  i++;\n}\n');
  await expect(dialog(page).getByRole('alert')).toContainText('Stopped after 1000 steps.');
});
