import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { generateSequenceArray } from '../../utils/handleRandomSequences';
import {
  compileFactorBlocks, resolveFactorConditions,
} from '../libraryParser';
import { parseStudyConfig } from '../parser';
import {
  ComponentBlock, ParserErrorWarning, StudyConfig,
} from '../types';

function factorConfig(): StudyConfig {
  return {
    $schema: '',
    studyMetadata: {
      title: '', version: '', authors: [], date: '', description: '', organizations: [],
    },
    uiConfig: {
      logoPath: '', contactEmail: '', withProgressBar: true, withSidebar: true, numSequences: 2,
    },
    baseComponents: {
      trial: {
        type: 'react-component', path: 'study/assets/Trial.tsx', response: [],
      },
      confidence: {
        type: 'markdown', path: 'study/assets/confidence.md', response: [],
      },
    },
    components: {},
    factors: {
      a: [1, 2, 3],
      b: ['x', 'y'],
    },
    sequence: {
      type: 'factor', id: 'test', factor: 'a', components: 'trial',
    },
  };
}

describe('factor sequence actions', () => {
  test('concatenates factor conditions in input order', () => {
    expect(resolveFactorConditions({
      action: 'concat',
      factors: ['a', 'b'],
    }, factorConfig().factors!)).toEqual([
      { a: 1 }, { a: 2 }, { a: 3 }, { b: 'x' }, { b: 'y' },
    ]);
  });

  test('repeats the concatenated condition sequence', () => {
    expect(resolveFactorConditions({
      action: 'repeat',
      factors: ['a', 'b'],
      numRepeats: 2,
    }, factorConfig().factors!)).toEqual([
      { a: 1 }, { a: 2 }, { a: 3 }, { b: 'x' }, { b: 'y' },
      { a: 1 }, { a: 2 }, { a: 3 }, { b: 'x' }, { b: 'y' },
    ]);
  });

  test('samples condition groups at participant allocation time', () => {
    const config = factorConfig();
    config.sequence = {
      type: 'factor',
      id: 'sampled',
      factor: { action: 'sample', factors: ['a'], numSamples: 2 },
      components: ['trial', 'confidence'],
    };

    const compiled = compileFactorBlocks(config.sequence, config);
    const sequenceBlock = compiled.sequence as ComponentBlock;
    const sequences = generateSequenceArray({
      ...config,
      sequence: compiled.sequence,
      components: compiled.components,
    });

    expect(sequenceBlock).toMatchObject({ order: 'random', numSamples: 2 });
    expect(sequenceBlock.components).toHaveLength(3);
    sequences.forEach((sequence) => {
      const sampled = sequence.components.slice(0, -1);
      expect(sampled).toHaveLength(4);
      expect(sampled.every((component) => typeof component === 'string')).toBe(true);

      const levels = sampled.map((component) => (
        typeof component === 'string' && 'parameters' in compiled.components[component]
          ? compiled.components[component].parameters?.a
          : undefined
      ));
      expect(levels[0]).toBe(levels[1]);
      expect(levels[2]).toBe(levels[3]);
      expect(levels[0]).not.toBe(levels[2]);
    });
  });

  test('validates repeat and sample counts', () => {
    const errors: ParserErrorWarning[] = [];
    const factors = factorConfig().factors!;

    resolveFactorConditions({
      action: 'repeat', factors: ['a'], numRepeats: 0,
    }, factors, errors, [], 'badRepeat');
    const config = factorConfig();
    config.sequence = {
      type: 'factor',
      id: 'badSample',
      factor: { action: 'sample', factors: ['a'], numSamples: 4 },
      components: 'trial',
    };
    compileFactorBlocks(config.sequence, config, errors);

    expect(errors.map((error) => error.message)).toEqual(expect.arrayContaining([
      'Repeat factor `badRepeat` requires a positive integer numRepeats',
      'Sample factor `badSample` cannot select 4 conditions from 3',
    ]));
  });

  test('rejects sampled factors nested inside another expression', () => {
    const errors: ParserErrorWarning[] = [];

    resolveFactorConditions({
      action: 'cross',
      factors: [
        { action: 'sample', factors: ['a'], numSamples: 2 },
        'b',
      ],
    }, factorConfig().factors!, errors, [], 'nestedSample');

    expect(errors.map((error) => error.message)).toContain(
      'Factor expression `nestedSample` cannot nest a sampled factor',
    );
  });

  test('parses the factor-action demo', async () => {
    const config = readFileSync(
      new URL('../../../public/demo-factors/config.json', import.meta.url),
      'utf8',
    );

    const result = await parseStudyConfig(config);

    expect(result.errors).toEqual([]);
  });
});
