import { describe, expect, test } from 'vitest';
import type { TrialValidation } from '../../store/types';
import { getAnswersFromAllLocations } from '../getAnswersFromAllLocations';

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
});
