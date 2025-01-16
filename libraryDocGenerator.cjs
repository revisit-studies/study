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

${libraryConfig.description}

## Reference

${libraryConfig.reference ? `:::note[Reference]\n${libraryConfig.reference}\n:::` : ''}

${libraryConfig.DOI ? `DOI: [${libraryConfig.DOI}](https://doi.org/${libraryConfig.DOI})` : ''}

${libraryConfig.externalLink ? `Link: ${libraryConfig.externalLink}` : ''}

## Available Components

${Object.keys(libraryConfig.components).map((component) => `- ${component}`).sort((a, b) => a.localeCompare(b)).join('\n')}

## Available Sequences

${Object.keys(libraryConfig.sequences).map((sequence) => `- ${sequence}`).sort((a, b) => a.localeCompare(b)).join('\n')}
`;

  const docsLibraryPath = path.join(docsLibrariesPath, `${library}.md`);
  fs.writeFileSync(docsLibraryPath, markdown);
});

// eslint-disable-next-line no-console
console.log('Library documentation generated');
