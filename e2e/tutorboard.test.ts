import { test, expect } from '@playwright/test';

test.describe('TutorBoard Golden Path', () => {

  test('E2E Golden Path: Guest chat -> Auth promotion -> Session persistence', async ({ page, context }) => {
    test.setTimeout(60000);
    // 1. Intercept AI calls to add the mock header
    await page.route('**/*', async (route) => {
      const url = route.request().url();
      if (url.includes('/api/chat/')) {
        console.log(`[Playwright] Intercepted route: ${url}`);
        const headers = {
          ...route.request().headers(),
          'x-e2e-mock-ai': 'true',
        };
        await route.continue({ headers });
      } else {
        await route.continue();
      }
    });

    // 2. Landing page and Guest entry
    await page.goto('/');
    
    // The auth modal might pop up, so we wait for either the Skip button or a Start button
    const skipButton = page.locator('button', { hasText: /Skip and try free/i }).first();
    const startButton = page.locator('button', { hasText: /Start Learning/i }).first();
    
    try {
      // Wait up to 5 seconds for the skip button (if auth modal appears)
      await skipButton.waitFor({ state: 'visible', timeout: 5000 });
      await skipButton.click({ force: true });
    } catch {
      // Otherwise click start learning if available
      if (await startButton.isVisible()) {
        await startButton.click({ force: true });
      }
    }

    // 2b. Handle Intro Animation
    const skipIntroButton = page.locator('button', { hasText: /Skip Introduction/i }).first();
    try {
      await skipIntroButton.waitFor({ state: 'visible', timeout: 5000 });
      await skipIntroButton.click({ force: true });
    } catch {
      // Intro might have finished or not shown
    }

    // 3. Wait for Chat Interface
    const chatInput = page.locator('textarea').first();
    await expect(chatInput).toBeVisible({ timeout: 15000 });

    // 4. Send a message
    const testMessage = 'Hello TutorBoard';
    await chatInput.fill(testMessage);
    await page.keyboard.press('Enter');

    // 5. Verify the Mock Response
    const mockResponseText = 'This is a mock response from the AI provider. Testing E2E functionality.';
    await expect(page.locator(`text=${mockResponseText}`)).toBeVisible({ timeout: 15000 });

    // Wait for the local debounced session persistence (1s) to fire before hard navigating
    await page.waitForTimeout(2000);

    // 6. Sign up / Promote account
    // Navigate explicitly to the login page to simulate the user deciding to sign up
    await page.goto('/login?mode=signup');

    // Wait for the signup form to appear
    const emailInput = page.locator("input[type='email']");
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    
    await page.fill("input[placeholder*='name']", 'E2E User');
    await emailInput.fill(`e2e-${Date.now()}@example.com`);
    
    const passwordInputs = page.locator("input[type='password']");
    if (await passwordInputs.count() > 1) {
      await passwordInputs.first().fill('Password123!');
      await passwordInputs.nth(1).fill('Password123!');
    } else {
      await passwordInputs.first().fill('Password123!');
    }
    
    await page.keyboard.press('Enter');

    // Wait for the Cinematic Transition to finish or skip it
    const skipIntroButton2 = page.locator('button', { hasText: /Skip Introduction/i }).first();
    try {
      await skipIntroButton2.waitFor({ state: 'visible', timeout: 5000 });
      await skipIntroButton2.click({ force: true });
    } catch {
      // Might not appear if transition is fast
    }

    // The chat input should become visible again once the transition is over.
    await expect(page.locator('textarea').first()).toBeVisible({ timeout: 20000 });

    // 7. Verify session history persistence
    // Click 'All Sessions' to reveal the history view
    const allSessionsButton = page.locator("button:has-text('All Sessions')");
    // Only click it if it exists (e.g. on mobile/left-panel view where history is hidden by default)
    if (await allSessionsButton.isVisible()) {
      await allSessionsButton.click();
    }

    // Wait for history item to appear
    const historyItem = page.locator("button:has-text('Hello TutorBoard')").first();
    try {
      await expect(historyItem).toBeVisible({ timeout: 15000 });
    } catch (err) {
      console.log('--- TEST FAILED: HISTORY ITEM NOT FOUND ---');
      throw err;
    }
  });
});
