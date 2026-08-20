import { describe, expect, test } from 'vitest';
import { checkBuiltInValidation } from '../builtInValidation';

describe('checkBuiltInValidation', () => {
  test.each([
    'test@revisit.dev',
    'test+participant@revisit.dev',
    'participant@university.edu',
  ])('accepts a valid email address: %s', (value) => {
    expect(checkBuiltInValidation('email', value)).toBeNull();
  });

  test.each([
    'test',
    'test@revisit',
    'test@revisit.d',
    '@revisit.dev',
    'test@.dev',
    'test @revisit.dev',
  ])('rejects an invalid email address: %s', (value) => {
    expect(checkBuiltInValidation('email', value)).toBe('Please enter a valid email address.');
  });

  test('accepts a US phone number with two hyphens', () => {
    expect(checkBuiltInValidation('phoneNumber', '800-000-0000')).toBeNull();
  });

  test.each([
    '8000000000',
    '800 000 0000',
    '800-000-000',
    '+1-800-000-0000',
  ])('rejects a phone number outside the 000-000-0000 format: %s', (value) => {
    expect(checkBuiltInValidation('phoneNumber', value))
      .toBe('Please enter a valid phone number in the format 000-000-0000.');
  });

  test.each([
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
    'New York', 'Washington', 'texas', ' tx ',
  ])('accepts a valid US state name or abbreviation: %s', (value) => {
    expect(checkBuiltInValidation('usState', value)).toBeNull();
  });

  test.each(['ZZ', 'New Pork', 'DC'])('rejects an invalid US state name or abbreviation: %s', (value) => {
    expect(checkBuiltInValidation('usState', value))
      .toBe('Please enter a valid US state name or two-letter abbreviation.');
  });

  test.each(['12345', '12345-6789'])('accepts a valid US postal code: %s', (value) => {
    expect(checkBuiltInValidation('postalCode', value)).toBeNull();
  });

  test.each(['1234', '123456789', '12345 6789', 'ABCDE'])('rejects an invalid US postal code: %s', (value) => {
    expect(checkBuiltInValidation('postalCode', value))
      .toBe('Please enter a valid US postal code in the format 00000 or 00000-0000.');
  });

  test.each([
    'https://revisit.dev',
    'http://localhost:8080/study?id=test',
  ])('accepts a valid HTTP URL: %s', (value) => {
    expect(checkBuiltInValidation('url', value)).toBeNull();
  });

  test.each([
    'revisit.dev',
    'ftp://revisit.dev',
    'https://',
    ' https://revisit.dev',
    'not a url',
  ])('rejects an invalid HTTP URL: %s', (value) => {
    expect(checkBuiltInValidation('url', value))
      .toBe('Please enter a valid URL beginning with http:// or https://.');
  });

  test.each([
    '06/24/2009',
    '02/29/2024',
    '12/31/2026',
  ])('accepts a valid MM/DD/YYYY date: %s', (value) => {
    expect(checkBuiltInValidation('date', value)).toBeNull();
  });

  test.each([
    '6/24/2009',
    '02/29/2025',
    '04/31/2025',
    '13/01/2025',
    '00/01/2025',
    '01/01/0000',
  ])('rejects an invalid MM/DD/YYYY date: %s', (value) => {
    expect(checkBuiltInValidation('date', value))
      .toBe('Please enter a valid date in MM/DD/YYYY format.');
  });

  test.each(['00:00', '14:28', '23:59'])('accepts a valid HH:mm time: %s', (value) => {
    expect(checkBuiltInValidation('time', value)).toBeNull();
  });

  test.each(['2:28', '24:00', '14:60', '02:28 PM'])('rejects an invalid HH:mm time: %s', (value) => {
    expect(checkBuiltInValidation('time', value))
      .toBe('Please enter a valid time in HH:mm format.');
  });
});
