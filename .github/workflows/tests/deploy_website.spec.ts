// @vitest-environment node
import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, test } from 'vitest';
import { loadEnv } from 'vite';
import { parse } from 'yaml';

type Step = { name?: string; if?: string; uses?: string; run?: string; env?: Record<string, string>; with?: Record<string, string> };
const root = fileURLToPath(new URL('../../../', import.meta.url));
const workflow = parse(readFileSync(resolve(root, '.github/workflows/deploy_website.yaml'), 'utf8')) as { jobs: Record<string, { steps: Step[] }> };
const temporaryDirectories: string[] = [];
function temporaryDirectory() {
  const directory = mkdtempSync(resolve(tmpdir(), 'revisit-pages-'));
  temporaryDirectories.push(directory);
  return directory;
}
afterEach(() => temporaryDirectories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })));

function expand(value: string, engine = '') {
  return value.replace(/\$\{\{\s*(.*?)\s*\}\}/g, (_, expression: string) => ({
    'vars.VITE_STORAGE_ENGINE': engine,
    'github.event.repository.name': 'research-study',
    'github.event.number': '1',
  }[expression] ?? ''));
}

test.each(['deploy-main', 'deploy-dev', 'pr-deploy'])('release regression: %s honors the downstream storage variable', (job) => {
  const directory = temporaryDirectory();
  // Replace only the expensive build boundary; execute the workflow's actual shell.
  const yarn = resolve(directory, 'yarn');
  // eslint-disable-next-line no-template-curly-in-string -- These are shell parameter expansions.
  writeFileSync(yarn, '#!/bin/sh\nprintf "%s" "${VITE_STORAGE_ENGINE:-$TEST_DOTENV_STORAGE_ENGINE}" > "$TEST_BUILD_ENGINE"\n');
  chmodSync(yarn, 0o755);
  const step = workflow.jobs[job].steps.find(({ name }) => name === ({
    'deploy-main': 'Build main deployment', 'deploy-dev': 'Build dev deployment', 'pr-deploy': 'Build PR deployment',
  }[job]))!;
  for (const engine of ['firebase', 'supabase', '']) {
    const environment = Object.fromEntries(Object.entries(step.env ?? {}).map(([key, value]) => [key, expand(value, engine)]));
    const output = resolve(directory, 'engine');
    execFileSync('bash', ['-e', '-c', expand(step.run!, engine)], {
      cwd: root,
      env: {
        ...process.env,
        ...environment,
        PATH: `${directory}:${process.env.PATH}`,
        GITHUB_REPOSITORY: 'researcher/research-study',
        TEST_BUILD_ENGINE: output,
        TEST_DOTENV_STORAGE_ENGINE: loadEnv('production', root).VITE_STORAGE_ENGINE,
      },
    });
    expect(readFileSync(output, 'utf8')).toBe(engine || loadEnv('production', root).VITE_STORAGE_ENGINE);
  }
});

test.each(['deploy-main', 'deploy-dev', 'pr-deploy'])('%s supplies the Enterprise key only to official builds', (job) => {
  const directory = temporaryDirectory();
  const yarn = resolve(directory, 'yarn');
  // Preserve explicit empty overrides, as Vite does for environment variables.
  // eslint-disable-next-line no-template-curly-in-string -- These are shell parameter expansions.
  writeFileSync(yarn, '#!/bin/sh\nprintf "%s" "${VITE_RECAPTCHA_ENTERPRISE_SITE_KEY-$TEST_DOTENV_ENTERPRISE_KEY}" > "$TEST_BUILD_KEY"\n');
  chmodSync(yarn, 0o755);
  const { steps } = workflow.jobs[job];
  const stepName = {
    'deploy-main': 'Build main deployment', 'deploy-dev': 'Build dev deployment', 'pr-deploy': 'Build PR deployment',
  }[job];
  const forkStep = steps.find(({ name }) => name === stepName)!;
  const officialStep = job === 'pr-deploy'
    ? steps.find(({ name }) => name === 'Build with github environment variables')! : forkStep;
  if (job === 'pr-deploy') expect(officialStep.if).toContain("github.repository == 'revisit-studies/study'");
  const build = (step: Step, repository: string, enterpriseKey?: string) => {
    const environment = { ...process.env };
    delete environment.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY;
    if (enterpriseKey !== undefined) environment.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY = enterpriseKey;
    const output = resolve(directory, 'enterprise-key');
    execFileSync('bash', ['-e', '-c', expand(step.run!, 'firebase')], {
      cwd: root,
      env: {
        ...environment,
        ...Object.fromEntries(Object.entries(step.env ?? {}).map(([key, value]) => [key, expand(value, 'firebase')])),
        PATH: `${directory}:${process.env.PATH}`,
        GITHUB_REPOSITORY: repository,
        TEST_BUILD_KEY: output,
        TEST_DOTENV_ENTERPRISE_KEY: loadEnv('production', root).VITE_RECAPTCHA_ENTERPRISE_SITE_KEY,
      },
    });
    return readFileSync(output, 'utf8');
  };
  expect(build(officialStep, 'revisit-studies/study')).toBe('6LeksfUtAAAAADwbkOg-HyN8ZkMD04uIbJvrSWeX');
  expect(build(forkStep, 'researcher/research-study')).toBe('');
  expect(build(forkStep, 'researcher/research-study', '')).toBe('');
  expect(build(forkStep, 'researcher/research-study', 'fork-enterprise-key')).toBe('fork-enterprise-key');
});

test('release regression: a downstream repository can publish without an existing gh-pages branch', () => {
  const directory = temporaryDirectory();
  const remote = resolve(directory, 'remote.git');
  const source = resolve(directory, 'source');
  const checkout = resolve(directory, 'pages');
  const dist = resolve(directory, 'dist');
  const git = (cwd: string, args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git(directory, ['init', '--bare', '--initial-branch=main', remote]);
  git(directory, ['clone', remote, source]);
  git(source, ['config', 'user.email', 'test@example.com']);
  git(source, ['config', 'user.name', 'Test']);
  writeFileSync(resolve(source, 'README.md'), 'Source code must not be published');
  git(source, ['add', '.']);
  git(source, ['commit', '-m', 'Initial source']);
  git(source, ['push', 'origin', 'main']);
  mkdirSync(dist);
  writeFileSync(resolve(dist, 'index.html'), '<h1>Study</h1>');
  writeFileSync(resolve(dist, '404.html'), '<h1>Not found</h1>');

  const { steps } = workflow.jobs['deploy-main'];
  const checkoutIndex = steps.findIndex((step) => step.with?.path === '.pages');
  const checkoutStep = steps[checkoutIndex];
  // Reproduce actions/checkout's requested ref against a fresh local remote.
  const clone = spawnSync('git', ['clone', '--branch', checkoutStep.with?.ref ?? 'main', remote, checkout], { encoding: 'utf8' });
  expect(clone.status, clone.stderr).toBe(0);
  for (const step of steps.slice(checkoutIndex + 1)) {
    if (step.name === 'Deploy current-only main snapshot') break;
    if (step.run) execFileSync('bash', ['-e', '-c', step.run.replaceAll('./.pages', checkout)], { cwd: root });
  }
  execFileSync('bash', [resolve(root, '.github/scripts/publish-pages-snapshot.sh'), dist, '', checkout], { cwd: root });
  expect(git(directory, ['--git-dir', remote, 'show', 'gh-pages:index.html'])).toBe('<h1>Study</h1>');
  expect(git(directory, ['--git-dir', remote, 'ls-tree', '--name-only', 'gh-pages'])).not.toContain('README.md');
});
