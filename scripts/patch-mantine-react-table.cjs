const fs = require('node:fs');
const path = require('node:path');

const packageDirectory = path.resolve(__dirname, '../node_modules/mantine-react-table');
const packageJson = JSON.parse(fs.readFileSync(path.join(packageDirectory, 'package.json'), 'utf8'));

if (packageJson.version !== '2.0.0-beta.9') {
  throw new Error(`Expected mantine-react-table 2.0.0-beta.9, found ${packageJson.version}. Remove this shim when upgrading MRT.`);
}

[
  ['dist/index.esm.mjs'],
  ['dist/index.cjs'],
].forEach(([relativePath]) => {
  const filePath = path.join(packageDirectory, relativePath);
  const source = fs.readFileSync(filePath, 'utf8');
  const newTextValue = 'expanded:';
  const occurrences = source.match(/\bin:/g)?.length ?? 0;

  if (occurrences === 0) {
    if (!source.includes(newTextValue)) {
      throw new Error(`Could not find Mantine Collapse calls in ${relativePath}.`);
    }
    return;
  }

  if (occurrences !== 5) {
    throw new Error(`Expected five Mantine Collapse calls in ${relativePath}, found ${occurrences}.`);
  }

  fs.writeFileSync(filePath, source.replace(/\bin:/g, newTextValue));
});
