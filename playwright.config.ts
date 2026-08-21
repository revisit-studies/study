import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);
const configuredWorkers = Number(process.env.PW_WORKERS ?? process.env.PW_CI_WORKERS);
const workers = Number.isFinite(configuredWorkers) && configuredWorkers > 0
  ? configuredWorkers
  : 1;

export default defineConfig({
  webServer: {
    command: 'corepack yarn serve',
    url: 'http://localhost:8080',
    // Reusing port 8080 can attach tests to a Vite server from another
    // worktree. Keep each run tied to the checkout under test.
    reuseExistingServer: Boolean(process.env.PW_REUSE_EXISTING_SERVER),
    stdout: 'ignore',
    stderr: 'pipe',
  },

  testDir: './tests',
  fullyParallel: true,
  // Retry on CI only.
  retries: isCI ? 2 : 0,
  workers,
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
