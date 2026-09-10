import { describe, expect, test } from 'vitest';
import type { DropdownResponse } from '../../parser/types';
import { getDropdownOptions } from '../dropdownOptions';

describe('getDropdownOptions', () => {
  test('parses configured options', () => {
    const response: DropdownResponse = {
      id: 'custom-options',
      prompt: 'Select an option',
      type: 'dropdown',
      options: ['First', { label: 'Second', value: 'second' }],
    };

    expect(getDropdownOptions(response)).toEqual([
      { label: 'First', value: 'First' },
      { label: 'Second', value: 'second' },
    ]);
  });

  test('expands the countries preset to emoji labels and ISO alpha-2 values', () => {
    const response: DropdownResponse = {
      id: 'country',
      prompt: 'Select a country',
      type: 'dropdown',
      options: 'countries',
    };

    const options = getDropdownOptions(response);
    expect(options.length).toBeGreaterThan(200);
    expect(options).toContainEqual({ label: '🇺🇸 United States', value: 'US' });
  });

  test('returns no options instead of throwing for an invalid runtime response', () => {
    const response = {
      id: 'missing-options',
      prompt: 'Select an option',
      type: 'dropdown',
    } as DropdownResponse;

    expect(getDropdownOptions(response)).toEqual([]);
  });
});
