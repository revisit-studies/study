// @vitest-environment node
import {
  mkdtemp, mkdir, readFile, rm, writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  afterEach, describe, expect, it,
} from 'vitest';
import { parse } from 'yaml';
import {
  checkVersion, parseReleaseTitle, setVersion, syncVersion, validateVersionForBranch,
} from '../release-version.mjs';

const workflow = parse(await readFile(new URL('../../.github/workflows/release.yaml', import.meta.url), 'utf8'));
const { release } = workflow.jobs;
const temporaryDirectories: string[] = [];

async function createFixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'revisit-version-'));
  temporaryDirectories.push(directory);
  await mkdir(path.join(directory, 'src', 'parser'), { recursive: true });
  await mkdir(path.join(directory, 'public', 'demo'), { recursive: true });
  await mkdir(path.join(directory, 'tests'), { recursive: true });
  await writeFile(path.join(directory, 'VERSION'), '3.0.0-dev\n');
  await writeFile(path.join(directory, 'package.json'), JSON.stringify({ name: 'revisit', version: '2.0.0' }, null, 2));
  await writeFile(path.join(directory, 'package-lock.json'), JSON.stringify({
    name: 'revisit',
    version: '2.0.0',
    packages: { '': { name: 'revisit', version: '2.0.0' } },
  }, null, 2));
  await writeFile(
    path.join(directory, 'src', 'parser', 'types.ts'),
    'https://raw.githubusercontent.com/revisit-studies/study/dev/src/parser/StudyConfigSchema.json\n',
  );
  await writeFile(
    path.join(directory, 'public', 'demo', 'config.json'),
    'https://raw.githubusercontent.com/revisit-studies/study/v3.0.0/src/parser/StudyConfigSchema.json\n',
  );
  await writeFile(
    path.join(directory, 'tests', 'historical.json'),
    'https://raw.githubusercontent.com/revisit-studies/study/v2.4.3/src/parser/StudyConfigSchema.json\n',
  );
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('study release workflow contract', () => {
  it('validates every merged pull request targeting main before publication', () => {
    expect(release.if).toBe('github.event.pull_request.merged');
    expect(release.steps[1].run).toContain('validate-title "$RELEASE_TAG"');
  });

  it.each([
    ['v1.0.0', '1.0.0'],
    ['v3.12.100', '3.12.100'],
  ])('accepts release title %s as version %s', (title, version) => {
    expect(parseReleaseTitle(title)).toBe(version);
  });

  it.each(['v3.0.0-beta.1', 'v3.0', '3.0.0', 'v3.0.0\n', 'v3.0.0$(true)'])('rejects invalid release title %j', (title) => {
    expect(() => parseReleaseTitle(title)).toThrow(/must exactly match vX\.Y\.Z/);
  });

  it('requires development and stable versions on their respective branches', () => {
    expect(() => validateVersionForBranch('3.0.0-dev', 'dev')).not.toThrow();
    expect(() => validateVersionForBranch('3.0.0', 'main')).not.toThrow();
    expect(() => validateVersionForBranch('3.0.0', 'dev')).toThrow(/must end in -dev/);
    expect(() => validateVersionForBranch('3.0.0-dev', 'main')).toThrow(/stable version/);
  });

  it('synchronizes package metadata and current pointers without rewriting historical references', async () => {
    const directory = await createFixture();

    await syncVersion(directory);
    await checkVersion(directory, 'dev');
    await setVersion(directory, '3.4.2');
    await checkVersion(directory, 'main');
    await setVersion(directory, '3.4.2');

    expect((await readFile(path.join(directory, 'VERSION'), 'utf8')).trim()).toBe('3.4.2');
    expect(JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8')).version).toBe('3.4.2');
    expect(JSON.parse(await readFile(path.join(directory, 'package-lock.json'), 'utf8')).packages[''].version).toBe('3.4.2');
    expect(await readFile(path.join(directory, 'public', 'demo', 'config.json'), 'utf8')).toContain('/study/v3.4.2/src/');
    expect(await readFile(path.join(directory, 'tests', 'historical.json'), 'utf8')).toContain('/study/v2.4.3/src/');
  });

  it('fails the current-version pointer check when a stale release URL remains', async () => {
    const directory = await createFixture();
    await setVersion(directory, '3.0.0-dev');
    await writeFile(
      path.join(directory, 'public', 'demo', 'config.json'),
      'https://raw.githubusercontent.com/revisit-studies/study/v2.4.3/src/parser/StudyConfigSchema.json\n',
    );

    await expect(checkVersion(directory, 'dev')).rejects.toThrow(/stale reVISit source or schema pointer/);
  });

  it('skips duplicate publication and downstream dispatch when a release tag already exists', () => {
    const prepareStep = release.steps.find((step: { id?: string }) => step.id === 'prepare');
    const dispatchSteps = release.steps.filter((step: { uses?: string }) => step.uses?.includes('repository-dispatch'));

    expect(prepareStep.run).toContain('git show-ref --verify --quiet "refs/tags/$RELEASE_TAG"');
    expect(prepareStep.run).toContain('publish=false');
    expect(dispatchSteps).toHaveLength(3);
    expect(dispatchSteps.every((step: { if: string }) => step.if.includes("steps.prepare.outputs.publish == 'true'"))).toBe(true);
    expect(dispatchSteps.every((step: { with: { 'client-payload': string } }) => step.with['client-payload'].includes('release_tag'))).toBe(true);
  });

  it('creates a GitHub release only when one does not already exist', async () => {
    const tagWorkflow = parse(await readFile(new URL('../../.github/workflows/release_github.yaml', import.meta.url), 'utf8'));
    const createStep = tagWorkflow.jobs.release.steps.find((step: { name?: string }) => step.name === 'Create release');

    expect(createStep.run).toContain('gh release view "$tag"');
    expect(createStep.run).toContain('gh release create "$tag"');
  });
});
