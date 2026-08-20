import { isEmail } from '@mantine/form';
import type { BuiltInValidationType } from '../../parser/types';

type BuiltInValidation = {
  passes: (value: string) => boolean;
  message: string;
};

const US_STATES = new Map([
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'],
  ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'],
  ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'],
  ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'],
  ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'], ['MD', 'Maryland'],
  ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'],
  ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'],
  ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'],
  ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'],
  ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'],
  ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'],
  ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'], ['WV', 'West Virginia'],
  ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
]);

const emailValidation = isEmail();

function isHttpUrl(value: string) {
  if (value.trim() !== value) {
    return false;
  }

  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.length > 0;
  } catch {
    return false;
  }
}

function isDateInMonthDayYearFormat(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    return false;
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  return year >= 1
    && month >= 1
    && month <= 12
    && day >= 1
    && day <= daysInMonth[month - 1];
}

function isValidUSState(value: string) {
  const normalizedValue = value.trim().toLowerCase();

  return [...US_STATES].some(([abbreviation, name]) => (
    abbreviation.toLowerCase() === normalizedValue || name.toLowerCase() === normalizedValue
  ));
}

const BUILT_IN_VALIDATIONS: Record<BuiltInValidationType, BuiltInValidation> = {
  email: {
    passes: (value) => emailValidation(value) === null,
    message: 'Please enter a valid email address.',
  },
  phoneNumber: {
    passes: (value) => /^\d{3}-\d{3}-\d{4}$/.test(value),
    message: 'Please enter a valid phone number in the format 000-000-0000.',
  },
  usState: {
    passes: isValidUSState,
    message: 'Please enter a valid US state name or two-letter abbreviation.',
  },
  postalCode: {
    passes: (value) => /^\d{5}(?:-\d{4})?$/.test(value),
    message: 'Please enter a valid US postal code in the format 00000 or 00000-0000.',
  },
  url: {
    passes: isHttpUrl,
    message: 'Please enter a valid URL beginning with http:// or https://.',
  },
  date: {
    passes: isDateInMonthDayYearFormat,
    message: 'Please enter a valid date in MM/DD/YYYY format.',
  },
  time: {
    passes: (value) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value),
    message: 'Please enter a valid time in HH:mm format.',
  },
};

export function checkBuiltInValidation(type: BuiltInValidationType, value: string): string | null {
  const validation = BUILT_IN_VALIDATIONS[type];
  return validation.passes(value) ? null : validation.message;
}
