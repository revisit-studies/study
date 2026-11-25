// @vitest-environment node
import {
  copyFile, mkdtemp, mkdir, readFile, rm, writeFile,
} from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {
  afterEach, describe, expect, it,
} from 'vitest';
import { parse } from 'yaml';
import {
  branchForPullRequestCheck, checkVersion, mergedReleaseVersionsAfter, parseReleaseTitle, setVersion, syncVersion, validatePreparedTag, validateReleaseOrder, validateVersionForBranch,
} from '../release-version.mjs';

const workflow = parse(await readFile(new URL('../../.github/workflows/release.yaml', import.meta.url), 'utf8'));
const { prepare } = workflow.jobs;
const temporaryDirectories: string[] = [];

async function createFixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'revisit-version-'));
  temporaryDirectories.push(directory);
  await mkdir(path.join(directory, 'src', 'parser'), { recursive: true });
  await mkdir(path.join(directory, 'public', 'demo'), { recursive: true });
  await mkdir(path.join(directory, '.github', 'workflows'), { recursive: true });
  await mkdir(path.join(directory, 'tests'), { recursive: true });
  await writeFile(path.join(directory, 'VERSION'), '3.0.0-dev\n');
  await writeFile(path.join(directory, '.env'), 'VITE_REPO_URL="https://github.com/revisit-studies/study/tree/dev/public/"\n');
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
    path.join(directory, 'public', 'demo', 'introduction.md'),
    'https://github.com/revisit-studies/study/blob/main/public/demo/config.json\n',
  );
  await writeFile(
    path.join(directory, '.github', 'workflows', 'deploy.yaml'),
    'VITE_REPO_URL=https://github.com/revisit-studies/study/tree/main/public/\n',
  );
  await writeFile(
    path.join(directory, 'libraryExampleStudyGenerator.cjs'),
    'const schema = "https://raw.githubusercontent.com/revisit-studies/study/dev/src/parser/StudyConfigSchema.json";\n',
  );
  await writeFile(
    path.join(directory, 'tests', 'historical.json'),
    'https://raw.githubusercontent.com/revisit-studies/study/v2.4.3/src/parser/StudyConfigSchema.json\n',
  );
  return directory;
}

async function createPreparedTagFixture({
  version = '3.4.2',
  reachableFromMain = true,
}: { version?: string; reachableFromMain?: boolean } = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'revisit-prepared-tag-'));
  temporaryDirectories.push(directory);
  const initialVersion = '3.4.2-dev';
  await writeFile(path.join(directory, 'VERSION'), `${initialVersion}\n`);
  await writeFile(path.join(directory, '.env'), 'VITE_REPO_URL="https://github.com/revisit-studies/study/tree/dev/public/"\n');
  await writeFile(path.join(directory, 'package.json'), JSON.stringify({ version: initialVersion }));
  await writeFile(path.join(directory, 'package-lock.json'), JSON.stringify({
    version: initialVersion, packages: { '': { version: initialVersion } },
  }));

  const git = (args: string[]) => execFileSync('git', args, { cwd: directory, encoding: 'utf8' }).trim();
  git(['init', '--initial-branch=main']);
  git(['config', 'user.email', 'release-test@example.com']);
  git(['config', 'user.name', 'Release Test']);
  git(['add', '--all']);
  git(['commit', '-m', 'Release PR merge']);
  const releaseMergeSha = git(['rev-parse', 'HEAD']);
  await setVersion(directory, version);
  git(['add', '--all']);
  git(['commit', '--allow-empty', '-m', 'Release version v3.4.2']);
  git(['tag', '-a', 'v3.4.2', '-m', 'Release version v3.4.2', '-m', `Release PR merge ${releaseMergeSha}`]);
  git(['update-ref', 'refs/remotes/origin/main', reachableFromMain ? 'HEAD' : releaseMergeSha]);
  return directory;
}

async function createReleaseOrderGitFixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'revisit-release-order-'));
  temporaryDirectories.push(directory);
  await writeFile(path.join(directory, 'VERSION'), '3.0.0-dev\n');
  const git = (args: string[]) => execFileSync('git', args, { cwd: directory, encoding: 'utf8' }).trim();
  git(['init', '--initial-branch=main']);
  git(['config', 'user.email', 'release-test@example.com']);
  git(['config', 'user.name', 'Release Test']);
  git(['add', 'VERSION']);
  git(['commit', '-m', 'Current release PR merge']);
  const originSha = git(['rev-parse', 'HEAD']);
  await writeFile(path.join(directory, 'later-release'), 'merged later');
  git(['add', 'later-release']);
  git(['commit', '-m', 'Later release PR merge']);
  const laterReleaseSha = git(['rev-parse', 'HEAD']);
  await mkdir(path.join(directory, 'scripts'));
  await copyFile(new URL('../release-version.mjs', import.meta.url), path.join(directory, 'scripts', 'release-version.mjs'));
  return {
    directory, git, originSha, laterReleaseSha,
  };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('study release workflow contract', () => {
  it('validates every merged pull request targeting main before publication', () => {
    expect(prepare.if).toBe('github.event.pull_request.merged');
    expect(prepare.steps[1].run).toContain('validate-title "$RELEASE_TAG"');
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

  it('validates release PRs against their pre-merge dev version', () => {
    expect(branchForPullRequestCheck('main', 'v3.0.0')).toBe('dev');
    expect(branchForPullRequestCheck('main', 'Regular contribution')).toBe('main');
    expect(branchForPullRequestCheck('dev', 'v3.0.0')).toBe('dev');
  });

  it('CLI validates a release PR title against an isolated dev fixture', async () => {
    const scriptSource = new URL('../release-version.mjs', import.meta.url);
    const directory = await mkdtemp(path.join(os.tmpdir(), 'revisit-version-cli-'));
    temporaryDirectories.push(directory);
    const scriptDirectory = path.join(directory, 'scripts');
    await mkdir(scriptDirectory);
    const script = path.join(scriptDirectory, 'release-version.mjs');

    await copyFile(scriptSource, script);
    await writeFile(path.join(directory, 'VERSION'), '3.0.0-dev\n');
    await writeFile(path.join(directory, 'package.json'), JSON.stringify({ version: '3.0.0-dev' }));
    await writeFile(path.join(directory, 'package-lock.json'), JSON.stringify({
      version: '3.0.0-dev', packages: { '': { version: '3.0.0-dev' } },
    }));

    expect(() => execFileSync(process.execPath, [script, 'check-pr', 'main', 'v3.0.0'])).not.toThrow();
  });

  it('rejects delayed releases older than the version already prepared on main', () => {
    expect(() => validateReleaseOrder('3.0.0-dev', '3.0.0')).not.toThrow();
    expect(() => validateReleaseOrder('3.1.0-dev', '3.0.0')).toThrow(/superseded by 3\.1\.0-dev/);
    expect(() => validateReleaseOrder('3.1.0-dev', '3.2.0')).not.toThrow();
    expect(() => validateReleaseOrder('3.1.0', '3.2.0')).not.toThrow();
    expect(() => validateReleaseOrder('3.2.0', '3.1.0')).toThrow(/superseded/);
    expect(() => validateReleaseOrder('3.0.0-dev', '3.0.0', ['3.1.0'])).toThrow(/later merged release 3\.1\.0/);
    expect(() => validateReleaseOrder('3.0.0-dev', '3.2.0', ['3.1.0'])).not.toThrow();
  });

  it('finds later merged release PRs by main ancestry even while VERSION is dev', async () => {
    const {
      directory, git, originSha, laterReleaseSha,
    } = await createReleaseOrderGitFixture();
    const laterVersions = mergedReleaseVersionsAfter(directory, originSha, [
      { title: 'v3.0.0', merge_commit_sha: originSha },
      { title: 'v3.1.0', merge_commit_sha: laterReleaseSha },
    ]);

    expect(laterVersions).toEqual(['3.1.0']);
    expect(() => validateReleaseOrder('3.0.0-dev', '3.0.0', laterVersions)).toThrow(/later merged release/);

    const pullRequestsPath = path.join(directory, 'merged-prs.jsonl');
    await writeFile(pullRequestsPath, `${JSON.stringify({ title: 'v3.1.0', merge_commit_sha: laterReleaseSha })}\n`);
    const script = path.join(directory, 'scripts', 'release-version.mjs');
    const cliResult = spawnSync(process.execPath, [
      script, 'validate-release-order', '3.0.0', originSha, pullRequestsPath,
    ], { encoding: 'utf8' });
    expect(cliResult.status).toBe(1);
    expect(cliResult.stderr).toContain('later merged release 3.1.0');

    git(['checkout', '-b', 'side', originSha]);
    await writeFile(path.join(directory, 'side-release'), 'not merged to main');
    git(['add', 'side-release']);
    git(['commit', '-m', 'Unmerged side release PR']);
    const sideSha = git(['rev-parse', 'HEAD']);
    git(['checkout', 'main']);
    expect(mergedReleaseVersionsAfter(directory, originSha, [
      { title: 'v3.9.0', merge_commit_sha: sideSha },
    ])).toEqual([]);
  });

  it('synchronizes package metadata and current pointers without rewriting historical references', async () => {
    const directory = await createFixture();

    await syncVersion(directory, 'dev');
    await checkVersion(directory, 'dev');
    await setVersion(directory, '3.4.2');
    await checkVersion(directory, 'main');
    await setVersion(directory, '3.4.2');

    expect((await readFile(path.join(directory, 'VERSION'), 'utf8')).trim()).toBe('3.4.2');
    expect(JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8')).version).toBe('3.4.2');
    expect(JSON.parse(await readFile(path.join(directory, 'package-lock.json'), 'utf8')).packages[''].version).toBe('3.4.2');
    expect(await readFile(path.join(directory, 'public', 'demo', 'config.json'), 'utf8')).toContain('/study/v3.4.2/src/');
    expect(await readFile(path.join(directory, 'public', 'demo', 'introduction.md'), 'utf8')).toContain('/study/blob/v3.4.2/');
    expect(await readFile(path.join(directory, '.github', 'workflows', 'deploy.yaml'), 'utf8')).toContain('/study/tree/v3.4.2/public/');
    expect(await readFile(path.join(directory, '.env'), 'utf8')).toContain('/study/tree/v3.4.2/public/');
    expect(await readFile(path.join(directory, 'libraryExampleStudyGenerator.cjs'), 'utf8')).toContain('/study/v3.4.2/src/parser/StudyConfigSchema.json');
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

  it('allows publication retries only for the originating release PR and separates dispatches', () => {
    const prepareStep = prepare.steps.find((step: { id?: string }) => step.id === 'prepare');
    const dispatchJobs = Object.values(workflow.jobs).filter((job: { steps?: { uses?: string }[] }) => job.steps?.some((step) => step.uses?.includes('repository-dispatch')));
    const releaseTagParameter = ['$', '{RELEASE_TAG#v}'].join('');

    expect(prepareStep.run).toContain('git show-ref --verify --quiet "refs/tags/$RELEASE_TAG"');
    expect(prepareStep.run).toContain('git merge-base --is-ancestor "$RELEASE_MERGE_SHA" HEAD');
    expect(prepareStep.run).toContain('git worktree add --detach "$validation_root/checkout" "$RELEASE_TAG"');
    expect(prepareStep.run).toContain('validate-tag "$RELEASE_TAG" "$RELEASE_MERGE_SHA"');
    expect(prepare.steps[0].with.ref).toBe('main');
    expect(prepareStep.run).toContain('git checkout --detach origin/main');
    expect(prepareStep.run).not.toContain('git add docsLibraries');
    expect(prepareStep.run).toContain('git add VERSION package.json package-lock.json src public README.md .env .github/workflows');
    expect(prepareStep.run).toContain('git commit --allow-empty -m "Release version $RELEASE_TAG"');
    expect(prepareStep.run).toContain('Release PR merge $RELEASE_MERGE_SHA');
    expect(prepareStep.run).toContain('git push --atomic origin HEAD:refs/heads/main "refs/tags/$RELEASE_TAG"');
    expect(prepareStep.run).toContain('gh api --paginate --jq');
    expect(prepareStep.run).toContain(`validate-release-order "${releaseTagParameter}" "$RELEASE_MERGE_SHA" "$RUNNER_TEMP/merged-main-prs.jsonl"`);
    expect(workflow.concurrency).toBeUndefined();
    expect(dispatchJobs).toHaveLength(3);
    const dispatchJobsHaveExpectedGuards = dispatchJobs.every((job: { needs: string; if: string; steps: { run?: string; if?: string }[] }) => job.needs === 'prepare'
      && job.if.includes("needs.prepare.outputs.publish == 'true'")
      && job.steps[0].run?.includes('GITHUB_RUN_ATTEMPT')
      && job.steps[0].run?.includes('prior_jobs="$(gh api')
      && job.steps[0].run?.includes('jq -e --arg job "$GITHUB_JOB"')
      && !job.steps[0].run?.includes('| grep')
      && job.steps[1].if?.includes("steps.prior.outputs.skip != 'true'"));
    expect(dispatchJobsHaveExpectedGuards).toBe(true);
  });

  it('keeps release workflow shell steps syntactically valid', () => {
    const scripts = Object.values(workflow.jobs).flatMap((job: { steps: { run?: string }[] }) => job.steps
      .filter((step) => step.run)
      .map((step) => step.run));

    scripts.forEach((script) => expect(spawnSync('bash', ['-n'], { input: script }).status).toBe(0));
  });

  it('validates pull request versions against the target branch', async () => {
    const lintWorkflow = parse(await readFile(new URL('../../.github/workflows/lint_build.yaml', import.meta.url), 'utf8'));
    const checkStep = lintWorkflow.jobs.lint.steps.find((step: { name?: string }) => step.name === 'Check version metadata and current pointers');

    expect(checkStep.run).toContain('check-pr "$GITHUB_BASE_REF" "$PR_TITLE"');
    expect(checkStep.run).toContain('check "$GITHUB_REF_NAME"');
  });

  it('creates a GitHub release only when one does not already exist', async () => {
    const tagWorkflow = parse(await readFile(new URL('../../.github/workflows/release_github.yaml', import.meta.url), 'utf8'));
    const { steps } = tagWorkflow.jobs.release;
    const validationIndex = steps.findIndex((step: { name?: string }) => step.name === 'Validate prepared release tag');
    const createIndex = steps.findIndex((step: { name?: string }) => step.name === 'Create release');
    const createStep = steps[createIndex];

    expect(validationIndex).toBeGreaterThan(-1);
    expect(validationIndex).toBeLessThan(createIndex);
    expect(steps[validationIndex].run).toContain('validate-tag "$tag"');
    expect(spawnSync('bash', ['-n'], { input: steps[validationIndex].run }).status).toBe(0);
    expect(spawnSync('bash', ['-n'], { input: createStep.run }).status).toBe(0);
    expect(createStep.run).toContain('gh release view "$tag"');
    expect(createStep.run).toContain('gh release create "$tag"');
  });

  it('accepts a correctly prepared annotated release tag on main', async () => {
    const directory = await createPreparedTagFixture();
    await expect(validatePreparedTag(directory, 'v3.4.2')).resolves.toBeUndefined();
  });

  it('requires the retrying PR to match the prepared tag origin', async () => {
    const directory = await createPreparedTagFixture();
    await expect(validatePreparedTag(directory, 'v3.4.2', 'a'.repeat(40))).rejects.toThrow(/different release PR/);
  });

  it('rejects a prepared tag with stale pointers during retry validation', async () => {
    const directory = await createPreparedTagFixture();
    await writeFile(path.join(directory, '.env'), 'VITE_REPO_URL="https://github.com/revisit-studies/study/tree/v3.4.1/public/"\n');
    await expect(validatePreparedTag(directory, 'v3.4.2')).rejects.toThrow(/stale reVISit source or schema pointer/);
  });

  it('rejects an invalid release tag name', async () => {
    await expect(validatePreparedTag('/missing/repository', 'vbanana')).rejects.toThrow(/must exactly match vX\.Y\.Z/);
  });

  it('rejects a release tag that points to a dev version', async () => {
    const directory = await createPreparedTagFixture({ version: '3.4.2-dev' });
    await expect(validatePreparedTag(directory, 'v3.4.2')).rejects.toThrow(/VERSION 3\.4\.2-dev, expected 3\.4\.2/);
  });

  it('rejects a tag whose commit VERSION does not match its tag', async () => {
    const directory = await createPreparedTagFixture({ version: '3.4.1' });
    await expect(validatePreparedTag(directory, 'v3.4.2')).rejects.toThrow(/expected 3\.4\.2/);
  });

  it('rejects a prepared release tag whose commit is not reachable from main', async () => {
    const directory = await createPreparedTagFixture({ reachableFromMain: false });
    await expect(validatePreparedTag(directory, 'v3.4.2')).rejects.toThrow(/not reachable from main/);
  });
});
