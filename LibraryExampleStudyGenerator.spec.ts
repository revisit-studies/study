import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const require = createRequire(import.meta.url);
const {
  createExampleConfig,
  generateLibraryExamples,
  getLibraries,
} = require('./libraryExampleStudyGenerator.cjs');

describe('libraryExampleStudyGenerator', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    tempDirs.forEach((dir) => {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
    tempDirs.length = 0;
  });

  it('createExampleConfig builds config with expected defaults', () => {
    const config = createExampleConfig('my-lib');

    expect(config.studyMetadata.title).toBe('my-lib Example Study');
    expect(config.importedLibraries).toEqual(['my-lib']);
    expect(config.components.introduction.path).toBe('library-my-lib/assets/my-lib.md');
    expect(config.sequence.components).toEqual(['introduction']);
  });

  it('getLibraries filters hidden entries and .DS_Store entries', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'lib-example-list-'));
    tempDirs.push(base);
    const libsPath = path.join(base, 'public', 'libraries');
    fs.mkdirSync(libsPath, { recursive: true });
    fs.mkdirSync(path.join(libsPath, 'alpha'));
    fs.mkdirSync(path.join(libsPath, '.hidden'));
    fs.writeFileSync(path.join(libsPath, '.DS_Store'), '');

    expect(getLibraries(libsPath)).toEqual(['alpha']);
  });

  it('generateLibraryExamples creates missing example study and invokes doc generation command', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'lib-example-run-'));
    tempDirs.push(base);
    const libraryName = 'alpha';
    const librariesPath = path.join(base, 'public', 'libraries', libraryName);
    fs.mkdirSync(librariesPath, { recursive: true });

    const execFn = vi.fn();
    generateLibraryExamples(base, execFn);

    const examplePath = path.join(base, 'public', `library-${libraryName}`);
    const configPath = path.join(examplePath, 'config.json');
    const assetsPath = path.join(examplePath, 'assets');

    expect(fs.existsSync(examplePath)).toBe(true);
    expect(fs.existsSync(assetsPath)).toBe(true);
    expect(fs.existsSync(configPath)).toBe(true);
    expect(execFn).toHaveBeenCalledTimes(1);
    expect(execFn).toHaveBeenCalledWith('node libraryDocGenerator.cjs', expect.any(Function));
  });

  it('logs an error when doc generator execution returns an error', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'lib-example-error-'));
    tempDirs.push(base);
    fs.mkdirSync(path.join(base, 'public', 'libraries', 'alpha'), { recursive: true });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const execFn = (
      _command: string,
      callback: (error: Error | null, stdout: string, stderr: string) => void,
    ) => callback(new Error('test Error'), '', '');

    generateLibraryExamples(base, execFn);

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Error running libraryDocGenerator.cjs: Error: test Error'));
    errorSpy.mockRestore();
  });

  it('logs stderr when doc generator execution writes to stderr', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'lib-example-stderr-'));
    tempDirs.push(base);
    fs.mkdirSync(path.join(base, 'public', 'libraries', 'alpha'), { recursive: true });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const execFn = (
      _command: string,
      callback: (error: Error | null, stdout: string, stderr: string) => void,
    ) => callback(null, '', 'warning output');

    generateLibraryExamples(base, execFn);

    expect(errorSpy).toHaveBeenCalledWith('libraryDocGenerator.cjs stderr: warning output');
    errorSpy.mockRestore();
  });

  it('logs stdout when doc generator execution succeeds', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'lib-example-stdout-'));
    tempDirs.push(base);
    fs.mkdirSync(path.join(base, 'public', 'libraries', 'alpha'), { recursive: true });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const execFn = (
      _command: string,
      callback: (error: Error | null, stdout: string, stderr: string) => void,
    ) => callback(null, 'generated docs', '');

    generateLibraryExamples(base, execFn);

    expect(logSpy).toHaveBeenCalledWith('generated docs');
    logSpy.mockRestore();
  });
});
