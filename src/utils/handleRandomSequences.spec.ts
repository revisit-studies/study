import { describe, expect, test } from 'vitest';
import { QuestionnaireComponent, StudyConfig } from '../parser/types';
import { generateSequenceArray } from './handleRandomSequences';
import { getSequenceFlatMap } from './getSequenceFlatMap';
import testRandomizationConfig from '../../public/test-randomization/config.json';

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

describe('Generating sequences works as expected', () => {
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

  test('generateSequenceArray matches expected distribution for test-randomization study', () => {
    const randomizationConfig = {
      ...(testRandomizationConfig as StudyConfig),
      uiConfig: {
        ...(testRandomizationConfig as StudyConfig).uiConfig,
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

    expect(() => generateSequenceArray(invalidInterruptionConfig)).toThrow('Number of interruptions cannot be greater than the number of components');
  });
});
