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
      expect(sequence.components[0]).not.toBe('brk');
      expect(sequence.components[sequence.components.length - 1]).toBe('end');
    });
  });

  test('does not place random interruptions first or back to back across groups', () => {
    const config: StudyConfig = {
      ...createBaseConfig(),
      uiConfig: {
        ...createBaseConfig().uiConfig,
        numSequences: 500,
      },
      components: {
        a: { type: 'questionnaire', response: [] },
        b: { type: 'questionnaire', response: [] },
        c: { type: 'questionnaire', response: [] },
        d: { type: 'questionnaire', response: [] },
        e: { type: 'questionnaire', response: [] },
        f: { type: 'questionnaire', response: [] },
        g: { type: 'questionnaire', response: [] },
        h: { type: 'questionnaire', response: [] },
        low: { type: 'questionnaire', response: [] },
        high: { type: 'questionnaire', response: [] },
      },
      sequence: {
        order: 'fixed',
        components: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
        interruptions: [
          {
            spacing: 'random',
            numInterruptions: 1,
            components: ['low'],
          },
          {
            spacing: 'random',
            numInterruptions: 1,
            components: ['high'],
          },
        ],
      },
    };

    const sequenceArray = generateSequenceArray(config);
    sequenceArray.forEach((sequence) => {
      expect(sequence.components[0]).not.toBe('low');
      expect(sequence.components[0]).not.toBe('high');

      for (let i = 0; i < sequence.components.length - 1; i += 1) {
        const current = sequence.components[i];
        const next = sequence.components[i + 1];
        const currentIsInterruption = current === 'low' || current === 'high';
        const nextIsInterruption = next === 'low' || next === 'high';

        expect(currentIsInterruption && nextIsInterruption).toBe(false);
      }
    });
  });

  test('fills every possible random interruption slot across groups when all slots are requested', () => {
    const config: StudyConfig = {
      ...createBaseConfig(),
      components: {
        a: { type: 'questionnaire', response: [] },
        b: { type: 'questionnaire', response: [] },
        c: { type: 'questionnaire', response: [] },
        d: { type: 'questionnaire', response: [] },
        low: { type: 'questionnaire', response: [] },
        high: { type: 'questionnaire', response: [] },
      },
      sequence: {
        order: 'fixed',
        components: ['a', 'b', 'c', 'd'],
        interruptions: [
          {
            spacing: 'random',
            numInterruptions: 1,
            components: ['low'],
          },
          {
            spacing: 'random',
            numInterruptions: 2,
            components: ['high'],
          },
        ],
      },
    };

    const [sequence] = generateSequenceArray(config);

    expect(sequence.components).toHaveLength(8);
    expect(sequence.components[0]).toBe('a');
    expect(sequence.components[2]).toBe('b');
    expect(sequence.components[4]).toBe('c');
    expect(sequence.components[6]).toBe('d');
    expect(sequence.components[7]).toBe('end');
    expect(['low', 'high']).toContain(sequence.components[1]);
    expect(['low', 'high']).toContain(sequence.components[3]);
    expect(['low', 'high']).toContain(sequence.components[5]);
    expect(sequence.components.filter((component) => component === 'low')).toHaveLength(1);
    expect(sequence.components.filter((component) => component === 'high')).toHaveLength(2);
  });

  test('throws when grouped random interruptions request more slots than available', () => {
    const config: StudyConfig = {
      ...createBaseConfig(),
      components: {
        a: { type: 'questionnaire', response: [] },
        b: { type: 'questionnaire', response: [] },
        c: { type: 'questionnaire', response: [] },
        d: { type: 'questionnaire', response: [] },
        low: { type: 'questionnaire', response: [] },
        high: { type: 'questionnaire', response: [] },
      },
      sequence: {
        order: 'fixed',
        components: ['a', 'b', 'c', 'd'],
        interruptions: [
          {
            spacing: 'random',
            numInterruptions: 2,
            components: ['low'],
          },
          {
            spacing: 'random',
            numInterruptions: 2,
            components: ['high'],
          },
        ],
      },
    };

    expect(() => generateSequenceArray(config)).toThrow('Number of interruptions cannot be greater than the number of available interruption slots');
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

    expect(() => generateSequenceArray(config)).toThrow('Number of interruptions cannot be greater than the number of available interruption slots');
  });
});
