import { defineConfig, devices } from '@playwright/test';

/**
 * Code walkthrough e2e — fully isolated:
 *   backend :5067 on an in-memory MongoDB with the mock model (e2e/support/viz-backend.mjs)
 *   app     :5196 proxying to it, hot reload off (e2e/support/viz-app.mjs)
 * C, C++ and Java runs go to the Judge0 sandbox the backend is configured for
 * (the public CE instance in development); Python loads Pyodide from its CDN.
 *   npx playwright test -c playwright.viz.config.ts
 * With VIZ_PROD=1 the app is the production build on :5195, served with
 * vercel.json's headers (Content-Security-Policy included) — e2e/support/viz-prod-app.mjs.
 */
const prod = !!process.env.VIZ_PROD;
const appPort = prod ? 5195 : 5196;

export default defineConfig({
  testDir: './e2e',
  testMatch: /codeVisualizer\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 150000,
  expect: { timeout: 20000 },
  use: {
    baseURL: `http://127.0.0.1:${appPort}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
  ],
  webServer: [
    {
      command: 'node e2e/support/viz-backend.mjs',
      env: { E2E_APP_ORIGIN: `http://127.0.0.1:${appPort}` },
      url: 'http://127.0.0.1:5067/health',
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: prod ? 'node e2e/support/viz-prod-app.mjs' : 'node e2e/support/viz-app.mjs',
      url: `http://127.0.0.1:${appPort}`,
      reuseExistingServer: false,
      timeout: 240000,
    },
  ],
});
