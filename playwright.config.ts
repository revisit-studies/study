import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);
const configuredTestPort = Number(process.env.PW_TEST_PORT);
const testPort = Number.isInteger(configuredTestPort) && configuredTestPort > 0
  ? configuredTestPort
  : 8090;
const testBaseURL = `http://localhost:${testPort}`;
const configuredCiWorkers = Number(process.env.PW_CI_WORKERS);
const ciWorkers = Number.isFinite(configuredCiWorkers) && configuredCiWorkers > 0
  ? configuredCiWorkers
  : 2;

export default defineConfig({
  webServer: {
    command: `corepack yarn serve --port=${testPort}`,
    url: testBaseURL,
    reuseExistingServer: Boolean(process.env.PW_REUSE_EXISTING_SERVER),
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
    baseURL: testBaseURL,
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
