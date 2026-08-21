import { describe, expect, test } from 'vitest';
import { checkBuiltInValidation } from '../builtInValidation';

describe('checkBuiltInValidation', () => {
  test.each([
    'test@revisit.dev',
    'test+participant@revisit.dev',
    'participant@university.edu',
    'first.last@sub-domain.revisit.dev',
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
    '.a@example.com',
    'a.@example.com',
    'a..b@example.com',
    'a@example..com',
    'a@-example.com',
    'a@example-.com',
    'a@exam_ple.com',
    'a@example.com.',
  ])('rejects an invalid email address: %s', (value) => {
    expect(checkBuiltInValidation('email', value)).toBe('Please enter a valid email address.');
  });

  test.each([
    '8000000',
    '+800-0000-0000',
    '+1-800-000-0000',
    '800-0000',
    '123456789012345',
  ])('accepts an international phone number containing 7 to 15 digits: %s', (value) => {
    expect(checkBuiltInValidation('phoneNumber', value)).toBeNull();
  });

  test.each([
    '800000',
    '1234567890123456',
    '+800--0000',
    '8000000-',
    '1+8000000',
    ' 8000000',
    'phone-number',
  ])('rejects an international phone number outside the supported format: %s', (value) => {
    expect(checkBuiltInValidation('phoneNumber', value))
      .toBe('Please enter a valid phone number.');
  });

  test('accepts a US phone number with two hyphens', () => {
    expect(checkBuiltInValidation('usPhoneNumber', '800-000-0000')).toBeNull();
  });

  test.each([
    '8000000000',
    '800 000 0000',
    '800-000-000',
    '+1-800-000-0000',
  ])('rejects a US phone number outside the 000-000-0000 format: %s', (value) => {
    expect(checkBuiltInValidation('usPhoneNumber', value))
      .toBe('Please enter a valid US phone number in the format 000-000-0000.');
  });

  test.each([
    'https://revisit.dev',
    'http://localhost:8080/study?id=test',
    'https://sub-domain.revisit.dev/path',
    'http://127.0.0.1:8080/path',
    'http://[::1]:8080/path',
  ])('accepts a valid HTTP URL: %s', (value) => {
    expect(checkBuiltInValidation('url', value)).toBeNull();
  });

  test.each([
    'revisit.dev',
    'ftp://revisit.dev',
    'https://',
    ' https://revisit.dev',
    'not a url',
    'http:foo',
    'http://.',
    'https://example..com',
    'https://-example.com',
    'https://example-.com',
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
