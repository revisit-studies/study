import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);
const configuredCiWorkers = Number(process.env.PW_CI_WORKERS);
const ciWorkers = Number.isFinite(configuredCiWorkers) && configuredCiWorkers > 0
  ? configuredCiWorkers
  : 2;

export default defineConfig({
  webServer: {
    command: 'yarn serve',
    url: 'http://localhost:8080',
    reuseExistingServer: !isCI,
    stdout: 'ignore',
    stderr: 'pipe',
  },

  testDir: './tests',
  fullyParallel: true,
  // Retry on CI only.
  retries: isCI ? 2 : 0,
  workers: isCI ? ciWorkers : '90%',
  timeout: isCI ? 120000 : 60000,
  reporter: isCI ? 'github' : 'list',

  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
