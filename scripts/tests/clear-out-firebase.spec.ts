// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Load functions without invoking the cleanup entry point. All cloud boundaries
// below are shell functions, so these tests never contact Firebase or gcloud.
const script = readFileSync(new URL('../clear-out-firebase.sh', import.meta.url), 'utf8')
  .replace(/main "\$@"\s*$/, '');
const mocks = `
require_commands() { :; }
load_studies_from_global_config() { printf '%s\\n' demo; }
discover_firestore_collections() {
  printf '%s\\n' prod-demo prod-retired dev-retired prod-demo-snapshot-123 user-management unrelated;
}
firebase() { :; }
gcloud() {
  if [[ "$1 $2" == "storage ls" ]]; then
    printf '%s\\n' gs://revisit-utah.appspot.com/prod-retired/file gs://revisit-utah.appspot.com/dev-retired/file gs://revisit-utah.appspot.com/prod-demo-snapshot-123/file;
  elif [[ "$1 $2" != "storage rm" ]]; then
    return 99;
  fi
}
`;
const run = (args = '', overrides = '') => spawnSync('bash', [], {
  input: `${script}\n${mocks}\n${overrides}\nmain --include-dev --jobs 8 ${args}\n`,
  encoding: 'utf8',
  env: {
    ...process.env,
    FIREBASE_PROJECT_ID: 'revisit-utah',
    FIREBASE_STORAGE_BUCKET: 'revisit-utah.appspot.com',
    FIRESTORE_DATABASE_ID: '(default)',
    STORAGE_BACKEND: 'gcloud',
  },
});
const targets = (output: string) => output.split('\n')
  .filter((line) => line.startsWith('[start] ')).sort();

describe('Firebase cleanup planning', () => {
  it('discovers the same collections, snapshots and storage prefixes in both modes', () => {
    const dryRun = run();
    const execute = run('--execute', 'confirm_destructive_run() { :; }');
    expect(dryRun.status, dryRun.stderr).toBe(0);
    expect(execute.status, execute.stderr).toBe(0);
    expect(targets(dryRun.stdout)).toEqual(targets(execute.stdout));
    expect(targets(dryRun.stdout)).toEqual([
      '[start] firestore _revisit',
      '[start] firestore dev-demo',
      '[start] firestore dev-retired',
      '[start] firestore prod-demo',
      '[start] firestore prod-demo-snapshot-123',
      '[start] firestore prod-retired',
      '[start] storage dev-demo',
      '[start] storage dev-retired',
      '[start] storage prod-demo',
      '[start] storage prod-demo-snapshot-123',
      '[start] storage prod-retired',
    ]);
    expect(dryRun.stdout).toContain('[dry-run]');
    expect(dryRun.stdout).not.toContain('[run]');
  });

  it('accepts an empty storage listing', () => {
    const result = run('', 'gcloud() { :; }');
    expect(result.status, result.stderr).toBe(0);
    expect(targets(result.stdout).filter((target) => target.startsWith('[start] storage'))).toEqual([
      '[start] storage dev-demo',
      '[start] storage prod-demo',
    ]);
  });

  it.each(['', '--execute'])('stops before deletion if Firestore discovery fails (%s)', (args) => {
    const result = run(args, 'discover_firestore_collections() { return 1; }');
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Firestore discovery failed; no data deleted');
    expect(targets(result.stdout)).toEqual([]);
  });

  it.each(['', '--execute'])('stops before deletion if storage discovery fails (%s)', (args) => {
    const result = run(args, 'gcloud() { return 1; }');
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Storage discovery failed; no data deleted');
    expect(targets(result.stdout)).toEqual([]);
  });
});
