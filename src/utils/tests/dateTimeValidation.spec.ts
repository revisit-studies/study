import { describe, expect, test } from 'vitest';
import {
  DATE_TIME_POPOVER_PROPS,
  formatDateInput,
  formatMonthInput,
  fromPickerDateValue,
  getDateValueFormat,
  isValidTime,
  parseDateValue,
  parseMonthDayYear,
  toPickerDateValue,
} from '../dateTimeValidation';

describe('dateTimeValidation', () => {
  test('keeps picker dropdowns below and scrollable within the available viewport', () => {
    expect(DATE_TIME_POPOVER_PROPS).toEqual({
      position: 'bottom-start',
      middlewares: {
        flip: false,
        shift: { mainAxis: false, crossAxis: true },
        size: true,
      },
      styles: { dropdown: { overflowY: 'auto' } },
    });
  });

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
    ['date', '06/24/0099'],
    ['month', '06/0099'],
    ['year', '0099'],
  ] as const)('rejects an invalid %s date option value: %s', (options, value) => {
    expect(parseDateValue(value, options)).toBeNull();
  });

  test.each([
    ['date', 'MM/DD/YYYY'],
    ['month', 'MM/YYYY'],
    ['year', 'YYYY'],
  ] as const)('returns the %s date option format', (options, expectedFormat) => {
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

  test.each([
    ['06', '06/'],
    ['062', '06/2'],
    ['0624', '06/24/'],
    ['06242', '06/24/2'],
    ['06242026', '06/24/2026'],
    ['6/24/2026', '6/24/2026'],
    ['0/24/2026', '0/24/2026'],
    ['06/4/2026', '06/4/2026'],
  ])('formats date input without repartitioning cursor edits: %s', (value, expected) => {
    expect(formatDateInput(value)).toBe(expected);
  });

  test.each([
    ['6/24/2026', '6/24/2026'],
    ['0/24/2026', '0/24/2026'],
    ['06/4/2026', '06/4/2026'],
  ])('preserves a date value while deleting: %s', (value, expected) => {
    expect(formatDateInput(value, true)).toBe(expected);
  });

  test.each([
    ['06', '06/'],
    ['062026', '06/2026'],
    ['6/2026', '6/2026'],
    ['0/2026', '0/2026'],
  ])('formats month input without repartitioning cursor edits: %s', (value, expected) => {
    expect(formatMonthInput(value)).toBe(expected);
  });

  test.each([
    ['6/2026', '6/2026'],
    ['0/2026', '0/2026'],
  ])('preserves a month value while deleting: %s', (value, expected) => {
    expect(formatMonthInput(value, true)).toBe(expected);
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
