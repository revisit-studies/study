import {
  describe, expect, test, vi,
} from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { QuestionnaireComponent, StudyConfig } from '../parser/types';
import { generateSequenceArray } from './handleRandomSequences';
import { getSequenceFlatMap } from './getSequenceFlatMap';

const components = Object.fromEntries(Array(50).fill(0).map((_, idx) => [`component_${idx}`, { type: 'questionnaire', response: [] } as QuestionnaireComponent]));

const config: StudyConfig = {
  $schema: '',
  studyMetadata: {
    title: '',
    version: '',
    authors: [],
    date: '',
    description: '',
    organizations: [],
  },
  uiConfig: {
    logoPath: '',
    contactEmail: '',
    withProgressBar: true,
    withSidebar: true,
    numSequences: 100_000,
  },
  components,
  sequence: {
    order: 'random',
    numSamples: 1,
    components: Object.keys(components),
  },
};

const trialGroupA = Array.from({ length: 10 }, (_, idx) => `trial${idx + 1}`);
const trialGroupB = Array.from({ length: 10 }, (_, idx) => `trial${idx + 11}`);
const testRandomizationConfigUrl = new URL('../../public/test-randomization/config.json', import.meta.url);
const randomizationDistributionTest = existsSync(testRandomizationConfigUrl) ? test : test.skip;

describe('Generating sequences works as expected', () => {
  test('generateSequenceArray preserves nested ordering for nest factors', () => {
    const nestedFactorConfig: StudyConfig = {
      ...config,
      uiConfig: {
        ...config.uiConfig,
        numSequences: 1,
      },
      factors: {
        m: ['m1', 'm2'],
        n: ['n1', 'n2', 'n3'],
      },
      sequence: {
        type: 'factor',
        action: 'nest',
        id: 'nestedFactors',
        factorsToCross: [
          { factor: 'm' },
          { factor: 'n' },
        ],
        component: 'factorComponent',
      },
    };

    const sequenceArray = generateSequenceArray(nestedFactorConfig);

    expect(sequenceArray).toHaveLength(1);
    expect(sequenceArray[0].order).toBe('fixed');
    expect(sequenceArray[0].components).toEqual([
      '_m1_n1',
      '_m1_n2',
      '_m1_n3',
      '_m2_n1',
      '_m2_n2',
      '_m2_n3',
      'end',
    ]);
  });

  test('generateSequenceArray preserves crossed ordering for cross factors', () => {
    const crossFactorConfig: StudyConfig = {
      ...config,
      uiConfig: {
        ...config.uiConfig,
        numSequences: 1,
      },
      factors: {
        m: ['m1', 'm2'],
        n: ['n1', 'n2'],
      },
      sequence: {
        type: 'factor',
        action: 'cross',
        id: 'crossedFactors',
        factorsToCross: [
          { factor: 'm' },
          { factor: 'n' },
        ],
        component: 'factorComponent',
      },
    };

    const sequenceArray = generateSequenceArray(crossFactorConfig);

    expect(sequenceArray).toHaveLength(1);
    expect(sequenceArray[0].order).toBe('fixed');
    expect(sequenceArray[0].components).toEqual([
      '_m1_n1',
      '_m2_n2',
      '_m2_n1',
      '_m1_n2',
      'end',
    ]);
  });

  test('generateSequenceArray preserves zipped ordering for zip factors', () => {
    const zipFactorConfig: StudyConfig = {
      ...config,
      uiConfig: {
        ...config.uiConfig,
        numSequences: 1,
      },
      factors: {
        m: ['m1', 'm2'],
        n: ['n1', 'n2', 'n3'],
      },
      sequence: {
        type: 'factor',
        action: 'zip',
        id: 'zippedFactors',
        factorsToCross: [
          { factor: 'm' },
          { factor: 'n' },
        ],
        component: 'factorComponent',
      },
    };

    const sequenceArray = generateSequenceArray(zipFactorConfig);

    expect(sequenceArray).toHaveLength(1);
    expect(sequenceArray[0].order).toBe('fixed');
    expect(sequenceArray[0].components).toEqual([
      '_m1_n1',
      '_m2_n2',
      'end',
    ]);
  });

  test('generateSequenceArray preserves ordering when a factor is used as a factor', () => {
    const nestedFactorConfig: StudyConfig = {
      ...config,
      uiConfig: {
        ...config.uiConfig,
        numSequences: 1,
      },
      factors: {
        data: ['d1', 'd2'],
        visType: ['v1', 'v2', 'v3'],
        task: ['t1', 't2'],
        zipDataVis: {
          action: 'zip',
          order: 'random',
          factorsToCross: [
            { factor: 'data' },
            { factor: 'visType' },
          ],
          component: 'factorComponent',
        },
      },
      sequence: {
        type: 'factor',
        action: 'nest',
        id: 'zipThenTask',
        factorsToCross: [
          { factor: 'zipDataVis' },
          { factor: 'task' },
        ],
        component: 'factorComponent',
      },
    };

    const sequenceArray = generateSequenceArray(nestedFactorConfig);

    expect(sequenceArray).toHaveLength(1);
    expect(sequenceArray[0].order).toBe('fixed');
    expect(sequenceArray[0].components).toEqual([
      '_d1_v1_t1',
      '_d1_v1_t2',
      '_d2_v2_t1',
      '_d2_v2_t2',
      'end',
    ]);
  });

  test('generateSequenceArray applies factor order after combinations are created', () => {
    const orderedFactorConfig: StudyConfig = {
      ...config,
      uiConfig: {
        ...config.uiConfig,
        numSequences: 1,
      },
      factors: {
        m: ['m1', 'm2'],
        n: ['n1', 'n2'],
      },
      sequence: {
        type: 'factor',
        action: 'nest',
        order: 'random',
        id: 'randomizedFactors',
        factorsToCross: [
          { factor: 'm' },
          { factor: 'n' },
        ],
        component: 'factorComponent',
      },
    };

    const sequenceArray = generateSequenceArray(orderedFactorConfig);
    const generatedComponents = sequenceArray[0].components.filter((component) => component !== 'end');

    expect(sequenceArray).toHaveLength(1);
    expect(sequenceArray[0].order).toBe('random');
    expect(generatedComponents).toHaveLength(4);
    expect(new Set(generatedComponents)).toEqual(new Set([
      '_m1_n1',
      '_m1_n2',
      '_m2_n1',
      '_m2_n2',
    ]));
  });

  test('generateSequenceArray applies numSamples to primitive factors before combining', () => {
    const sampledFactorConfig: StudyConfig = {
      ...config,
      uiConfig: {
        ...config.uiConfig,
        numSequences: 1,
      },
      factors: {
        m: ['m1', 'm2', 'm3'],
        n: ['n1', 'n2', 'n3'],
      },
      sequence: {
        type: 'factor',
        action: 'nest',
        id: 'sampledFactors',
        factorsToCross: [
          { factor: 'm', numSamples: 2 },
          { factor: 'n', numSamples: 1 },
        ],
        component: 'factorComponent',
      },
    };

    const sequenceArray = generateSequenceArray(sampledFactorConfig);

    expect(sequenceArray).toHaveLength(1);
    expect(sequenceArray[0].components).toEqual([
      '_m1_n1',
      '_m2_n1',
      'end',
    ]);
  });

  test('generateSequenceArray applies numSamples to derived factors before combining', () => {
    const sampledDerivedFactorConfig: StudyConfig = {
      ...config,
      uiConfig: {
        ...config.uiConfig,
        numSequences: 1,
      },
      factors: {
        data: ['d1', 'd2'],
        visType: ['v1', 'v2'],
        task: ['t1', 't2'],
        zippedDataVis: {
          action: 'zip',
          factorsToCross: [
            { factor: 'data' },
            { factor: 'visType' },
          ],
          component: 'factorComponent',
        },
      },
      sequence: {
        type: 'factor',
        action: 'nest',
        id: 'sampledDerivedFactors',
        factorsToCross: [
          { factor: 'zippedDataVis', numSamples: 1 },
          { factor: 'task' },
        ],
        component: 'factorComponent',
      },
    };

    const sequenceArray = generateSequenceArray(sampledDerivedFactorConfig);

    expect(sequenceArray).toHaveLength(1);
    expect(sequenceArray[0].components).toEqual([
      '_d1_v1_t1',
      '_d1_v1_t2',
      'end',
    ]);
  });

  test('generateSequenceArray repeats and samples factor values for random factor blocks', () => {
    const okGoogleFactorConfig: StudyConfig = {
      ...config,
      uiConfig: {
        ...config.uiConfig,
        numSequences: 2,
      },
      factors: {
        ageGroup: ['young', 'old'],
        learningStrategies: ['monologue', 'scaffolding', 'conceptual'],
        topics: ['sleep', 'cholesterol', 'alzheimer', 'vitamin', 'sugar', 'flu'],
        Ok_googleTopicAssignments: {
          action: 'zip',
          order: 'random',
          factorsToCross: [
            { factor: 'learningStrategies', numSamples: 6 },
            { factor: 'topics', numSamples: 6 },
          ],
          component: 'factorComponent',
        },
      },
      betweenSubjectsFactors: ['ageGroup'],
      sequence: {
        type: 'factor',
        action: 'nest',
        id: 'Ok_google',
        factorsToCross: [
          { factor: 'ageGroup' },
          { factor: 'Ok_googleTopicAssignments' },
        ],
        component: 'factorComponent',
      },
    };
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);

    try {
      const sequenceArray = generateSequenceArray(okGoogleFactorConfig);

      expect(sequenceArray).toHaveLength(2);
      expect(sequenceArray[0].parameters).toEqual({ ageGroup: 'young' });
      expect(sequenceArray[0].components).toEqual([
        '_young_scaffolding_cholesterol',
        '_young_conceptual_alzheimer',
        '_young_monologue_vitamin',
        '_young_scaffolding_sugar',
        '_young_conceptual_flu',
        '_young_monologue_sleep',
        'end',
      ]);
      expect(sequenceArray[1].parameters).toEqual({ ageGroup: 'old' });
      expect(sequenceArray[1].components).toEqual([
        '_old_scaffolding_cholesterol',
        '_old_conceptual_alzheimer',
        '_old_monologue_vitamin',
        '_old_scaffolding_sugar',
        '_old_conceptual_flu',
        '_old_monologue_sleep',
        'end',
      ]);
      expect(sequenceArray[0].components.filter((component) => (
        typeof component === 'string' && component.includes('monologue')
      ))).toHaveLength(2);
      expect(sequenceArray[0].components.filter((component) => (
        typeof component === 'string' && component.includes('scaffolding')
      ))).toHaveLength(2);
      expect(sequenceArray[0].components.filter((component) => (
        typeof component === 'string' && component.includes('conceptual')
      ))).toHaveLength(2);
    } finally {
      randomSpy.mockRestore();
    }
  });

  test('generateSequenceArray assigns one between-subjects value to factor sequences', () => {
    const betweenSubjectsConfig: StudyConfig = {
      ...config,
      uiConfig: {
        ...config.uiConfig,
        numSequences: 2,
      },
      factors: {
        data: ['d1', 'd2'],
        task: ['t1', 't2'],
      },
      betweenSubjectsFactors: ['data'],
      sequence: {
        type: 'factor',
        action: 'nest',
        id: 'betweenSubjectFactors',
        factorsToCross: [
          { factor: 'data' },
          { factor: 'task' },
        ],
        component: 'factorComponent',
      },
    };

    const sequenceArray = generateSequenceArray(betweenSubjectsConfig);

    expect(sequenceArray).toHaveLength(2);
    expect(sequenceArray[0].parameters).toEqual({ data: 'd1' });
    expect(sequenceArray[0].components).toEqual([
      '_d1_t1',
      '_d1_t2',
      'end',
    ]);
    expect(sequenceArray[1].parameters).toEqual({ data: 'd2' });
    expect(sequenceArray[1].components).toEqual([
      '_d2_t1',
      '_d2_t2',
      'end',
    ]);
  });

  test('generateSequenceArray filters pre-expanded between-subjects components', () => {
    const parsedBetweenSubjectsConfig: StudyConfig = {
      ...config,
      uiConfig: {
        ...config.uiConfig,
        numSequences: 2,
      },
      factors: {
        data: ['d1', 'd2'],
      },
      betweenSubjectsFactors: ['data'],
      components: {
        d1Trial: {
          type: 'react-component',
          path: 'test/assets/Trial.tsx',
          response: [],
          parameters: { data: 'd1' },
        },
        d2Trial: {
          type: 'react-component',
          path: 'test/assets/Trial.tsx',
          response: [],
          parameters: { data: 'd2' },
        },
        sharedTrial: {
          type: 'questionnaire',
          response: [],
        },
      },
      sequence: {
        order: 'fixed',
        components: ['d1Trial', 'd2Trial', 'sharedTrial'],
      },
    };

    const sequenceArray = generateSequenceArray(parsedBetweenSubjectsConfig);

    expect(sequenceArray[0].components).toEqual(['d1Trial', 'sharedTrial', 'end']);
    expect(sequenceArray[0].parameters).toEqual({ data: 'd1' });
    expect(sequenceArray[1].components).toEqual(['d2Trial', 'sharedTrial', 'end']);
    expect(sequenceArray[1].parameters).toEqual({ data: 'd2' });
  });

  test('generateSequenceArray filters between-subjects components inside nested blocks', () => {
    const parsedBetweenSubjectsConfig: StudyConfig = {
      ...config,
      uiConfig: {
        ...config.uiConfig,
        numSequences: 2,
      },
      factors: {
        ageGroup: ['young', 'old'],
      },
      betweenSubjectsFactors: ['ageGroup'],
      components: {
        youngTutorial: {
          type: 'markdown',
          path: 'test/assets/young.md',
          response: [],
        },
        oldTutorial: {
          type: 'markdown',
          path: 'test/assets/old.md',
          response: [],
        },
      },
      sequence: {
        order: 'fixed',
        components: [
          {
            id: 'tutorialByAgeGroup',
            order: 'fixed',
            components: [
              {
                id: 'youngTutorialBlock',
                order: 'fixed',
                parameters: { ageGroup: 'young' },
                components: ['youngTutorial'],
              },
              {
                id: 'oldTutorialBlock',
                order: 'fixed',
                parameters: { ageGroup: 'old' },
                components: ['oldTutorial'],
              },
            ],
          },
        ],
      },
    };

    const sequenceArray = generateSequenceArray(parsedBetweenSubjectsConfig);

    expect(sequenceArray[0].components[0]).toMatchObject({
      id: 'tutorialByAgeGroup',
      components: [
        expect.objectContaining({
          id: 'youngTutorialBlock',
          components: ['youngTutorial'],
        }),
      ],
    });
    expect(sequenceArray[0].parameters).toEqual({ ageGroup: 'young' });
    expect(sequenceArray[1].components[0]).toMatchObject({
      id: 'tutorialByAgeGroup',
      components: [
        expect.objectContaining({
          id: 'oldTutorialBlock',
          components: ['oldTutorial'],
        }),
      ],
    });
    expect(sequenceArray[1].parameters).toEqual({ ageGroup: 'old' });
  });

  test('generateSequenceArray defaults to 1000 sequences when numSequences is omitted', () => {
    const defaultCountConfig: StudyConfig = {
      ...config,
      uiConfig: {
        logoPath: '',
        contactEmail: '',
        withProgressBar: true,
        withSidebar: true,
      },
      sequence: {
        order: 'fixed',
        numSamples: 1,
        components: ['component_0'],
      },
    };

    const sequenceArray = generateSequenceArray(defaultCountConfig);
    expect(sequenceArray).toHaveLength(1000);
  });

  test('generateSequenceArray appends end exactly once as the last component', () => {
    const endConfig: StudyConfig = {
      ...config,
      uiConfig: {
        ...config.uiConfig,
        numSequences: 50,
      },
      sequence: {
        order: 'fixed',
        numSamples: 2,
        components: ['component_0', 'component_1'],
      },
    };

    const sequenceArray = generateSequenceArray(endConfig);
    sequenceArray.forEach((sequence) => {
      expect(sequence.components[sequence.components.length - 1]).toBe('end');
      expect(sequence.components.slice(0, -1)).not.toContain('end');
    });
  });

  test('generateSequenceArray respects numSamples for random order blocks', () => {
    const sampledConfig: StudyConfig = {
      ...config,
      uiConfig: {
        ...config.uiConfig,
        numSequences: 200,
      },
      sequence: {
        order: 'random',
        numSamples: 3,
        components: Object.keys(components).slice(0, 10),
      },
    };

    const sequenceArray = generateSequenceArray(sampledConfig);
    sequenceArray.forEach((sequence) => {
      const withoutEnd = sequence.components.filter((component) => component !== 'end');
      expect(withoutEnd).toHaveLength(3);
      expect(sequence.components).toHaveLength(4);
    });
  });

  test('generateSequenceArray returns balanced random sequences, numSamples = 1', async () => {
    const sequenceArray = generateSequenceArray(config);

    const counts = sequenceArray.flatMap(((seq) => seq.components)).filter((comp) => comp !== 'end').reduce((acc, compId) => {
      acc[compId as string] = (acc[compId as string] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const values = Object.values(counts);
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Check that the difference between max and min counts is within an acceptable range
    expect(max - min).toBeLessThan(300); // Allow a small margin of error
  });

  test('generateSequenceArray returns balanced random sequences, numSamples = 50', async () => {
    const sequenceArray = generateSequenceArray({ ...config, sequence: { order: 'random', numSamples: 31, components: Object.keys(components) } });

    const counts = sequenceArray.flatMap(((seq) => seq.components)).filter((comp) => comp !== 'end').reduce((acc, compId) => {
      acc[compId as string] = (acc[compId as string] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const values = Object.values(counts);
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Check that the difference between max and min counts is within an acceptable range
    expect(max - min).toBeLessThan(1000); // Allow a small margin of error

    const counts1 = sequenceArray.map(((seq) => seq.components[1])).reduce((acc, compId) => {
      acc[compId as string] = (acc[compId as string] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const counts30 = sequenceArray.map(((seq) => seq.components[30])).reduce((acc, compId) => {
      acc[compId as string] = (acc[compId as string] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const values1 = Object.values(counts1);
    const min1 = Math.min(...values1);
    const max1 = Math.max(...values1);

    // Check that the difference between max and min counts is within an acceptable range
    // Stochastic variance can occasionally exceed 300 across 100k random draws.
    expect(max1 - min1).toBeLessThan(400);

    const values30 = Object.values(counts30);
    const min30 = Math.min(...values30);
    const max30 = Math.max(...values30);

    // Check that the difference between max and min counts is within an acceptable range
    // Stochastic variance can occasionally exceed 300 across 100k random draws.
    expect(max30 - min30).toBeLessThan(400);
  });

  randomizationDistributionTest('generateSequenceArray matches expected distribution for test-randomization study', () => {
    const testRandomizationConfig = JSON.parse(readFileSync(testRandomizationConfigUrl, 'utf-8')) as StudyConfig;
    const randomizationConfig = {
      ...testRandomizationConfig,
      uiConfig: {
        ...testRandomizationConfig.uiConfig,
        numSequences: 1000,
      },
    } as StudyConfig;

    const sequenceArray = generateSequenceArray(randomizationConfig);
    expect(sequenceArray).toHaveLength(1000);

    const flattenedSequenceArray = sequenceArray.map((sequence) => getSequenceFlatMap(sequence));
    const sequenceOccurrences = flattenedSequenceArray.map((sequence) => {
      expect(sequence).toHaveLength(24);

      const occurrences = sequence.reduce((acc, curr) => {
        acc[curr] = (acc[curr] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      expect(occurrences.introduction).toBe(2);
      expect(occurrences.end).toBe(1);
      expect(occurrences.break1).toBe(6);
      expect(occurrences.break2).toBe(4);

      const trialGroupATotal = trialGroupA.reduce((sum, trial) => sum + (occurrences[trial] || 0), 0);
      const trialGroupBTotal = trialGroupB.reduce((sum, trial) => sum + (occurrences[trial] || 0), 0);

      expect(trialGroupATotal).toBe(5);
      expect(trialGroupBTotal).toBe(5);

      return occurrences;
    });

    const globalOccurrences = sequenceOccurrences.reduce((acc, curr) => {
      Object.entries(curr).forEach(([key, value]) => {
        acc[key] = (acc[key] || 0) + value;
      });
      return acc;
    }, {} as Record<string, number>);

    expect(globalOccurrences.introduction).toBe(2000);
    expect(globalOccurrences.break1).toBe(6000);
    expect(globalOccurrences.break2).toBe(4000);
    expect(globalOccurrences.end).toBe(1000);

    trialGroupA.forEach((trial) => {
      expect(globalOccurrences[trial]).toBe(500);
    });
    trialGroupB.forEach((trial) => {
      expect(globalOccurrences[trial]).toBe(500);
    });
  });

  test('generateSequenceArray inserts the configured number of random interruptions', () => {
    const interruptionConfig: StudyConfig = {
      $schema: '',
      studyMetadata: {
        title: '',
        version: '',
        authors: [],
        date: '',
        description: '',
        organizations: [],
      },
      uiConfig: {
        logoPath: '',
        contactEmail: '',
        withProgressBar: true,
        withSidebar: true,
        numSequences: 200,
      },
      components: {
        a: { type: 'questionnaire', response: [] },
        b: { type: 'questionnaire', response: [] },
        c: { type: 'questionnaire', response: [] },
        brk: { type: 'questionnaire', response: [] },
      },
      sequence: {
        order: 'fixed',
        numSamples: 3,
        components: ['a', 'b', 'c'],
        interruptions: [
          {
            spacing: 'random',
            numInterruptions: 2,
            components: ['brk'],
          },
        ],
      },
    };

    const sequenceArray = generateSequenceArray(interruptionConfig);
    sequenceArray.forEach((sequence) => {
      const breakCount = sequence.components.filter((component) => component === 'brk').length;
      expect(breakCount).toBe(2);
      expect(sequence.components).toHaveLength(6);
      expect(sequence.components[sequence.components.length - 1]).toBe('end');
    });
  });

  test('generateSequenceArray throws when random interruption count exceeds allowed maximum', () => {
    const invalidInterruptionConfig: StudyConfig = {
      $schema: '',
      studyMetadata: {
        title: '',
        version: '',
        authors: [],
        date: '',
        description: '',
        organizations: [],
      },
      uiConfig: {
        logoPath: '',
        contactEmail: '',
        withProgressBar: true,
        withSidebar: true,
        numSequences: 1,
      },
      components: {
        a: { type: 'questionnaire', response: [] },
        b: { type: 'questionnaire', response: [] },
        brk: { type: 'questionnaire', response: [] },
      },
      sequence: {
        order: 'fixed',
        numSamples: 2,
        components: ['a', 'b'],
        interruptions: [
          {
            spacing: 'random',
            numInterruptions: 2,
            components: ['brk'],
          },
        ],
      },
    };

    expect(() => generateSequenceArray(invalidInterruptionConfig)).toThrow('Number of interruptions cannot be greater than the number of available interruption slots');
  });
});
