/**
 * Generates the full study config.json for A3-Study-2ndTry.
 *
 * Usage: node generateStudyConfig.cjs
 *
 * Reads datasets.json and produces config.json with 40 trial components
 * (20 line charts + 20 colorfields, half permuted each) plus intro/consent.
 */

const fs = require('fs');
const path = require('path');

const FULL_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const datasetsPath = path.join(__dirname, 'src/public/A3-Study-2ndTry/assets/datasets.json');
const outputPath = path.join(__dirname, 'public/A3-Study-2ndTry/config.json');

const datasets = JSON.parse(fs.readFileSync(datasetsPath, 'utf-8'));

// --- Static parts of the config ---

const config = {
  $schema: 'https://raw.githubusercontent.com/revisit-studies/study/v2.3.2/src/parser/StudyConfigSchema.json',
  studyMetadata: {
    title: 'A3 Study: Identifying the month with the highest mean',
    version: 'pilot',
    authors: ['The Averagers'],
    date: '2026-02-10',
    description: 'A3 Study',
    organizations: ['WPI'],
  },
  uiConfig: {
    contactEmail: 'contact@revisit.dev',
    helpTextPath: 'A3-Study-2ndTry/assets/help.md',
    logoPath: 'revisitAssets/revisitLogoSquare.svg',
    withProgressBar: true,
    autoDownloadStudy: false,
    withSidebar: true,
  },
  baseComponents: {},
  components: {},
  sequence: {},
};

// --- Shared response definition ---

const monthDropdownResponse = [
  {
    id: 'cm-response',
    prompt: 'Answer:',
    location: 'sidebar',
    type: 'dropdown',
    placeholder: 'Please select an option',
    options: FULL_MONTH_NAMES,
  },
];

// --- Base components ---

config.baseComponents = {
  LineChartNonPermuted: {
    meta: { chart: 'line chart', permuted: false },
    description: 'A non-permuted line chart',
    instruction: 'The graph shows a line chart. Which month do you believe has the highest average value?',
    type: 'react-component',
    path: 'A3-Study-2ndTry/assets/LineChart.tsx',
    parameters: { permuted: false },
    response: monthDropdownResponse,
    nextButtonLocation: 'sidebar',
    instructionLocation: 'sidebar',
  },
  LineChartPermuted: {
    meta: { chart: 'line chart', permuted: true },
    description: 'A permuted line chart',
    instruction: 'The graph shows a line chart. Which month do you believe has the highest average value?',
    type: 'react-component',
    path: 'A3-Study-2ndTry/assets/LineChart.tsx',
    parameters: { permuted: true },
    response: monthDropdownResponse,
    nextButtonLocation: 'sidebar',
    instructionLocation: 'sidebar',
  },
  ColorfieldNonPermuted: {
    meta: { chart: 'colorfield', permuted: false },
    description: 'A non-permuted colorfield',
    instruction: 'The graph shows a colorfield. Using the scale given, which month do you believe has the highest average value?',
    type: 'react-component',
    path: 'A3-Study-2ndTry/assets/Colorfield.tsx',
    parameters: { permuted: false },
    response: monthDropdownResponse,
    nextButtonLocation: 'sidebar',
    instructionLocation: 'sidebar',
  },
  ColorfieldPermuted: {
    meta: { chart: 'colorfield', permuted: true },
    description: 'A permuted colorfield',
    instruction: 'The graph shows a colorfield. Using the scale given, which month do you believe has the highest average value?',
    type: 'react-component',
    path: 'A3-Study-2ndTry/assets/Colorfield.tsx',
    parameters: { permuted: true },
    response: monthDropdownResponse,
    nextButtonLocation: 'sidebar',
    instructionLocation: 'sidebar',
  },
};

// --- Fixed components (intro + consent) ---

config.components.introduction = {
  type: 'markdown',
  path: 'A3-Study-2ndTry/assets/introduction.md',
  response: [],
};

config.components.consent = {
  type: 'markdown',
  path: 'A3-Study-2ndTry/assets/consent-cm.md',
  nextButtonText: 'Agree',
  response: [
    {
      id: 'signature',
      prompt: 'Your signature',
      location: 'belowStimulus',
      type: 'shortText',
      placeholder: 'Please provide your signature',
    },
    {
      id: 'accept',
      prompt: 'Do you consent to the study and wish to continue?',
      requiredValue: 'Accept',
      location: 'belowStimulus',
      type: 'radio',
      options: ['Decline', 'Accept'],
    },
  ],
};

// --- Generate 40 trial components ---
// Datasets 0-9: line chart non-permuted
// Datasets 10-19: line chart permuted
// Datasets 20-29: colorfield non-permuted
// Datasets 30-39: colorfield permuted

const trialNames = [];

for (let i = 0; i < 40; i++) {
  const dataset = datasets[i];
  const correctMonth = FULL_MONTH_NAMES[dataset.meta.winningMonth];

  let baseName;
  let compName;

  if (i < 10) {
    baseName = 'LineChartNonPermuted';
    compName = `line-np-${String(i).padStart(2, '0')}`;
  } else if (i < 20) {
    baseName = 'LineChartPermuted';
    compName = `line-p-${String(i - 10).padStart(2, '0')}`;
  } else if (i < 30) {
    baseName = 'ColorfieldNonPermuted';
    compName = `cf-np-${String(i - 20).padStart(2, '0')}`;
  } else {
    baseName = 'ColorfieldPermuted';
    compName = `cf-p-${String(i - 30).padStart(2, '0')}`;
  }

  config.components[compName] = {
    baseComponent: baseName,
    parameters: { datasetIndex: i },
    correctAnswer: [{ id: 'cm-response', answer: correctMonth }],
  };

  trialNames.push(compName);
}

// --- Sequence: fixed intro/consent, then randomized trials ---

config.sequence = {
  order: 'fixed',
  components: [
    'introduction',
    'consent',
    {
      order: 'random',
      components: trialNames,
    },
  ],
};

// --- Write output ---

fs.writeFileSync(outputPath, JSON.stringify(config, null, 2));
console.log(`Wrote config with ${trialNames.length} trial components to ${outputPath}`);
console.log(`Trial names: ${trialNames.join(', ')}`);
