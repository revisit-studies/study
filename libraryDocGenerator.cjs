/* eslint-disable @typescript-eslint/no-require-imports */
// Loops over the files in public/libraries/*/config.json and outputs a markdown document for each library
// Each json contains optional keys "description", and "reference" that are used to generate the markdown. Name comes from the folder name
// The markdown is output to docsLibraries in the root of the project, which can then be copied to the website repo

const fs = require('fs');
const path = require('path');

const generateMd = (library, libraryConfig, forDocs) => `
# ${library}

${forDocs ?
  `import StructuredLinks from '@site/src/components/StructuredLinks/StructuredLinks.tsx';
  
  <StructuredLinks
      demoLinks={[
        {name: "${library} Demo", url: "https://revisit.dev/study/library-${library}"}
      ]}
      codeLinks={[
        {name: "${library} Code", url: "https://github.com/revisit-studies/study/tree/main/public/library-${library}"}
      ]}
      ${
        (libraryConfig.doi || libraryConfig.externalLink)
        ? `referenceLinks={[
        ${libraryConfig.doi ? `{name: "DOI", url: "https://dx.doi.org/${libraryConfig.doi}"}` : ''}${libraryConfig.doi && libraryConfig.externalLink ? ',' : ''}
        ${libraryConfig.externalLink ? `{name: "${library}", url: "${libraryConfig.externalLink}"}` : ''}
      ]}`
      : ''}
  />` :  ''}

${!forDocs ? `This is an example study of the library \`${library}\`.` : ''}

${libraryConfig.description}

${libraryConfig.reference || libraryConfig.doi || libraryConfig.externalLink ? '## Reference' : ''}

${libraryConfig.reference ? (forDocs ? `:::note[Reference]\n${libraryConfig.reference}\n:::` : `${libraryConfig.reference}`) : ''}

${libraryConfig.doi ? `DOI: [${libraryConfig.doi}](https://dx.doi.org/${libraryConfig.doi})` : ''}

${libraryConfig.externalLink ? `Link: [${libraryConfig.externalLink}](${libraryConfig.externalLink})` : ''}

## Available Components

${Object.keys(libraryConfig.components).map((component) => `- ${component}`).sort((a, b) => a.localeCompare(b)).join('\n')}

## Available Sequences

${Object.keys(libraryConfig.sequences).length > 0
    ? Object.keys(libraryConfig.sequences).map((sequence) => `- ${sequence}`).sort((a, b) => a.localeCompare(b)).join('\n')
    : 'None'}

${libraryConfig.additionalDescription ? `## Additional Description\n\n${libraryConfig.additionalDescription}` : ''}
`;

const librariesPath = path.join(__dirname, './public/libraries');
const docsLibrariesPath = path.join(__dirname, './docsLibraries');

const libraries = fs.readdirSync(librariesPath)
  .filter(library => !library.startsWith('.') && !library.endsWith('.DS_Store'));

if (!fs.existsSync(docsLibrariesPath)) {
  fs.mkdirSync(docsLibrariesPath);
}

libraries.forEach((library) => {
  const libraryPath = path.join(librariesPath, library, 'config.json');
  const libraryConfig = JSON.parse(fs.readFileSync(libraryPath, 'utf8'));

  const docsMd = generateMd(library, libraryConfig, true);
  const exampleMd = generateMd(library, libraryConfig, false);

  // Save to docsLibraries folder
  const docsLibraryPath = path.join(docsLibrariesPath, `${library}.md`);
  fs.writeFileSync(docsLibraryPath, docsMd);
  // eslint-disable-next-line no-console
  console.log(`Documentation saved to ${docsLibraryPath}`);

  // Save to example study assets folder if assets folder exists
  // Add a prefix to baseMarkdown when saving to example assets
  const exampleAssetsPath = path.join(__dirname, 'public', `library-${library}`, 'assets');
  if (fs.existsSync(exampleAssetsPath)) {
    const exampleDocsPath = path.join(exampleAssetsPath, `${library}.md`);
    fs.writeFileSync(exampleDocsPath, exampleMd);

    // eslint-disable-next-line no-console
    console.log(`Documentation saved to ${exampleDocsPath}`);
  }
});

// eslint-disable-next-line no-console
console.log('Library documentation generated');
