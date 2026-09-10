import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);
const configuredTestPort = Number(process.env.PW_TEST_PORT);
const testPort = Number.isInteger(configuredTestPort) && configuredTestPort > 0
  ? configuredTestPort
  : 8090;
const testBaseURL = `http://localhost:${testPort}`;
const configuredWorkers = Number(process.env.PW_WORKERS ?? process.env.PW_CI_WORKERS);
const workers = Number.isFinite(configuredWorkers) && configuredWorkers > 0
  ? configuredWorkers
  : 1;
const includeSlowTests = process.env.PW_INCLUDE_SLOW === '1';

export default defineConfig({
  webServer: {
    command: `corepack yarn serve --port=${testPort}`,
    url: testBaseURL,
    // Reusing port 8080 can attach tests to a Vite server from another
    // worktree. Keep each run tied to the checkout under test.
    reuseExistingServer: Boolean(process.env.PW_REUSE_EXISTING_SERVER),
    stdout: 'ignore',
    stderr: 'pipe',
  },

  testDir: './tests',
  fullyParallel: true,
  // The full MVNV participant journey is covered separately from the fast
  // replay smoke test. Set PW_INCLUDE_SLOW=1 when the long journey is needed.
  grepInvert: includeSlowTests ? undefined : /@slow-mvnv/,
  // Retry on CI only.
  retries: isCI ? 2 : 0,
  workers,
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
  ],
});
