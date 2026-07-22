import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

const require = createRequire(import.meta.url);
const { generateMd, generateLibraryDocs, getLibraries } = require('./libraryDocGenerator.cjs');

describe('libraryDocGenerator', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    tempDirs.forEach((dir) => {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
    tempDirs.length = 0;
  });

  it('generateMd includes components, sequences, and reference sections', () => {
    const md = generateMd('demo-lib', {
      description: 'Demo description',
      reference: 'Some reference',
      doi: '10.1000/xyz',
      externalLink: 'https://example.com',
      components: { beta: {}, alpha: {} },
      sequences: { second: {}, first: {} },
      additionalDescription: 'Extra details',
    }, true);

    expect(md).toContain('# demo-lib');
    expect(md).toContain('## Available Components');
    expect(md).toContain('- alpha');
    expect(md).toContain('- beta');
    expect(md).toContain('## Available Sequences');
    expect(md).toContain('- first');
    expect(md).toContain('- second');
    expect(md).toContain('## Reference');
    expect(md).toContain('https://dx.doi.org/10.1000/xyz');
    expect(md).toContain('## Additional Description');
  });

  it('generateMd handles example reference text and external-link-only docs links', () => {
    const exampleMd = generateMd('demo-lib', {
      description: 'Demo description',
      reference: 'Some reference',
      components: {},
      sequences: {},
    }, false);

    expect(exampleMd).toContain('This is a demo of the library `demo-lib`.');
    expect(exampleMd).toContain('Some reference');
    expect(exampleMd).not.toContain(':::note[Reference]');

    const docsMd = generateMd('demo-lib', {
      description: 'Demo description',
      externalLink: 'https://example.com',
      components: {},
      sequences: {},
    }, true);

    expect(docsMd).toContain('referenceLinks={[');
    expect(docsMd).toContain('{name: "demo-lib", url: "https://example.com"}');
    expect(docsMd).not.toContain('{name: "DOI"');

    const docsWithDoiOnly = generateMd('demo-lib', {
      description: 'Demo description',
      doi: '10.1000/xyz',
      components: {},
      sequences: {},
    }, true);

    expect(docsWithDoiOnly).toContain('{name: "DOI", url: "https://dx.doi.org/10.1000/xyz"}');
    expect(docsWithDoiOnly).not.toContain('{name: "demo-lib", url:');
  });

  it('getLibraries filters hidden entries and .DS_Store entries', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'lib-doc-list-'));
    tempDirs.push(base);
    const libsPath = path.join(base, 'public', 'libraries');
    fs.mkdirSync(libsPath, { recursive: true });
    fs.mkdirSync(path.join(libsPath, 'alpha'));
    fs.mkdirSync(path.join(libsPath, '.hidden'));
    fs.writeFileSync(path.join(libsPath, '.DS_Store'), '');

    expect(getLibraries(libsPath)).toEqual(['alpha']);
  });

  it('generateLibraryDocs writes docs and example markdown when assets folder exists', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'lib-doc-run-'));
    tempDirs.push(base);
    const libraryName = 'alpha';
    const librariesPath = path.join(base, 'public', 'libraries', libraryName);
    const exampleAssetsPath = path.join(base, 'public', `library-${libraryName}`, 'assets');

    fs.mkdirSync(librariesPath, { recursive: true });
    fs.mkdirSync(exampleAssetsPath, { recursive: true });
    fs.writeFileSync(
      path.join(librariesPath, 'config.json'),
      JSON.stringify({
        description: 'Alpha description',
        components: { compA: {} },
        sequences: {},
      }),
    );

    generateLibraryDocs(base);

    const docsOut = path.join(base, 'docsLibraries', `${libraryName}.md`);
    const exampleOut = path.join(exampleAssetsPath, `${libraryName}.md`);

    expect(fs.existsSync(docsOut)).toBe(true);
    expect(fs.existsSync(exampleOut)).toBe(true);
    expect(fs.readFileSync(docsOut, 'utf8')).toContain('# alpha');
    expect(fs.readFileSync(exampleOut, 'utf8')).toContain('# alpha');
    expect(fs.readFileSync(exampleOut, 'utf8')).toContain('This is a demo');
  });

  it('preserves an existing example study title while regenerating its content', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'lib-doc-title-'));
    tempDirs.push(base);
    const libraryName = 'alpha';
    const librariesPath = path.join(base, 'public', 'libraries', libraryName);
    const exampleAssetsPath = path.join(base, 'public', `library-${libraryName}`, 'assets');

    fs.mkdirSync(librariesPath, { recursive: true });
    fs.mkdirSync(exampleAssetsPath, { recursive: true });
    fs.writeFileSync(
      path.join(librariesPath, 'config.json'),
      JSON.stringify({
        description: 'Updated description',
        components: {},
        sequences: {},
      }),
    );
    fs.writeFileSync(
      path.join(exampleAssetsPath, `${libraryName}.md`),
      '# Custom Alpha Title\n\nOld description',
    );

    generateLibraryDocs(base);

    const docsOutput = fs.readFileSync(path.join(base, 'docsLibraries', `${libraryName}.md`), 'utf8');
    const exampleOutput = fs.readFileSync(path.join(exampleAssetsPath, `${libraryName}.md`), 'utf8');
    expect(docsOutput).toContain('# alpha');
    expect(docsOutput).not.toContain('# Custom Alpha Title');
    expect(exampleOutput).toContain('# Custom Alpha Title');
    expect(exampleOutput).toContain('Updated description');
    expect(exampleOutput).not.toContain('Old description');
  });
});
