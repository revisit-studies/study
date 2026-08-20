import fs from 'node:fs';

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const packageLock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const yarnLines = fs.readFileSync('yarn.lock', 'utf8').split(/\r?\n/);

const yarnSelectorVersions = new Map();
const yarnPackageVersions = new Set();
let activeSelectors = [];

const packageNameFromSelector = (selector) => {
  const separator = selector.startsWith('@')
    ? selector.indexOf('@', 1)
    : selector.indexOf('@');
  return selector.slice(0, separator);
};

for (const line of yarnLines) {
  if (line && !/^\s/.test(line) && line.endsWith(':')) {
    activeSelectors = [];
    const selectorPattern = /"([^"]+)"|([^,\s]+)/g;
    const header = line.slice(0, -1);
    let match = selectorPattern.exec(header);

    while (match) {
      activeSelectors.push(match[1] || match[2]);
      match = selectorPattern.exec(header);
    }
  } else if (activeSelectors.length && line.startsWith('  version "')) {
    const version = line.match(/^  version "([^"]+)"/)?.[1];

    for (const selector of activeSelectors) {
      yarnSelectorVersions.set(selector, version);
      yarnPackageVersions.add(`${packageNameFromSelector(selector)}@${version}`);
    }
    activeSelectors = [];
  }
}

const errors = [];
const directDependencies = {
  ...packageJson.dependencies,
  ...packageJson.devDependencies,
};

for (const [name, range] of Object.entries(directDependencies)) {
  const yarnVersion = yarnSelectorVersions.get(`${name}@${range}`);
  const npmVersion = packageLock.packages?.[`node_modules/${name}`]?.version;

  if (!yarnVersion) {
    errors.push(`yarn.lock has no resolution for ${name}@${range}`);
  } else if (!npmVersion) {
    errors.push(`package-lock.json has no root resolution for ${name}`);
  } else if (npmVersion !== yarnVersion) {
    errors.push(`${name} resolves to ${npmVersion} with npm and ${yarnVersion} with Yarn`);
  }
}

for (const [location, dependency] of Object.entries(packageLock.packages ?? {})) {
  if (!location || !dependency.version || dependency.optional) continue;

  const nodeModulesMarker = 'node_modules/';
  const markerIndex = location.lastIndexOf(nodeModulesMarker);
  if (markerIndex === -1) continue;

  const name = location.slice(markerIndex + nodeModulesMarker.length);
  const packageVersion = `${name}@${dependency.version}`;
  if (!yarnPackageVersions.has(packageVersion)) {
    errors.push(`${packageVersion} appears only in package-lock.json`);
  }
}

if (errors.length) {
  console.error('Dependency lockfiles have drifted:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Lockfiles agree on ${Object.keys(directDependencies).length} direct dependencies.`);
