import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-dev)?$/;
const RELEASE_TITLE_PATTERN = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const CURRENT_POINTER_PATTERN = /(https:\/\/(?:raw\.githubusercontent\.com\/revisit-studies\/study|github\.com\/revisit-studies\/study\/(?:tree|blob))\/)(?:dev|v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))(?=\/)/g;
const POINTER_PATTERN = /https:\/\/(?:raw\.githubusercontent\.com\/revisit-studies\/study|github\.com\/revisit-studies\/study\/(?:tree|blob))\/(dev|v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))(?=\/)/g;
const TEXT_EXTENSIONS = new Set(['.json', '.md', '.mdx', '.ts', '.tsx', '.yaml', '.yml']);

export function parseReleaseTitle(title) {
  const match = RELEASE_TITLE_PATTERN.exec(title);
  if (!match) {
    throw new Error(`Release PR title must exactly match vX.Y.Z; received ${JSON.stringify(title)}`);
  }
  return match.slice(1).join('.');
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
  for (const directory of ['src', 'public', 'docsLibraries']) {
    try {
      yield* walk(path.join(root, directory));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  for (const filename of ['README.md', 'typedocReadMe.md']) {
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

export async function syncVersion(root) {
  const version = (await readFile(path.join(root, 'VERSION'), 'utf8')).trim();
  await setVersion(root, version);
  await checkVersion(root, version.endsWith('-dev') ? 'dev' : 'main');
}

async function main() {
  const [command, value] = process.argv.slice(2);
  if (command === 'validate-title') {
    parseReleaseTitle(value ?? '');
    return;
  }
  if (command === 'check') {
    await checkVersion(ROOT, value ?? process.env.GITHUB_REF_NAME);
    return;
  }
  if (command === 'release') {
    const version = parseReleaseTitle(value ?? '');
    await setVersion(ROOT, version);
    await checkVersion(ROOT, 'main');
    return;
  }
  if (command === 'sync') {
    if (value !== undefined) {
      throw new Error('The sync command reads the version from VERSION and does not accept a version argument');
    }
    await syncVersion(ROOT);
    return;
  }
  throw new Error('Usage: node scripts/release-version.mjs validate-title <title> | check [branch] | release <vX.Y.Z> | sync');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
