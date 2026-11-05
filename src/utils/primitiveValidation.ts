import type {
  NumericalResponse, ShortTextResponse, LongTextResponse, TextValidationRule,
} from '../parser/types';
import { compareResponseValues } from './compareResponseValues';
import { checkBuiltInValidation } from './builtInValidation';

export function checkNumericalResponse(response: NumericalResponse, value: number) {
  if ([response.min, response.max, response.strictMin, response.strictMax].some((bound) => typeof bound === 'string')) {
    return 'The numeric constraint could not be resolved from the global store.';
  }
  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  const min = typeof response.min === 'number' ? response.min : undefined;
  const max = typeof response.max === 'number' ? response.max : undefined;
  const strictMin = typeof response.strictMin === 'number' ? response.strictMin : undefined;
  const strictMax = typeof response.strictMax === 'number' ? response.strictMax : undefined;

  const failsStrictMin = strictMin !== undefined && numValue <= strictMin;
  const failsStrictMax = strictMax !== undefined && numValue >= strictMax;
  const failsMin = min !== undefined && numValue < min;
  const failsMax = max !== undefined && numValue > max;

  if (strictMin !== undefined && strictMax !== undefined && (failsStrictMin || failsStrictMax)) {
    return `Please enter a value greater than ${strictMin} and less than ${strictMax}.`;
  }

  if (failsStrictMin) {
    return `Please enter a value greater than ${strictMin}.`;
  }

  if (failsStrictMax) {
    return `Please enter a value less than ${strictMax}.`;
  }

  if (min !== undefined && max !== undefined && (failsMin || failsMax)) {
    return `Please enter a value between ${min} and ${max}.`;
  }

  if (failsMin) {
    return `Please enter a value of ${min} or greater.`;
  }

  if (failsMax) {
    return `Please enter a value of ${max} or less.`;
  }

  return null;
}

const DEFAULT_TEXT_VALIDATION_MESSAGES: Record<TextValidationRule['type'], string> = {
  matchesRegex: 'Please enter a value that matches the required format.',
  contains: 'Please enter a value containing the required text.',
  doesNotContain: 'Please enter a value that does not contain the restricted text.',
  equals: 'Please enter a value equal to the required text.',
  doesNotEqual: 'Please enter a value that does not equal the restricted text.',
};

function textValidationRulePasses(rule: TextValidationRule, value: string) {
  return compareResponseValues(value, rule.value, rule.type);
}

// Count words by splitting on whitespace and filtering out any empty strings or strings that don't contain letters or numbers
export function countTextResponseWords(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word))
    .length;
}

export function checkTextResponse(response: ShortTextResponse | LongTextResponse, value: string) {
  const {
    minCharLength, maxCharLength, minWordLength, maxWordLength,
  } = response;

  if (minCharLength !== undefined && maxCharLength !== undefined
    && (value.length < minCharLength || value.length > maxCharLength)) {
    return `Please enter between ${minCharLength} and ${maxCharLength} characters.`;
  }
  if (minCharLength !== undefined && value.length < minCharLength) {
    return `Please enter at least ${minCharLength} characters.`;
  }
  if (maxCharLength !== undefined && value.length > maxCharLength) {
    return `Please enter at most ${maxCharLength} characters.`;
  }

  const wordCount = countTextResponseWords(value);
  if (minWordLength !== undefined && maxWordLength !== undefined
    && (wordCount < minWordLength || wordCount > maxWordLength)) {
    return `Please enter between ${minWordLength} and ${maxWordLength} words.`;
  }
  if (minWordLength !== undefined && wordCount < minWordLength) {
    return `Please enter at least ${minWordLength} words.`;
  }
  if (maxWordLength !== undefined && wordCount > maxWordLength) {
    return `Please enter at most ${maxWordLength} words.`;
  }

  if (response.type === 'shortText' && response.builtInValidation) {
    const builtInValidationError = checkBuiltInValidation(response.builtInValidation, value);
    if (builtInValidationError) {
      return builtInValidationError;
    }
  }
  const failedRule = response.textValidation?.find((rule) => !textValidationRulePasses(rule, value));
  return failedRule
    ? DEFAULT_TEXT_VALIDATION_MESSAGES[failedRule.type]
    : null;
}
