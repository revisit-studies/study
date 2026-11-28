import { defineConfig, devices } from '@playwright/test';

// Real-network load test: builds the app for production and loads a study
// against the Firebase project in .env (revisit-utah). Run with
// `yarn test:perf-real`; see tests/perf/realLoad.spec.ts.
const port = Number(process.env.PERF_PORT) || 4179;
const outDir = 'dist-perf';
// PERF_HEADED=1 opens the browsers visibly, for watching a run.
const headless = process.env.PERF_HEADED !== '1';
// PERF_BROWSERS=chrome,webkit adds the Safari long-polling path. WebKit is
// off by default because Playwright's build crashes on launch on macOS 26.
const browsers = (process.env.PERF_BROWSERS || 'chrome').split(',').map((name) => name.trim());

export default defineConfig({
  webServer: {
    command: `corepack yarn vite build --outDir ${outDir} --emptyOutDir && corepack yarn vite preview --outDir ${outDir} --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 300_000,
    stdout: 'ignore',
    stderr: 'pipe',
    env: { VITE_STORAGE_ENGINE: 'firebase' },
  },
  testDir: './tests/perf',
  // Loads run one at a time so they do not compete for the network.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30 * 60_000,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    headless,
  },
  projects: [
    {
      // Streams Firestore responses.
      name: 'chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
    {
      // Takes the forced long-polling path, as Safari does.
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ].filter((project) => browsers.includes(project.name)),
});
