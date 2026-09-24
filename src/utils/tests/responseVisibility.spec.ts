import { describe, expect, test } from 'vitest';
import type { StoredAnswer } from '../../store/types';
import type { Response } from '../../parser/types';
import { resolveResponseVisibility } from '../responseVisibility';

const responses: Response[] = [
  {
    id: 'attended', type: 'radio', prompt: '', options: ['yes', 'no'],
  },
  {
    id: 'name', type: 'shortText', prompt: '', visibleIf: { responseId: 'attended', comparison: 'equals', value: 'yes' },
  },
];

describe('conditional response visibility', () => {
  test.each([undefined, null, '', [], 'no'])('hides dependent fields for %j', (attended) => {
    const values: StoredAnswer['answer'] = attended === undefined ? { name: 'Old university' } : { attended, name: 'Old university' };
    const result = resolveResponseVisibility(responses, values);
    expect(result.visibleIds.has('name')).toBe(false);
    expect(result.answers).not.toHaveProperty('name');
    expect(values.name).toBe('Old university');
  });

  test('preserves visible answers and assigned response order', () => {
    const ordered = [...responses].reverse();
    const result = resolveResponseVisibility(ordered, { attended: 'yes', name: 'University' });
    expect(ordered.filter((response) => result.visibleIds.has(response.id)).map((response) => response.id)).toEqual(['name', 'attended']);
    expect(result.answers.name).toBe('University');
  });

  test('notEquals requires an answer and comparisons do not coerce types', () => {
    const fields: Response[] = [responses[0], { ...responses[1], visibleIf: { responseId: 'attended', comparison: 'doesNotEqual', value: 'no' } }];
    expect(resolveResponseVisibility(fields, {}).visibleIds.has('name')).toBe(false);
    expect(resolveResponseVisibility(fields, { attended: 'yes' }).visibleIds.has('name')).toBe(true);
    fields[1].visibleIf = { responseId: 'attended', comparison: 'equals', value: 1 };
    expect(resolveResponseVisibility(fields, { attended: '1' }).visibleIds.has('name')).toBe(false);
    expect(resolveResponseVisibility(fields, { attended: 1 }).visibleIds.has('name')).toBe(true);
  });

  test('compares complete lists without regard to selection order', () => {
    const fields: Response[] = [responses[0], { ...responses[1], visibleIf: { responseId: 'attended', comparison: 'equals', value: ['a', 'b'] } }];
    expect(resolveResponseVisibility(fields, { attended: ['b', 'a'] }).visibleIds.has('name')).toBe(true);
    expect(resolveResponseVisibility(fields, { attended: ['a'] }).visibleIds.has('name')).toBe(false);
  });

  test('clears a dependency chain, defaults, and auxiliary values', () => {
    const fields: Response[] = [
      {
        id: 'leaf', type: 'radio', prompt: '', options: ['other'], withOther: true, withDontKnow: true, visibleIf: { responseId: 'name', comparison: 'equals', value: 'University' },
      },
      ...responses,
    ];
    const defaults = { name: 'University', leaf: 'other' };
    const hidden = resolveResponseVisibility(fields, {
      attended: 'no', name: 'University', leaf: 'other', 'leaf-other': 'old', 'leaf-dontKnow': true,
    }, defaults);
    expect(hidden.answers).toEqual({ attended: 'no' });
    expect(resolveResponseVisibility(fields, { attended: 'yes' }, defaults).answers).toEqual({ attended: 'yes', ...defaults });
    expect(resolveResponseVisibility(fields, { attended: 'yes', name: '' }, defaults).answers).toEqual({ attended: 'yes', name: '' });
  });

  test('textOnly and divider can be conditional; dontKnow does not reveal dependents', () => {
    const fields: Response[] = [responses[0], {
      id: 'text', type: 'textOnly', prompt: '', visibleIf: { responseId: 'attended', comparison: 'equals', value: 'yes' },
    }, { id: 'divider', type: 'divider', visibleIf: { responseId: 'attended', comparison: 'equals', value: 'yes' } }];
    expect([...resolveResponseVisibility(fields, { attended: 'yes' }).visibleIds]).toEqual(['attended', 'text', 'divider']);
    expect([...resolveResponseVisibility(fields, { attended: 'yes', 'attended-dontKnow': true }).visibleIds]).toEqual(['attended']);
  });
});

describe('comparison conditions', () => {
  test.each([
    ['lessThan', 20, true], ['lessThan', 21, false], ['lessThan', 22, false],
    ['lessThanOrEqual', 21, true], ['greaterThan', 21, false],
    ['greaterThan', 22, true], ['greaterThanOrEqual', 21, true],
  ] as const)('%s evaluates the age boundary for %s', (comparison, age, visible) => {
    const fields: Response[] = [
      { id: 'age', type: 'numerical', prompt: '' },
      { ...responses[1], visibleIf: { responseId: 'age', comparison, value: 21 } },
    ];
    expect(resolveResponseVisibility(fields, { age }).visibleIds.has('name')).toBe(visible);
    expect(resolveResponseVisibility(fields, {}).visibleIds.has('name')).toBe(false);
    expect(resolveResponseVisibility(fields, { age: '20' }).visibleIds.has('name')).toBe(false);
  });

  test.each([
    ['contains', 'example', 'example.com', true],
    ['doesNotContain', 'example', 'other.com', true],
    ['matchesRegex', '@example\\.com$', 'a@example.com', true],
    ['matchesRegex', '@example\\.com$', 'a@other.com', false],
    ['matchesRegex', '[', 'anything', false],
    ['equals', '01', '1', false],
  ] as const)('%s evaluates string conditions', (comparison, expected, answer, visible) => {
    const fields: Response[] = [responses[0], {
      ...responses[1], visibleIf: { responseId: 'attended', comparison, value: expected },
    }];
    expect(resolveResponseVisibility(fields, { attended: answer }).visibleIds.has('name')).toBe(visible);
    expect(resolveResponseVisibility(fields, { attended: '' }).visibleIds.has('name')).toBe(false);
  });

  test.each([true, false])('isCorrect=%s uses configured correctness and excludes unanswered responses', (expected) => {
    const fields: Response[] = [responses[0], {
      ...responses[1], visibleIf: { responseId: 'attended', comparison: 'isCorrect', value: expected },
    }];
    const correctAnswers = [{
      id: 'attended', answer: 21, acceptableLow: 20, acceptableHigh: 22,
    }];
    expect(resolveResponseVisibility(fields, { attended: '21' }, {}, correctAnswers).visibleIds.has('name')).toBe(expected);
    expect(resolveResponseVisibility(fields, { attended: 23 }, {}, correctAnswers).visibleIds.has('name')).toBe(!expected);
    expect(resolveResponseVisibility(fields, {}, {}, correctAnswers).visibleIds.has('name')).toBe(false);
    expect(resolveResponseVisibility(fields, { attended: 21 }).visibleIds.has('name')).toBe(false);
  });

  test('isCorrect cannot reveal a dependent of a hidden controller', () => {
    const fields: Response[] = [...responses, {
      id: 'leaf', type: 'shortText', prompt: '', visibleIf: { responseId: 'name', comparison: 'isCorrect', value: false },
    }];
    const result = resolveResponseVisibility(fields, { attended: 'no', name: 'incorrect', leaf: 'old' }, {}, [{ id: 'name', answer: 'University' }]);
    expect(result.answers).toEqual({ attended: 'no' });
    expect(result.visibleIds.has('leaf')).toBe(false);
  });
});
