import { readFile, readdir, writeFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-dev)?$/;
const RELEASE_TITLE_PATTERN = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const CURRENT_POINTER_PATTERN = /(https:\/\/(?:raw\.githubusercontent\.com\/revisit-studies\/study|github\.com\/revisit-studies\/study\/(?:tree|blob))\/)(?:dev|main|v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))(?=\/)/g;
const POINTER_PATTERN = /https:\/\/(?:raw\.githubusercontent\.com\/revisit-studies\/study|github\.com\/revisit-studies\/study\/(?:tree|blob))\/(dev|main|v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))(?=\/)/g;
const TEXT_EXTENSIONS = new Set(['.cjs', '.json', '.md', '.mdx', '.ts', '.tsx', '.yaml', '.yml']);

export function parseReleaseTitle(title) {
  const match = RELEASE_TITLE_PATTERN.exec(title);
  if (!match) {
    throw new Error(`Release PR title must exactly match vX.Y.Z; received ${JSON.stringify(title)}`);
  }
  return match.slice(1).join('.');
}

export function releaseTagFromDevVersion(version, title) {
  const devVersion = version.trim();
  validateVersionForBranch(devVersion, 'dev');
  const releaseVersion = devVersion.slice(0, -'-dev'.length);
  if (parseReleaseTitle(title) !== releaseVersion) {
    throw new Error(`Release PR title must match the merged VERSION ${devVersion}`);
  }
  return `v${releaseVersion}`;
}

export function validateVersionForBranch(version, branch) {
  if (!VERSION_PATTERN.test(version)) {
    throw new Error(`VERSION must contain a semantic version with an optional -dev suffix; received ${JSON.stringify(version)}`);
  }
  if (branch === 'dev' && !version.endsWith('-dev')) {
    throw new Error('The dev branch VERSION must end in -dev');
  }
  if (branch === 'main' && version.endsWith('-dev')) {
    throw new Error('The main branch VERSION must be a stable version without -dev');
  }
}

export function branchForPullRequestCheck(baseBranch, title) {
  return baseBranch === 'main' && RELEASE_TITLE_PATTERN.test(title) ? 'dev' : baseBranch;
}

function compareVersions(leftVersion, rightVersion) {
  const left = leftVersion.split('.').map(Number);
  const right = rightVersion.split('.').map(Number);
  const differingIndex = left.findIndex((part, index) => part !== right[index]);
  if (differingIndex === -1) return 0;
  return left[differingIndex] < right[differingIndex] ? -1 : 1;
}

export function mergedReleaseVersionsAfter(root, originSha, mergedPullRequests) {
  return mergedPullRequests.flatMap(({ title, merge_commit_sha: mergeCommitSha }) => {
    if (!mergeCommitSha || mergeCommitSha === originSha || !RELEASE_TITLE_PATTERN.test(title)) return [];
    if (!isAncestor(root, originSha, mergeCommitSha) || !isAncestor(root, mergeCommitSha, 'HEAD')) return [];
    return [parseReleaseTitle(title)];
  });
}

export function validateReleaseOrder(currentVersion, releaseVersion, laterReleaseVersions = []) {
  validateVersionForBranch(currentVersion, currentVersion.endsWith('-dev') ? 'dev' : 'main');
  validateVersionForBranch(releaseVersion, 'main');
  const currentStableVersion = currentVersion.replace(/-dev$/, '');
  if (compareVersions(releaseVersion, currentStableVersion) < 0) {
    throw new Error(`Release ${releaseVersion} is superseded by ${currentVersion} already on main`);
  }
  const supersedingRelease = laterReleaseVersions.find((version) => compareVersions(version, releaseVersion) >= 0);
  if (supersedingRelease) {
    throw new Error(`Release ${releaseVersion} is superseded by later merged release ${supersedingRelease}`);
  }
}

export function validateReleaseVersionAboveLatest(devVersion, title, releaseTags) {
  const releaseTag = releaseTagFromDevVersion(devVersion, title);
  const releaseVersion = parseReleaseTitle(releaseTag);
  const latestVersion = releaseTags.reduce((latest, tag) => {
    try {
      const version = parseReleaseTitle(tag);
      return latest === undefined || compareVersions(version, latest) > 0 ? version : latest;
    } catch {
      return latest;
    }
  }, undefined);

  if (latestVersion !== undefined && compareVersions(releaseVersion, latestVersion) <= 0) {
    throw new Error(`Release version ${releaseVersion} must be higher than the latest release v${latestVersion}`);
  }
  return releaseTag;
}

async function* walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      yield* walk(entryPath);
    } else if (TEXT_EXTENSIONS.has(path.extname(entry.name))) {
      yield entryPath;
    }
  }
}

async function* currentPointerFiles(root) {
  for (const directory of ['src', 'public', 'docsLibraries', '.github/workflows']) {
    try {
      yield* walk(path.join(root, directory));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  for (const filename of ['.env', 'README.md', 'typedocReadMe.md', 'libraryExampleStudyGenerator.cjs']) {
    try {
      const filePath = path.join(root, filename);
      await readFile(filePath);
      yield filePath;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

async function updatePackageMetadata(root, version) {
  const packagePath = path.join(root, 'package.json');
  const packageLockPath = path.join(root, 'package-lock.json');
  const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
  packageJson.version = version;
  await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

  const packageLock = JSON.parse(await readFile(packageLockPath, 'utf8'));
  packageLock.version = version;
  packageLock.packages[''].version = version;
  await writeFile(packageLockPath, `${JSON.stringify(packageLock, null, 2)}\n`);
}

export async function setVersion(root, version) {
  validateVersionForBranch(version, version.endsWith('-dev') ? 'dev' : 'main');
  const pointer = version.endsWith('-dev') ? 'dev' : `v${version}`;
  await writeFile(path.join(root, 'VERSION'), `${version}\n`);
  await updatePackageMetadata(root, version);

  for await (const filename of currentPointerFiles(root)) {
    const original = await readFile(filename, 'utf8');
    const updated = original.replace(CURRENT_POINTER_PATTERN, (_match, prefix) => `${prefix}${pointer}`);
    if (updated !== original) await writeFile(filename, updated);
  }
}

export async function checkVersion(root, branch) {
  const version = (await readFile(path.join(root, 'VERSION'), 'utf8')).trim();
  validateVersionForBranch(version, branch);
  const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const packageLock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));
  if (packageJson.version !== version || packageLock.version !== version || packageLock.packages[''].version !== version) {
    throw new Error('VERSION, package.json, and package-lock.json must contain the same version');
  }

  const expectedPointer = version.endsWith('-dev') ? 'dev' : `v${version}`;
  for await (const filename of currentPointerFiles(root)) {
    const contents = await readFile(filename, 'utf8');
    for (const match of contents.matchAll(POINTER_PATTERN)) {
      if (match[1] !== expectedPointer) {
        throw new Error(`${path.relative(root, filename)} contains a stale reVISit source or schema pointer: ${match[1]}`);
      }
    }
  }
}

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function isAncestor(root, ancestor, descendant) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], { cwd: root, stdio: 'ignore' });
    return true;
  } catch (error) {
    if (error.status === 1) return false;
    throw error;
  }
}

export async function validatePreparedTag(root, tag, expectedOrigin) {
  const releaseVersion = parseReleaseTitle(tag);
  const tagCommit = git(root, ['rev-parse', `${tag}^{commit}`]);
  if (git(root, ['rev-parse', 'HEAD']) !== tagCommit) {
    throw new Error(`HEAD does not match release tag ${tag}`);
  }

  const version = (await readFile(path.join(root, 'VERSION'), 'utf8')).trim();
  if (version !== releaseVersion) {
    throw new Error(`Tag ${tag} points to VERSION ${version}, expected ${releaseVersion}`);
  }
  await checkVersion(root, 'main');

  if (git(root, ['cat-file', '-t', `refs/tags/${tag}`]) !== 'tag') {
    throw new Error(`Tag ${tag} must be an annotated prepared release tag`);
  }
  if (git(root, ['show', '-s', '--format=%s', tagCommit]) !== `Release version ${tag}`) {
    throw new Error(`Tag ${tag} does not point to a release preparation commit`);
  }

  const tagBody = git(root, ['for-each-ref', '--format=%(contents:body)', `refs/tags/${tag}`]);
  const origins = tagBody.split(/\r?\n/).filter((line) => line.startsWith('Release PR merge '));
  const tagOrigin = origins.length === 1 ? origins[0].slice('Release PR merge '.length) : '';
  if (!/^[0-9a-f]{40,64}$/.test(tagOrigin) || !isAncestor(root, tagOrigin, tagCommit)) {
    throw new Error(`Tag ${tag} is not tied to its originating release PR`);
  }
  if (expectedOrigin !== undefined && tagOrigin !== expectedOrigin) {
    throw new Error(`Tag ${tag} was prepared for a different release PR`);
  }
  if (!isAncestor(root, tagCommit, 'origin/main')) {
    throw new Error(`Tag ${tag} is not reachable from main`);
  }
}

export async function syncVersion(root, branch) {
  const version = (await readFile(path.join(root, 'VERSION'), 'utf8')).trim();
  await setVersion(root, version);
  await checkVersion(root, branch);
}

async function main() {
  const [command, value] = process.argv.slice(2);
  if (command === 'validate-title') {
    parseReleaseTitle(value ?? '');
    return;
  }
  if (command === 'release-tag') {
    const [, devVersion, title] = process.argv.slice(2);
    console.log(releaseTagFromDevVersion(devVersion ?? '', title ?? ''));
    return;
  }
  if (command === 'validate-release-pr') {
    const [, title] = process.argv.slice(2);
    const version = (await readFile(path.join(ROOT, 'VERSION'), 'utf8')).trim();
    const tags = git(ROOT, ['tag', '--list', 'v*']).split('\n').filter(Boolean);
    validateReleaseVersionAboveLatest(version, title ?? '', tags);
    return;
  }
  if (command === 'validate-release-order') {
    const currentVersion = (await readFile(path.join(ROOT, 'VERSION'), 'utf8')).trim();
    const [,, releaseMergeSha, pullRequestsPath] = process.argv.slice(2);
    const pullRequestLines = pullRequestsPath === undefined
      ? []
      : (await readFile(pullRequestsPath, 'utf8')).split(/\r?\n/).filter(Boolean);
    const mergedPullRequests = pullRequestLines.map((line) => JSON.parse(line));
    const laterReleaseVersions = releaseMergeSha === undefined
      ? []
      : mergedReleaseVersionsAfter(ROOT, releaseMergeSha, mergedPullRequests);
    validateReleaseOrder(currentVersion, value ?? '', laterReleaseVersions);
    return;
  }
  if (command === 'check') {
    await checkVersion(ROOT, value ?? process.env.GITHUB_REF_NAME);
    return;
  }
  if (command === 'check-pr') {
    const [, , title] = process.argv.slice(2);
    await checkVersion(ROOT, branchForPullRequestCheck(value ?? '', title ?? ''));
    return;
  }
  if (command === 'validate-tag') {
    const [, , expectedOrigin] = process.argv.slice(2);
    await validatePreparedTag(ROOT, value ?? '', expectedOrigin);
    return;
  }
  if (command === 'release') {
    const version = parseReleaseTitle(value ?? '');
    await setVersion(ROOT, version);
    await checkVersion(ROOT, 'main');
    return;
  }
  if (command === 'sync') {
    if (value === undefined) {
      throw new Error('The sync command requires the target branch name');
    }
    await syncVersion(ROOT, value);
    return;
  }
  throw new Error('Usage: node scripts/release-version.mjs validate-title <title> | release-tag <dev-version> <title> | validate-release-pr <title> | validate-release-order <version> [merge-sha] [merged-prs.jsonl] | validate-tag <vX.Y.Z> | check [branch] | check-pr <base-branch> <title> | release <vX.Y.Z> | sync <branch>');
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
