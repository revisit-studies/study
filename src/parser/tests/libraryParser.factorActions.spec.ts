import { readFileSync } from 'node:fs';
import {
  describe, expect, test, vi,
} from 'vitest';
import { generateSequenceArray } from '../../utils/handleRandomSequences';
import { getSequenceFlatMap } from '../../utils/getSequenceFlatMap';
import {
  compileFactorBlocks, createFactorOrderContext, resolveFactorConditions, resolveOrderedFactorConditions,
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
  test('subtracts congruent Stroop conditions from one crossed color factor', () => {
    const factors = {
      color: ['RED', 'GREEN', 'BLUE'],
      stroopConditions: {
        action: 'cross' as const,
        factors: ['color', 'color'],
        as: ['word', 'inkColor'],
      },
    };

    expect(resolveFactorConditions({
      action: 'cross', factors: ['color', 'color'], as: ['word', 'inkColor'],
    }, factors)).toContainEqual({ word: 'RED', inkColor: 'BLUE' });
    expect(resolveFactorConditions({
      action: 'zip', factors: ['color', 'color'],
    }, factors)).toEqual([
      { color_0: 'RED', color_1: 'RED' },
      { color_0: 'GREEN', color_1: 'GREEN' },
      { color_0: 'BLUE', color_1: 'BLUE' },
    ]);
    expect(resolveFactorConditions({
      action: 'remove',
      factor: 'stroopConditions',
      items: { action: 'zip', factors: ['color', 'color'] },
    }, factors)).toEqual([
      { word: 'RED', inkColor: 'GREEN' },
      { word: 'RED', inkColor: 'BLUE' },
      { word: 'GREEN', inkColor: 'RED' },
      { word: 'GREEN', inkColor: 'BLUE' },
      { word: 'BLUE', inkColor: 'RED' },
      { word: 'BLUE', inkColor: 'GREEN' },
    ]);
  });

  test('validates factor as names', () => {
    const errors: ParserErrorWarning[] = [];
    const factors = factorConfig().factors!;

    resolveFactorConditions({
      action: 'cross', factors: ['a', 'b'], as: ['value'],
    }, factors, errors, [], 'wrongLength');
    resolveFactorConditions({
      action: 'zip', factors: ['a', 'b'], as: ['value', 'value'],
    }, factors, errors, [], 'duplicateNames');

    expect(errors.map((error) => error.message)).toEqual(expect.arrayContaining([
      'Factor expression `wrongLength` requires one as name per factor; received 1 names for 2 factors',
      'Factor expression `duplicateNames` requires unique, non-empty as names',
    ]));
  });

  test('renames repeated scalar factor inputs and rejects aliases for object conditions', () => {
    const errors: ParserErrorWarning[] = [];
    const factors: NonNullable<StudyConfig['factors']> = {
      color: ['RED', 'BLUE'],
      trial: [{ word: 'RED', ink: 'BLUE' }],
    };

    expect(resolveFactorConditions({
      action: 'cross', factors: ['color', 'color'], as: ['word', 'ink'],
    }, factors, errors, [], 'stroop')).toEqual([
      { word: 'RED', ink: 'RED' },
      { word: 'RED', ink: 'BLUE' },
      { word: 'BLUE', ink: 'RED' },
      { word: 'BLUE', ink: 'BLUE' },
    ]);
    expect(resolveFactorConditions({
      action: 'cross', factors: ['trial'], as: ['renamedTrial'],
    }, factors, errors, [], 'objectAlias')).toEqual([{ word: 'RED', ink: 'BLUE' }]);

    expect(errors.map((error) => error.message)).toContain(
      'Factor expression `objectAlias` cannot apply as name `renamedTrial` to an input with multiple parameters',
    );
  });

  test('accepts literal factor arrays and preserves primitive value types', () => {
    const factors: NonNullable<StudyConfig['factors']> = {
      labels: ['first', 'second'],
      counts: [1, 2],
      enabled: [true, false],
    };

    expect(resolveFactorConditions({
      action: 'cross', factors: ['labels', 'counts', 'enabled'],
    }, factors)).toEqual([
      { labels: 'first', counts: 1, enabled: true },
      { labels: 'first', counts: 1, enabled: false },
      { labels: 'first', counts: 2, enabled: true },
      { labels: 'first', counts: 2, enabled: false },
      { labels: 'second', counts: 1, enabled: true },
      { labels: 'second', counts: 1, enabled: false },
      { labels: 'second', counts: 2, enabled: true },
      { labels: 'second', counts: 2, enabled: false },
    ]);
  });

  test('rejects parameters on fixed and factor sequence blocks', async () => {
    const fixedBlockConfig = factorConfig();
    fixedBlockConfig.sequence = {
      order: 'fixed',
      parameters: { disallowed: true },
      components: ['trial'],
    } as StudyConfig['sequence'];
    const factorBlockConfig = factorConfig();
    factorBlockConfig.sequence = {
      type: 'factor',
      id: 'disallowedParameters',
      factor: 'a',
      components: 'trial',
      parameters: { disallowed: true },
    } as StudyConfig['sequence'];

    const [fixedResult, factorResult] = await Promise.all([
      parseStudyConfig(JSON.stringify(fixedBlockConfig)),
      parseStudyConfig(JSON.stringify(factorBlockConfig)),
    ]);

    expect(fixedResult.errors.some((error) => (
      'additionalProperty' in error.params && error.params.additionalProperty === 'parameters'
    ))).toBe(true);
    expect(factorResult.errors.some((error) => (
      'additionalProperty' in error.params && error.params.additionalProperty === 'parameters'
    ))).toBe(true);
  });

  test('supports object-valued between-subjects factors and warns about conflicting fields', async () => {
    const config = factorConfig();
    config.factors = {
      taskOrder: [
        { firstTask: 'C1', secondTask: 'C2' },
        { firstTask: 'C2', secondTask: 'C1' },
      ],
      interfaceOrder: [
        { firstInterface: 'FFL', secondInterface: 'LaTeX' },
        { firstInterface: 'LaTeX', secondInterface: 'FFL' },
      ],
      conflictingOrder: [{ firstTask: 'E1' }],
    };
    config.betweenSubjects = ['taskOrder', 'interfaceOrder', 'conflictingOrder'];
    config.sequence = {
      type: 'factor', id: 'objectBetweenSubjects', factor: 'taskOrder', components: 'trial',
    };

    const result = await parseStudyConfig(JSON.stringify(config));

    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        message: 'Between-subjects factors `taskOrder` and `conflictingOrder` assign incompatible values to `firstTask`',
      }),
    ]));
    expect(result.warnings).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ message: expect.stringContaining('taskOrder` must be') }),
      expect.objectContaining({ message: expect.stringContaining('interfaceOrder` must be') }),
    ]));
  });

  test('warns when between-subjects declarations are undefined, derived, empty, or mixed', async () => {
    const config = factorConfig();
    config.factors = {
      valid: ['included'],
      derived: { action: 'concat', factors: ['valid'] },
      empty: [],
      mixed: ['primitive', { paired: 'object' }],
    };
    config.betweenSubjects = ['missing', 'derived', 'empty', 'mixed'];
    config.sequence = {
      type: 'factor', id: 'validTrials', factor: 'valid', components: 'trial',
    };

    const result = await parseStudyConfig(JSON.stringify(config));

    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        instancePath: '/betweenSubjects/0',
        message: 'Between-subjects factor `missing` is not defined in factors',
      }),
      expect.objectContaining({
        instancePath: '/betweenSubjects/1',
        message: 'Between-subjects factor `derived` must be a non-empty factor with either all primitive levels or all object levels',
      }),
      expect.objectContaining({
        instancePath: '/betweenSubjects/2',
        message: 'Between-subjects factor `empty` must be a non-empty factor with either all primitive levels or all object levels',
      }),
      expect.objectContaining({
        instancePath: '/betweenSubjects/3',
        message: 'Between-subjects factor `mixed` must be a non-empty factor with either all primitive levels or all object levels',
      }),
    ]));
  });

  test('validates unused derived factors and warns about incompatible zip inputs', async () => {
    const config = factorConfig();
    config.factors = {
      used: ['shown'],
      short: [1],
      long: [1, 2],
      unusedBadZip: { action: 'zip', factors: ['short', 'long'] },
      unusedMissingReference: { action: 'concat', factors: ['notDefined'] },
      unusedBadKeep: { action: 'keep', factor: 'used' },
      unusedCycleA: { action: 'concat', factors: ['unusedCycleB'] },
      unusedCycleB: { action: 'concat', factors: ['unusedCycleA'] },
    };
    config.sequence = {
      type: 'factor', id: 'usedTrials', factor: 'used', components: 'trial',
    };

    const result = await parseStudyConfig(JSON.stringify(config));

    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        message: 'Circular factor reference: unusedCycleA -> unusedCycleB -> unusedCycleA',
      }),
      expect.objectContaining({ message: 'Factor `notDefined` is not defined' }),
      expect.objectContaining({
        message: 'Keep factor `unusedBadKeep` requires exactly one non-empty condition or items list',
      }),
    ]));
    expect(result.errors).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        message: 'Zip factor `unusedBadZip` requires inputs with equal lengths; received 1, 2',
      }),
    ]));
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        instancePath: '/factors/',
        message: 'Zip factor `unusedBadZip` requires inputs with equal lengths; received 1, 2',
      }),
    ]));
  });

  test('validates keep/remove selectors and nested samples', () => {
    const errors: ParserErrorWarning[] = [];
    const factors = factorConfig().factors!;

    resolveFactorConditions({
      action: 'keep', factor: 'a',
    }, factors, errors, [], 'missingKeepSelector');
    resolveFactorConditions({
      action: 'remove',
      factor: {
        action: 'sample', factors: ['a'], numSamples: 1, samplingStrategy: 'withoutReplacement',
      },
      items: 'a',
    }, factors, errors, [], 'sampledRemove');

    expect(errors.map((error) => error.message)).toEqual(expect.arrayContaining([
      'Keep factor `missingKeepSelector` requires exactly one non-empty condition or items list',
      'Factor expression `sampledRemove` cannot nest a sampled factor',
    ]));
  });

  test('uses another factor as the complete-condition items selector', () => {
    const factors: NonNullable<StudyConfig['factors']> = {
      trials: [
        { stimulus: 'A', guardrail: 'none' },
        { stimulus: 'B', guardrail: 'summary' },
        { stimulus: 'C', guardrail: 'none' },
      ],
      summaryTrials: [{ stimulus: 'B', guardrail: 'summary' }],
    };

    expect(resolveFactorConditions({
      action: 'keep', factor: 'trials', items: 'summaryTrials',
    }, factors)).toEqual([{ stimulus: 'B', guardrail: 'summary' }]);
    expect(resolveFactorConditions({
      action: 'remove', factor: 'trials', items: 'summaryTrials',
    }, factors)).toEqual([
      { stimulus: 'A', guardrail: 'none' },
      { stimulus: 'C', guardrail: 'none' },
    ]);
  });

  test('concatenates factor conditions in input order', () => {
    expect(resolveFactorConditions({
      action: 'concat',
      factors: ['a', 'b'],
    }, factorConfig().factors!)).toEqual([
      { a: 1 }, { a: 2 }, { a: 3 }, { b: 'x' }, { b: 'y' },
    ]);
  });

  test('warns about unequal zip inputs while materializing pairs through the shorter input', async () => {
    const config = factorConfig();
    config.baseComponents = {
      trial: { type: 'markdown', path: 'study/assets/trial.md', response: [] },
    };
    config.factors = {
      left: [1, 2, 3],
      right: ['first', 'second'],
      paired: { action: 'zip', factors: ['left', 'right'] },
    };
    config.sequence = {
      type: 'factor', id: 'pairedTrials', factor: 'paired', components: 'trial',
    };

    const result = await parseStudyConfig(JSON.stringify(config));

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        message: 'Zip factor `paired` requires inputs with equal lengths; received 3, 2',
      }),
    ]));
    expect(result.sequence).toMatchObject({
      components: [
        'pairedTrials__left=1__right=first__trial',
        'pairedTrials__left=2__right=second__trial',
      ],
    });
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

  test('materializes repeated conditions as repeated references to the same generated component', () => {
    const config = factorConfig();
    config.factors = {
      a: [1, 2],
      repeated: { action: 'repeat', factors: ['a'], numRepeats: 2 },
    };
    config.sequence = {
      type: 'factor', id: 'repeated', factor: 'repeated', components: 'trial',
    };

    const compiled = compileFactorBlocks(config.sequence, config);

    expect(compiled.sequence).toMatchObject({
      order: 'fixed',
      components: [
        'repeated__a=1__trial',
        'repeated__a=2__trial',
        'repeated__a=1__trial',
        'repeated__a=2__trial',
      ],
    });
    expect(Object.keys(compiled.components)).toEqual([
      'repeated__a=1__trial',
      'repeated__a=2__trial',
    ]);
  });

  test('orders and samples wrapped factor values once per sequence', () => {
    const factors: NonNullable<StudyConfig['factors']> = {
      tasks: { values: [1, 2, 3], order: 'fixed', numSamples: 2 },
      interfaces: { values: ['FFL', 'LaTeX'], order: 'latinSquare' },
    };

    expect(resolveOrderedFactorConditions('tasks', factors, createFactorOrderContext(0))).toEqual([
      { tasks: 1 }, { tasks: 2 },
    ]);
    expect(resolveOrderedFactorConditions('interfaces', factors, createFactorOrderContext(0))).toEqual([
      { interfaces: 'FFL' }, { interfaces: 'LaTeX' },
    ]);
    expect(resolveOrderedFactorConditions('interfaces', factors, createFactorOrderContext(1))).toEqual([
      { interfaces: 'LaTeX' }, { interfaces: 'FFL' },
    ]);
  });

  test('materializes all ordered-factor levels but shares randomized choices within a sequence', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    const factors: NonNullable<StudyConfig['factors']> = {
      tasks: { values: ['A', 'B', 'C'], order: 'random', numSamples: 2 },
    };
    const context = createFactorOrderContext(0);

    expect(resolveFactorConditions('tasks', factors)).toEqual([
      { tasks: 'A' }, { tasks: 'B' }, { tasks: 'C' },
    ]);
    const firstReference = resolveOrderedFactorConditions('tasks', factors, context);
    const secondReference = resolveOrderedFactorConditions('tasks', factors, context);
    random.mockRestore();

    expect(firstReference).toEqual([{ tasks: 'B' }, { tasks: 'C' }]);
    expect(secondReference).toEqual(firstReference);
  });

  test('validates empty and invalid ordered factor declarations', () => {
    const errors: ParserErrorWarning[] = [];
    const factors: NonNullable<StudyConfig['factors']> = {
      empty: { values: [] },
      tooMany: { values: ['A', 'B'], numSamples: 3 },
      fractional: { values: ['A', 'B'], numSamples: 1.5 },
    };

    resolveFactorConditions('empty', factors, errors);
    resolveFactorConditions('tooMany', factors, errors);
    resolveFactorConditions('fractional', factors, errors);

    expect(errors.map((error) => error.message)).toEqual(expect.arrayContaining([
      'Factor `empty` must contain at least one value',
      'Factor `tooMany` numSamples must be between 1 and 2',
      'Factor `fractional` numSamples must be between 1 and 2',
    ]));
  });

  test('samples condition groups at participant allocation time', () => {
    const config = factorConfig();
    config.sequence = {
      type: 'factor',
      id: 'sampled',
      factor: {
        action: 'sample', factors: ['a'], numSamples: 2, samplingStrategy: 'withoutReplacement',
      },
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

  test('samples with replacement at participant allocation time', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    const config = factorConfig();
    config.sequence = {
      type: 'factor',
      id: 'resampled',
      factor: {
        action: 'sample', factors: ['a'], numSamples: 4, samplingStrategy: 'withReplacement',
      },
      components: 'trial',
    };

    const compiled = compileFactorBlocks(config.sequence, config);
    const sequences = generateSequenceArray({
      ...config,
      sequence: compiled.sequence,
      components: compiled.components,
    });
    random.mockRestore();

    expect(sequences).toHaveLength(2);
    sequences.forEach((sequence) => {
      const sampled = sequence.components.slice(0, -1);
      expect(sampled).toHaveLength(4);
      expect(new Set(sampled)).toHaveLength(1);
    });
  });

  test('keeps coupled base components together for Latin-square factor selections', () => {
    const config = factorConfig();
    config.uiConfig.numSequences = 3;
    config.factors = {
      task: { values: ['A', 'B', 'C'], order: 'latinSquare', numSamples: 2 },
    };
    config.sequence = {
      type: 'factor', id: 'counterbalancedTasks', factor: 'task', components: ['trial', 'confidence'],
    };

    const compiled = compileFactorBlocks(config.sequence, config);
    const sequenceBlock = compiled.sequence as ComponentBlock;
    const sequences = generateSequenceArray({
      ...config,
      sequence: compiled.sequence,
      components: compiled.components,
    });

    expect(sequenceBlock).toMatchObject({
      type: 'factor-runtime-plan', id: 'counterbalancedTasks', order: 'fixed', components: [],
    });
    expect(sequences.map((sequence) => sequence.components.slice(0, -1))).toEqual([
      [
        'counterbalancedTasks__task=A__trial',
        'counterbalancedTasks__task=A__confidence',
        'counterbalancedTasks__task=B__trial',
        'counterbalancedTasks__task=B__confidence',
      ],
      [
        'counterbalancedTasks__task=B__trial',
        'counterbalancedTasks__task=B__confidence',
        'counterbalancedTasks__task=C__trial',
        'counterbalancedTasks__task=C__confidence',
      ],
      [
        'counterbalancedTasks__task=C__trial',
        'counterbalancedTasks__task=C__confidence',
        'counterbalancedTasks__task=A__trial',
        'counterbalancedTasks__task=A__confidence',
      ],
    ]);
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
      factor: {
        action: 'sample', factors: ['a'], numSamples: 4, samplingStrategy: 'withoutReplacement',
      },
      components: 'trial',
    };
    compileFactorBlocks(config.sequence, config, errors);

    expect(errors.map((error) => error.message)).toEqual(expect.arrayContaining([
      'Repeat factor `badRepeat` requires a positive integer numRepeats',
      'Sample factor `badSample` cannot select 4 conditions from 3',
    ]));
  });

  test('reports undefined, empty, and malformed factor expressions', () => {
    const errors: ParserErrorWarning[] = [];
    const factors = factorConfig().factors!;

    resolveFactorConditions('missing', factors, errors);
    resolveFactorConditions({ action: 'cross', factors: [] }, factors, errors, [], 'emptyCross');
    resolveFactorConditions({
      action: 'sample',
      factors: ['a'],
      numSamples: 1,
      samplingStrategy: 'invalid' as unknown as 'withoutReplacement',
    }, factors, errors, [], 'invalidStrategy');

    expect(errors.map((error) => error.message)).toEqual(expect.arrayContaining([
      'Factor `missing` is not defined',
      'Factor expression `emptyCross` must reference at least one factor',
      'Sample factor `invalidStrategy` requires samplingStrategy to be withoutReplacement or withReplacement',
    ]));
  });

  test('preserves factor block controls and reports missing base components', () => {
    const config = factorConfig();
    config.sequence = {
      type: 'factor',
      id: 'controlled',
      factor: 'a',
      components: ['trial', 'missing'],
      order: 'random',
      conditional: true,
      interruptions: [{
        spacing: 'random', numInterruptions: 1, components: ['break'],
      }],
      skip: [{
        check: 'block', condition: 'numIncorrect', value: 1, to: 'end',
      }],
    };
    const errors: ParserErrorWarning[] = [];

    const compiled = compileFactorBlocks(config.sequence, config, errors);

    expect(compiled.sequence).toMatchObject({
      id: 'controlled',
      order: 'random',
      conditional: true,
      interruptions: [{
        spacing: 'random', numInterruptions: 1, components: ['break'],
      }],
      skip: [{
        check: 'block', condition: 'numIncorrect', value: 1, to: 'end',
      }],
    });
    expect(Object.keys(compiled.components)).toEqual([
      'controlled__a=1__trial',
      'controlled__a=2__trial',
      'controlled__a=3__trial',
    ]);
    expect(errors.map((error) => error.message)).toContain(
      'Factor block `controlled` references undefined base component `missing`',
    );
  });

  test('reports factor-generated component ID collisions with configured components', () => {
    const config = factorConfig();
    config.components = {
      'test__a=1__trial': {
        type: 'markdown', path: 'study/assets/already-used.md', response: [],
      },
    };
    const errors: ParserErrorWarning[] = [];

    compileFactorBlocks(config.sequence, config, errors);

    expect(errors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        instancePath: '/sequence/',
        message: 'Generated component ID `test__a=1__trial` is already used by another component',
      }),
    ]));
  });

  test('reports a factor block that samples conditions and also declares an order', () => {
    const config = factorConfig();
    config.sequence = {
      type: 'factor',
      id: 'sampleWithBlockOrder',
      factor: {
        action: 'sample', factors: ['a'], numSamples: 1, samplingStrategy: 'withoutReplacement',
      },
      components: 'trial',
      order: 'fixed',
    };
    const errors: ParserErrorWarning[] = [];

    compileFactorBlocks(config.sequence, config, errors);

    expect(errors.map((error) => error.message)).toContain(
      'Factor block `sampleWithBlockOrder` materializes a sample and cannot also define `order`',
    );
  });

  test('warns when a valid factor selector produces an empty sequence block', async () => {
    const config = factorConfig();
    config.factors = {
      trials: [{ stimulus: 'A' }],
      noMatchingTrials: {
        action: 'keep', factor: 'trials', condition: { stimulus: 'not-present' },
      },
    };
    config.sequence = {
      type: 'factor', id: 'noMatchingTrials', factor: 'noMatchingTrials', components: 'trial',
    };

    const result = await parseStudyConfig(JSON.stringify(config));

    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        instancePath: '/sequence/',
        message: 'Sequence has an empty components array',
      }),
    ]));
  });

  test('rejects order on a sample action', async () => {
    const config = factorConfig();
    config.sequence = {
      type: 'factor',
      id: 'orderedSample',
      factor: {
        action: 'sample', factors: ['a'], numSamples: 1, samplingStrategy: 'withoutReplacement', order: 'random',
      },
      components: 'trial',
    } as unknown as StudyConfig['sequence'];

    const result = await parseStudyConfig(JSON.stringify(config));

    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        params: expect.objectContaining({ additionalProperty: 'order' }),
      }),
    ]));
  });

  test('rejects sampled factors nested inside another expression', () => {
    const errors: ParserErrorWarning[] = [];

    resolveFactorConditions({
      action: 'cross',
      factors: [
        {
          action: 'sample', factors: ['a'], numSamples: 2, samplingStrategy: 'withoutReplacement',
        },
        'b',
      ],
    }, factorConfig().factors!, errors, [], 'nestedSample');

    expect(errors.map((error) => error.message)).toContain(
      'Factor expression `nestedSample` cannot nest a sampled factor',
    );
  });

  test('parses the factor-action demo', async () => {
    const config = readFileSync(
      'public/demo-factors/config.json',
      'utf8',
    );

    const result = await parseStudyConfig(config);

    expect(result.errors).toEqual([]);
  });

  test('uses subtract to produce 90 incongruent Stroop trials', async () => {
    const config = readFileSync(
      'public/demo-stroop-factors/config.json',
      'utf8',
    );

    const result = await parseStudyConfig(config);
    const rootSequence = result.sequence as ComponentBlock;
    const trialSequence = rootSequence.components[1] as ComponentBlock;
    const redWordBlueInkId = 'stroopTrials__word=RED__inkColor=BLUE__stroopTrial';

    expect(result.errors).toEqual([]);
    expect(trialSequence).toMatchObject({
      id: 'stroopTrials',
      order: 'random',
    });
    expect(trialSequence.components).toHaveLength(90);
    expect(trialSequence.components.filter((componentId) => {
      if (typeof componentId !== 'string' || !('parameters' in result.components[componentId])) {
        return false;
      }
      const { parameters } = result.components[componentId];
      return parameters?.word === parameters?.inkColor;
    })).toEqual([]);
    expect(result.components[redWordBlueInkId]).toMatchObject({
      parameters: {
        word: 'RED',
        inkColor: 'BLUE',
      },
      correctAnswer: [{
        id: 'response',
        answer: 'BLUE',
      }],
    });
  });

  test('parses the factorized visualization guardrails demo', async () => {
    const config = readFileSync(
      'public/demo-max-study2/config.json',
      'utf8',
    );

    const result = await parseStudyConfig(config);
    const generatedTrials = Object.values(result.components).filter((component) => (
      'parameters' in component
      && component.parameters?.studyArm !== undefined
      && component.parameters?.guardrail !== undefined
    ));

    expect(result.errors).toEqual([]);
    expect(generatedTrials).toHaveLength(427);
    expect(Object.values(result.factors || {}).filter((factor) => (
      !Array.isArray(factor) && 'action' in factor && factor.action === 'sample'
    ))).toHaveLength(20);
    expect(new Set(generatedTrials.map((component) => (
      'parameters' in component ? component.parameters?.studyArm : undefined
    )))).toEqual(new Set(['viral-a', 'viral-b', 'stock-a', 'stock-b']));

    const sequences = generateSequenceArray({
      ...result,
      uiConfig: { ...result.uiConfig, numSequences: 4 },
    });
    expect(sequences).toHaveLength(4);
    sequences.forEach((sequence) => {
      const componentIds = getSequenceFlatMap(sequence);
      const participantTrials = componentIds.filter((componentId) => {
        const component = result.components[componentId];
        return component && 'parameters' in component
          && component.parameters?.guardrail !== undefined;
      });
      const studyArms = participantTrials.map((componentId) => {
        const component = result.components[componentId];
        return 'parameters' in component ? component.parameters?.studyArm : undefined;
      });
      const guardrails = participantTrials.map((componentId) => {
        const component = result.components[componentId];
        return 'parameters' in component ? component.parameters?.guardrail : undefined;
      });

      expect(participantTrials).toHaveLength(5);
      expect(new Set(studyArms).size).toBe(1);
      expect(new Set(guardrails)).toEqual(new Set([
        'none', 'super_data', 'super_summ', 'juxt_data', 'juxt_summ',
      ]));
      expect(componentIds.filter((componentId) => componentId.endsWith('-check-month'))).toHaveLength(1);
      expect(componentIds.filter((componentId) => componentId.endsWith('-check-text'))).toHaveLength(1);
    });

    const sourceTrial = generatedTrials.find((component) => (
      'parameters' in component
      && component.parameters?.stimulusId === '55b688fafdf99b26e287abd3-viral-a-n'
    ));
    expect(sourceTrial).toMatchObject({
      instruction: 'You need to travel to **Eldoril North (Policy A)** for work. Review the visualization and caption, then answer based solely on this information.',
      parameters: {
        guardrail: 'none',
        initialSelection: [
          'Eldoril North', 'Aerion South', 'Aerion West', 'Thundoril North',
        ],
        caption: 'These policy B counties have similar or higher peaks to policy A',
        studyArm: 'viral-a',
      },
      response: expect.arrayContaining([
        expect.objectContaining({
          id: 'action',
          prompt: 'Before traveling to **Eldoril North (Policy A)**, I would buy this much insurance ($0 = no risk, $100 = very high risk):',
        }),
        expect.objectContaining({
          id: 'support',
          prompt: 'The visualization supports the idea that Policy A is a great containment strategy:',
        }),
      ]),
    });
  });

  test('uses a Latin-square factor to select 50 visualization-complexity stimuli', async () => {
    const config = readFileSync(
      'public/demo-visualization-complexity/config.json',
      'utf8',
    );
    const result = await parseStudyConfig(config);
    const sequences = generateSequenceArray({
      ...result,
      uiConfig: { ...result.uiConfig, numSequences: 3 },
    });

    expect(result.errors).toEqual([]);
    expect(result.factors?.stimulusNumber).toMatchObject({
      order: 'latinSquare', numSamples: 50,
    });
    expect(sequences).toHaveLength(3);
    sequences.forEach((sequence, sequenceIndex) => {
      const stimulusNumbers = getSequenceFlatMap(sequence).flatMap((componentId) => {
        const component = result.components[componentId];
        return component?.type === 'react-component'
          ? [component.parameters?.stimulusNumber]
          : [];
      });

      expect(stimulusNumbers).toHaveLength(50);
      expect(stimulusNumbers).toEqual(Array.from(
        { length: 50 },
        (_, index) => sequenceIndex + index + 1,
      ));
    });
  });

  test('assigns distinct serialization formats to CONFIG and TABULAR task sets', async () => {
    const config = readFileSync(
      'public/demo-dsf-study/config.json',
      'utf8',
    );
    const result = await parseStudyConfig(config);
    const sequences = generateSequenceArray({
      ...result,
      uiConfig: { ...result.uiConfig, numSequences: 12 },
    });

    expect(result.errors).toEqual([]);
    expect(sequences).toHaveLength(12);
    sequences.forEach((sequence) => {
      const taskParameters = getSequenceFlatMap(sequence).flatMap((componentId) => {
        const component = result.components[componentId];
        if (component?.type !== 'react-component') {
          return [];
        }
        return [component.parameters];
      });
      const configTasks = taskParameters.filter((parameters) => parameters?.dataContext === 'config');
      const tabularTasks = taskParameters.filter((parameters) => parameters?.dataContext === 'tabular');

      expect(configTasks).toHaveLength(3);
      expect(tabularTasks).toHaveLength(3);
      expect(new Set(configTasks.map((parameters) => parameters?.taskType))).toEqual(
        new Set(['reading', 'authoring', 'modifying']),
      );
      expect(new Set(tabularTasks.map((parameters) => parameters?.taskType))).toEqual(
        new Set(['reading', 'authoring', 'modifying']),
      );
      expect(configTasks[0]?.format).not.toBe(tabularTasks[0]?.format);
    });
  });

  test('parses the counterbalanced FFL authoring study demo', async () => {
    const config = readFileSync(
      'public/demo-ffl-study/config.json',
      'utf8',
    );
    const result = await parseStudyConfig(config);
    const sequences = generateSequenceArray({
      ...result,
      uiConfig: { ...result.uiConfig, numSequences: 4 },
    });

    expect(result.errors).toEqual([]);
    expect(sequences).toHaveLength(4);
    sequences.forEach((sequence) => {
      const timedTasks = getSequenceFlatMap(sequence).flatMap((componentId) => {
        const component = result.components[componentId];
        if (
          !component
          || component.type !== 'react-component'
          || component.parameters?.taskCode === 'Exploratory'
        ) {
          return [];
        }
        return [[component.parameters?.taskCode, component.parameters?.interfaceName]];
      });

      expect(timedTasks.map(([taskCode]) => taskCode)).toEqual(
        expect.arrayContaining(['C1', 'C2', 'E1', 'E2']),
      );
      expect(timedTasks).toHaveLength(4);
      const interfaceByTask = Object.fromEntries(timedTasks);
      expect(interfaceByTask.C1).toBe(interfaceByTask.E1);
      expect(interfaceByTask.C2).toBe(interfaceByTask.E2);
      expect(new Set(Object.values(interfaceByTask))).toEqual(new Set(['FFL', 'LaTeX']));
    });
  });
});
