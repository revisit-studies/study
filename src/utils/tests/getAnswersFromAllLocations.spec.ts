import { describe, expect, test } from 'vitest';
import type { TrialValidation } from '../../store/types';
import type { Response } from '../../parser/types';
import { getAnswersFromAllLocations, getPersistedAnswersFromAllLocations } from '../getAnswersFromAllLocations';

function makeEntry(overrides: Partial<TrialValidation[string]>): TrialValidation[string] {
  return {
    aboveStimulus: { valid: true, values: {} },
    belowStimulus: { valid: true, values: {} },
    sidebar: { valid: true, values: {} },
    stimulus: { valid: true, values: {} },
    provenanceGraph: {
      aboveStimulus: undefined, belowStimulus: undefined, stimulus: undefined, sidebar: undefined,
    },
    ...overrides,
  };
}

describe('getAnswersFromAllLocations', () => {
  test('returns an empty object when the entry is undefined', () => {
    expect(getAnswersFromAllLocations(undefined)).toEqual({});
  });

  test('merges values from every response block location', () => {
    const entry = makeEntry({
      aboveStimulus: { valid: true, values: { q1: 'a' } },
      belowStimulus: { valid: true, values: { q2: 'b' } },
      sidebar: { valid: true, values: { q3: 'c' } },
    });
    expect(getAnswersFromAllLocations(entry)).toEqual({ q1: 'a', q2: 'b', q3: 'c' });
  });

  test('merges stimulus values with response block values', () => {
    const entry = makeEntry({
      belowStimulus: { valid: true, values: { q1: 'a' } },
      stimulus: { valid: true, values: { stimulusAnswer: 42 } },
    });
    expect(getAnswersFromAllLocations(entry)).toEqual({ q1: 'a', stimulusAnswer: 42 });
  });

  test('ignores entries without a values field, like the provenance graph', () => {
    const entry = makeEntry({ belowStimulus: { valid: true, values: { q1: 'a' } } });
    expect(getAnswersFromAllLocations(entry)).toEqual({ q1: 'a' });
  });

  test('does not share references with the source validation entry', () => {
    const nested = { picked: ['x'] };
    const entry = makeEntry({ belowStimulus: { valid: true, values: { q1: nested } } });
    const result = getAnswersFromAllLocations(entry);
    expect(result.q1).toEqual(nested);
    expect(result.q1).not.toBe(nested);
  });

  test('omits inactive Other text while retaining selected Other text', () => {
    const entry = makeEntry({
      aboveStimulus: { valid: true, values: { q1: '', 'q1-other': 'cleared response' } },
      belowStimulus: { valid: true, values: { q2: 'B', 'q2-other': 'switched-away response' } },
      sidebar: { valid: true, values: { q3: 'other', 'q3-other': 'selected response' } },
      stimulus: {
        valid: true,
        values: {
          q4: ['A', '__other'],
          'q4-other': 'selected checkbox response',
          q5: ['A'],
          'q5-other': 'inactive checkbox response',
          consent: '',
          'consent-other': 'ordinary response',
        },
      },
    });

    expect(getAnswersFromAllLocations(entry)).toMatchObject({
      'q1-other': 'cleared response',
      'q2-other': 'switched-away response',
      'q5-other': 'inactive checkbox response',
    });

    expect(getPersistedAnswersFromAllLocations(entry, [
      {
        type: 'radio', id: 'q1', prompt: '', options: [], withOther: true,
      } as Response,
      {
        type: 'radio', id: 'q2', prompt: '', options: [], withOther: true,
      } as Response,
      {
        type: 'radio', id: 'q3', prompt: '', options: [], withOther: true,
      } as Response,
      {
        type: 'checkbox', id: 'q4', prompt: '', options: [], withOther: true,
      } as Response,
      {
        type: 'checkbox', id: 'q5', prompt: '', options: [], withOther: true,
      } as Response,
      {
        type: 'radio', id: 'consent', prompt: '', options: [], withOther: true,
      } as Response,
      {
        type: 'shortText', id: 'consent-other', prompt: '',
      } as Response,
    ])).toEqual({
      q1: '',
      q2: 'B',
      q3: 'other',
      'q3-other': 'selected response',
      q4: ['A', '__other'],
      'q4-other': 'selected checkbox response',
      q5: ['A'],
      consent: '',
      'consent-other': 'ordinary response',
    });
  });
});
