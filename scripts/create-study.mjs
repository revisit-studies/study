#!/usr/bin/env node
/**
 * Scaffolds a new study under public/<study-name>/ and registers it in public/global.json.
 * Cross-platform (Windows, macOS, Linux): uses only Node built-ins.
 *
 * Usage:
 *   yarn create-study <study-name> [--title "My Study"] [--author "Jane Doe"] [--no-global] [--force]
 *   yarn create-study            (prompts for the name and title)
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(rootDir, 'public');
const globalPath = path.join(publicDir, 'global.json');

const SCHEMA_URL = 'https://raw.githubusercontent.com/revisit-studies/study/v3.0.0/src/parser/StudyConfigSchema.json';
const NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

function parseArgs(argv) {
  const opts = {
    name: undefined, title: undefined, author: undefined, global: true, force: false, help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--title') { i += 1; opts.title = argv[i]; }
    else if (arg === '--author') { i += 1; opts.author = argv[i]; }
    else if (arg === '--no-global') opts.global = false;
    else if (arg === '--force') opts.force = true;
    else if (arg === '-h' || arg === '--help') opts.help = true;
    else if (arg.startsWith('--')) throw new Error(`Unknown option: ${arg}`);
    else if (opts.name === undefined) opts.name = arg;
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  return opts;
}

function slugify(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/-{2,}/g, '-').replace(/^[-_]+|[-_]+$/g, '');
}

function titleFromName(name) {
  return name.split(/[-_]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

function buildConfig(name, title, author) {
  return {
    $schema: SCHEMA_URL,
    studyMetadata: {
      title,
      version: '1.0',
      authors: [author],
      date: new Date().toISOString().slice(0, 10),
      description: `${title}: a new reVISit study.`,
      organizations: [],
    },
    uiConfig: {
      contactEmail: 'contact@revisit.dev',
      helpTextPath: `${name}/assets/help.md`,
      logoPath: 'revisitAssets/revisitLogoSquare.svg',
      withProgressBar: true,
      autoDownloadStudy: false,
      withSidebar: false,
    },
    components: {
      introduction: {
        type: 'markdown',
        path: `${name}/assets/introduction.md`,
        response: [],
      },
      question: {
        type: 'questionnaire',
        instruction: 'Replace this with your own question.',
        response: [
          {
            id: 'answer',
            prompt: 'Your answer:',
            location: 'belowStimulus',
            type: 'shortText',
            placeholder: 'Enter your answer',
          },
        ],
      },
    },
    sequence: {
      order: 'fixed',
      components: ['introduction', 'question'],
    },
  };
}

function registerInGlobal(name) {
  const global = JSON.parse(fs.readFileSync(globalPath, 'utf8'));
  if (!Array.isArray(global.configsList)) throw new Error('public/global.json has no configsList array.');
  // global.json requires every configsList entry to have a matching configs entry
  const inList = global.configsList.includes(name);
  const inConfigs = global.configs?.[name] !== undefined;
  if (inList && inConfigs) return 'already-registered';
  if (!inList) global.configsList.push(name);
  if (!inConfigs) {
    global.configs = global.configs || {};
    global.configs[name] = { path: `${name}/config.json` };
  }
  fs.writeFileSync(globalPath, `${JSON.stringify(global, null, 2)}\n`);
  return 'registered';
}

async function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try { return (await rl.question(question)).trim(); } finally { rl.close(); }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    // eslint-disable-next-line no-console
    console.log('Usage: yarn create-study <study-name> [--title "Title"] [--author "Name"] [--no-global] [--force]');
    return;
  }

  let { name, title } = opts;
  if (!name) {
    if (!process.stdin.isTTY) throw new Error('A study name is required (yarn create-study <study-name>).');
    name = await prompt('Study name (e.g. "My Study" or my-study): ');
  }
  if (!name) throw new Error('A study name is required.');

  // Turn free-form names like "My Study" into a URL/folder-safe slug ("my-study")
  if (!NAME_PATTERN.test(name)) {
    const slug = slugify(name);
    if (!NAME_PATTERN.test(slug)) {
      throw new Error('Study name must contain at least one letter or digit.');
    }
    if (!title) title = name.trim();
    console.log(`Using folder name "${slug}" for "${name}".`);
    name = slug;
  }
  if (!title && !opts.name) {
    title = await prompt(`Study title [${titleFromName(name)}]: `);
  }
  title = title || titleFromName(name);
  const author = opts.author || 'The reVISit Team';

  const studyDir = path.join(publicDir, name);
  if (fs.existsSync(studyDir) && !opts.force) {
    throw new Error(`public/${name} already exists. Use --force to overwrite its scaffold files.`);
  }

  const assetsDir = path.join(studyDir, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.writeFileSync(path.join(studyDir, 'config.json'), `${JSON.stringify(buildConfig(name, title, author), null, 2)}\n`);
  fs.writeFileSync(path.join(assetsDir, 'introduction.md'), `# ${title}\n\nWelcome! Replace this text with an introduction to your study.\n`);
  fs.writeFileSync(path.join(assetsDir, 'help.md'), '# Help\n\nIf you have any questions, please contact the study designer.\n');

  // eslint-disable-next-line no-console
  console.log(`Created public/${name}/ (config.json, assets/introduction.md, assets/help.md)`);

  if (opts.global) {
    const result = registerInGlobal(name);
    // eslint-disable-next-line no-console
    console.log(result === 'registered'
      ? 'Added to configsList and configs in public/global.json'
      : 'Already listed in public/global.json');
  }
  // eslint-disable-next-line no-console
  console.log(`\nRun "yarn serve" and open http://localhost:8080/${name}`);
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
