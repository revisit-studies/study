import { describe, expect, test } from 'vitest';
import {
  formatDateValue,
  formatMonthDayYear,
  fromPickerDateValue,
  getDateValueFormat,
  isValidTime,
  parseDateValue,
  parseMonthDayYear,
  toPickerDateValue,
} from '../dateTimeValidation';

describe('dateTimeValidation', () => {
  test.each([
    ['06/24/2009', 2009, 5, 24],
    ['02/29/2024', 2024, 1, 29],
  ])('parses a valid MM/DD/YYYY date: %s', (value, year, month, day) => {
    const date = parseMonthDayYear(value);

    expect(date?.getUTCFullYear()).toBe(year);
    expect(date?.getUTCMonth()).toBe(month);
    expect(date?.getUTCDate()).toBe(day);
  });

  test.each([
    '2009-06-24',
    '02/29/2025',
    '04/31/2025',
    '13/01/2025',
    '01/01/0000',
  ])('rejects an invalid MM/DD/YYYY date: %s', (value) => {
    expect(parseMonthDayYear(value)).toBeNull();
  });

  test('formats a date without converting it to UTC', () => {
    expect(formatMonthDayYear(new Date(2009, 5, 24))).toBe('06/24/2009');
  });

  test('validates a civil date skipped by the runtime timezone', () => {
    const originalTimezone = process.env.TZ;
    process.env.TZ = 'Pacific/Apia';

    try {
      expect(parseMonthDayYear('12/30/2011')?.toISOString()).toBe('2011-12-30T00:00:00.000Z');
    } finally {
      if (originalTimezone === undefined) {
        Reflect.deleteProperty(process.env, 'TZ');
      } else {
        process.env.TZ = originalTimezone;
      }
    }
  });

  test.each([
    ['date', '06/24/2009', 5, 24],
    ['month', '06/2009', 5, 1],
    ['year', '2009', 0, 1],
  ] as const)('parses a valid %s date option value', (options, value, month, day) => {
    const date = parseDateValue(value, options);

    expect(date?.getUTCFullYear()).toBe(2009);
    expect(date?.getUTCMonth()).toBe(month);
    expect(date?.getUTCDate()).toBe(day);
  });

  test.each([
    ['month', '13/2009'],
    ['month', '6/2009'],
    ['month', '06/24/2009'],
    ['year', '0000'],
    ['year', '09'],
    ['year', '06/2009'],
  ] as const)('rejects an invalid %s date option value: %s', (options, value) => {
    expect(parseDateValue(value, options)).toBeNull();
  });

  test.each([
    ['date', '06/24/2009', 'MM/DD/YYYY'],
    ['month', '06/2009', 'MM/YYYY'],
    ['year', '2009', 'YYYY'],
  ] as const)('formats %s date option values', (options, expectedValue, expectedFormat) => {
    expect(formatDateValue(new Date(2009, 5, 24), options)).toBe(expectedValue);
    expect(getDateValueFormat(options)).toBe(expectedFormat);
  });

  test.each([
    ['date', '06/24/2009', '2009-06-24'],
    ['month', '06/2009', '2009-06-01'],
    ['year', '2009', '2009-01-01'],
  ] as const)('converts a %s response value to and from the picker format', (options, responseValue, pickerValue) => {
    expect(toPickerDateValue(responseValue, options)).toBe(pickerValue);
    expect(fromPickerDateValue(pickerValue, options)).toBe(responseValue);
  });

  test('rejects an invalid picker date value', () => {
    expect(toPickerDateValue('02/29/2025', 'date')).toBeNull();
    expect(fromPickerDateValue('06/24/2009', 'date')).toBe('');
  });

  test.each(['00:00', '10:10', '23:59'])('accepts a valid 24-hour time: %s', (value) => {
    expect(isValidTime(value)).toBe(true);
  });

  test.each(['2:28', '24:00', '14:60', '02:28 PM', '14:28:00'])('rejects an invalid 24-hour time: %s', (value) => {
    expect(isValidTime(value)).toBe(false);
  });

  test.each(['00:00:00', '10:10:10', '23:59:59'])('accepts a valid 24-hour time with seconds: %s', (value) => {
    expect(isValidTime(value, true)).toBe(true);
  });

  test.each(['14:28', '24:00:00', '14:60:00', '14:28:60'])('rejects an invalid 24-hour time with seconds: %s', (value) => {
    expect(isValidTime(value, true)).toBe(false);
  });
});
