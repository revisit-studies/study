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

  const baseMarkdown = `
# ${library}

${libraryConfig.description}

${libraryConfig.reference || libraryConfig.doi || libraryConfig.externalLink ? '## Reference' : ''}

${libraryConfig.reference ? `${libraryConfig.reference}` : ''}

${libraryConfig.doi ? `DOI: [${libraryConfig.doi}](https://doi.org/${libraryConfig.doi})` : ''}

${libraryConfig.externalLink ? `Link: [${libraryConfig.externalLink}](https://${libraryConfig.externalLink})` : ''}

## Available Components

${Object.keys(libraryConfig.components).map((component) => `- ${component}`).sort((a, b) => a.localeCompare(b)).join('\n')}

## Available Sequences

${Object.keys(libraryConfig.sequences).length > 0
    ? Object.keys(libraryConfig.sequences).map((sequence) => `- ${sequence}`).sort((a, b) => a.localeCompare(b)).join('\n')
    : 'None'}
`;

  // Save to docsLibraries folder
  const docsLibraryPath = path.join(docsLibrariesPath, `${library}.md`);
  fs.writeFileSync(docsLibraryPath, baseMarkdown);

  // Save to example study assets folder if assets folder exists
  // Add a prefix to baseMarkdown when saving to example assets
  const exampleAssetsPath = path.join(__dirname, 'public', `library-${library}`, 'assets');
  if (fs.existsSync(exampleAssetsPath)) {
    const exampleMarkdown = `This is an example study of the library \`${library}\`.

${baseMarkdown}`;
    const exampleDocsPath = path.join(exampleAssetsPath, `${library}.md`);
    fs.writeFileSync(exampleDocsPath, exampleMarkdown);
    console.log(`Documentation saved to ${exampleDocsPath}`);
  }
});

// eslint-disable-next-line no-console
console.log('Library documentation generated');
