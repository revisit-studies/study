/* eslint-disable @typescript-eslint/no-var-requires */

// This script generates example study configurations for each library in the public/libraries directory
// It creates a new directory for each library (library-{name}) with a basic config.json and an assets folder
// This script will skip generating example configs for libraries that already have a library-{name} folder
// For example, if library-demographics already exists, it will skip creating a new one


const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Path to the libraries directory containing reusable components and sequences
const librariesPath = path.join(__dirname, './public/libraries');
const publicPath = path.join(__dirname, './public');

// Create example study config template
const createExampleConfig = (libraryName) => ({
  "$schema": "https://raw.githubusercontent.com/revisit-studies/study/v2.0.0-rc4/src/parser/StudyConfigSchema.json",
  "studyMetadata": {
    "title": `${libraryName} Example Study`,
    "version": "1.0.0",
    "authors": ["reVISit Team"],
    "date": new Date().toISOString().split('T')[0],
    "description": `Example study using the ${libraryName} library.`,
    "organizations": ["University of Utah", "WPI", "University of Toronto"]
  },
  "uiConfig": {
    "contactEmail": "",
    "logoPath": "revisitAssets/revisitLogoSquare.svg",
    "withProgressBar": true,
    "sidebar": true
  },
  "importedLibraries": [libraryName],
  "components": {
    "introduction": {
      "type": "markdown",
      "path": `library-${libraryName}/assets/${libraryName}.md`,
      "response": []
    }
  },
  "sequence": {
    "order": "fixed",
    "components": [
      "introduction"
    ]
  }
});

// Process each library
const libraries = fs.readdirSync(librariesPath);
libraries.forEach((library) => {
  // Skip hidden folders and files
  if (library.startsWith('.')) return;

  const exampleFolderName = `library-${library}`;
  const examplePath = path.join(publicPath, exampleFolderName);

  // Check if example folder already exists
  if (!fs.existsSync(examplePath)) {
    // Create the example folder
    fs.mkdirSync(examplePath);
    console.log(`Created ${exampleFolderName} directory`);

    // Create assets directory
    const assetsPath = path.join(examplePath, 'assets');
    fs.mkdirSync(assetsPath);
    console.log(`Created ${exampleFolderName}/assets directory`);

    // Create config.json
    const configPath = path.join(examplePath, 'config.json');
    const configContent = createExampleConfig(library);
    fs.writeFileSync(configPath, JSON.stringify(configContent, null, 2));
    console.log(`Created ${exampleFolderName}/config.json`);
  } else {
    console.log(`Skipping ${exampleFolderName} - already exists`);
  }
});

console.log('Library example generation complete');

// Run libraryDocGenerator.cjs after example generation
// To generate the library.md files which will be placed in the assets/ folder of each example study for the introduction component
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
  console.log(stdout);
}); 