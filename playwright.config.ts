import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './web/test',
  testMatch: /.*\.spec\.ts/,
  timeout: 120_000,
  reporter: 'list',
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
});
