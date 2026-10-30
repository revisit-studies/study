// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const { release } = parse(readFileSync(new URL('../../.github/workflows/release.yaml', import.meta.url), 'utf8')).jobs;
const expression = (name: string) => `\${{ ${name} }}`;
const environment = (title: string) => ({
  ...process.env,
  RELEASE_TAG: release.env.RELEASE_TAG.replaceAll(expression('github.event.pull_request.title'), title),
});
const validate = (title: string) => execFileSync('bash', ['-e', '-o', 'pipefail', '-c', release.steps[0].run], {
  env: environment(title), stdio: 'pipe',
});

describe('study release workflow contract', () => {
  it.each(['v1.0.0', 'v3.12.100'])('validates and sends exact stable tag %s to docs', (title) => {
    validate(title);
    const dispatch = release.steps.find((step: { with?: { repository?: string } }) => step.with?.repository === 'revisit-studies/reVISit-studies.github.io');
    const payload = JSON.parse(dispatch.with['client-payload'].replaceAll(expression('env.RELEASE_TAG'), environment(title).RELEASE_TAG));
    expect(payload).toEqual({ release_tag: title });
    expect(dispatch.with['event-type']).toBe('study_repo_publish');
  });

  it.each(['v3.0.0-beta.1', 'v3.0', '3.0.0', 'v3.0.0\n', 'v3.0.0$(true)'])('rejects invalid release title %j before publication', (title) => {
    expect(() => validate(title)).toThrow();
  });
});
