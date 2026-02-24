import { describe, expect, test } from 'vitest';
import { StudyConfig } from '../parser/types';
import { generateSequenceArray } from './handleRandomSequences';

function createBaseConfig(): Omit<StudyConfig, 'components' | 'sequence'> {
  return {
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
  };
}

describe('handleInterruptionSequences', () => {
  test('inserts deterministic interruptions using firstLocation and spacing', () => {
    const config: StudyConfig = {
      ...createBaseConfig(),
      components: {
        a: { type: 'questionnaire', response: [] },
        b: { type: 'questionnaire', response: [] },
        c: { type: 'questionnaire', response: [] },
        d: { type: 'questionnaire', response: [] },
        brk: { type: 'questionnaire', response: [] },
      },
      sequence: {
        order: 'fixed',
        components: ['a', 'b', 'c', 'd'],
        interruptions: [
          {
            firstLocation: 1,
            spacing: 2,
            components: ['brk'],
          },
        ],
      },
    };

    const [sequence] = generateSequenceArray(config);
    expect(sequence.components).toEqual(['a', 'brk', 'b', 'brk', 'c', 'd', 'end']);
  });

  test('inserts the exact number of random interruptions', () => {
    const config: StudyConfig = {
      ...createBaseConfig(),
      uiConfig: {
        ...createBaseConfig().uiConfig,
        numSequences: 50,
      },
      components: {
        a: { type: 'questionnaire', response: [] },
        b: { type: 'questionnaire', response: [] },
        c: { type: 'questionnaire', response: [] },
        d: { type: 'questionnaire', response: [] },
        e: { type: 'questionnaire', response: [] },
        brk: { type: 'questionnaire', response: [] },
      },
      sequence: {
        order: 'fixed',
        components: ['a', 'b', 'c', 'd', 'e'],
        interruptions: [
          {
            spacing: 'random',
            numInterruptions: 2,
            components: ['brk'],
          },
        ],
      },
    };

    const sequenceArray = generateSequenceArray(config);
    sequenceArray.forEach((sequence) => {
      const interruptionIndices = sequence.components
        .map((value, index) => ({ value, index }))
        .filter(({ value }) => value === 'brk')
        .map(({ index }) => index);

      expect(interruptionIndices).toHaveLength(2);
      expect(sequence.components[sequence.components.length - 1]).toBe('end');
    });
  });

  test('throws when random interruptions exceed allowed maximum', () => {
    const config: StudyConfig = {
      ...createBaseConfig(),
      components: {
        a: { type: 'questionnaire', response: [] },
        b: { type: 'questionnaire', response: [] },
        brk: { type: 'questionnaire', response: [] },
      },
      sequence: {
        order: 'fixed',
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

    expect(() => generateSequenceArray(config)).toThrow('Number of interruptions cannot be greater than the number of components');
  });
});
