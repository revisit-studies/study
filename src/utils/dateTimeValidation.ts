function createUtcDate(year: number, month: number, day: number) {
  // Mantine/dayjs interprets years 0000–0099 as 1900–1999 at the picker boundary.
  if (year < 100) {
    return null;
  }

  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
    ? date
    : null;
}

// Checks if a string is a valid date in the format MM/DD/YYYY
export function parseMonthDayYear(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? createUtcDate(Number(match[3]), Number(match[1]), Number(match[2])) : null;
}

export function parseMonthYear(value: string) {
  // Checks if a string is a valid date in the format MM/YYYY
  const match = value.match(/^(\d{2})\/(\d{4})$/);
  return match ? createUtcDate(Number(match[2]), Number(match[1]), 1) : null;
}

export function parseYear(value: string) {
  // Checks if a string is a valid date in the format YYYY
  const match = value.match(/^(\d{4})$/);
  return match ? createUtcDate(Number(match[1]), 1, 1) : null;
}

// Checks if a string is a valid date in the format MM/DD/YYYY, MM/YYYY, or YYYY
export function parseDateValue(value: string, options: 'date' | 'month' | 'year' = 'date') {
  if (options === 'month') {
    return parseMonthYear(value);
  }
  if (options === 'year') {
    return parseYear(value);
  }
  return parseMonthDayYear(value);
}

export function toPickerDateValue(value: string, options: 'date' | 'month' | 'year') {
  const date = parseDateValue(value, options);
  if (date === null) {
    return null;
  }

  const year = date.getUTCFullYear().toString().padStart(4, '0');
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = date.getUTCDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function fromPickerDateValue(value: string, options: 'date' | 'month' | 'year') {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return '';
  }

  if (options === 'month') {
    return `${match[2]}/${match[1]}`;
  }
  if (options === 'year') {
    return match[1];
  }
  return `${match[2]}/${match[3]}/${match[1]}`;
}

export function getDateValueFormat(options: 'date' | 'month' | 'year' = 'date') {
  if (options === 'month') {
    return 'MM/YYYY';
  }
  if (options === 'year') {
    return 'YYYY';
  }
  return 'MM/DD/YYYY';
}

// Checks if a string is a valid time in the format HH:MM or HH:MM:SS (24-hour format)
export function isValidTime(value: string, withSeconds = false) {
  const pattern = withSeconds
    ? /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/
    : /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  return pattern.test(value);
}
