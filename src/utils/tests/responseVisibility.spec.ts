import { describe, expect, test } from 'vitest';
import type { StoredAnswer } from '../../store/types';
import type { Response } from '../../parser/types';
import { resolveResponseVisibility } from '../responseVisibility';

const responses: Response[] = [
  {
    id: 'attended', type: 'radio', prompt: '', options: ['yes', 'no'],
  },
  {
    id: 'name', type: 'shortText', prompt: '', visibleIf: { responseId: 'attended', equals: 'yes' },
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
    const fields: Response[] = [responses[0], { ...responses[1], visibleIf: { responseId: 'attended', notEquals: 'no' } }];
    expect(resolveResponseVisibility(fields, {}).visibleIds.has('name')).toBe(false);
    expect(resolveResponseVisibility(fields, { attended: 'yes' }).visibleIds.has('name')).toBe(true);
    fields[1].visibleIf = { responseId: 'attended', equals: 1 };
    expect(resolveResponseVisibility(fields, { attended: '1' }).visibleIds.has('name')).toBe(false);
    expect(resolveResponseVisibility(fields, { attended: 1 }).visibleIds.has('name')).toBe(true);
  });

  test('compares complete lists without regard to selection order', () => {
    const fields: Response[] = [responses[0], { ...responses[1], visibleIf: { responseId: 'attended', equals: ['a', 'b'] } }];
    expect(resolveResponseVisibility(fields, { attended: ['b', 'a'] }).visibleIds.has('name')).toBe(true);
    expect(resolveResponseVisibility(fields, { attended: ['a'] }).visibleIds.has('name')).toBe(false);
  });

  test('clears a dependency chain, defaults, and auxiliary values', () => {
    const fields: Response[] = [
      {
        id: 'leaf', type: 'radio', prompt: '', options: ['other'], withOther: true, withDontKnow: true, visibleIf: { responseId: 'name', equals: 'University' },
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
      id: 'text', type: 'textOnly', prompt: '', visibleIf: { responseId: 'attended', equals: 'yes' },
    }, { id: 'divider', type: 'divider', visibleIf: { responseId: 'attended', equals: 'yes' } }];
    expect([...resolveResponseVisibility(fields, { attended: 'yes' }).visibleIds]).toEqual(['attended', 'text', 'divider']);
    expect([...resolveResponseVisibility(fields, { attended: 'yes', 'attended-dontKnow': true }).visibleIds]).toEqual(['attended']);
  });
});
