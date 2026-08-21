import { isEmail } from '@mantine/form';
import type { BuiltInValidationType } from '../../parser/types';

type BuiltInValidation = {
  passes: (value: string) => boolean;
  message: string;
};

const emailValidation = isEmail();
// Email local part can contain letters, digits, and special characters, but cannot start or end with a dot, and cannot have consecutive dots.
const EMAIL_LOCAL_PART_PATTERN = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
// Domain part consists of labels separated by dots, where each label can contain letters, digits, and hyphens, but cannot start or end with a hyphen. The top-level domain must be at least two characters long.
const DOMAIN_LABEL_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;

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
    && domainLabels.every((label) => DOMAIN_LABEL_PATTERN.test(label));
}

function isIpHostname(hostname: string) {
  // If the hostname is an IPv6 address, it will be enclosed in square brackets (e.g., [2001:db8::1])
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    return true;
  }

  const labels = hostname.split('.');
  // Check if the hostname is an IPv4 address
  return labels.length === 4
    && labels.every((label) => /^\d{1,3}$/.test(label) && Number(label) <= 255);
}

function isValidHostname(hostname: string) {
  // Checks if the hostname is 'localhost' or an IP address (IPv4 or IPv6)
  if (hostname === 'localhost' || isIpHostname(hostname)) {
    return true;
  }

  const labels = hostname.split('.');
  return labels.length >= 2 && labels.every((label) => DOMAIN_LABEL_PATTERN.test(label));
}

function isHttpUrl(value: string) {
  // Check if the value is a valid HTTP or HTTPS URL
  if (value.trim() !== value || !/^https?:\/\//i.test(value)) {
    return false;
  }

  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && isValidHostname(url.hostname);
  } catch {
    return false;
  }
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
};

export function checkBuiltInValidation(type: BuiltInValidationType, value: string): string | null {
  const validation = BUILT_IN_VALIDATIONS[type];
  return validation.passes(value) ? null : validation.message;
}
