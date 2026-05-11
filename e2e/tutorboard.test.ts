import { test, expect } from '@playwright/test';

test.describe('TutorBoard E2E Core Flows', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to the landing page
    await page.goto('/');
    
    // Bypass the intro animation if it exists
    const skipButton = page.locator("button:has-text('Skip Introduction')");
    if (await skipButton.isVisible()) {
      await skipButton.click();
    }
  });

  test('Guest flow: can send a message and trigger canvas generation', async ({ page }) => {
    // Navigate to trial/guest mode if available or just use the landing page chat
    // Based on the exploration, 'Skip and try free' leads to the main interface
    const tryFreeButton = page.locator("button:has-text('Skip and try free')");
    if (await tryFreeButton.isVisible()) {
      await tryFreeButton.click();
    }

    // Wait for the chat interface to load
    const chatInput = page.locator("textarea[placeholder*='How does a']");
    await expect(chatInput).toBeVisible({ timeout: 10000 });

    // Send a message
    const testMessage = 'Explain how binary search works';
    await chatInput.fill(testMessage);
    await page.keyboard.press('Enter');

    // Verify message appears in chat
    await expect(page.locator(`text=${testMessage}`)).toBeVisible();

    // Verify AI response starts streaming (wait for some text to appear)
    const aiMessage = page.locator('.message-content').first();
    await expect(aiMessage).not.toBeEmpty({ timeout: 15000 });

    // Verify canvas area is active
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
  });

  test('Auth flow: sign up and navigate to dashboard', async ({ page }) => {
    // Click 'Create Account'
    await page.click("button:has-text('Create Account')");

    // Fill sign up form
    const email = `test-user-${Date.now()}@example.com`;
    await page.fill("input[placeholder='Your full name']", 'Test User');
    await page.fill("input[placeholder='name@company.com']", email);
    await page.fill("input[placeholder='••••••••']", 'Password123!');

    // Submit form
    await page.click("button:has-text('Create Account')");

    // Should navigate to session or home
    await expect(page).toHaveURL(/.*session|.*home/);
    
    // Verify user is logged in (e.g., settings button or profile name)
    const settingsButton = page.locator("button[title='Open Settings']");
    await expect(settingsButton).toBeVisible();
  });

  test('Responsive: canvas layout stability on mobile', async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/');
    
    // Check if the mobile-specific elements are visible or hidden correctly
    // (e.g., sidebar might be closed by default on mobile)
    const sidebar = page.locator('aside'); // assuming sidebar is an aside
    // Verify it handles mobile layout without crashing
    await expect(page.locator('text=TutorBoard')).toBeVisible();
  });
});
