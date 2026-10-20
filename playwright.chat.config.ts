import { defineConfig, devices } from '@playwright/test';

/**
 * Chat reliability e2e — fully isolated, guest mode only:
 *   backend :5066 on an in-memory MongoDB with the mock model (e2e/support/isolated-backend.mjs)
 *   app     :5197 proxying to it
 * Never reuses another dev server, so it can't touch the .env database or port 5000.
 *   npx playwright test -c playwright.chat.config.ts
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: /chatReliability\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 60000,
  use: {
    baseURL: 'http://127.0.0.1:5197',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: 'node e2e/support/isolated-backend.mjs',
      url: 'http://127.0.0.1:5066/health',
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: 'node client/scripts/dev-v2.mjs 5197',
      env: { TB_BACKEND: '127.0.0.1:5066' },
      url: 'http://127.0.0.1:5197',
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
