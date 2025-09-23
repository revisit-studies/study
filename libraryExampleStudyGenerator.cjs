/* eslint-disable @typescript-eslint/no-require-imports */

// This script generates example study configurations for libraries in the public/libraries directory
// It creates a new directory for each library (library-{name}) with a basic config.json and an assets folder
// It will run libraryDocGenerator.cjs to generate library.md files, which will be placed in the assets/ folder of each example study to serve as the introduction component

// The script will skip:
// - Libraries that already have a library-{name} folder (e.g. if library-demographics exists)

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Path to the libraries directory containing reusable components and sequences
const librariesPath = path.join(__dirname, './public/libraries');
const publicPath = path.join(__dirname, './public');


// Create example study config template
const createExampleConfig = (libraryName) => ({
  $schema: 'https://raw.githubusercontent.com/revisit-studies/study/dev/src/parser/StudyConfigSchema.json',
  studyMetadata: {
    title: `${libraryName} Example Study`,
    version: '1.0.0',
    authors: ['The reVISit Team'],
    date: new Date().toISOString().split('T')[0],
    description: `Example study using the ${libraryName} library.`,
    organizations: ['University of Utah', 'WPI', 'University of Toronto'],
  },
  uiConfig: {
    contactEmail: '',
    logoPath: 'revisitAssets/revisitLogoSquare.svg',
    withProgressBar: true,
    withSidebar: true,
  },
  importedLibraries: [libraryName],
  components: {
    introduction: {
      type: 'markdown',
      path: `library-${libraryName}/assets/${libraryName}.md`,
      response: [],
    },
  },
  sequence: {
    order: 'fixed',
    components: [
      'introduction',
    ],
  },
});

// Process each library
const libraries = fs.readdirSync(librariesPath)
  .filter(library => !library.startsWith('.') && !library.endsWith('.DS_Store'));

libraries.forEach((library) => {
  // Skip hidden folders and files, and libraries in skip list
  if (library.startsWith('.')) {
    // eslint-disable-next-line no-console
    console.log(`Skipping ${library} library`);
    return;
  }

  const exampleFolderName = `library-${library}`;
  const examplePath = path.join(publicPath, exampleFolderName);

  // Check if example folder already exists
  if (!fs.existsSync(examplePath)) {
    // Create the example folder
    fs.mkdirSync(examplePath);
    // eslint-disable-next-line no-console
    console.log(`Created ${exampleFolderName} directory`);

    // Create assets directory
    const assetsPath = path.join(examplePath, 'assets');
    fs.mkdirSync(assetsPath);
    // eslint-disable-next-line no-console
    console.log(`Created ${exampleFolderName}/assets directory`);

    // Create config.json
    const configPath = path.join(examplePath, 'config.json');
    const configContent = createExampleConfig(library);
    fs.writeFileSync(configPath, JSON.stringify(configContent, null, 2));
    // eslint-disable-next-line no-console
    console.log(`Created/Updated ${exampleFolderName}/config.json`);
  }

});

// eslint-disable-next-line no-console
console.log('Library example generation complete');

// Run libraryDocGenerator.cjs after example generation
// To generate the library.md files which will be placed in the assets/ folder of each example study for the introduction component
// eslint-disable-next-line no-console
console.log('Generating library documentation...');
exec('node libraryDocGenerator.cjs', (error, stdout, stderr) => {
  if (error) {
    console.error(`Error running libraryDocGenerator.cjs: ${error}`);
    return;
  }
  if (stderr) {
    console.error(`libraryDocGenerator.cjs stderr: ${stderr}`);
    return;
  }
  // eslint-disable-next-line no-console
  console.log(stdout);
});
