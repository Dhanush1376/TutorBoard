/**
 * Chat reliability, end to end (guest mode, mock model, isolated backend).
 * Run: npx playwright test -c playwright.chat.config.ts
 *
 * Asserts what the learner sees AND what was sent: one submission → one
 * request → one question and one answer; follow-ups stay in one conversation;
 * an interrupted or failed answer offers a retry that re-sends the SAME request
 * and never duplicates anything; switching conversations never mixes them.
 */
import { test, expect, type Page } from '@playwright/test';

const MOCK_ANSWER = 'This is a mock response from the AI provider.';

type Sent = { sessionId: string; requestId: string; userMessage: string };

/** Mock-model header on every chat request, plus a log of what was sent. */
async function instrument(page: Page) {
  const sent: Sent[] = [];
  await page.route('**/api/chat/**', async (route) => {
    try { sent.push(JSON.parse(route.request().postData() || '{}')); } catch { /* not JSON */ }
    await route.continue({ headers: { ...route.request().headers(), 'x-e2e-mock-ai': 'true' } });
  });
  return sent;
}

async function enterAsGuest(page: Page) {
  await page.goto('/');
  // landing copy changes: any guest entry point will do
  await page.getByRole('button', { name: /Start (learning free|as a guest)/i }).first().click();
  await page.waitForURL('**/session');
  await ensureComposer(page);
}

async function ensureComposer(page: Page) {
  const composer = page.locator('textarea').first();
  // the workspace animates in after the guest transition
  if (await composer.waitFor({ state: 'visible', timeout: 10000 }).then(() => true, () => false)) return composer;
  const ask = page.getByRole('button', { name: /^Ask a question/i });
  if (await ask.isVisible().catch(() => false)) await ask.click();
  else await page.getByRole('button', { name: /Open workspace/i }).click();
  await expect(composer).toBeVisible();
  return composer;
}

const bubbles = (page: Page) => page.locator('[data-message-id]');
const texts = async (page: Page) => (await bubbles(page).allInnerTexts()).map((t) => t.split('\n')[0].trim());

async function ask(page: Page, question: string) {
  const before = await bubbles(page).count();
  const composer = await ensureComposer(page);
  await composer.fill(question);
  await composer.press('Enter');
  await expect(bubbles(page)).toHaveCount(before + 2);
  await expect(bubbles(page).last()).toContainText(MOCK_ANSWER);
}

async function openConversation(page: Page, title: RegExp) {
  const back = page.getByRole('button', { name: /^Sessions$/ });
  if (await back.isVisible().catch(() => false)) await back.click();
  await page.getByRole('button', { name: title }).first().click();
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => { throw err; });
});

test('one submission is one request, one question and one answer — even with repeated Enter/clicks', async ({ page }) => {
  const sent = await instrument(page);
  await enterAsGuest(page);

  const composer = await ensureComposer(page);
  await composer.fill('What is a binary heap?');
  // Four submits in the same tick, before React can clear the composer
  await page.evaluate(() => {
    const ta = document.querySelector('textarea')!;
    const enter = () => ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    enter(); enter();
    (document.querySelector('button[aria-label^="Send"]') as HTMLButtonElement | null)?.click();
    enter();
  });
  await expect(bubbles(page)).toHaveCount(2);
  await expect(bubbles(page).last()).toContainText(MOCK_ANSWER);
  await page.waitForTimeout(800);
  expect(sent).toHaveLength(1);
  expect(await texts(page)).toEqual(['What is a binary heap?', expect.stringContaining('This is a mock response')]);
});

test('a follow-up stays in the same conversation, using the id the server assigned', async ({ page }) => {
  const sent = await instrument(page);
  await enterAsGuest(page);
  await ask(page, 'What is a binary heap?');
  await ask(page, 'And how does insertion work?');

  expect(sent).toHaveLength(2);
  expect(sent[1].sessionId).toMatch(/^[0-9a-f]{24}$/); // learned from the server's `meta` event
  expect(sent[0].requestId).not.toBe(sent[1].requestId);
  // every bubble carries a server id once the answer is saved
  const ids = await bubbles(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-message-id')));
  expect(ids.every((id) => /^[0-9a-f]{24}$/.test(id || ''))).toBe(true);
  expect(new Set(ids).size).toBe(4);
});

test('an answer cut off mid-stream shows an error, and Try again re-sends the same request without duplicates', async ({ page }) => {
  const sent = await instrument(page);
  await enterAsGuest(page);
  await ask(page, 'What is a binary heap?');

  // Next stream: let the server answer, but deliver only its first event (no `end`)
  let cut = true;
  await page.route('**/api/chat/stream', async (route) => {
    if (!cut) return route.fallback();
    cut = false;
    try { sent.push(JSON.parse(route.request().postData() || '{}')); } catch { /* */ }
    const res = await route.fetch({ headers: { ...route.request().headers(), 'x-e2e-mock-ai': 'true' } });
    const first = (await res.text()).split('\n\n')[0] + '\n\n';
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: first });
  });

  const composer = await ensureComposer(page);
  await composer.fill('Explain heapify');
  await composer.press('Enter');

  const alert = page.getByRole('alert');
  await expect(alert).toContainText(/Answer interrupted/i);
  await alert.getByRole('button', { name: /Try again/i }).click();
  await expect(alert).toBeHidden();
  await expect(bubbles(page).last()).toContainText(MOCK_ANSWER);

  const heapify = sent.filter((s) => s.userMessage === 'Explain heapify');
  expect(heapify).toHaveLength(2);
  expect(heapify[1].requestId).toBe(heapify[0].requestId); // same logical request
  const shown = await texts(page);
  expect(shown.filter((t) => t === 'Explain heapify')).toHaveLength(1);
  expect(shown).toHaveLength(4);
});

test('a provider error is shown with a retry, and the retry succeeds without duplicating the question', async ({ page }) => {
  const sent = await instrument(page);
  await enterAsGuest(page);

  let failOnce = true;
  await page.route('**/api/chat/stream', async (route) => {
    if (!failOnce) return route.fallback();
    failOnce = false;
    try { sent.push(JSON.parse(route.request().postData() || '{}')); } catch { /* */ }
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: 'data: {"type":"error","code":"RATE_LIMITED","content":"The AI service is busy right now.","retryable":true}\n\nevent: end\ndata: {}\n\n',
    });
  });

  const composer = await ensureComposer(page);
  await composer.fill('Why is the sky blue?');
  await composer.press('Enter');
  const alert = page.getByRole('alert');
  await expect(alert).toContainText(/Busy right now/i);
  await expect(bubbles(page)).toHaveCount(1); // the question only — no empty answer bubble

  await alert.getByRole('button', { name: /Try again/i }).click();
  await expect(bubbles(page)).toHaveCount(2);
  await expect(bubbles(page).last()).toContainText(MOCK_ANSWER);
  expect((await texts(page)).filter((t) => t === 'Why is the sky blue?')).toHaveLength(1);
  expect(sent[1].requestId).toBe(sent[0].requestId);
});

test('switching between conversations never mixes their messages', async ({ page }) => {
  await instrument(page);
  await enterAsGuest(page);
  await ask(page, 'What is a binary heap?');
  await ask(page, 'And insertion?');

  const back = page.getByRole('button', { name: /^Sessions$/ });
  if (await back.isVisible().catch(() => false)) await back.click();
  await page.getByRole('button', { name: /New session/i }).click();
  await ask(page, 'Why is the sky blue?');

  const A = ['What is a binary heap?', 'And insertion?'];
  for (const target of ['A', 'B', 'A', 'B'] as const) {
    await openConversation(page, target === 'A' ? /What is a binary heap/ : /Why is the sky blue/);
    const shown = (await texts(page)).filter((t) => !t.startsWith('This is a mock'));
    expect(shown).toEqual(target === 'A' ? A : ['Why is the sky blue?']);
  }

  // one sidebar entry per conversation
  const back2 = page.getByRole('button', { name: /^Sessions$/ });
  if (await back2.isVisible().catch(() => false)) await back2.click();
  await expect(page.getByRole('button', { name: /What is a binary heap/ })).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Why is the sky blue/ })).toHaveCount(1);
});

test('the chat fits the screen with no horizontal overflow', async ({ page }) => {
  await instrument(page);
  await enterAsGuest(page);
  await ask(page, 'Show me a long line: ' + 'x'.repeat(300));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
