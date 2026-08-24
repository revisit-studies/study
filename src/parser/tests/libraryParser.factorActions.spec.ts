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

  test('applies aliases when selecting factor conditions', () => {
    const factors = {
      color: ['RED', 'GREEN', 'BLUE'],
      stroopConditions: {
        action: 'cross' as const,
        factors: ['color', 'color'],
        as: ['word', 'inkColor'],
      },
    };

    expect(resolveFactorConditions({
      action: 'keep',
      factor: 'stroopConditions',
      condition: { word: 'RED' },
    }, factors)).toEqual([
      { word: 'RED', inkColor: 'RED' },
      { word: 'RED', inkColor: 'GREEN' },
      { word: 'RED', inkColor: 'BLUE' },
    ]);
  });

  test('rejects aliases for repeated multi-value inputs', () => {
    const errors: ParserErrorWarning[] = [];

    resolveFactorConditions({
      action: 'cross',
      factors: [
        { action: 'cross', factors: ['a', 'a'] },
        'b',
      ],
      as: ['repeated', 'other'],
    }, factorConfig().factors!, errors, [], 'nestedAlias');

    expect(errors.map((error) => error.message)).toContain(
      'Factor expression `nestedAlias` cannot apply as name `repeated` to an input with multiple parameters',
    );
  });

  test('rejects sampling after a selector removes every condition', () => {
    const errors: ParserErrorWarning[] = [];

    resolveFactorConditions({
      action: 'sample',
      factors: [{ action: 'keep', factor: 'a', condition: { a: 99 } }],
      numSamples: 1,
      samplingStrategy: 'withReplacement',
    }, factorConfig().factors!, errors, [], 'emptySample');

    expect(errors.map((error) => error.message)).toContain(
      'Sample factor `emptySample` cannot sample from an empty condition set',
    );
  });

  test('allocates mixed primitive between-subjects levels', () => {
    const config = factorConfig();
    config.factors = { arm: [0, 'control'] };
    config.betweenSubjects = ['arm'];
    config.components = {
      numericArm: {
        type: 'markdown', path: 'numeric.md', response: [], parameters: { arm: 0 },
      },
      stringArm: {
        type: 'markdown', path: 'string.md', response: [], parameters: { arm: 'control' },
      },
    };
    config.sequence = { order: 'fixed', components: ['numericArm', 'stringArm'] };

    const sequences = generateSequenceArray(config);

    expect(sequences.map((sequence) => sequence.parameters?.arm)).toEqual([0, 'control']);
    expect(sequences.map((sequence) => sequence.components[0])).toEqual(['numericArm', 'stringArm']);
  });

  test('filters between-subjects levels before factor sampling', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    const config = factorConfig();
    config.factors = {
      arm: ['A', 'B'],
      stimulus: ['x', 'y'],
      trials: { action: 'cross', factors: ['arm', 'stimulus'] },
    };
    config.betweenSubjects = ['arm'];
    config.sequence = {
      type: 'factor',
      id: 'sampledTrials',
      factor: {
        action: 'sample', factors: ['trials'], numSamples: 1, samplingStrategy: 'withoutReplacement',
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
      expect(sampled).toHaveLength(1);
      expect(compiled.components[sampled[0] as string]).toMatchObject({
        parameters: { arm: sequence.parameters?.arm },
      });
    });
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

  test('validates keep/remove selectors and materializes nested samples in factor blocks', () => {
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
      'Sample factor `sampledRemove` must be materialized by a factor block',
    ]));
  });

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

  test('evaluates nested sampled factors from the inner factor outward', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    const config = factorConfig();
    config.uiConfig.numSequences = 1;
    config.sequence = {
      type: 'factor',
      id: 'nestedSample',
      factor: {
        action: 'cross',
        factors: [
          {
            action: 'sample', factors: ['a'], numSamples: 2, samplingStrategy: 'withoutReplacement',
          },
          'b',
        ],
      },
      components: 'trial',
    };

    const errors: ParserErrorWarning[] = [];
    const compiled = compileFactorBlocks(config.sequence, config, errors);
    expect(errors).toEqual([]);
    expect(compiled.sequence).toMatchObject({ type: 'factor-runtime-plan', id: 'nestedSample' });
    expect(Object.keys(compiled.components)).toHaveLength(6);

    const sequences = generateSequenceArray({
      ...config,
      sequence: compiled.sequence,
      components: compiled.components,
    });
    random.mockRestore();

    expect(sequences).toHaveLength(1);
    const generatedComponents = getSequenceFlatMap(sequences[0]).filter((componentId) => componentId !== 'end');
    expect(generatedComponents).toHaveLength(4);
    generatedComponents.forEach((componentId) => {
      const component = compiled.components[componentId];
      expect(component).toMatchObject({ parameters: { b: expect.any(String) } });
      expect(component).toMatchObject({ parameters: { a: expect.any(Number) } });
    });
  });

  test('parses the factor-action demo', async () => {
    const config = readFileSync(
      'public/demo-factors/config.json',
      'utf8',
    );

    const result = await parseStudyConfig(config);

    expect(result.errors).toEqual([]);
  });

  test('parses the Markdown templating factors demo', async () => {
    const config = readFileSync(
      'public/demo-markdown-factors/config.json',
      'utf8',
    );

    const result = await parseStudyConfig(config);
    const rootSequence = result.sequence as ComponentBlock;
    const trialSequence = rootSequence.components[0] as ComponentBlock;

    expect(result.errors).toEqual([]);
    expect(trialSequence.components).toHaveLength(4);
    expect(result.components['markdownFactorTrials__animal=%22cat%22__color=%22blue%22__factorTemplate'])
      .toMatchObject({ description: 'Animal: cat; color: blue' });
  });

  test('uses subtract to produce 90 incongruent Stroop trials', async () => {
    const config = readFileSync(
      'public/demo-stroop-factors/config.json',
      'utf8',
    );

    const result = await parseStudyConfig(config);
    const rootSequence = result.sequence as ComponentBlock;
    const trialSequence = rootSequence.components[1] as ComponentBlock;
    const redWordBlueInkId = 'stroopTrials__word=%22RED%22__inkColor=%22BLUE%22__stroopTrial';

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
