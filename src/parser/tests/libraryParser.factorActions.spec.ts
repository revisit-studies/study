import { readFileSync } from 'node:fs';
import {
  describe, expect, test, vi,
} from 'vitest';
import { generateSequenceArray } from '../../utils/handleRandomSequences';
import { getSequenceFlatMap } from '../../utils/getSequenceFlatMap';
import {
  compileFactorBlocks, createFactorOrderContext, materializeParticipantConfig, resolveFactorConditions, resolveOrderedFactorConditions, validateBetweenSubjects,
} from '../libraryParser';
import { parseStudyConfig } from '../parser';
import {
  ComponentBlock, FactorOption, ParserErrorWarning, StudyConfig,
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
  test.each([false, true])('rejects unknown shared layouts rather than equating missing identities (assigned=%s)', async (assigned) => {
    const config = factorConfig();
    const draw: FactorOption = {
      action: 'sample', factors: ['a'], numSamples: 2, samplingStrategy: 'withoutReplacement',
    };
    config.factors = {
      a: [1, 2],
      p: draw,
      selected: { action: 'zip', factors: [{ action: 'concat', factors: ['p', draw] }, { action: 'concat', factors: [draw, 'p'] }], as: ['x', 'y'] },
    };
    if (assigned) {
      config.factors.assignment = [{ x: 1, y: 2 }];
      config.betweenSubjects = ['assignment'];
    }
    config.baseComponents!.trial = { type: 'questionnaire', response: [] };
    config.sequence = {
      type: 'factor', id: 'unknownLayouts', factor: 'selected', components: 'trial',
    };
    const parsed = await parseStudyConfig(JSON.stringify(config));
    expect(parsed.errors.some((error) => error.category === 'invalid-config')).toBe(false);
    expect(parsed.errors.some((error) => error.message.includes('unsupported shared-draw zip'))).toBe(true);
  });

  test('does not treat a named wrapper as proof of an unknown child layout', async () => {
    const config = factorConfig();
    const draw: FactorOption = {
      action: 'sample', factors: ['a'], numSamples: 2, samplingStrategy: 'withoutReplacement',
    };
    config.factors = {
      a: [1, 2],
      p: draw,
      left: { action: 'concat', factors: ['p', draw] },
      selected: { action: 'zip', factors: ['left', 'left'], as: ['x', 'y'] },
    };
    config.baseComponents!.trial = { type: 'questionnaire', response: [] };
    config.sequence = {
      type: 'factor', id: 'unknownWrappedLayout', factor: 'selected', components: 'trial',
    };
    const parsed = await parseStudyConfig(JSON.stringify(config));
    expect(parsed.errors.some((error) => error.message.includes('unsupported shared-draw zip'))).toBe(true);
  });

  test.each([false, true])('rejects matching sliced prefixes before shared zip generation (assigned=%s)', async (assigned) => {
    const config = factorConfig();
    const prefix = { values: [{ chart: 'intro' }, { chart: 'unused' }], order: 'fixed' as const, numSamples: 1 };
    config.factors = {
      chart: ['bar', 'line', 'pie'],
      p: {
        action: 'sample', factors: ['chart'], numSamples: 3, samplingStrategy: 'withoutReplacement',
      },
      c: prefix,
      d: prefix,
      paired: { action: 'zip', factors: [{ action: 'concat', factors: ['c', 'p'] }, { action: 'concat', factors: ['d', 'p'] }], as: ['stimulus', 'probe'] },
      arm: [{ probe: 'line' }],
    };
    if (assigned) config.betweenSubjects = ['arm'];
    config.baseComponents!.trial = { type: 'questionnaire', response: [] };
    config.sequence = {
      type: 'factor', id: 'slicedPrefix', factor: 'paired', components: 'trial',
    };
    const parsed = await parseStudyConfig(JSON.stringify(config));
    expect(parsed.errors.some((error) => error.category === 'invalid-config')).toBe(false);
    expect(parsed.errors.some((error) => error.message.includes('unsupported shared-draw zip'))).toBe(true);
  });

  test.each([false, true].flatMap((leftSlice) => [false, true].flatMap((rightSlice) => (
    [false, true].map((assigned) => ({ leftSlice, rightSlice, assigned }))
  ))))('checks array versus sliced prefix semantics (leftSlice=$leftSlice, rightSlice=$rightSlice, assigned=$assigned)', async ({ leftSlice, rightSlice, assigned }) => {
    const config = factorConfig();
    const prefix = (sliced: boolean) => (sliced
      ? { values: [{ chart: 'intro' }, { chart: 'unused' }], order: 'fixed' as const, numSamples: 1 }
      : [{ chart: 'intro' }]);
    config.factors = {
      chart: ['bar', 'line', 'pie'],
      shuffled: {
        action: 'sample', factors: ['chart'], numSamples: 3, samplingStrategy: 'withoutReplacement',
      },
      introA: prefix(leftSlice),
      introB: prefix(rightSlice),
      paired: { action: 'zip', factors: [{ action: 'concat', factors: ['introA', 'shuffled'] }, { action: 'concat', factors: ['introB', 'shuffled'] }], as: ['stimulus', 'probe'] },
      arm: [{ stimulus: 'bar', probe: 'bar' }, { stimulus: 'bar', probe: 'line' }],
    };
    if (assigned) config.betweenSubjects = ['arm'];
    config.baseComponents!.trial = { type: 'questionnaire', response: [] };
    config.sequence = {
      type: 'factor', id: 'prefixSemantics', factor: 'paired', components: 'trial',
    };
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      const parsed = await parseStudyConfig(JSON.stringify(config));
      if (leftSlice || rightSlice) {
        expect(parsed.errors.some((error) => error.message.includes('unsupported shared-draw zip'))).toBe(true);
        return;
      }
      expect(parsed.errors).toEqual([]);
      generateSequenceArray(parsed).forEach((sequence) => {
        const rows = getSequenceFlatMap(sequence).filter((id) => id !== 'end').map((id) => parsed.components[id].parameters);
        expect(rows).toHaveLength(assigned ? Number(sequence.parameters?.stimulus === sequence.parameters?.probe) : 4);
        rows.forEach((row) => expect(row?.stimulus).toEqual(row?.probe));
      });
    } finally { random.mockRestore(); }
  });

  test.each((['fixed', 'latinSquare'] as const).flatMap((order) => [1, 2].map((numSamples) => ({ order, numSamples }))))('compares actual ordered prefix lengths ($order, numSamples=$numSamples)', async ({ order, numSamples }) => {
    const config = factorConfig();
    config.factors = {
      a: [1, 2],
      p: {
        action: 'sample', factors: ['a'], numSamples: 2, samplingStrategy: 'withoutReplacement',
      },
      c: { values: [{ a: 3 }, { a: 4 }], order, numSamples },
      d: { values: [{ a: 5 }, { a: 6 }], order },
      selected: { action: 'zip', factors: [{ action: 'concat', factors: ['c', 'p'] }, { action: 'concat', factors: ['d', 'p'] }], as: ['x', 'y'] },
    };
      config.baseComponents!.trial = { type: 'questionnaire', response: [] };
      config.sequence = {
        type: 'factor', id: 'orderedPrefixes', factor: 'selected', components: 'trial',
      };
      const parsed = await parseStudyConfig(JSON.stringify(config));
      if (numSamples === 1) {
        expect(parsed.errors.some((error) => error.message.includes('unsupported shared-draw zip'))).toBe(true);
      } else {
        expect(parsed.errors).toEqual([]);
        generateSequenceArray(parsed).forEach((sequence) => expect(getSequenceFlatMap(sequence)).toHaveLength(5));
      }
  });

  test.each([1, 2].flatMap((numSamples) => [false, true].map((wrapped) => ({ numSamples, wrapped }))))('allows deterministic slices as shared markers (numSamples=$numSamples, wrapped=$wrapped)', async ({ numSamples, wrapped }) => {
    const config = factorConfig();
    const draw: FactorOption = {
      action: 'sample', factors: ['a'], numSamples: 2, samplingStrategy: 'withoutReplacement',
    };
    config.factors = {
      a: [1, 2],
      p: draw,
      q: draw,
      c: { values: [{ a: 3 }, { a: 4 }], order: 'fixed', numSamples },
      marker: { action: 'concat', factors: ['c'] },
      selected: { action: 'zip', factors: [{ action: 'concat', factors: ['p', wrapped ? 'marker' : 'c'] }, { action: 'concat', factors: ['q', wrapped ? 'marker' : 'c'] }], as: ['x', 'y'] },
      assignment: [{ x: 1, y: 2 }],
    };
    config.betweenSubjects = ['assignment'];
      config.baseComponents!.trial = { type: 'questionnaire', response: [] };
      config.sequence = {
        type: 'factor', id: 'fixedMarkers', factor: 'selected', components: 'trial',
      };
      const random = vi.spyOn(Math, 'random').mockReturnValue(0);
      try {
        const parsed = await parseStudyConfig(JSON.stringify(config));
        expect(parsed.errors).toEqual([]);
        generateSequenceArray(parsed).forEach((sequence) => {
          expect(getSequenceFlatMap(sequence).filter((id) => id !== 'end').map((id) => parsed.components[id].parameters)).toEqual([{ x: 1, y: 2 }]);
        });
      } finally { random.mockRestore(); }
  });

  test.each((['keep', 'remove'] as const).flatMap((action) => [false, true].map((named) => ({ action, named }))))('rejects shared selector draw dependencies ($action, named=$named)', async ({ action, named }) => {
    const config = factorConfig();
    const filter: Exclude<FactorOption, string> = { action, factor: 'a', items: 'p' };
    config.factors = {
      a: [1, 2, 3],
      p: {
        action: 'sample', factors: ['a'], numSamples: 1, samplingStrategy: 'withoutReplacement',
      },
      left: filter,
      right: filter,
      selected: { action: 'zip', factors: named ? ['left', 'right'] : [filter, filter], as: ['x', 'y'] },
    };
      config.baseComponents!.trial = { type: 'questionnaire', response: [] };
      config.sequence = {
        type: 'factor', id: 'sharedSelectors', factor: 'selected', components: 'trial',
      };
      const parsed = await parseStudyConfig(JSON.stringify(config));
      expect(parsed.errors.some((error) => error.category === 'invalid-config')).toBe(false);
      expect(parsed.errors.some((error) => error.message.includes('unsupported shared-draw zip'))).toBe(true);
  });

  test.each((['cross', 'zip', 'keep', 'remove', 'prefix', 'independentTail'] as const).flatMap((kind) => (
    [false, true].map((assigned) => ({ kind, assigned }))
  )))(
    'rejects unsupported shared-draw zip composition ($kind, assigned=$assigned) before generation',
    async ({ kind, assigned }) => {
      const config = factorConfig();
      const inner: FactorOption = { action: kind === 'cross' ? 'cross' : 'zip', factors: ['p', 'q'], as: ['x', 'y'] };
      const wrapped: FactorOption = kind === 'keep' ? { action: 'keep', factor: inner, condition: { x: 1 } }
        : kind === 'remove' ? { action: 'remove', factor: inner, condition: { x: 999 } } : inner;
      config.factors = {
        a: [1, 2],
        b: [10, 20],
        p: {
          action: 'sample', factors: ['a'], numSamples: 2, samplingStrategy: 'withoutReplacement',
        },
        q: {
          action: 'sample', factors: ['b'], numSamples: 2, samplingStrategy: 'withoutReplacement',
        },
        selected: {
          action: 'zip',
          factors: kind === 'prefix' || kind === 'independentTail'
            ? [{ action: 'repeat', factors: ['p'], numRepeats: 2 }, { action: 'concat', factors: kind === 'prefix' ? ['p'] : ['p', 'q'] }]
            : ['p', wrapped],
        },
      };
      config.baseComponents!.trial = { type: 'questionnaire', response: [] };
      if (assigned) {
        config.factors.assignment = [{ a: 1 }];
        config.betweenSubjects = ['assignment'];
      }
      config.sequence = {
        type: 'factor', id: 'unsupportedZip', factor: 'selected', components: 'trial',
      };
      const parsed = await parseStudyConfig(JSON.stringify(config));
      expect(parsed.errors).toEqual(expect.arrayContaining([expect.objectContaining({
        message: expect.stringContaining('unsupported shared-draw zip'),
        category: 'sequence-validation',
      })]));
    },
  );

  test.each(['inline', 'named'] as const)('rejects differently laid out shared streams with %s draws', async (kind) => {
    const config = factorConfig();
    const draw: Exclude<FactorOption, string> = {
      action: 'sample', factors: ['a'], numSamples: 3, samplingStrategy: 'withoutReplacement',
    };
    config.factors = {
      a: [1, 2, 3],
      p: draw,
      q: draw,
      selected: { action: 'zip', factors: [{ action: 'repeat', factors: ['p'], numRepeats: 2 }, { action: 'concat', factors: ['p', kind === 'inline' ? draw : 'q'] }], as: ['x', 'y'] },
      assignment: [{ x: 2, y: 1 }],
    };
    config.betweenSubjects = ['assignment'];
    config.baseComponents!.trial = { type: 'questionnaire', response: [] };
    config.sequence = {
      type: 'factor', id: 'inlineDraw', factor: 'selected', components: 'trial',
    };
    const parsed = await parseStudyConfig(JSON.stringify(config));
    expect(parsed.errors.some((error) => error.message.includes('unsupported shared-draw zip'))).toBe(true);
  });

  test.each([14, 18, 32])('bounds partially constrained %s-input shared-zip eligibility work by groups', (inputCount) => {
    const factors: NonNullable<StudyConfig['factors']> = {
      a: [1, 2],
      p: {
        action: 'sample', factors: ['a'], numSamples: 2, samplingStrategy: 'withoutReplacement',
      },
      q: {
        action: 'sample', factors: ['a'], numSamples: 2, samplingStrategy: 'withoutReplacement',
      },
      selected: { action: 'zip', factors: [...Array<string>(inputCount - 1).fill('p'), 'q'], as: Array.from({ length: inputCount }, (_, index) => `v${index}`) },
    };
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    const original = Object.entries;
    let visits = 0;
    const entries = vi.spyOn(Object, 'entries').mockImplementation((value) => {
      if (Object.hasOwn(value, 'v0')) visits += 1;
      return original(value);
    });
    try {
      const errors: ParserErrorWarning[] = [];
      const rows = resolveOrderedFactorConditions('selected', factors, createFactorOrderContext(0), errors, 'selected', { v0: 1 });
      expect(errors).toEqual([]);
      expect(rows).toEqual([Object.fromEntries(Array.from({ length: inputCount }, (_, index) => [`v${index}`, index === inputCount - 1 ? 2 : 1]))]);
      expect(visits).toBeLessThan(inputCount ** 2 * 20);
    } finally { entries.mockRestore(); random.mockRestore(); }
  });

  test.each([false, true])('rejects shared draws through a nested cross (aliases=%s)', async (aliases) => {
    const factors: NonNullable<StudyConfig['factors']> = {
      a: [1, 2],
      b: [10, 20],
      p: {
        action: 'sample', factors: ['a'], numSamples: 2, samplingStrategy: 'withoutReplacement',
      },
      r: {
        action: 'sample', factors: ['b'], numSamples: 1, samplingStrategy: 'withoutReplacement',
      },
      q: { action: 'cross', factors: ['p', 'r'], ...(aliases ? { as: ['left', 'right'] } : {}) },
      selected: { action: 'zip', factors: ['p', 'p', 'q'] },
    };
    const expected: Record<string, number> = aliases ? {
      a_0: 1, a_1: 1, left: 1, right: 20,
    } : {
      a_0: 1, a_1: 1, a_2: 1, b: 20,
    };
    const config = factorConfig();
    config.factors = { ...factors, assignment: [expected] };
    config.betweenSubjects = ['assignment'];
    config.baseComponents!.trial = { type: 'questionnaire', response: [] };
    config.sequence = {
      type: 'factor', id: 'nestedCross', factor: 'selected', components: 'trial',
    };
    const parsed = await parseStudyConfig(JSON.stringify(config));
    expect(parsed.errors.some((error) => error.message.includes('unsupported shared-draw zip'))).toBe(true);
  });

  test.each(['fixed', 'latinSquare'] as const)('rejects runtime shared prefixes with different layouts while allowing fixed inputs (%s)', (order) => {
    const factors: NonNullable<StudyConfig['factors']> = {
      a: [1, 2],
      p: { values: [{ a: 1 }, { a: 2 }], order },
      q: {
        action: 'sample', factors: ['a'], numSamples: 1, samplingStrategy: 'withoutReplacement',
      },
      selected: { action: 'zip', factors: [{ action: 'repeat', factors: ['p'], numRepeats: 2 }, { action: 'concat', factors: ['p', 'q'] }], as: ['x', 'y'] },
    };
    [0, 1].forEach((index) => {
      const errors: ParserErrorWarning[] = [];
      expect(resolveOrderedFactorConditions('selected', factors, createFactorOrderContext(index), errors, 'selected', { x: 1, y: 2 }))
        .toEqual(order === 'latinSquare' ? [] : [{ x: 1, y: 2 }]);
      if (order === 'latinSquare') {
        expect(errors.some((error) => error.message.includes('unsupported shared-draw zip'))).toBe(true);
      } else expect(errors).toEqual([]);
    });
  });

  test('keeps independent draws eligible when both streams share a deterministic tail', () => {
    const factors: NonNullable<StudyConfig['factors']> = {
      a: [1, 2],
      c: [{ a: 3 }],
      p: {
        action: 'sample', factors: ['a'], numSamples: 2, samplingStrategy: 'withoutReplacement',
      },
      q: {
        action: 'sample', factors: ['a'], numSamples: 2, samplingStrategy: 'withoutReplacement',
      },
      selected: { action: 'zip', factors: [{ action: 'concat', factors: ['p', 'c'] }, { action: 'concat', factors: ['q', 'c'] }], as: ['x', 'y'] },
    };
    const errors: ParserErrorWarning[] = [];
    expect(resolveOrderedFactorConditions('selected', factors, createFactorOrderContext(0), errors, 'selected', { x: 1, y: 2 })).toEqual([{ x: 1, y: 2 }]);
    expect(errors).toEqual([]);
  });

  test.each(['keep', 'remove'] as const)('rejects shared draws through a %s wrapper', (action) => {
    const factors: NonNullable<StudyConfig['factors']> = {
      a: [1, 2],
      p: {
        action: 'sample', factors: ['a'], numSamples: 2, samplingStrategy: 'withoutReplacement',
      },
      q: action === 'keep' ? { action, factor: 'p', items: 'a' } : { action, factor: 'p', condition: { a: 3 } },
      selected: { action: 'zip', factors: ['p', 'p', 'q'], as: ['x', 'y', 'z'] },
    };
    const errors: ParserErrorWarning[] = [];
    expect(resolveOrderedFactorConditions('selected', factors, createFactorOrderContext(0), errors)).toEqual([]);
    expect(errors.some((error) => error.message.includes('unsupported shared-draw zip'))).toBe(true);
  });

  test.each([0, 0.99])('filters an independent sample of a shared full draw (random=%s)', (value) => {
    const factors: NonNullable<StudyConfig['factors']> = {
      a: [1, 2],
      p: {
        action: 'sample', factors: ['a'], numSamples: 2, samplingStrategy: 'withoutReplacement',
      },
      q: {
        action: 'sample', factors: ['p'], numSamples: 1, samplingStrategy: 'withoutReplacement',
      },
      selected: { action: 'zip', factors: ['p', 'p', 'q'], as: ['x', 'y', 'z'] },
    };
    const random = vi.spyOn(Math, 'random').mockReturnValue(value);
    try {
      const errors: ParserErrorWarning[] = [];
      expect(resolveOrderedFactorConditions('selected', factors, createFactorOrderContext(0), errors, 'selected', { x: 1, y: 1, z: 2 }))
        .toEqual([{ x: 1, y: 1, z: 2 }]);
      expect(errors).toEqual([]);
    } finally { random.mockRestore(); }
  });

  test.each([3, 5])('materializes only correlated rows across %s interleaved inputs', async (length) => {
    const config = factorConfig();
    const inputs = ['p', 'q', 'p', 'q', 'p'].slice(0, length);
    config.factors = {
      a: [1, 2],
      b: [3, 4],
      p: {
        action: 'sample', factors: ['a'], numSamples: 2, samplingStrategy: 'withoutReplacement',
      },
      q: {
        action: 'sample', factors: ['b'], numSamples: 1, samplingStrategy: 'withoutReplacement',
      },
      selected: { action: 'zip', factors: inputs, as: inputs.map((_, index) => `v${index}`) },
    };
    config.baseComponents = { trial11: { type: 'questionnaire', response: [] }, trial22: { type: 'questionnaire', response: [] } };
    config.sequence = {
      type: 'factor', id: 'strictGroupedTemplates', factor: 'selected', components: 'trial{{v0}}{{v2}}',
    };
    const parsed = await parseStudyConfig(JSON.stringify(config));
    expect(parsed.errors).toEqual([]);
    generateSequenceArray(parsed).forEach((sequence) => {
      getSequenceFlatMap(sequence).filter((id) => id !== 'end').forEach((id) => {
        const parameters = parsed.components[id].parameters!;
        inputs.forEach((input, index) => {
          if (input === 'p') expect(parameters[`v${index}`]).toBe(parameters.v0);
        });
      });
    });
  });

  test.each([3, 5, 8, 32].flatMap((length) => [0, 0.99].flatMap((random) => (
    [false, true].map((conflict) => ({ length, random, conflict }))
  ))))('preserves shared input groups for $length inputs (random=$random, conflict=$conflict)', async ({ length, random: value, conflict }) => {
    const config = factorConfig();
    const pattern = length === 3 ? ['p', 'p', 'q'] : ['p', 'r', 'p', 'q', 'r', 'p', 'r', 'q'];
    const inputs = Array.from({ length }, (_, index) => pattern[index % pattern.length]);
    const aliases = inputs.map((_, index) => `v${index}`);
    const assignment = Object.fromEntries(inputs.map((input, index) => [aliases[index], input === 'p' ? 1 : input === 'r' ? 10 : 100]));
    if (conflict) assignment[aliases[inputs.lastIndexOf('p')]] = 2;
    config.factors = {
      a: [1, 2],
      b: [10, 20],
      c: [100, 200],
      p: {
        action: 'sample', factors: ['a'], numSamples: 2, samplingStrategy: 'withoutReplacement',
      },
      r: {
        action: 'sample', factors: ['b'], numSamples: 2, samplingStrategy: 'withoutReplacement',
      },
      q: {
        action: 'sample', factors: ['c'], numSamples: 1, samplingStrategy: 'withoutReplacement',
      },
      selected: { action: 'zip', factors: inputs, as: aliases },
      assignment: [assignment],
    };
    config.betweenSubjects = ['assignment'];
    config.baseComponents!.trial = { type: 'questionnaire', response: [] };
    config.sequence = {
      type: 'factor', id: 'sharedGroups', factor: 'selected', components: 'trial',
    };
    const random = vi.spyOn(Math, 'random').mockReturnValue(value);
    try {
      const parsed = await parseStudyConfig(JSON.stringify(config));
      expect(parsed.errors).toEqual([]);
      generateSequenceArray(parsed).forEach((sequence) => {
        const rows = getSequenceFlatMap(sequence).filter((id) => id !== 'end').map((id) => parsed.components[id].parameters);
        expect(rows).toEqual(conflict ? [] : [assignment]);
      });
    } finally { random.mockRestore(); }
  });

  test('rejects differently laid out shared segments with an independent partial tail', () => {
    const factors: NonNullable<StudyConfig['factors']> = {
      a: [1, 2],
      p: {
        action: 'sample', factors: ['a'], numSamples: 2, samplingStrategy: 'withoutReplacement',
      },
      q: {
        action: 'sample', factors: ['a'], numSamples: 1, samplingStrategy: 'withoutReplacement',
      },
      selected: { action: 'zip', factors: [{ action: 'repeat', factors: ['p'], numRepeats: 2 }, { action: 'concat', factors: ['p', 'q'] }], as: ['x', 'y'] },
    };
    const errors: ParserErrorWarning[] = [];
    expect(resolveOrderedFactorConditions('selected', factors, createFactorOrderContext(0), errors)).toEqual([]);
    expect(errors.some((error) => error.message.includes('unsupported shared-draw zip'))).toBe(true);
  });

  test.each([1, 2])('filters independent %s-row draws alongside a shared pair', (numSamples) => {
    const factors: NonNullable<StudyConfig['factors']> = {
      a: [1, 2],
      b: [3, 4],
      p: {
        action: 'sample', factors: ['a'], numSamples: 2, samplingStrategy: 'withoutReplacement',
      },
      q: {
        action: 'sample', factors: ['b'], numSamples, samplingStrategy: 'withoutReplacement',
      },
      selected: { action: 'zip', factors: ['p', 'p', 'q'] },
    };
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      const errors: ParserErrorWarning[] = [];
      const context = createFactorOrderContext(0);
      expect(resolveOrderedFactorConditions('selected', factors, context, errors, 'selected', { a_0: 1, a_1: 1, b: 4 }))
        .toEqual([{ a_0: 1, a_1: 1, b: 4 }]);
      // Protecting the pair must not change eligibility for later resolutions.
      expect(resolveOrderedFactorConditions('p', factors, context, errors, 'p', { a: 1 })).toEqual([{ a: 1 }]);
      expect(errors).toEqual([]);
    } finally { random.mockRestore(); }
  });

  test.each(['fixed', 'latinSquare'] as const)('preserves aligned %s ordering without treating it as ownership', (order) => {
    const factors: NonNullable<StudyConfig['factors']> = {
      a: { values: [1, 2], order },
      b: { values: [3, 4], order },
      selected: { action: 'zip', factors: ['a', 'b'], as: ['x', 'y'] },
    };
    [0, 1].forEach((index) => {
      const errors: ParserErrorWarning[] = [];
      expect(resolveOrderedFactorConditions('selected', factors, createFactorOrderContext(index), errors, 'selected', { x: 1, y: 4 })).toEqual([]);
      expect(errors).toEqual([]);
    });
  });

  test.each(['array', 'fixed', 'latinSquare'] as const)('keeps independent draws independent with matching %s tails', async (order) => {
    const config = factorConfig();
    config.factors = {
      a: [1, 2],
      p: {
        action: 'sample', factors: ['a'], numSamples: 2, samplingStrategy: 'withoutReplacement',
      },
      q: {
        action: 'sample', factors: ['a'], numSamples: 2, samplingStrategy: 'withoutReplacement',
      },
      c: order === 'array' ? [{ a: 3 }] : { values: [{ a: 3 }], order },
      d: order === 'array' ? [{ a: 4 }] : { values: [{ a: 4 }], order },
      selected: {
        action: 'zip',
        factors: [{ action: 'concat', factors: ['p', 'c'] }, { action: 'concat', factors: ['q', 'd'] }],
        as: ['x', 'y'],
      },
      assignment: [{ x: 1, y: 2 }],
    };
    config.betweenSubjects = ['assignment'];
    config.baseComponents!.trial = { type: 'questionnaire', response: [] };
    config.sequence = {
      type: 'factor', id: 'independentTails', factor: 'selected', components: 'trial',
    };
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      const errors: ParserErrorWarning[] = [];
      expect(resolveOrderedFactorConditions('selected', config.factors, createFactorOrderContext(0), errors, 'selected', { x: 1, y: 2 }))
        .toEqual([{ x: 1, y: 2 }]);
      expect(errors).toEqual([]);
      const parsed = await parseStudyConfig(JSON.stringify(config));
      expect(parsed.errors).toEqual([]);
      generateSequenceArray(parsed).forEach((sequence) => {
        const rows = getSequenceFlatMap(sequence).filter((id) => id !== 'end').map((id) => parsed.components[id].parameters);
        expect(rows).toEqual([{ x: 1, y: 2 }]);
      });
    } finally { random.mockRestore(); }
  });

  test.each((['prefix', 'partialOverlap'] as const).flatMap((kind) => (
    [false, true].map((unknownCount) => ({ kind, unknownCount }))
  )))('rejects shared draws across different $kind streams (unknownCount=$unknownCount)', async ({ kind, unknownCount }) => {
    const config = factorConfig();
    config.factors = {
      a: [1, 2],
      one: [{ a: 1 }],
      two: [{ a: 2 }],
      three: [{ a: 3 }],
      p: unknownCount ? {
        action: 'remove',
        condition: { a: 3 },
        factor: {
          action: 'concat',
          factors: ['one', {
            action: 'sample', factors: ['two'], numSamples: 3, samplingStrategy: 'withReplacement',
          }, 'three'],
        },
      } : {
        action: 'sample', factors: ['a'], numSamples: 2, samplingStrategy: 'withoutReplacement',
      },
      q: {
        action: 'sample', factors: ['a'], numSamples: 2, samplingStrategy: 'withoutReplacement',
      },
      left: { action: 'repeat', factors: ['p'], numRepeats: 2 },
      right: { action: 'concat', factors: kind === 'prefix' ? ['p'] : ['p', 'q'] },
      selected: { action: 'zip', factors: ['left', 'right'], as: ['x', 'y'] },
      assignment: [{ x: 1, y: 2 }],
    };
    config.betweenSubjects = ['assignment'];
    config.baseComponents!.trial = { type: 'questionnaire', response: [] };
    config.sequence = {
      type: 'factor', id: 'prefixOwnership', factor: 'selected', components: 'trial',
    };
    const parsed = await parseStudyConfig(JSON.stringify(config));
    expect(parsed.errors.some((error) => error.message.includes('unsupported shared-draw zip'))).toBe(true);
  });

  test('rejects a shared prefix zip used as a removal selector', async () => {
    const config = factorConfig();
    config.factors = {
      a: [1, 2],
      p: {
        action: 'sample', factors: ['a'], numSamples: 2, samplingStrategy: 'withoutReplacement',
      },
      source: { action: 'cross', factors: ['a', 'a'], as: ['x', 'y'] },
      selected: {
        action: 'remove',
        factor: 'source',
        items: { action: 'zip', factors: [{ action: 'repeat', factors: ['p'], numRepeats: 2 }, 'p'], as: ['x', 'y'] },
      },
    };
    config.baseComponents = {
      trial12: { type: 'questionnaire', response: [] }, trial21: { type: 'questionnaire', response: [] },
    };
    config.sequence = {
      type: 'factor', id: 'prefixRemoval', factor: 'selected', components: 'trial{{x}}{{y}}',
    };
    const parsed = await parseStudyConfig(JSON.stringify(config));
    expect(parsed.errors.some((error) => error.message.includes('unsupported shared-draw zip'))).toBe(true);
  });

  test.each(['partial', 'independent'] as const)('rejects shared unequal streams while allowing independent samples (%s)', (kind) => {
    const draw: Exclude<FactorOption, string> = {
      action: 'sample', factors: ['a'], numSamples: kind === 'partial' ? 1 : 2, samplingStrategy: 'withoutReplacement',
    };
    const factors: NonNullable<StudyConfig['factors']> = {
      a: [1, 2],
      p: draw,
      q: draw,
      selected: { action: 'zip', factors: [{ action: 'repeat', factors: ['p'], numRepeats: 2 }, kind === 'partial' ? 'p' : 'q'], as: ['x', 'y'] },
    };
    const errors: ParserErrorWarning[] = [];
    expect(resolveOrderedFactorConditions('selected', factors, createFactorOrderContext(0), errors, 'selected', { x: 1, y: 2 })).toEqual(kind === 'partial' ? [] : [{ x: 1, y: 2 }]);
    if (kind === 'partial') {
      expect(errors.some((error) => error.message.includes('unsupported shared-draw zip'))).toBe(true);
    } else expect(errors).toEqual([]);
  });

  test.each(['cross', 'zip'] as const)('rejects shared draws through nested %s groupings', async (action) => {
    const config = factorConfig();
    config.factors = {
      a: [1, 2],
      p: {
        action: 'sample', factors: ['a'], numSamples: 2, samplingStrategy: 'withoutReplacement',
      },
      left: { action, factors: [{ action, factors: ['p', 'p'] }, 'p'] },
      right: { action, factors: ['p', { action, factors: ['p', 'p'] }] },
      selected: { action: 'zip', factors: ['left', 'right'] },
      assignment: [{ a_0: 1, a_3: 2 }],
    };
    config.betweenSubjects = ['assignment'];
    config.baseComponents!.trial = { type: 'questionnaire', response: [] };
    config.sequence = {
      type: 'factor', id: 'associativePairing', factor: 'selected', components: 'trial',
    };
    const parsed = await parseStudyConfig(JSON.stringify(config));
    expect(parsed.errors.some((error) => error.message.includes('unsupported shared-draw zip'))).toBe(true);
  });

  test('materializes only surviving templates for equivalent repeat and concat draws', async () => {
    const config = factorConfig();
    config.factors = {
      a: [1, 2],
      p: {
        action: 'sample', factors: ['a'], numSamples: 2, samplingStrategy: 'withoutReplacement',
      },
      left: { action: 'repeat', factors: ['p'], numRepeats: 2 },
      right: { action: 'concat', factors: ['p', 'p'] },
      source: { action: 'cross', factors: ['a', 'a'], as: ['x', 'y'] },
      selected: { action: 'remove', factor: 'source', items: { action: 'zip', factors: ['left', 'right'], as: ['x', 'y'] } },
    };
    config.baseComponents = {
      trial12: { type: 'questionnaire', response: [] }, trial21: { type: 'questionnaire', response: [] },
    };
    config.sequence = {
      type: 'factor', id: 'equivalentRemoval', factor: 'selected', components: 'trial{{x}}{{y}}',
    };
    const parsed = await parseStudyConfig(JSON.stringify(config));
    expect(parsed.errors).toEqual([]);
    generateSequenceArray(parsed).forEach((sequence) => {
      const rows = getSequenceFlatMap(sequence).filter((id) => id !== 'end').map((id) => parsed.components[id].parameters);
      expect(rows).toEqual([{ x: 1, y: 2 }, { x: 2, y: 1 }]);
    });
  });

  test('keeps static definitions isolated by factor set', () => {
    const { definitions } = createFactorOrderContext(0);
    const first: NonNullable<StudyConfig['factors']> = {
      a: [1, 2],
      p: {
        action: 'sample', factors: ['a'], numSamples: 2, samplingStrategy: 'withoutReplacement',
      },
      selected: { action: 'zip', factors: ['p', 'p'], as: ['left', 'right'] },
    };
    const second: NonNullable<StudyConfig['factors']> = {
      ...first,
      a: [3, 4],
      p: {
        action: 'sample', factors: ['a'], numSamples: 1, samplingStrategy: 'withoutReplacement',
      },
    };
    const errors: ParserErrorWarning[] = [];
    expect(resolveOrderedFactorConditions('selected', first, createFactorOrderContext(0, definitions), errors)).toHaveLength(2);
    expect(resolveOrderedFactorConditions('selected', second, createFactorOrderContext(0, definitions), errors, 'inline', { left: 3, right: 4 })).toEqual([{ left: 3, right: 4 }]);
    expect(errors).toEqual([]);
  });

  test.each(['repeatConcat', 'groupedConcat', 'nestedRepeat'] as const)('normalizes equivalent shared draw compositions (%s)', async (kind) => {
    const config = factorConfig();
    const repeat = (factor: FactorOption, numRepeats: number): Exclude<FactorOption, string> => ({ action: 'repeat', factors: [factor], numRepeats });
    const concat = (...factors: FactorOption[]): Exclude<FactorOption, string> => ({ action: 'concat', factors });
    const left = kind === 'repeatConcat' ? repeat('p', 2)
      : kind === 'groupedConcat' ? concat('p', concat('p', 'p')) : repeat(repeat('p', 2), 2);
    const right = kind === 'repeatConcat' ? concat('p', 'p')
      : kind === 'groupedConcat' ? concat(concat('p', 'p'), 'p') : repeat('p', 4);
    config.factors = {
      a: [1, 2],
      p: {
        action: 'sample', factors: ['a'], numSamples: 2, samplingStrategy: 'withoutReplacement',
      },
      left,
      right,
      selected: { action: 'zip', factors: ['left', 'right'], as: ['x', 'y'] },
      assignment: [{ x: 1, y: 2 }],
    };
    config.betweenSubjects = ['assignment'];
    config.baseComponents!.trial = { type: 'questionnaire', response: [] };
    config.sequence = {
      type: 'factor', id: 'equivalentDraws', factor: 'selected', components: 'trial',
    };
    const parsed = await parseStudyConfig(JSON.stringify(config));
    expect(parsed.errors).toEqual([]);
    generateSequenceArray(parsed).forEach((sequence) => expect(getSequenceFlatMap(sequence)).toEqual(['end']));
  });

  test('reuses unassigned membership metadata across generated sequences', async () => {
    const levelCount = 20;
    const sequenceCount = 20;
    const config = factorConfig();
    config.uiConfig.numSequences = sequenceCount;
    config.factors = {
      a: { values: Array.from({ length: levelCount }, (_, index) => index), order: 'random' },
      b: { values: Array.from({ length: levelCount }, (_, index) => index), order: 'random' },
      p: { action: 'keep', factor: { action: 'zip', factors: ['a', 'b'] }, condition: { a: 1 } },
      left: { action: 'concat', factors: ['p'] },
      r: {
        action: 'sample', factors: ['p'], numSamples: 1, samplingStrategy: 'withoutReplacement',
      },
      right: { action: 'concat', factors: ['r'] },
      selected: { action: 'zip', factors: ['left', 'right'] },
    };
    config.baseComponents!.trial = { type: 'questionnaire', response: [] };
    config.sequence = {
      type: 'factor', id: 'membershipWork', factor: 'selected', components: 'trial',
    };
    const parsed = await parseStudyConfig(JSON.stringify(config));
    expect(parsed.errors).toEqual([]);
    let visits = 0;
    const original = Object.entries;
    const traversal = vi.spyOn(Object, 'entries').mockImplementation((value) => {
      if (Object.hasOwn(value, 'a') && Object.hasOwn(value, 'b')) visits += 1;
      return original(value);
    });
    try {
      const sequences = generateSequenceArray(parsed);
      expect(sequences).toHaveLength(sequenceCount);
      sequences.forEach((sequence) => expect(getSequenceFlatMap(sequence)).toHaveLength(2));
      // One static domain expansion, then linear runtime work per sequence.
      expect(visits).toBeLessThan(levelCount ** 2 * 6 + sequenceCount * levelCount * 10);
    } finally { traversal.mockRestore(); }
  });

  test('keeps participant draws separate while sharing static definitions', async () => {
    const config = factorConfig();
    config.factors = {
      a: [1, 2],
      p: {
        action: 'sample', factors: ['a'], numSamples: 1, samplingStrategy: 'withoutReplacement',
      },
      selected: { action: 'zip', factors: ['p', 'p'], as: ['left', 'right'] },
    };
    config.baseComponents!.trial = { type: 'questionnaire', response: [] };
    config.sequence = {
      type: 'factor', id: 'freshDraws', factor: 'selected', components: 'trial',
    };
    const parsed = await parseStudyConfig(JSON.stringify(config));
    expect(parsed.errors).toEqual([]);
    const random = vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValue(0.99);
    try {
      const rows = generateSequenceArray(parsed).map((sequence) => getSequenceFlatMap(sequence).filter((id) => id !== 'end').map((id) => parsed.components[id].parameters));
      expect(rows).toEqual([[{ left: 2, right: 2 }], [{ left: 1, right: 1 }]]);
    } finally { random.mockRestore(); }
  });

  test.each([false, true])('rejects hidden filters while allowing simple shared-draw wrappers (unknownCount=%s)', async (unknownCount) => {
    const config = factorConfig();
    config.factors = {
      a: [1, 2],
      one: [{ a: 1 }],
      two: [{ a: 2 }],
      three: [{ a: 3 }],
      p: unknownCount ? {
        action: 'remove',
        condition: { a: 3 },
        factor: {
          action: 'concat',
          factors: ['one', {
            action: 'sample', factors: ['two'], numSamples: 3, samplingStrategy: 'withReplacement',
          }, 'three'],
        },
      } : {
        action: 'sample', factors: ['a'], numSamples: 2, samplingStrategy: 'withoutReplacement',
      },
      left: { action: 'concat', factors: ['p'] },
      right: { action: 'cross', factors: ['p'], as: ['r'] },
      selected: { action: 'zip', factors: ['left', 'right'], as: ['x', 'y'] },
      assignment: [{ x: 1, y: 2 }],
    };
    config.betweenSubjects = ['assignment'];
    config.baseComponents!.trial = { type: 'questionnaire', response: [] };
    config.sequence = {
      type: 'factor', id: 'mixedWrapperZip', factor: 'selected', components: 'trial',
    };
    const parsed = await parseStudyConfig(JSON.stringify(config));
    if (unknownCount) {
      expect(parsed.errors.some((error) => error.message.includes('unsupported shared-draw zip'))).toBe(true);
    } else {
      expect(parsed.errors).toEqual([]);
      generateSequenceArray(parsed).forEach((sequence) => expect(getSequenceFlatMap(sequence)).toEqual(['end']));
    }
  });

  test.each(['partial', 'independent', 'filtered'] as const)('keeps independent and partial draws eligible and rejects shared filters (%s)', (kind) => {
    const draw: FactorOption = {
      action: 'sample', factors: ['a'], numSamples: kind === 'partial' ? 1 : 2, samplingStrategy: 'withoutReplacement',
    };
    const factors: NonNullable<StudyConfig['factors']> = {
      a: [1, 2],
      p: draw,
      q: draw,
      left: kind === 'filtered' ? { action: 'keep', factor: 'p', condition: { a: 1 } } : { action: 'concat', factors: ['p'] },
      right: kind === 'filtered' ? { action: 'keep', factor: 'p', condition: { a: 2 } } : { action: 'cross', factors: [kind === 'independent' ? 'q' : 'p'] },
      selected: { action: 'zip', factors: ['left', 'right'], as: ['x', 'y'] },
    };
    const random = vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValue(0.99);
    try {
      const errors: ParserErrorWarning[] = [];
      const assignment = kind === 'partial' ? { x: 1, y: 2 } : undefined;
      const rows = resolveOrderedFactorConditions('selected', factors, createFactorOrderContext(0), errors, 'selected', assignment);
      expect(rows).toEqual(kind === 'filtered' ? [] : kind === 'independent' ? [{ x: 2, y: 1 }, { x: 1, y: 2 }] : [{ x: 1, y: 2 }]);
      if (kind === 'filtered') {
        expect(errors.some((error) => error.message.includes('unsupported shared-draw zip'))).toBe(true);
      } else expect(errors).toEqual([]);
    } finally { random.mockRestore(); }
  });

  test.each(['concat', 'cross', 'zip', 'repeat'] as const)('preserves cached draw identity through %s wrappers', async (wrapper) => {
    const config = factorConfig();
    const wrap = (alias: string): Exclude<FactorOption, string> => (wrapper === 'repeat'
      ? { action: 'repeat', factors: ['p'], numRepeats: 2 }
      : { action: wrapper, factors: ['p'], ...(wrapper === 'cross' || wrapper === 'zip' ? { as: [alias] } : {}) });
    config.factors = {
      a: [1, 2],
      p: {
        action: 'sample', factors: ['a'], numSamples: 2, samplingStrategy: 'withoutReplacement',
      },
      left: wrap('l'),
      right: wrap('r'),
      selected: { action: 'zip', factors: ['left', 'right'], as: ['x', 'y'] },
      assignment: [{ x: 1, y: 2 }],
    };
    config.betweenSubjects = ['assignment'];
    config.baseComponents!.trial = { type: 'questionnaire', response: [] };
    config.sequence = {
      type: 'factor', id: 'sharedWrapper', factor: 'selected', components: 'trial',
    };
    const parsed = await parseStudyConfig(JSON.stringify(config));
    expect(parsed.errors).toEqual([]);
    generateSequenceArray(parsed).forEach((sequence) => expect(getSequenceFlatMap(sequence)).toEqual(['end']));
  });

  test('rejects a filtered shared draw used as a zip removal selector', async () => {
    const config = factorConfig();
    config.factors = {
      a: [1, 2, 3],
      one: [{ a: 1 }],
      two: [{ a: 2 }],
      three: [{ a: 3 }],
      p: {
        action: 'remove',
        condition: { a: 3 },
        factor: {
          action: 'concat',
          factors: ['one', {
            action: 'sample', factors: ['two'], numSamples: 3, samplingStrategy: 'withReplacement',
          }, 'three'],
        },
      },
      selected: { action: 'remove', factor: { action: 'cross', factors: ['a', 'a'] }, items: { action: 'zip', factors: ['p', 'p'] } },
    };
    config.baseComponents = Object.fromEntries(['12', '21', '13', '31', '23', '32', '33'].map((pair) => [
      `trial${pair}`, { type: 'questionnaire', response: [] },
    ]));
    config.sequence = {
      type: 'factor', id: 'unknownCountZip', factor: 'selected', components: 'trial{{a_0}}{{a_1}}',
    };
    const parsed = await parseStudyConfig(JSON.stringify(config));
    expect(parsed.errors.some((error) => error.message.includes('unsupported shared-draw zip'))).toBe(true);
  });

  test.each([false, true])('preserves full named sample zip membership (expanded=%s)', async (expanded) => {
    const config = factorConfig();
    config.factors = {
      a: [1, 2],
      one: [{ a: 1 }],
      two: [{ a: 2 }],
      p: {
        action: 'sample',
        factors: expanded ? ['one', {
          action: 'sample', factors: ['two'], numSamples: 3, samplingStrategy: 'withReplacement',
        }] : ['a'],
        numSamples: expanded ? 4 : 2,
        samplingStrategy: 'withoutReplacement',
      },
      source: { action: 'cross', factors: ['a', 'a'] },
      selected: { action: 'remove', factor: 'source', items: { action: 'zip', factors: ['p', 'p'] } },
    };
    config.baseComponents = {
      trial12: { type: 'questionnaire', response: [] }, trial21: { type: 'questionnaire', response: [] },
    };
    config.sequence = {
      type: 'factor', id: 'namedZip', factor: 'selected', components: 'trial{{a_0}}{{a_1}}',
    };
    const parsed = await parseStudyConfig(JSON.stringify(config));
    expect(parsed.errors).toEqual([]);
    generateSequenceArray(parsed).forEach((sequence) => {
      const rows = getSequenceFlatMap(sequence).filter((id) => id !== 'end').map((id) => parsed.components[id].parameters);
      expect(rows).toEqual([{ a_0: 1, a_1: 2 }, { a_0: 2, a_1: 1 }]);
    });
  });

  test.each([1, 2])('filters paired rows of a shared full named sample (right=%i)', async (right) => {
    const config = factorConfig();
    config.factors = {
      a: [1, 2],
      p: {
        action: 'sample', factors: ['a'], numSamples: 2, samplingStrategy: 'withoutReplacement',
      },
      selected: { action: 'zip', factors: ['p', 'p'], as: ['left', 'right'] },
      assignment: [{ left: 1, right }],
    };
    config.betweenSubjects = ['assignment'];
    config.baseComponents!.trial = { type: 'questionnaire', response: [] };
    config.sequence = {
      type: 'factor', id: 'assignedNamedZip', factor: 'selected', components: 'trial',
    };
    const parsed = await parseStudyConfig(JSON.stringify(config));
    expect(parsed.errors).toEqual([]);
    generateSequenceArray(parsed).forEach((sequence) => {
      const rows = getSequenceFlatMap(sequence).filter((id) => id !== 'end').map((id) => parsed.components[id].parameters);
      expect(rows).toEqual(right === 1 ? [{ left: 1, right: 1 }] : []);
    });
  });

  test('keeps partial named samples eligible before zip selection', () => {
    const factors: NonNullable<StudyConfig['factors']> = {
      a: [1, 2],
      p: {
        action: 'sample', factors: ['a'], numSamples: 1, samplingStrategy: 'withoutReplacement',
      },
      selected: { action: 'zip', factors: ['p', 'p'], as: ['left', 'right'] },
    };
    const errors: ParserErrorWarning[] = [];
    expect(resolveOrderedFactorConditions('selected', factors, createFactorOrderContext(0), errors, 'selected', { left: 1, right: 2 })).toEqual([{ left: 1, right: 2 }]);
    expect(errors).toEqual([]);
  });

  test('keeps independent inline full samples uncorrelated', () => {
    const draw: FactorOption = {
      action: 'sample', factors: ['a'], numSamples: 2, samplingStrategy: 'withoutReplacement',
    };
    const factors: NonNullable<StudyConfig['factors']> = { a: [1, 2], selected: { action: 'zip', factors: [draw, draw], as: ['left', 'right'] } };
    const random = vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValue(0.99);
    try {
      const errors: ParserErrorWarning[] = [];
      expect(resolveOrderedFactorConditions('selected', factors, createFactorOrderContext(0), errors, 'selected')).toEqual([{ left: 2, right: 1 }, { left: 1, right: 2 }]);
      expect(errors).toEqual([]);
    } finally { random.mockRestore(); }
  });

  test.each(['singleInput', 'sharedPartial'] as const)('applies eligibility before partial sampling in a %s zip', (kind) => {
    const factors: NonNullable<StudyConfig['factors']> = {
      a: { values: [1, 2], order: 'random', numSamples: 1 },
      selected: { action: 'zip', factors: kind === 'singleInput' ? ['a'] : ['a', 'a'], ...(kind === 'singleInput' ? {} : { as: ['left', 'right'] }) },
    };
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      const errors: ParserErrorWarning[] = [];
      expect(resolveOrderedFactorConditions('selected', factors, createFactorOrderContext(0), errors, 'selected', kind === 'singleInput' ? { a: 1 } : { left: 1, right: 1 })).toEqual([
        kind === 'singleInput' ? { a: 1 } : { left: 1, right: 1 },
      ]);
      expect(errors).toEqual([]);
    } finally { random.mockRestore(); }
  });

  test.each(['random', 'latinSquare'] as const)('filters complete correlated %s zip rows before assigning participants', (order) => {
    const factors: NonNullable<StudyConfig['factors']> = {
      a: { values: [1, 2], order },
      selected: { action: 'zip', factors: ['a', 'a'], as: ['left', 'right'] },
    };
    const errors: ParserErrorWarning[] = [];
    expect(resolveOrderedFactorConditions('selected', factors, createFactorOrderContext(0), errors, 'selected', { left: 1, right: 1 })).toEqual([{ left: 1, right: 1 }]);
    expect(resolveOrderedFactorConditions('selected', factors, createFactorOrderContext(0), errors, 'selected', { left: 1, right: 2 })).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('proves full zip membership when constant inputs cover one varying input', async () => {
    const config = factorConfig();
    config.factors = {
      a: [1, 2],
      b: [0, 9],
      zero: [{ b: 0 }],
      source: { action: 'cross', factors: ['a', 'b'] },
      selected: {
        action: 'remove',
        factor: 'source',
        items: {
          action: 'zip',
          factors: [
            {
              action: 'sample', factors: ['a'], numSamples: 2, samplingStrategy: 'withoutReplacement',
            },
            {
              action: 'sample', factors: ['zero'], numSamples: 3, samplingStrategy: 'withReplacement',
            },
          ],
        },
      },
    };
    config.baseComponents = {
      trial19: { type: 'questionnaire', response: [] }, trial29: { type: 'questionnaire', response: [] },
    };
    config.sequence = {
      type: 'factor', id: 'constantZip', factor: 'selected', components: 'trial{{a}}{{b}}',
    };
    const parsed = await parseStudyConfig(JSON.stringify(config));
    expect(parsed.errors).toEqual([]);
    generateSequenceArray(parsed).forEach((sequence) => {
      const rows = getSequenceFlatMap(sequence).filter((id) => id !== 'end').map((id) => parsed.components[id].parameters);
      expect(rows).toEqual([{ a: 1, b: 9 }, { a: 2, b: 9 }]);
    });
  });

  test.each(['sharedRandom', 'latinSquare'] as const)('materializes only survivors of a correlated %s zip', async (kind) => {
    const config = factorConfig();
    config.factors = {
      a: { values: [1, 2], order: kind === 'sharedRandom' ? 'random' : 'latinSquare' },
      b: { values: [1, 2], order: 'latinSquare' },
      source: { action: 'cross', factors: kind === 'sharedRandom' ? ['a', 'a'] : ['a', 'b'] },
      selected: { action: 'remove', factor: 'source', items: { action: 'zip', factors: kind === 'sharedRandom' ? ['a', 'a'] : ['a', 'b'] } },
    };
    config.baseComponents = {
      trial12: { type: 'questionnaire', response: [] }, trial21: { type: 'questionnaire', response: [] },
    };
    config.sequence = {
      type: 'factor', id: 'correlatedZip', factor: 'selected', components: kind === 'sharedRandom' ? 'trial{{a_0}}{{a_1}}' : 'trial{{a}}{{b}}',
    };
    const parsed = await parseStudyConfig(JSON.stringify(config));
    expect(parsed.errors).toEqual([]);
    generateSequenceArray(parsed).forEach((sequence) => {
      const rows = getSequenceFlatMap(sequence).filter((id) => id !== 'end').map((id) => parsed.components[id].parameters);
      expect(rows).toHaveLength(2);
      expect(rows).toEqual(expect.arrayContaining(kind === 'sharedRandom'
        ? [{ a_0: 1, a_1: 2 }, { a_0: 2, a_1: 1 }] : [{ a: 1, b: 2 }, { a: 2, b: 1 }]));
    });
  });

  test('keeps selector constraints local to each public condition shape', async () => {
    const config = factorConfig();
    config.factors = {
      a: { values: [1, 2], order: 'latinSquare' },
      left: { action: 'cross', factors: ['a'], as: ['x'] },
      selected: { action: 'keep', factor: { action: 'concat', factors: ['a', 'left'] }, items: 'a' },
      assignment: [{ a: 1 }],
    };
    config.betweenSubjects = ['assignment'];
    config.baseComponents!.trial = { type: 'questionnaire', response: [] };
    config.sequence = {
      type: 'factor', id: 'selectorShapes', factor: 'selected', components: 'trial',
    };
    const parsed = await parseStudyConfig(JSON.stringify(config));
    expect(parsed.errors).toEqual([]);
    generateSequenceArray(parsed).forEach((sequence) => {
      const rows = getSequenceFlatMap(sequence).filter((id) => id !== 'end').map((id) => parsed.components[id].parameters);
      expect(rows).toEqual(expect.arrayContaining([{ a: 1 }, { x: 1 }, { x: 2 }]));
      expect(rows).toHaveLength(3);
    });
  });

  test('does not apply unrelated generated-slot names inside source selectors', () => {
    const factors: NonNullable<StudyConfig['factors']> = {
      a: { values: [1, 2], order: 'latinSquare' },
      left: { action: 'cross', factors: ['a'], as: ['x'] },
      source: { action: 'cross', factors: ['a', 'left'] },
      selected: { action: 'keep', factor: 'source', items: { action: 'cross', factors: ['a', 'a'] } },
    };
    const errors: ParserErrorWarning[] = [];
    expect(resolveOrderedFactorConditions('selected', factors, createFactorOrderContext(0), errors, 'selected', { a_0: 1 })).toHaveLength(4);
    expect(errors).toEqual([]);
  });

  test.each([2, 3])('outer sample of %i uses expanded runtime cardinality', async (numSamples) => {
    const config = factorConfig();
    config.factors = {
      a: [1, 2, 3],
      one: [{ a: 1 }],
      two: [{ a: 2 }],
      selector: {
        action: 'sample',
        factors: ['one', {
          action: 'sample', factors: ['two'], numSamples: 3, samplingStrategy: 'withReplacement',
        }],
        numSamples,
        samplingStrategy: 'withoutReplacement',
      },
      selected: { action: 'remove', factor: 'a', items: 'selector' },
    };
    config.baseComponents!.trial = { type: 'questionnaire', response: [] };
    config.sequence = {
      type: 'factor', id: 'expandedPool', factor: 'selected', components: 'trial',
    };
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      const parsed = await parseStudyConfig(JSON.stringify(config));
      expect(parsed.errors).toEqual([]);
      const diagnostics: ParserErrorWarning[] = [];
      generateSequenceArray(parsed, diagnostics).forEach((sequence) => {
        const values = getSequenceFlatMap(sequence).filter((id) => id !== 'end').map((id) => parsed.components[id].parameters!.a);
        expect(values).toEqual([1, 3]);
      });
      expect([...parsed.warnings, ...diagnostics].filter((warning) => warning.message.includes('are available'))).toEqual([]);
    } finally { random.mockRestore(); }
  });

  test('zip cardinality equality does not prove complete pair membership', async () => {
    const config = factorConfig();
    config.factors = {
      a: [1, 2],
      b: [1, 2],
      aOne: [{ a: 1 }],
      aTwo: [{ a: 2 }],
      bOne: [{ b: 1 }],
      bTwo: [{ b: 2 }],
      aRows: {
        action: 'concat',
        factors: ['aOne', {
          action: 'sample', factors: ['aTwo'], numSamples: 3, samplingStrategy: 'withReplacement',
        }],
      },
      bRows: {
        action: 'concat',
        factors: ['bOne', {
          action: 'sample', factors: ['bTwo'], numSamples: 3, samplingStrategy: 'withReplacement',
        }],
      },
      source: { action: 'cross', factors: ['a', 'b'] },
      selector: { action: 'zip', factors: ['aRows', 'bRows'] },
      selected: { action: 'remove', factor: 'source', items: 'selector' },
    };
    config.baseComponents!.trial = { type: 'questionnaire', response: [] };
    config.sequence = {
      type: 'factor', id: 'duplicateZip', factor: 'selected', components: 'trial',
    };
    const parsed = await parseStudyConfig(JSON.stringify(config));
    expect(parsed.errors).toEqual([]);
    generateSequenceArray(parsed).forEach((sequence) => {
      const rows = getSequenceFlatMap(sequence).filter((id) => id !== 'end').map((id) => parsed.components[id].parameters);
      expect(rows).toEqual([{ a: 1, b: 2 }, { a: 2, b: 1 }]);
    });
  });

  test.each((['concat', 'repeat', 'cross', 'zip'] as const).flatMap((wrapper) => (
    (['withoutReplacement', 'withReplacement'] as const).map((samplingStrategy) => ({ wrapper, samplingStrategy }))
  )))('retains possible survivors through $wrapper with $samplingStrategy', async ({ wrapper, samplingStrategy }) => {
    const config = factorConfig();
    const sampled: FactorOption = {
      action: 'sample', factors: ['pool'], numSamples: samplingStrategy === 'withReplacement' ? 2 : 1, samplingStrategy,
    };
    config.factors = {
      a: [1, 2, 3],
      pool: [{ a: 1 }, { a: 2 }],
      selected: {
        action: 'remove',
        factor: 'a',
        items: wrapper === 'repeat' ? { action: wrapper, factors: [sampled], numRepeats: 1 } : { action: wrapper, factors: [sampled] },
      },
    };
    config.baseComponents!.trial = { type: 'questionnaire', response: [] };
    config.sequence = {
      type: 'factor', id: 'variableRemoval', factor: 'selected', components: 'trial',
    };
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      const parsed = await parseStudyConfig(JSON.stringify(config));
      expect(parsed.errors).toEqual([]);
      generateSequenceArray(parsed).forEach((sequence) => {
        const values = getSequenceFlatMap(sequence).filter((id) => id !== 'end').map((id) => parsed.components[id].parameters!.a);
        expect(values).toEqual(samplingStrategy === 'withReplacement' ? [2, 3] : [1, 3]);
      });
    } finally { random.mockRestore(); }
  });

  test('preserves possible survivors when runtime zip changes pair membership', async () => {
    const config = factorConfig();
    config.factors = {
      a: { values: [1, 2], order: 'latinSquare' },
      b: { values: ['x', 'y'], order: 'latinSquare' },
      source: { action: 'cross', factors: ['a', 'b'] },
      selected: { action: 'remove', factor: 'source', items: { action: 'zip', factors: ['a', 'b'] } },
    };
    config.baseComponents!.trial = { type: 'questionnaire', response: [] };
    config.sequence = {
      type: 'factor', id: 'zipRemoval', factor: 'selected', components: 'trial',
    };
    const parsed = await parseStudyConfig(JSON.stringify(config));
    expect(parsed.errors).toEqual([]);
    generateSequenceArray(parsed).forEach((sequence) => {
      const rows = getSequenceFlatMap(sequence).filter((id) => id !== 'end').map((id) => parsed.components[id].parameters);
      expect(rows).toEqual(expect.arrayContaining([{ a: 1, b: 'y' }, { a: 2, b: 'x' }]));
      expect(rows).toHaveLength(2);
    });
  });

  test.each(['cross', 'zip'] as const)('rejects %s aliases overlapping another input namespace at parse time', async (action) => {
    const config = factorConfig();
    config.factors = {
      a: [1, 2],
      b: [3, 4],
      selected: { action, factors: ['a', 'b'], as: ['x', 'a'] },
    };
    config.baseComponents!.trial = { type: 'questionnaire', response: [] };
    config.sequence = {
      type: 'factor', id: 'aliasCollision', factor: 'selected', components: 'trial',
    };
    const parsed = await parseStudyConfig(JSON.stringify(config));
    expect(parsed.errors.map((error) => error.message)).toContain(
      'Factor expression `selected` as name `a` conflicts with another input parameter namespace',
    );
  });

  test('rejects aliases hiding another input original source namespace', () => {
    const factors: NonNullable<StudyConfig['factors']> = {
      a: [1],
      b: [2],
      inner: { action: 'cross', factors: ['a'], as: ['x'] },
      selected: { action: 'cross', factors: ['inner', 'b'], as: ['y', 'a'] },
    };
    const errors: ParserErrorWarning[] = [];
    resolveFactorConditions('selected', factors, errors);
    expect(errors.map((error) => error.message)).toContain(
      'Factor expression `selected` as name `a` conflicts with another input parameter namespace',
    );
  });

  test.each([['a', 'b'], ['x', 'y']])('preserves identity and disjoint aliases (%j, %j)', (first, second) => {
    const errors: ParserErrorWarning[] = [];
    expect(resolveFactorConditions({ action: 'cross', factors: ['a', 'b'], as: [first, second] }, { a: [1], b: [2] }, errors)).toEqual([
      { [first]: 1, [second]: 2 },
    ]);
    expect(errors).toEqual([]);
  });

  test.each(['direct', 'concat', 'repeat', 'cross', 'zip', 'keep', 'remove'] as const)('preserves definite removal membership through %s', async (wrapper) => {
    const full: FactorOption = {
      action: 'sample', factors: ['pool'], numSamples: 2, samplingStrategy: 'withoutReplacement',
    };
    const selector: FactorOption = wrapper === 'direct' ? full
      : wrapper === 'repeat' ? { action: wrapper, factors: [full], numRepeats: 1 }
        : wrapper === 'keep' ? { action: wrapper, factor: full, condition: { a: 1 } }
          : wrapper === 'remove' ? { action: wrapper, factor: full, items: [{ a: 2 }] }
            : { action: wrapper, factors: [full] };
    const config = factorConfig();
    config.factors = {
      a: [1, 2, 3],
      pool: [{ a: 1 }, { a: 2 }],
      selected: { action: 'remove', factor: 'a', items: selector },
    };
    config.baseComponents = {
      trial3: { type: 'questionnaire', response: [] },
      ...(['keep', 'remove'].includes(wrapper) ? { trial2: { type: 'questionnaire' as const, response: [] } } : {}),
    };
    config.sequence = {
      type: 'factor', id: 'wrappedRemoval', factor: 'selected', components: 'trial{{a}}',
    };
    const parsed = await parseStudyConfig(JSON.stringify(config));
    expect(parsed.errors).toEqual([]);
    generateSequenceArray(parsed).forEach((sequence) => {
      const rows = getSequenceFlatMap(sequence).filter((id) => id !== 'end').map((id) => parsed.components[id].parameters!.a);
      expect(rows).toEqual(['keep', 'remove'].includes(wrapper) ? [2, 3] : [3]);
    });
  });

  test('retains possible survivors when a full-size selector samples with replacement', async () => {
    const config = factorConfig();
    config.factors = {
      a: [1, 2, 3],
      pool: [{ a: 1 }, { a: 2 }],
      selected: {
        action: 'remove',
        factor: 'a',
        items: {
          action: 'sample', factors: ['pool'], numSamples: 2, samplingStrategy: 'withReplacement',
        },
      },
    };
    config.baseComponents!.trial = { type: 'questionnaire', response: [] };
    config.sequence = {
      type: 'factor', id: 'replacementSelector', factor: 'selected', components: 'trial',
    };
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      const parsed = await parseStudyConfig(JSON.stringify(config));
      expect(parsed.errors).toEqual([]);
      generateSequenceArray(parsed).forEach((sequence) => {
        const values = getSequenceFlatMap(sequence).filter((id) => id !== 'end').map((id) => parsed.components[id].parameters!.a);
        expect(values).toEqual([2, 3]);
      });
    } finally { random.mockRestore(); }
  });

  test.each([{ x: 1 }, { a: 1 }])('translates only public eligibility into aliased selector sampling (%j)', (assignment) => {
    const factors: NonNullable<StudyConfig['factors']> = {
      a: { values: [1, 2], order: 'latinSquare' },
      c: [0],
      aliased: { action: 'cross', factors: ['a'], as: ['x'] },
      selected: {
        action: 'keep',
        factor: 'aliased',
        items: {
          action: 'sample', factors: ['a'], numSamples: 1, samplingStrategy: 'withoutReplacement',
        },
      },
      outer: { action: 'cross', factors: ['selected', 'c'] },
    };
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      const errors: ParserErrorWarning[] = [];
      expect(resolveOrderedFactorConditions('outer', factors, createFactorOrderContext(0), errors, 'outer', assignment)).toEqual([
        { x: 'x' in assignment ? 1 : 2, c: 0 },
      ]);
      expect(errors).toEqual([]);
    } finally { random.mockRestore(); }
  });

  test('does not constrain independent selector draws to a sampled source result', () => {
    const factors: NonNullable<StudyConfig['factors']> = {
      a: [1, 2],
      c: [0],
      source: {
        action: 'sample', factors: ['a'], numSamples: 1, samplingStrategy: 'withoutReplacement',
      },
      selected: {
        action: 'keep',
        factor: 'source',
        items: {
          action: 'sample', factors: ['a'], numSamples: 1, samplingStrategy: 'withoutReplacement',
        },
      },
      outer: { action: 'cross', factors: ['selected', 'c'] },
    };
    const random = vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValue(0.99);
    try {
      const errors: ParserErrorWarning[] = [];
      expect(resolveOrderedFactorConditions('outer', factors, createFactorOrderContext(0), errors, 'outer', { c: 0 })).toEqual([]);
      expect(errors).toEqual([]);
    } finally { random.mockRestore(); }
  });

  test.each(['full-sample', 'random', 'latinSquare', 'fixed'] as const)('materializes only definite survivors for a %s selector', async (selector) => {
    const config = factorConfig();
    config.factors = {
      a: [1, 2, 3],
      pool: { values: [{ a: 1 }, { a: 2 }], order: selector === 'full-sample' ? 'fixed' : selector, numSamples: 2 },
      selected: {
        action: 'remove',
        factor: 'a',
        items: selector === 'full-sample' ? {
          action: 'sample', factors: ['pool'], numSamples: 2, samplingStrategy: 'withoutReplacement',
        } : 'pool',
      },
    };
    config.baseComponents = { trial3: { type: 'questionnaire', response: [] } };
    config.sequence = {
      type: 'factor', id: 'definiteRemoval', factor: 'selected', components: 'trial{{a}}',
    };
    const parsed = await parseStudyConfig(JSON.stringify(config));
    expect(parsed.errors).toEqual([]);
    generateSequenceArray(parsed).forEach((sequence) => {
      const parameters = getSequenceFlatMap(sequence).filter((id) => id !== 'end').map((id) => parsed.components[id].parameters);
      expect(parameters).toEqual([{ a: 3 }]);
    });
  });

  test.each((['keep', 'remove'] as const).flatMap((action) => (
    (['direct', 'cross', 'zip', 'concat', 'repeat', 'sample'] as const).map((wrapper) => ({ action, wrapper }))
  )))('preserves projected eligibility before $action selector sampling in $wrapper', async ({ action, wrapper }) => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      const config = factorConfig();
      config.factors = {
        a: [1, 2],
        c: [0],
        selected: {
          action,
          factor: 'a',
          items: {
            action: 'sample', factors: ['a'], numSamples: 1, samplingStrategy: 'withoutReplacement',
          },
        },
        assignment: [{ a: 1 }],
      };
      if (wrapper !== 'direct') {
        config.factors.outer = wrapper === 'sample'
          ? {
            action: 'sample', factors: ['selected'], numSamples: 1, samplingStrategy: 'withoutReplacement',
          }
          : wrapper === 'repeat'
            ? { action: 'repeat', factors: ['selected'], numRepeats: 1 }
            : { action: wrapper, factors: wrapper === 'concat' ? ['selected'] : ['selected', 'c'] };
      }
      config.betweenSubjects = ['assignment'];
      config.baseComponents!.trial = { type: 'questionnaire', response: [] };
      config.sequence = {
        type: 'factor', id: 'nestedSelector', factor: wrapper === 'direct' ? 'selected' : 'outer', components: 'trial',
      };
      const parsed = await parseStudyConfig(JSON.stringify(config));
      expect(parsed.errors, wrapper).toEqual([]);
      generateSequenceArray(parsed).forEach((sequence) => {
        const values = getSequenceFlatMap(sequence).filter((id) => id !== 'end').map((id) => parsed.components[id].parameters!.a);
        expect(values, wrapper).toEqual(action === 'keep' ? [1] : []);
      });
    } finally {
      random.mockRestore();
    }
  });

  test.each(['keep', 'remove'] as const)('materializes possible survivors of %s with sampled items', async (action) => {
    const config = factorConfig();
    config.factors = {
      a: [1, 2],
      selected: {
        action,
        factor: 'a',
        items: {
          action: 'sample', factors: ['a'], numSamples: 1, samplingStrategy: 'withoutReplacement',
        },
      },
    };
    config.baseComponents!.trial = { type: 'questionnaire', response: [] };
    config.sequence = {
      type: 'factor', id: 'sampledSelector', factor: 'selected', components: 'trial',
    };
    const parsed = await parseStudyConfig(JSON.stringify(config));
    expect(parsed.errors).toEqual([]);
    generateSequenceArray(parsed).forEach((sequence) => {
      const trials = getSequenceFlatMap(sequence).filter((id) => id !== 'end');
      expect(trials).toHaveLength(1);
      expect([1, 2]).toContain(parsed.components[trials[0]].parameters!.a);
    });
  });

  test.each(['fixed', 'latinSquare'] as const)('retains assigned fixed-zip rows inside a %s cross', async (order) => {
    const config = factorConfig();
    config.factors = {
      a: ['A', 'B', 'A'],
      b: [1, 1, 2],
      paired: { action: 'zip', factors: ['a', 'b'] },
      c: { values: [0], order },
      selected: { action: 'cross', factors: ['paired', 'c'] },
      assignment: [{ a: 'A' }],
    };
    config.betweenSubjects = ['assignment'];
    config.baseComponents!.trial = { type: 'questionnaire', response: [] };
    config.sequence = {
      type: 'factor', id: 'fixedPairs', factor: 'selected', components: 'trial',
    };
    const parsed = await parseStudyConfig(JSON.stringify(config));
    expect(parsed.errors).toEqual([]);
    generateSequenceArray(parsed).forEach((sequence) => {
      const parameters = getSequenceFlatMap(sequence).filter((id) => id !== 'end').map((id) => parsed.components[id].parameters);
      expect(parameters).toEqual([{ a: 'A', b: 1, c: 0 }, { a: 'A', b: 2, c: 0 }]);
    });
  });

  test.each(['fixed', 'latinSquare'] as const)('keeps independent aliased values with a %s source selector', async (order) => {
    const config = factorConfig();
    config.factors = {
      a: { values: [1, 2], order },
      aliased: { action: 'cross', factors: ['a'], as: ['x'] },
      selected: { action: 'keep', factor: 'aliased', items: 'a' },
      assignment: [{ a: 1 }],
    };
    config.betweenSubjects = ['assignment'];
    config.baseComponents!.trial = { type: 'questionnaire', response: [] };
    config.sequence = {
      type: 'factor', id: 'independentSelector', factor: 'selected', components: 'trial',
    };
    const parsed = await parseStudyConfig(JSON.stringify(config));
    expect(parsed.errors).toEqual([]);
    generateSequenceArray(parsed).forEach((sequence) => {
      const parameters = getSequenceFlatMap(sequence).filter((id) => id !== 'end').map((id) => parsed.components[id].parameters);
      expect(parameters).toHaveLength(2);
      expect(parameters).toEqual(expect.arrayContaining([{ x: 1 }, { x: 2 }]));
    });
  });

  test('prunes assigned prefixes before constructing a large cross', () => {
    const levelCount = 20;
    const factors: NonNullable<StudyConfig['factors']> = {
      x: { values: Array.from({ length: levelCount }, (_, index) => index), order: 'latinSquare' },
      selected: { action: 'cross', factors: ['x', 'x', 'x'] },
    };
    let visits = 0;
    const { entries } = Object;
    const traversal = vi.spyOn(Object, 'entries').mockImplementation((value) => {
      if (Object.hasOwn(value, 'x')) visits += 1;
      return entries(value);
    });
    try {
      const errors: ParserErrorWarning[] = [];
      expect(resolveOrderedFactorConditions('selected', factors, createFactorOrderContext(0), errors, 'selected', {
        x_0: 1, x_1: 2, x_2: 3,
      })).toEqual([{ x_0: 1, x_1: 2, x_2: 3 }]);
      expect(errors).toEqual([]);
      expect(visits).toBeLessThan(levelCount * 3 * 20);
    } finally {
      traversal.mockRestore();
    }
  });

  test('retains prefixes when a later branch may change a singleton name', () => {
    const factors: NonNullable<StudyConfig['factors']> = {
      x: { values: [1, 2], order: 'latinSquare' },
      y: [3],
      joined: { action: 'concat', factors: ['x', 'y'] },
      selected: { action: 'cross', factors: ['x', 'joined'] },
    };
    const errors: ParserErrorWarning[] = [];
    expect(resolveOrderedFactorConditions('selected', factors, createFactorOrderContext(0), errors, 'selected', {
      x: 1, y: 3,
    })).toEqual([
      { x_0: 1, x_1: 1 },
      { x_0: 1, x_1: 2 },
      { x: 1, y: 3 },
      { x_0: 2, x_1: 1 },
      { x_0: 2, x_1: 2 },
    ]);
    expect(errors).toEqual([]);
  });

  test.each([undefined, 1])('projects assigned slots per concatenated shape before sampling (%s)', async (numSamples) => {
    const config = factorConfig();
    config.uiConfig.numSequences = 1;
    config.factors = {
      x: { values: [1, 2], order: 'random', ...(numSamples ? { numSamples } : {}) },
      pair: { action: 'cross', factors: ['x', 'x'] },
      joined: { action: 'concat', factors: ['x', 'pair'] },
      selected: { action: 'cross', factors: ['joined', 'x'] },
      assignment: [{ x_0: 1, x_1: 2, x_2: 1 }],
    };
    config.betweenSubjects = ['assignment'];
    config.baseComponents!.trial = { type: 'questionnaire', response: [] };
    config.sequence = {
      type: 'factor', id: 'shapes', factor: 'selected', components: 'trial',
    };
    const parsed = await parseStudyConfig(JSON.stringify(config));
    expect(parsed.errors).toEqual([]);
    const sequence = generateSequenceArray(parsed)[0];
    const parameters = getSequenceFlatMap(sequence).filter((id) => id !== 'end').map((id) => parsed.components[id].parameters);
    expect(parameters).toEqual(expect.arrayContaining([
      { x_0: 1, x_1: 2 },
      { x_0: 1, x_1: 2, x_2: 1 },
    ]));
    expect(parameters).toHaveLength(2);
  });

  test.each(['keep', 'remove'] as const)('ignores ambiguous hidden source names in %s fallback', async (action) => {
    const config = factorConfig();
    config.factors = {
      a: [1],
      a_0: [2],
      b: [3],
      aliased: { action: 'cross', factors: ['a', 'a', 'a_0'], as: ['x', 'y', 'z'] },
      joined: { action: 'concat', factors: ['aliased', 'b'] },
      selected: { action, factor: 'joined', items: [{ b: 3 }] },
    };
    config.baseComponents!.trial = { type: 'questionnaire', response: [] };
    config.sequence = {
      type: 'factor', id: 'hiddenSources', factor: 'selected', components: 'trial',
    };
    const parsed = await parseStudyConfig(JSON.stringify(config));
    expect(parsed.errors).toEqual([]);
    generateSequenceArray(parsed).forEach((sequence) => {
      const parameters = getSequenceFlatMap(sequence).filter((id) => id !== 'end').map((id) => parsed.components[id].parameters);
      expect(parameters).toEqual(action === 'keep' ? [{ b: 3 }] : [{ x: 1, y: 1, z: 2 }]);
    });
  });

  test.each([{}, { arm: 'control' }])('does not expand runtime samples for irrelevant assignments (%j)', (assignment) => {
    const levelCount = 20;
    const factors: NonNullable<StudyConfig['factors']> = {
      a: { values: Array.from({ length: levelCount }, (_, index) => index), order: 'latinSquare' },
      b: { values: Array.from({ length: levelCount }, (_, index) => index), order: 'latinSquare' },
      sample: {
        action: 'sample', factors: [{ action: 'zip', factors: ['a', 'b'] }], numSamples: 5, samplingStrategy: 'withoutReplacement',
      },
    };
    let visits = 0;
    const { entries } = Object;
    const traversal = vi.spyOn(Object, 'entries').mockImplementation((value) => {
      if (Object.hasOwn(value, 'a') && Object.hasOwn(value, 'b')) visits += 1;
      return entries(value);
    });
    try {
      for (let index = 0; index < 3; index += 1) {
        const errors: ParserErrorWarning[] = [];
        expect(resolveOrderedFactorConditions('sample', factors, createFactorOrderContext(index), errors, 'sample', assignment)).toHaveLength(5);
        expect(errors).toEqual([]);
      }
      // Bound pair-record traversals by runtime list size, not its Cartesian square.
      expect(visits).toBeLessThan(levelCount * 3 * 10);
    } finally {
      traversal.mockRestore();
    }
  });

  test.each(['keep', 'remove'] as const)('preserves nested repeated source-name %s selectors', async (action) => {
    const config = factorConfig();
    config.factors = {
      a: [1, 2],
      left: { action: 'cross', factors: ['a'], as: ['x'] },
      pair: { action: 'cross', factors: ['left', 'left'] },
      triple: { action: 'cross', factors: ['pair', 'left'] },
      selected: { action, factor: 'triple', items: [{ a_0: 1, a_1: 2, a_2: 1 }] },
    };
    config.baseComponents!.trial = { type: 'questionnaire', response: [] };
    config.sequence = {
      type: 'factor', id: 'nestedSelector', factor: 'selected', components: 'trial',
    };
    const parsed = await parseStudyConfig(JSON.stringify(config));
    expect(parsed.errors).toEqual([]);
    const sequences = generateSequenceArray(parsed);
    const target = { x_0: 1, x_1: 2, x_2: 1 };
    sequences.forEach((sequence) => {
      const parameters = getSequenceFlatMap(sequence).filter((id) => id !== 'end').map((id) => parsed.components[id].parameters);
      if (action === 'keep') expect(parameters).toEqual([target]);
      else {
        expect(parameters).toHaveLength(7);
        expect(parameters).not.toContainEqual(target);
      }
    });
  });

  test('matches source selectors against each concatenated condition rather than possible keys', () => {
    const factors: StudyConfig['factors'] = {
      a: [1],
      b: [2],
      left: { action: 'cross', factors: ['a'], as: ['arm'] },
      right: { action: 'cross', factors: ['b'], as: ['arm'] },
      joined: { action: 'concat', factors: ['left', 'right'] },
      combined: { action: 'cross', factors: ['joined', 'a'] },
    };
    expect(resolveFactorConditions({
      action: 'keep', factor: 'combined', items: [{ b: 2, a: 1 }],
    }, factors)).toEqual([{ arm: 2, a: 1 }]);
  });

  test.each([false, true])('filters repeated assignments before inner sampling (explicit aliases=%s)', async (explicit) => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      const config = factorConfig();
      config.uiConfig.numSequences = 4;
      config.factors = {
        stimulus: { values: [1, 2], order: 'random', numSamples: 1 },
        aliased: { action: 'cross', factors: ['stimulus'], as: ['arm'] },
        selected: {
          action: 'cross', factors: ['aliased', 'aliased'], ...(explicit ? { as: ['arm_0', 'arm_1'] } : {}),
        },
      };
      config.betweenSubjects = ['selected'];
      config.baseComponents!.trial = { type: 'questionnaire', response: [] };
      config.sequence = {
        type: 'factor', id: 'sampledRepeated', factor: 'selected', components: 'trial',
      };
      const parsed = await parseStudyConfig(JSON.stringify(config));
      expect(parsed.errors).toEqual([]);
      const sequences = generateSequenceArray(parsed);
      expect(sequences.map((sequence) => sequence.parameters?.selected)).toEqual([
        { arm_0: 1, arm_1: 1 }, { arm_0: 1, arm_1: 2 }, { arm_0: 2, arm_1: 1 }, { arm_0: 2, arm_1: 2 },
      ]);
      sequences.forEach((sequence) => {
        expect(getSequenceFlatMap(sequence)).toHaveLength(2);
        expect(parsed.components[getSequenceFlatMap(sequence)[0]].parameters).toEqual(sequence.parameters?.selected);
      });
    } finally {
      random.mockRestore();
    }
  });

  test.each(['fixed', 'random', 'latinSquare'] as const)('keeps independently aliased values when the original is assigned (%s)', async (order) => {
    const config = factorConfig();
    config.factors = {
      stimulus: { values: [1, 2], order },
      assignment: { action: 'cross', factors: ['stimulus'] },
      left: { action: 'cross', factors: ['stimulus'], as: ['leftArm'] },
      selected: { action: 'cross', factors: ['left', 'stimulus'] },
    };
    config.betweenSubjects = ['assignment'];
    config.baseComponents!.trial = { type: 'questionnaire', response: [] };
    config.sequence = {
      type: 'factor', id: 'independent', factor: 'selected', components: 'trial',
    };
    const parsed = await parseStudyConfig(JSON.stringify(config));
    expect(parsed.errors).toEqual([]);
    generateSequenceArray(parsed).forEach((sequence) => {
      const parameters = getSequenceFlatMap(sequence).filter((id) => id !== 'end').map((id) => parsed.components[id].parameters);
      expect(parameters).toHaveLength(2);
      expect(parameters).toEqual(expect.arrayContaining([
        { leftArm: 1, stimulus: sequence.parameters?.stimulus },
        { leftArm: 2, stimulus: sequence.parameters?.stimulus },
      ]));
    });
  });

  test.each(['keep', 'remove'] as const)('gives public literal %s items precedence over source aliases', async (action) => {
    const config = factorConfig();
    const target = { x: 1, y: 2 };
    config.factors = {
      a: [1, 2],
      b: [1, 2],
      aliased: { action: 'cross', factors: ['a', 'b'], as: ['x', 'y'] },
      selected: { action, factor: 'aliased', items: [target] },
    };
    config.baseComponents!.trial = { type: 'questionnaire', response: [] };
    config.sequence = {
      type: 'factor', id: 'publicSelector', factor: 'selected', components: 'trial',
    };
    const parsed = await parseStudyConfig(JSON.stringify(config));
    expect(parsed.errors).toEqual([]);
    generateSequenceArray(parsed).forEach((sequence) => {
      const parameters = getSequenceFlatMap(sequence).filter((id) => id !== 'end').map((id) => parsed.components[id].parameters);
      if (action === 'keep') expect(parameters).toEqual([target]);
      else {
        expect(parameters).toHaveLength(3);
        expect(parameters).not.toContainEqual(target);
      }
    });
  });

  test.each(['cross', 'zip'] as const)('composes nested %s aliases from their original source', (action) => {
    const factors: StudyConfig['factors'] = {
      stimulus: [1, 2],
      inner: { action, factors: ['stimulus'], as: ['innerArm'] },
      outer: { action, factors: ['inner'], as: ['arm'] },
    };

    expect(resolveFactorConditions('stimulus', factors)).toEqual([{ stimulus: 1 }, { stimulus: 2 }]);
    expect(resolveFactorConditions('inner', factors)).toEqual([{ innerArm: 1 }, { innerArm: 2 }]);
    expect(resolveFactorConditions('outer', factors)).toEqual([{ arm: 1 }, { arm: 2 }]);
  });

  test('aliases repeated inputs that already have different public names', () => {
    const factors: StudyConfig['factors'] = {
      stimulus: [1, 2],
      left: { action: 'cross', factors: ['stimulus'], as: ['leftArm'] },
      right: { action: 'cross', factors: ['stimulus'], as: ['rightArm'] },
    };

    expect(resolveFactorConditions({
      action: 'cross', factors: ['left', 'right'], as: ['first', 'second'],
    }, factors)).toEqual([
      { first: 1, second: 1 },
      { first: 1, second: 2 },
      { first: 2, second: 1 },
      { first: 2, second: 2 },
    ]);
  });

  test('materializes nested aliases in stimulus paths and participant parameters', async () => {
    const config = factorConfig();
    config.factors = {
      stimulus: ['pcp', 'scatter'],
      inner: { action: 'cross', factors: ['stimulus'], as: ['innerArm'] },
      outer: { action: 'cross', factors: ['inner'], as: ['arm'] },
    };
    config.betweenSubjects = ['outer'];
    config.baseComponents!.trial = {
      type: 'markdown', path: 'incentives-corr/assets/help-{{arm}}.md', response: [],
    };
    config.sequence = {
      type: 'factor', id: 'nested', factor: 'outer', components: 'trial',
    };

    const parsed = await parseStudyConfig(JSON.stringify(config));
    expect(parsed.errors).toEqual([]);
    const sequences = generateSequenceArray(parsed);
    expect(sequences.map((sequence) => sequence.parameters)).toEqual([
      { arm: 'pcp', outer: { arm: 'pcp' } },
      { arm: 'scatter', outer: { arm: 'scatter' } },
    ]);
    sequences.forEach((sequence) => {
      const componentId = getSequenceFlatMap(sequence)[0];
      expect(parsed.components[componentId]).toMatchObject({
        path: `incentives-corr/assets/help-${sequence.parameters?.arm}.md`,
        parameters: { arm: sequence.parameters?.arm },
      });
    });
  });

  test.each(['cross', 'zip'] as const)('aliases every branch of a concatenation in %s', (action) => {
    const factors: StudyConfig['factors'] = {
      a: [1],
      b: [2],
      left: { action: 'cross', factors: ['a'], as: ['value'] },
      right: { action: 'cross', factors: ['b'], as: ['value'] },
      joined: { action: 'concat', factors: ['left', 'right'] },
      outer: { action, factors: ['joined'], as: ['arm'] },
    };
    const errors: ParserErrorWarning[] = [];

    expect(resolveFactorConditions('outer', factors, errors)).toEqual([{ arm: 1 }, { arm: 2 }]);
    expect(resolveFactorConditions({
      action, factors: [{ action: 'concat', factors: ['a', 'b'] }], as: ['arm'],
    }, factors, errors)).toEqual([{ arm: 1 }, { arm: 2 }]);
    expect(errors).toEqual([]);
  });

  test.each(['cross', 'zip'] as const)('preserves child aliases over a shared source in %s', (action) => {
    const factors: StudyConfig['factors'] = {
      stimulus: [1, 2],
      left: { action: 'cross', factors: ['stimulus'], as: ['leftArm'] },
      right: { action: 'cross', factors: ['stimulus'], as: ['rightArm'] },
    };
    const errors: ParserErrorWarning[] = [];
    const pairs = action === 'cross' ? [[1, 1], [1, 2], [2, 1], [2, 2]] : [[1, 1], [2, 2]];

    expect(resolveFactorConditions({ action, factors: ['left', 'stimulus'] }, factors, errors)).toEqual(
      pairs.map(([leftArm, stimulus]) => ({ leftArm, stimulus })),
    );
    expect(resolveFactorConditions({ action, factors: ['left', 'right'] }, factors, errors)).toEqual(
      pairs.map(([leftArm, rightArm]) => ({ leftArm, rightArm })),
    );
    expect(errors).toEqual([]);
  });

  test('keeps unaliased selectors working through nested and combined aliases', () => {
    const factors: StudyConfig['factors'] = {
      a: [1, 2],
      b: ['x', 'y'],
      left: { action: 'cross', factors: ['a'], as: ['leftArm'] },
      outer: { action: 'cross', factors: ['left'], as: ['arm'] },
      right: { action: 'cross', factors: ['b'], as: ['rightArm'] },
      combined: { action: 'cross', factors: ['left', 'right'] },
    };

    expect(resolveFactorConditions({
      action: 'keep', factor: 'outer', items: [{ a: 1 }],
    }, factors)).toEqual([{ arm: 1 }]);
    expect(resolveFactorConditions({
      action: 'keep', factor: 'combined', items: [{ a: 1, b: 'y' }],
    }, factors)).toEqual([{ leftArm: 1, rightArm: 'y' }]);
    expect(resolveFactorConditions({
      action: 'keep',
      factor: { action: 'cross', factors: ['left', 'left'], as: ['first', 'second'] },
      items: { action: 'zip', factors: ['a', 'a'] },
    }, factors)).toEqual([{ first: 1, second: 1 }, { first: 2, second: 2 }]);
    expect(resolveFactorConditions({
      action: 'keep',
      factor: { action: 'cross', factors: ['left', 'a'] },
      items: { action: 'zip', factors: ['a', 'a'] },
    }, factors)).toEqual([{ leftArm: 1, a: 1 }, { leftArm: 2, a: 2 }]);
  });

  test('aliases alternative source keys independently in each crossed input', () => {
    const factors: StudyConfig['factors'] = { a: [1], b: [2], c: [3] };
    const errors: ParserErrorWarning[] = [];
    expect(resolveFactorConditions({
      action: 'cross',
      factors: [
        { action: 'concat', factors: ['a', 'b'] },
        { action: 'concat', factors: ['a', 'c'] },
      ],
      as: ['first', 'second'],
    }, factors, errors)).toEqual([
      { first: 1, second: 1 },
      { first: 1, second: 3 },
      { first: 2, second: 1 },
      { first: 2, second: 3 },
    ]);
    expect(errors).toEqual([]);
  });

  test('filters every concatenated source before sampling an aliased assignment', async () => {
    const config = factorConfig();
    config.factors = {
      arm: [1, 2],
      a: [1],
      b: [2],
      sampled: {
        action: 'sample', factors: ['a', 'b'], numSamples: 1, samplingStrategy: 'withoutReplacement',
      },
      assignment: { action: 'cross', factors: ['sampled'], as: ['arm'] },
    };
    config.betweenSubjects = ['arm'];
    config.baseComponents!.trial = { type: 'questionnaire', response: [] };
    config.sequence = {
      type: 'factor', id: 'sampled', factor: 'assignment', components: 'trial',
    };
    const parsed = await parseStudyConfig(JSON.stringify(config));
    expect(parsed.errors).toEqual([]);
    const sequences = generateSequenceArray(parsed);
    expect(sequences.map((sequence) => sequence.parameters?.arm)).toEqual([1, 2]);
    sequences.forEach((sequence) => {
      expect(getSequenceFlatMap(sequence)).toHaveLength(2);
      expect(parsed.components[getSequenceFlatMap(sequence)[0]].parameters).toEqual({ arm: sequence.parameters?.arm });
    });
  });

  test.each(['concat', 'cross'] as const)('materializes composed %s aliases in templates and assigned parameters', async (action) => {
    const config = factorConfig();
    config.factors = action === 'concat' ? {
      a: ['pcp'],
      b: ['scatter'],
      left: { action: 'cross', factors: ['a'], as: ['value'] },
      right: { action: 'cross', factors: ['b'], as: ['value'] },
      joined: { action: 'concat', factors: ['left', 'right'] },
      assignment: { action: 'cross', factors: ['joined'], as: ['arm'] },
    } : {
      stimulus: ['pcp', 'scatter'],
      left: { action: 'cross', factors: ['stimulus'], as: ['leftArm'] },
      assignment: { action: 'cross', factors: ['left', 'stimulus'] },
    };
    const parameterName = action === 'concat' ? 'arm' : 'leftArm';
    config.baseComponents!.trial = {
      type: 'markdown',
      path: `incentives-corr/assets/help-{{${parameterName}}}.md`,
      response: [],
      instruction: action === 'concat' ? 'Arm {{arm}}' : '{{leftArm}} versus {{stimulus}}',
    };
    config.betweenSubjects = ['assignment'];
    config.uiConfig.numSequences = action === 'concat' ? 2 : 4;
    config.sequence = {
      type: 'factor', id: 'composed', factor: 'assignment', components: 'trial',
    };

    const parsed = await parseStudyConfig(JSON.stringify(config));
    expect(parsed.errors).toEqual([]);
    const sequences = generateSequenceArray(parsed);
    const expectedParameters: Record<string, string>[] = action === 'concat'
      ? [{ arm: 'pcp' }, { arm: 'scatter' }]
      : [
        { leftArm: 'pcp', stimulus: 'pcp' },
        { leftArm: 'pcp', stimulus: 'scatter' },
        { leftArm: 'scatter', stimulus: 'pcp' },
        { leftArm: 'scatter', stimulus: 'scatter' },
      ];
    expect(sequences.map((sequence) => sequence.parameters?.assignment)).toEqual(expectedParameters);
    sequences.forEach((sequence, index) => {
      const parameters = expectedParameters[index];
      expect(getSequenceFlatMap(sequence)).toHaveLength(2);
      expect(parsed.components[getSequenceFlatMap(sequence)[0]]).toMatchObject({
        parameters,
        path: `incentives-corr/assets/help-${parameters[parameterName]}.md`,
        instruction: action === 'concat' ? `Arm ${parameters.arm}` : `${parameters.leftArm} versus ${parameters.stimulus}`,
      });
    });
  });

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

  test.each([
    { order: 'fixed' as const },
    { order: 'random' as const },
    { order: 'latinSquare' as const },
    { order: 'random' as const, numSamples: 1 },
  ])('allows an ordered factor with no eligible trials for one arm ($order, $numSamples)', async (ordering) => {
    const config = factorConfig();
    config.factors = {
      arm: ['A', 'B'],
      tasks: { values: [{ arm: 'A', task: 'only-A' }], ...ordering },
    };
    config.betweenSubjects = ['arm'];
    config.sequence = {
      type: 'factor', id: 'tasks', factor: 'tasks', components: 'trial',
    };
    // Use a bundled asset so this exercises the complete parser contract.
    config.baseComponents!.trial = {
      type: 'markdown', path: 'demo-html-trrack/assets/introduction.md', response: [],
    };
    const parsed = await parseStudyConfig(JSON.stringify(config));
    expect(parsed.errors).toEqual([]);

    const sequences = generateSequenceArray(parsed);
    expect(sequences).toHaveLength(2);
    const armA = sequences.find((sequence) => sequence.parameters?.arm === 'A')!;
    const armB = sequences.find((sequence) => sequence.parameters?.arm === 'B')!;
    expect(getSequenceFlatMap(armA)).toHaveLength(2);
    expect(parsed.components[getSequenceFlatMap(armA)[0]].parameters).toMatchObject({ arm: 'A', task: 'only-A' });
    expect(getSequenceFlatMap(armB)).toEqual(['end']);
  });

  test.each([
    { samplingStrategy: 'withoutReplacement' as const, ordered: false },
    { samplingStrategy: 'withReplacement' as const, ordered: false },
    { samplingStrategy: 'withoutReplacement' as const, ordered: true },
    { samplingStrategy: 'withReplacement' as const, ordered: true },
  ])('allows a sampled factor with no eligible trials for one arm ($samplingStrategy, ordered=$ordered)', async ({ samplingStrategy, ordered }) => {
    const config = factorConfig();
    const tasks = [{ arm: 'A', task: 'only-A' }];
    config.factors = {
      arm: ['A', 'B'],
      tasks: ordered ? { values: tasks, order: 'random' } : tasks,
      sampled: {
        action: 'sample', factors: ['tasks'], numSamples: 1, samplingStrategy,
      },
    };
    config.betweenSubjects = ['arm'];
    config.sequence = {
      type: 'factor', id: 'tasks', factor: 'sampled', components: 'trial',
    };
    config.baseComponents!.trial = { type: 'questionnaire', response: [] };
    const parsed = await parseStudyConfig(JSON.stringify(config));
    expect(parsed.errors).toEqual([]);

    const sequences = generateSequenceArray(parsed);
    expect(sequences).toHaveLength(2);
    const armA = sequences.find((sequence) => sequence.parameters?.arm === 'A')!;
    const armB = sequences.find((sequence) => sequence.parameters?.arm === 'B')!;
    const armATrials = getSequenceFlatMap(armA);
    expect(armATrials).toHaveLength(2);
    expect(parsed.components[armATrials[0]].parameters).toMatchObject({ arm: 'A', task: 'only-A' });
    expect(getSequenceFlatMap(armB)).toEqual(['end']);
  });

  test('still rejects an originally empty ordered factor', () => {
    const errors: ParserErrorWarning[] = [];
    expect(resolveFactorConditions('tasks', { tasks: { values: [], order: 'random' } }, errors)).toEqual([]);
    expect(errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ message: 'Factor `tasks` must contain at least one value' }),
    ]));
  });

  test('reports invalid between-subjects factors as parser errors', async () => {
    const invalidFactors: Array<[string, StudyConfig['factors'], string]> = [
      ['missing', {}, 'Between-subjects factor `missing` is not defined in factors'],
      ['empty', { empty: [] }, 'Between-subjects factor `empty` must be a non-empty factor with either all primitive levels or all object levels'],
      ['ordered', { ordered: { values: ['A'], order: 'fixed' } }, 'Between-subjects factor `ordered` must be a list of levels or a factor expression'],
    ];

    await Promise.all(invalidFactors.map(async ([factorName, factors, message]) => {
      const result = await parseStudyConfig(JSON.stringify({
        ...factorConfig(),
        factors,
        betweenSubjects: [factorName],
        baseComponents: {},
        sequence: { order: 'fixed', components: [] },
      }));

      expect(result.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({
          message,
          instancePath: '/betweenSubjects/0',
          category: 'sequence-validation',
        }),
      ]));
      expect(result.warnings).not.toEqual(expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining(`Between-subjects factor \`${factorName}\``),
        }),
      ]));
    }));
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

  test('filters aliased derived assignments before factor-owned sampling', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    const config = factorConfig();
    config.uiConfig.numSequences = 2;
    config.factors = {
      stimulus: { values: [1, 2], order: 'random', numSamples: 1 },
      assignment: { action: 'cross', factors: ['stimulus'], as: ['arm'] },
    };
    config.betweenSubjects = ['assignment'];
    config.sequence = {
      type: 'factor', id: 'aliasedAssignment', factor: 'assignment', components: 'trial',
    };

    const compiled = compileFactorBlocks(config.sequence, config);
    const sequences = generateSequenceArray({
      ...config,
      sequence: compiled.sequence,
      components: compiled.components,
    });
    random.mockRestore();

    sequences.forEach((sequence) => {
      const componentId = sequence.components.find((component): component is string => component !== 'end');
      expect(componentId).toBeDefined();
      expect(compiled.components[componentId!].parameters?.arm).toBe(sequence.parameters?.arm);
    });
  });

  test('filters each aliased input before cross-product sampling', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    const config = factorConfig();
    config.uiConfig.numSequences = 4;
    config.factors = {
      stimulus: { values: [1, 2], order: 'random', numSamples: 1 },
      context: { values: ['x', 'y'], order: 'random', numSamples: 1 },
      assignment: {
        action: 'cross', factors: ['stimulus', 'context'], as: ['arm', 'condition'],
      },
    };
    config.betweenSubjects = ['assignment'];
    config.sequence = {
      type: 'factor', id: 'multiAliasedAssignment', factor: 'assignment', components: 'trial',
    };

    const compiled = compileFactorBlocks(config.sequence, config);
    const sequences = generateSequenceArray({
      ...config,
      sequence: compiled.sequence,
      components: compiled.components,
    });
    random.mockRestore();

    sequences.forEach((sequence) => {
      const componentId = sequence.components.find((component): component is string => component !== 'end');
      expect(componentId).toBeDefined();
      expect(compiled.components[componentId!].parameters).toMatchObject({
        arm: sequence.parameters?.arm,
        condition: sequence.parameters?.condition,
      });
    });
  });

  test('filters repeated aliased ordered inputs independently', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    const config = factorConfig();
    config.uiConfig.numSequences = 4;
    config.factors = {
      stimulus: { values: [1, 2], order: 'random', numSamples: 1 },
      assignment: {
        action: 'cross', factors: ['stimulus', 'stimulus'], as: ['word', 'inkColor'],
      },
    };
    config.betweenSubjects = ['assignment'];
    config.sequence = {
      type: 'factor', id: 'repeatedAliasedAssignment', factor: 'assignment', components: 'trial',
    };

    const compiled = compileFactorBlocks(config.sequence, config);
    const sequences = generateSequenceArray({
      ...config,
      sequence: compiled.sequence,
      components: compiled.components,
    });
    random.mockRestore();

    sequences.forEach((sequence) => {
      const componentId = sequence.components.find((component): component is string => component !== 'end');
      expect(componentId).toBeDefined();
      expect(compiled.components[componentId!].parameters).toMatchObject({
        word: sequence.parameters?.word,
        inkColor: sequence.parameters?.inkColor,
      });
    });
  });

  test('filters nested aliases before sampling the inner factor', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    const config = factorConfig();
    config.uiConfig.numSequences = 2;
    config.factors = {
      stimulus: { values: [1, 2], order: 'random', numSamples: 1 },
      innerAssignment: { action: 'cross', factors: ['stimulus'], as: ['innerArm'] },
      assignment: { action: 'cross', factors: ['innerAssignment'], as: ['arm'] },
    };
    config.betweenSubjects = ['assignment'];
    config.sequence = {
      type: 'factor', id: 'nestedAliasedAssignment', factor: 'assignment', components: 'trial',
    };

    const compiled = compileFactorBlocks(config.sequence, config);
    const sequences = generateSequenceArray({
      ...config,
      sequence: compiled.sequence,
      components: compiled.components,
    });
    random.mockRestore();

    expect(sequences.map((sequence) => sequence.parameters)).toEqual([
      { arm: 1, assignment: { arm: 1 } },
      { arm: 2, assignment: { arm: 2 } },
    ]);
    sequences.forEach((sequence) => {
      const componentId = sequence.components.find((component): component is string => component !== 'end');
      expect(componentId).toBeDefined();
      expect(compiled.components[componentId!].parameters).toEqual({ arm: sequence.parameters?.arm });
    });
  });

  test('rejects incomplete base components used by factor blocks', () => {
    const config = factorConfig();
    config.baseComponents!.trial = {};
    const errors: ParserErrorWarning[] = [];

    const compiled = compileFactorBlocks(config.sequence, config, errors);

    expect(errors.map((error) => error.message)).toContain(
      'Factor block `test` generated component from base component `trial` that does not satisfy the IndividualComponent schema',
    );
    expect(compiled.components).toEqual({});
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

  test('supports object-valued between-subjects factors and rejects namespace collisions', async () => {
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

    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        message: 'Between-subjects factors `taskOrder` and `conflictingOrder` collide on parameter namespace `firstTask`',
      }),
    ]));
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

  test('allocates derived between-subjects factors', () => {
    const config = factorConfig();
    config.uiConfig.numSequences = 4;
    config.factors = {
      task: ['A', 'B'],
      interface: ['FFL', 'LaTeX'],
      assignment: { action: 'cross', factors: ['task', 'interface'] },
    };
    config.betweenSubjects = ['assignment'];

    const sequences = generateSequenceArray(config);

    expect(sequences).toHaveLength(4);
    expect(sequences.map((sequence) => sequence.parameters)).toEqual(expect.arrayContaining([
      expect.objectContaining({ task: 'A', interface: 'FFL' }),
      expect.objectContaining({ task: 'A', interface: 'LaTeX' }),
      expect.objectContaining({ task: 'B', interface: 'FFL' }),
      expect.objectContaining({ task: 'B', interface: 'LaTeX' }),
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

  test('preserves runtime sampling when an outer sample wraps a nested sample', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    const config = factorConfig();
    config.uiConfig.numSequences = 1;
    config.sequence = {
      type: 'factor',
      id: 'nestedOuterSample',
      factor: {
        action: 'sample',
        factors: [
          {
            action: 'sample', factors: ['a'], numSamples: 1, samplingStrategy: 'withoutReplacement',
          },
          'b',
        ],
        numSamples: 5,
        samplingStrategy: 'withoutReplacement',
      },
      components: 'trial',
    };

    const errors: ParserErrorWarning[] = [];
    const compiled = compileFactorBlocks(config.sequence, config, errors);
    expect(errors).toEqual([]);
    const runtimeWarnings: ParserErrorWarning[] = [];
    resolveOrderedFactorConditions(
      config.sequence.factor,
      config.factors!,
      createFactorOrderContext(0),
      [],
      'nestedOuterSample',
      undefined,
      runtimeWarnings,
    );
    expect(runtimeWarnings.map((warning) => warning.message)).toContain(
      'Sample factor `nestedOuterSample` requested 5 conditions but only 3 are available; stopping after the list is exhausted',
    );
    expect(compiled.sequence).toMatchObject({ type: 'factor-runtime-plan', id: 'nestedOuterSample' });

    const sequences = generateSequenceArray({
      ...config,
      sequence: compiled.sequence,
      components: compiled.components,
    });
    random.mockRestore();

    const generatedComponents = getSequenceFlatMap(sequences[0]).filter((componentId) => componentId !== 'end');
    expect(generatedComponents).toHaveLength(3);
    expect(generatedComponents.filter((componentId) => compiled.components[componentId].parameters?.a !== undefined)).toHaveLength(1);
    expect(generatedComponents.filter((componentId) => compiled.components[componentId].parameters?.b !== undefined)).toHaveLength(2);
  });

  test('preserves string types when filling component templates', () => {
    const config = factorConfig();
    config.factors = { file: [1] };
    config.sequence = {
      type: 'factor', id: 'stringTemplate', factor: 'file', components: 'trial',
    };
    if (!config.baseComponents?.trial || !('path' in config.baseComponents.trial)) {
      throw new Error('Expected a path component');
    }
    config.baseComponents!.trial.path = '{{file}}';

    const compiled = compileFactorBlocks(config.sequence, config);
    const component = Object.values(compiled.components)[0];

    if (!('path' in component)) throw new Error('Expected a path component');
    expect(component.path).toBe('1');
    expect(typeof component.path).toBe('string');
  });

  test.each([
    { factor: { values: ['A', 'B', 'C'], order: 'random' as const, numSamples: 2 }, expected: [] },
    { factor: { values: ['A', 'B', 'C'], order: 'random' as const, numSamples: 1 }, expected: ['Zip factor `knownZip` received inputs with different lengths (1, 2); stopping after the shortest input'] },
  ])('reports only real post-sampling length mismatches for $factor.numSamples ordered values', async ({ factor, expected }) => {
    const config = factorConfig();
    config.baseComponents!.trial = { type: 'questionnaire', response: [] };
    config.factors!.ordered = factor;
    config.sequence = {
      type: 'factor', id: 'knownZip', factor: { action: 'zip', factors: ['ordered', 'b'] }, components: 'trial',
    };
    const parsed = await parseStudyConfig(JSON.stringify(config));
    expect(parsed.errors).toEqual([]);
    expect(parsed.warnings.filter((warning) => warning.category === 'sequence-validation').map((warning) => warning.message)).toEqual(expected);
  });

  test('reports zip mismatch through nested sampling and repetition before sequence preparation', async () => {
    const config = factorConfig();
    config.baseComponents!.trial = { type: 'questionnaire', response: [] };
    config.factors!.sampled = {
      action: 'sample', factors: ['a'], numSamples: 2, samplingStrategy: 'withoutReplacement',
    };
    config.factors!.repeated = { action: 'repeat', factors: ['sampled'], numRepeats: 2 };
    config.sequence = {
      type: 'factor', id: 'nestedZip', factor: { action: 'zip', factors: ['repeated', 'b'] }, components: 'trial',
    };
    const parsed = await parseStudyConfig(JSON.stringify(config));
    expect(parsed.errors).toEqual([]);
    expect(parsed.warnings.map((warning) => warning.message)).toContain('Zip factor `nestedZip` received inputs with different lengths (4, 2); stopping after the shortest input');
    const savedConfig = JSON.stringify(parsed);
    generateSequenceArray(parsed);
    expect(JSON.stringify(parsed)).toBe(savedConfig);
  });

  test('checks zip lengths after sampling rather than against the full input pool', () => {
    const config = factorConfig();
    config.factors!.sampledA = {
      action: 'sample', factors: ['a'], numSamples: 2, samplingStrategy: 'withoutReplacement',
    };
    config.sequence = {
      type: 'factor',
      id: 'sampledZip',
      factor: { action: 'zip', factors: ['sampledA', 'b'] },
      components: 'trial',
    };
    const errors: ParserErrorWarning[] = [];
    const warnings: ParserErrorWarning[] = [];
    const compiled = compileFactorBlocks(config.sequence, config, errors, warnings);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    const sequences = generateSequenceArray({ ...config, ...compiled }, warnings);
    expect(sequences.every((sequence) => getSequenceFlatMap(sequence).length === 3)).toBe(true);
    expect(warnings).toEqual([]);
  });

  test('warns when a runtime zip will truncate unequal inputs', () => {
    const config = factorConfig();
    config.factors = {
      ordered: { values: ['A', 'B'], order: 'random' },
      short: ['x'],
    };
    const errors: ParserErrorWarning[] = [];
    const warnings: ParserErrorWarning[] = [];

    const compiled = compileFactorBlocks({
      type: 'factor',
      id: 'runtimeZip',
      factor: { action: 'zip', factors: ['ordered', 'short'] },
      components: 'trial',
    }, config, errors, warnings);

    expect(errors).toEqual([]);
    const expectedWarning = 'Zip factor `runtimeZip` received inputs with different lengths (2, 1); stopping after the shortest input';
    expect(warnings.map((warning) => warning.message)).toContain(expectedWarning);
    const sequences = generateSequenceArray({ ...config, ...compiled }, warnings);
    expect(getSequenceFlatMap(sequences[0])).toHaveLength(2);
    expect(warnings.map((warning) => warning.message)).toContain(expectedWarning);
  });

  test('surfaces warnings when runtime zip inputs become unequal', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    const config = factorConfig();
    config.uiConfig.numSequences = 1;
    config.factors = {
      ordered: { values: ['A', 'B'], order: 'random', numSamples: 1 },
      long: ['x', 'y'],
    };
    config.sequence = {
      type: 'factor',
      id: 'runtimeZipSampled',
      factor: { action: 'zip', factors: ['ordered', 'long'] },
      components: 'trial',
    };

    const errors: ParserErrorWarning[] = [];
    const warnings: ParserErrorWarning[] = [];
    const compiled = compileFactorBlocks(config.sequence, config, errors, warnings);
    expect(errors).toEqual([]);
    expect(warnings.map((warning) => warning.message)).toContain('Zip factor `runtimeZipSampled` received inputs with different lengths (1, 2); stopping after the shortest input');

    const sequences = generateSequenceArray({
      ...config,
      sequence: compiled.sequence,
      components: compiled.components,
    }, warnings);
    random.mockRestore();

    expect(sequences[0].components).toHaveLength(2);
    expect(warnings.map((warning) => warning.message)).toContain(
      'Zip factor `runtimeZipSampled` received inputs with different lengths (1, 2); stopping after the shortest input',
    );
  });

  test('warns when factor-owned numSamples exceeds participant-eligible values', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    const config = factorConfig();
    config.uiConfig.numSequences = 2;
    config.factors = {
      arm: ['A', 'B'],
      ordered: {
        values: [{ arm: 'A', value: 'x' }, { arm: 'B', value: 'y' }], order: 'random', numSamples: 2,
      },
    };
    config.betweenSubjects = ['arm'];
    config.sequence = {
      type: 'factor', id: 'runtimeSampled', factor: 'ordered', components: 'trial',
    };

    const errors: ParserErrorWarning[] = [];
    const warnings: ParserErrorWarning[] = [];
    const compiled = compileFactorBlocks(config.sequence, config, errors, warnings);
    expect(errors).toEqual([]);

    const sequences = generateSequenceArray({
      ...config,
      sequence: compiled.sequence,
      components: compiled.components,
    }, warnings);
    random.mockRestore();

    expect(sequences).toHaveLength(2);
    expect(sequences.every((sequence) => sequence.components.length === 2)).toBe(true);
    expect(warnings.map((warning) => warning.message)).toContain(
      'Factor `ordered` requested 2 values but only 1 are available; stopping after the list is exhausted',
    );
  });

  test('parses the factor-action demo', async () => {
    const config = readFileSync(
      'public/test-factors/config.json',
      'utf8',
    );

    const result = await parseStudyConfig(config);

    expect(result.errors).toEqual([]);
  });

  test('parses the Markdown templating factors demo', async () => {
    const config = readFileSync(
      'public/test-markdown-factors/config.json',
      'utf8',
    );

    const result = await parseStudyConfig(config);
    const rootSequence = result.sequence as ComponentBlock;
    const trialSequence = rootSequence.components[0] as ComponentBlock;

    expect(result.errors).toEqual([]);
    expect(trialSequence.components).toHaveLength(4);
    expect(result.components['markdownFactorTrials__animal=%22cat%22__color=%22blue%22__factorTemplate'])
      .toMatchObject({
        path: 'test-markdown-factors/assets/factor-template.md',
        parameters: { animal: 'cat', color: 'blue' },
      });
  });

  test('crosses five Stroop colors and assigns font size between participants', async () => {
    const config = readFileSync(
      'public/demo-stroop-factors/config.json',
      'utf8',
    );

    const result = await parseStudyConfig(config);
    const rootSequence = result.sequence as ComponentBlock;
    const trialSequence = rootSequence.components[1] as ComponentBlock;
    const redWordBlueInkId = 't__word=%22RED%22__inkColor=%22BLUE%22__stroopTrial';

    expect(result.errors).toEqual([]);
    expect(trialSequence).toMatchObject({
      id: 't',
      order: 'random',
    });
    expect(trialSequence.components).toHaveLength(25);
    expect(trialSequence.components.filter((componentId) => {
      if (typeof componentId !== 'string' || !('parameters' in result.components[componentId])) {
        return false;
      }
      const { parameters } = result.components[componentId];
      return parameters?.word === parameters?.inkColor;
    })).toHaveLength(5);
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
    const sequences = generateSequenceArray({
      ...result,
      uiConfig: { ...result.uiConfig, numSequences: 2 },
    });
    expect(sequences.map((sequence) => sequence.parameters?.fontSize)).toEqual(['24px', '48px']);
    sequences.forEach((sequence) => {
      const runtimeConfig = materializeParticipantConfig(result, sequence.parameters || {});
      const trials = getSequenceFlatMap(sequence).filter((id) => id.startsWith('t__'));
      expect(trials).toHaveLength(25);
      trials.forEach((id) => {
        expect(runtimeConfig.components[id]).toMatchObject({
          type: 'markdown',
          parameters: { fontSize: sequence.parameters?.fontSize },
        });
      });
    });
  });

  test('parses the factorized visualization guardrails study', async () => {
    const config = readFileSync(
      'public/test-max-study2/config.json',
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
    expect(result.warnings.filter((warning) => warning.message.includes('different lengths'))).toEqual([]);
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

describe('release regressions: factor allocation', () => {
  test('reuses a random ordered factor selection in the same sequence', () => {
    const random = vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0).mockReturnValueOnce(0)
      .mockReturnValue(0.999);
    try {
      const factors = { tasks: { values: ['A', 'B', 'C'], order: 'random' as const, numSamples: 1 } };
      const context = createFactorOrderContext(0);
      const first = resolveOrderedFactorConditions('tasks', factors, context);
      expect(first).toHaveLength(1);
      expect(resolveOrderedFactorConditions('tasks', factors, context)).toEqual(first);
    } finally { random.mockRestore(); }
  });

  test('rejects a sequence count that cannot cover every between-subject combination', () => {
    const config = factorConfig();
    config.factors = { group: ['A', 'B', 'C'] };
    config.betweenSubjects = ['group'];
    config.uiConfig.numSequences = 2;
    const errors: ParserErrorWarning[] = [];
    validateBetweenSubjects(config, [], errors);
    expect(errors).toContainEqual(expect.objectContaining({ instancePath: '/uiConfig/numSequences' }));
  });

  test('rejects explicit block ordering that conflicts with runtime factor ordering', () => {
    const config = factorConfig();
    config.factors = { tasks: { values: ['A', 'B', 'C'], order: 'latinSquare' } };
    config.sequence = {
      type: 'factor', id: 'trial', factor: 'tasks', order: 'random', components: 'trial',
    };
    const errors: ParserErrorWarning[] = [];
    compileFactorBlocks(config.sequence, config, errors);
    expect(errors).toContainEqual(expect.objectContaining({ message: expect.stringMatching(/order/) }));
  });
});

test('followup: sampled aliases retain trials for every between-subject assignment', async () => {
  const config = factorConfig();
  config.uiConfig.numSequences = 4;
  config.baseComponents = { trial: { type: 'questionnaire', response: [] } };
  config.factors = {
    values: ['a', 'b'],
    first: ['a', 'b'],
    second: ['a', 'b'],
    sample: {
      action: 'sample', factors: ['values'], numSamples: 1, samplingStrategy: 'withoutReplacement',
    },
    pair: { action: 'cross', factors: ['sample', 'sample'], as: ['first', 'second'] },
  };
  config.betweenSubjects = ['first', 'second'];
  config.sequence = {
    order: 'fixed',
    components: [{
      type: 'factor', id: 'pairs', factor: 'pair', components: 'trial',
    }],
  };
  const parsed = await parseStudyConfig(JSON.stringify(config));
  expect(parsed.errors).toEqual([]);
  const sequences = generateSequenceArray(parsed);
  expect(sequences).toHaveLength(4);
  sequences.forEach((sequence) => expect(getSequenceFlatMap(sequence).filter((id) => id !== 'end')).toHaveLength(1));
});
