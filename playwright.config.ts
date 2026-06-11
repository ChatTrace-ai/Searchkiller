import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['json', { outputFile: '.agents/test-report.json' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'api',
      testMatch: /.*\.api\.test\.ts/,
      use: {},
    },
    {
      name: 'ui',
      testMatch: /.*\.ui\.test\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'state',
      testMatch: /.*\.state\.test\.ts/,
      use: {},
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
