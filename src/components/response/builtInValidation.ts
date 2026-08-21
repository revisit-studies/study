import { isEmail } from '@mantine/form';
import type { BuiltInValidationType } from '../../parser/types';

type BuiltInValidation = {
  passes: (value: string) => boolean;
  message: string;
};

const emailValidation = isEmail();
// RFC 5322 email regex pattern for the local part and domain labels
// Email local part takes any letter or digit, and special characters !#$%&'*+/=?^_`{|}~-. (dot cannot be first or last character, and cannot appear consecutively)
const EMAIL_LOCAL_PART_PATTERN = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
// Email domain part takes any letter or digit, and hyphen (cannot be first or last character, and cannot appear consecutively)
const EMAIL_DOMAIN_LABEL_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;

function isEmailAddress(value: string) {
  if (emailValidation(value) !== null) {
    return false;
  }

  const emailParts = value.split('@');
  // If there are not exactly two parts (local part and domain), it's not a valid email address
  if (emailParts.length !== 2) {
    return false;
  }

  const [localPart, domain] = emailParts;
  const domainLabels = domain.split('.');
  const topLevelDomain = domainLabels[domainLabels.length - 1];

  // Domain should have at least two labels (e.g., example.com), and the top-level domain should be at least two characters long (e.g., .com, .org)
  return EMAIL_LOCAL_PART_PATTERN.test(localPart)
    && domainLabels.length >= 2
    && topLevelDomain.length >= 2
    && domainLabels.every((label) => EMAIL_DOMAIN_LABEL_PATTERN.test(label));
}

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

function isPhoneNumber(value: string) {
  if (!/^\+?\d+(?:-\d+)*$/.test(value)) {
    return false;
  }

  const digitCount = value.replace(/\D/g, '').length;
  return digitCount >= 7 && digitCount <= 15;
}

const BUILT_IN_VALIDATIONS: Record<BuiltInValidationType, BuiltInValidation> = {
  email: {
    passes: isEmailAddress,
    message: 'Please enter a valid email address.',
  },
  phoneNumber: {
    passes: isPhoneNumber,
    message: 'Please enter a valid phone number.',
  },
  usPhoneNumber: {
    passes: (value) => /^\d{3}-\d{3}-\d{4}$/.test(value),
    message: 'Please enter a valid US phone number in the format 000-000-0000.',
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
