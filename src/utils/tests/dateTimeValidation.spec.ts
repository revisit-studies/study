import { describe, expect, test } from 'vitest';
import {
  formatMonthDayYear,
  isValidTime,
  parseMonthDayYear,
} from '../dateTimeValidation';

describe('dateTimeValidation', () => {
  test.each([
    ['06/24/2009', 2009, 5, 24],
    ['02/29/2024', 2024, 1, 29],
  ])('parses a valid MM/DD/YYYY date: %s', (value, year, month, day) => {
    const date = parseMonthDayYear(value);

    expect(date?.getFullYear()).toBe(year);
    expect(date?.getMonth()).toBe(month);
    expect(date?.getDate()).toBe(day);
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

  test.each(['00:00', '10:10', '23:59'])('accepts a valid 24-hour time: %s', (value) => {
    expect(isValidTime(value)).toBe(true);
  });

  test.each(['2:28', '24:00', '14:60', '02:28 PM', '14:28:00'])('rejects an invalid 24-hour time: %s', (value) => {
    expect(isValidTime(value)).toBe(false);
  });
});
