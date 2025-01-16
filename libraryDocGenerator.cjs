/* eslint-disable @typescript-eslint/no-var-requires */
// Loops over the files in public/libraries/*/config.json and outputs a markdown document for each library
// Each json contains optional keys "description", and "reference" that are used to generate the markdown. Name comes from the folder name
// The markdown is output to docsLibraries in the root of the project, which can then be copied to the website repo

const fs = require('fs');
const path = require('path');

const librariesPath = path.join(__dirname, './public/libraries');
const docsLibrariesPath = path.join(__dirname, './docsLibraries');

const libraries = fs.readdirSync(librariesPath);

if (!fs.existsSync(docsLibrariesPath)) {
  fs.mkdirSync(docsLibrariesPath);
}

libraries.forEach((library) => {
  const libraryPath = path.join(librariesPath, library, 'config.json');
  const libraryConfig = JSON.parse(fs.readFileSync(libraryPath, 'utf8'));

  const markdown = `
# ${library}

${libraryConfig.description || ''}

${libraryConfig.reference ? '## Reference' : ''}

${libraryConfig.reference || ''}
`;

  const docsLibraryPath = path.join(docsLibrariesPath, `${library}.md`);
  fs.writeFileSync(docsLibraryPath, markdown);
});

// eslint-disable-next-line no-console
console.log('Library documentation generated');
