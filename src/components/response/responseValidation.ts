import isEqual from 'lodash.isequal';
import {
  CheckboxResponse,
  DateResponse,
  DropdownResponse,
  LongTextResponse,
  MatrixResponse,
  NumericalResponse,
  RankingResponse,
  Response,
  ShortTextResponse,
  TextValidationRule,
  TimeResponse,
} from '../../parser/types';
import { CustomResponseValidate, StoredAnswer } from '../../store/types';
import { isValidTime, parseDateValue } from '../../utils/dateTimeValidation';
import { getDropdownOptions } from '../../utils/dropdownOptions';
import { parseStringOptions, parseStringOptionValue } from '../../utils/stringOptions';
import { checkBuiltInValidation } from './builtInValidation';

export const REQUIRED_ERROR_MESSAGE = 'Please answer this question to continue.';
export const INVALID_DATE_MESSAGE = 'Please select a valid date.';

export function getDateValidationMessage(response: DateResponse, value: string) {
  const options = response.options ?? 'date';
  const dateOption = options === 'date' ? 'date' : options;
  const date = parseDateValue(value, options);
  if (date === null) {
    return `Please select a valid ${dateOption}.`;
  }

  const minDate = response.min ? parseDateValue(response.min, options) : null;
  const maxDate = response.max ? parseDateValue(response.max, options) : null;

  if (minDate && maxDate && (date < minDate || date > maxDate)) {
    return `Please select a ${dateOption} between ${response.min} and ${response.max}.`;
  }
  if (minDate && date < minDate) {
    return `Please select a ${dateOption} on or after ${response.min}.`;
  }
  if (maxDate && date > maxDate) {
    return `Please select a ${dateOption} on or before ${response.max}.`;
  }

  return null;
}

function getTimeValidationMessage(response: TimeResponse, value: string) {
  if (!isValidTime(value, response.withSeconds)) {
    return 'Please select a valid time.';
  }
  if (response.min && response.max && (value < response.min || value > response.max)) {
    return `Please select a time between ${response.min} and ${response.max}.`;
  }
  if (response.min && value < response.min) {
    return `Please select a time at or after ${response.min}.`;
  }
  if (response.max && value > response.max) {
    return `Please select a time at or before ${response.max}.`;
  }

  return null;
}

export type ResponseIssueType = 'unanswered' | 'invalid';
export type ResponseIssueSummary = { unansweredCount: number; invalidCount: number };
export type ResponseValidationIssueType = 'none' | ResponseIssueType;
export type ResponseValidationResult = {
  valid: boolean;
  issueType: ResponseValidationIssueType;
  message?: string;
  reason?: 'requiredValueMismatch';
  blocksProgression: boolean;
};

export type ResponseValidationOptions = {
  customValidate?: CustomResponseValidate;
  loadError?: string;
};

export function isEmptyCustomResponseValue(value: StoredAnswer['answer'][string] | undefined): boolean {
  if (value === null || value === undefined || value === '') {
    return true;
  }

  if (Array.isArray(value)) {
    return value.length === 0 || value.every((entry) => isEmptyCustomResponseValue(entry));
  }

  if (typeof value === 'object') {
    const objectValues = Object.values(value);
    return objectValues.length === 0 || objectValues.every((entry) => isEmptyCustomResponseValue(entry));
  }

  return false;
}

export function checkDropdownResponse(dropdownResponse: DropdownResponse, value: string[]) {
  if (dropdownResponse.options === 'countries') {
    const countryValues = new Set(getDropdownOptions(dropdownResponse).map((option) => option.value));
    if (value.some((entry) => !countryValues.has(entry))) {
      return 'Please select a valid country.';
    }
  }

  const minNotSelected = dropdownResponse.minSelections && value.length < dropdownResponse.minSelections;
  const maxNotSelected = dropdownResponse.maxSelections && value.length > dropdownResponse.maxSelections;

  if (minNotSelected) {
    return `Please select at least ${dropdownResponse.minSelections} options`;
  }
  if (maxNotSelected) {
    return `Please select at most ${dropdownResponse.maxSelections} options`;
  }
  return null;
}

function checkCheckboxResponse(response: CheckboxResponse, value: string[]) {
  const minNotSelected = response.minSelections && value.length < response.minSelections;
  const maxNotSelected = response.maxSelections && value.length > response.maxSelections;

  if (minNotSelected && maxNotSelected) {
    return `Please select between ${response.minSelections} and ${response.maxSelections} options`;
  }
  if (minNotSelected) {
    return `Please select at least ${response.minSelections} options`;
  }
  if (maxNotSelected) {
    return `Please select at most ${response.maxSelections} options`;
  }
  return null;
}

export function checkCheckboxResponseForValidation(
  response: CheckboxResponse,
  value: string[],
  dontKnowChecked = false,
) {
  if (response.withDontKnow && dontKnowChecked) {
    return null;
  }

  return checkCheckboxResponse(response, value);
}

export function checkNumericalResponse(response: NumericalResponse, value: number) {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  const { min, max } = response;

  if (min !== undefined && max !== undefined && (numValue < min || numValue > max)) {
    return `Please enter a value between ${min} and ${max}`;
  }
  if (min !== undefined && numValue < min) {
    return `Please enter a value of ${min} or greater`;
  }
  if (max !== undefined && numValue > max) {
    return `Please enter a value of ${max} or less`;
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
  if (rule.type === 'equals') {
    return value === rule.value;
  }

  if (rule.type === 'doesNotEqual') {
    return value !== rule.value;
  }

  if (rule.type === 'contains') {
    return value.includes(rule.value);
  }

  if (rule.type === 'doesNotContain') {
    return !value.includes(rule.value);
  }

  try {
    return new RegExp(rule.value).test(value);
  } catch {
    return false;
  }
}

// Count words by splitting on whitespace and filtering out any empty strings or strings that don't contain letters or numbers
function countWords(value: string) {
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

  const wordCount = countWords(value);
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

// Instance keys (`instance-<index>-<optionValue>`) never collide with option values; legacy keys still parse.
export function makeRankingInstanceKey(baseItemId: string, instanceIndex: number): string {
  return `instance-${instanceIndex}-${baseItemId}`;
}

function parseTaggedRankingInstanceKey(instanceId: string): { baseItemId: string; instanceIndex: number } | null {
  const match = instanceId.match(/^instance-(\d+)-(.*)$/);
  if (!match) {
    return null;
  }

  return { baseItemId: match[2], instanceIndex: parseInt(match[1], 10) };
}

export function getRankingBaseItemId(instanceId: string, optionValues: Set<string>): string {
  if (optionValues.has(instanceId)) {
    return instanceId;
  }

  const tagged = parseTaggedRankingInstanceKey(instanceId);
  if (tagged) {
    return tagged.baseItemId;
  }

  // Legacy generated keys: `<optionValue>_<counter>`, longest option match first
  const matchingOption = [...optionValues]
    .filter((optionValue) => instanceId.startsWith(`${optionValue}_`))
    .sort((first, second) => second.length - first.length)
    .find((optionValue) => /^\d+$/.test(instanceId.slice(optionValue.length + 1)));

  return matchingOption ?? instanceId;
}

export function getRankingInstanceIndex(instanceId: string, optionValues: Set<string>): number | null {
  if (optionValues.has(instanceId)) {
    return null;
  }

  const tagged = parseTaggedRankingInstanceKey(instanceId);
  if (tagged) {
    return tagged.instanceIndex;
  }

  const baseItemId = getRankingBaseItemId(instanceId, optionValues);
  if (!optionValues.has(baseItemId) || baseItemId === instanceId) {
    return null;
  }

  return Number(instanceId.slice(baseItemId.length + 1));
}

export function checkPairwiseRankingResponse(response: RankingResponse, value: Record<string, string>) {
  const optionValues = new Set(parseStringOptions(response.options).map((option) => option.value));
  const pairs: Record<string, { high: string[]; low: string[] }> = {};
  let hasInvalidLocation = false;

  Object.entries(value).forEach(([itemId, location]) => {
    const match = typeof location === 'string' ? location.match(/^pair-(\d+)-(high|low)$/) : null;
    if (!match) {
      hasInvalidLocation = true;
      return;
    }
    const [, pairId, position] = match;
    if (!pairs[pairId]) pairs[pairId] = { high: [], low: [] };
    pairs[pairId][position as 'high' | 'low'].push(getRankingBaseItemId(itemId, optionValues));
  });

  if (hasInvalidLocation) {
    return 'Please complete or remove invalid pairs to continue.';
  }

  // A pair is complete when both sides hold exactly one distinct configured option
  const isCompletePair = (pair: { high: string[]; low: string[] }) => pair.high.length === 1
    && pair.low.length === 1
    && optionValues.has(pair.high[0])
    && optionValues.has(pair.low[0])
    && pair.high[0] !== pair.low[0];

  const pairList = Object.values(pairs);
  if (!pairList.some(isCompletePair)) {
    return 'Please complete at least one pair to continue.';
  }
  if (!pairList.every(isCompletePair)) {
    return 'Please complete or remove unfinished pairs to continue.';
  }

  const pairSignatures = pairList.map((pair) => JSON.stringify([
    pair.high[0],
    pair.low[0],
  ].sort()));
  if (new Set(pairSignatures).size !== pairSignatures.length) {
    return 'This would create a duplicate pair.';
  }

  return null;
}

export function checkMatrixResponse(response: MatrixResponse, value: Record<string, string>) {
  const expectedQuestionKeys = response.questionOptions.map((entry) => parseStringOptionValue(entry));
  const unanswered = expectedQuestionKeys.some((questionKey) => {
    const rowValue = value[questionKey];
    return rowValue === undefined || rowValue === '';
  });

  if (unanswered) {
    return 'Please answer all questions in the matrix to continue.';
  }

  return null;
}

function hasOtherText(value: StoredAnswer['answer'][string] | undefined) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isOtherSelectionIncomplete(
  response: Response,
  value: StoredAnswer['answer'][string] | undefined,
  values: StoredAnswer['answer'],
) {
  if (!('withOther' in response) || !response.withOther) {
    return false;
  }

  const otherInputValue = values[`${response.id}-other`];
  if (response.type === 'radio') {
    return value === 'other' && !hasOtherText(otherInputValue);
  }

  if (response.type === 'checkbox') {
    return Array.isArray(value) && value.includes('__other') && !hasOtherText(otherInputValue);
  }

  return false;
}

export const usesStandaloneDontKnowField = (response: Response) => !!response.withDontKnow
  && response.type !== 'matrix-radio'
  && response.type !== 'matrix-checkbox';

export const shouldBypassValidationForStandaloneDontKnow = (response: Response, dontKnowChecked: boolean) => (
  usesStandaloneDontKnowField(response) && dontKnowChecked
);

function createValidationResult(
  response: Response,
  issueType: ResponseValidationIssueType,
  options: Pick<ResponseValidationResult, 'message' | 'reason'> = {},
): ResponseValidationResult {
  return {
    valid: issueType === 'none',
    issueType,
    ...options,
    blocksProgression: issueType !== 'none' && response.required !== false,
  };
}

export function validateResponse(
  response: Response,
  value: StoredAnswer['answer'][string] | undefined,
  values: StoredAnswer['answer'],
  options: ResponseValidationOptions = {},
): ResponseValidationResult {
  const dontKnowChecked = !!values[`${response.id}-dontKnow`];

  if (response.type === 'textOnly' || response.type === 'divider' || response.type === 'reactive') {
    return createValidationResult(response, 'none');
  }

  if (response.type === 'custom') {
    const { customValidate, loadError } = options;

    if (loadError) {
      return createValidationResult(response, 'invalid', { message: loadError });
    }

    if (shouldBypassValidationForStandaloneDontKnow(response, dontKnowChecked)) {
      return createValidationResult(response, 'none');
    }

    if (response.required === false && isEmptyCustomResponseValue(value)) {
      return createValidationResult(response, 'none');
    }

    if (isEmptyCustomResponseValue(value)) {
      return createValidationResult(response, response.required === false ? 'none' : 'unanswered');
    }

    const customValue = value as StoredAnswer['answer'][string];

    if (response.requiredValue !== undefined && !isEqual(customValue, response.requiredValue)) {
      return createValidationResult(response, 'invalid', { message: 'Incorrect input' });
    }

    if (!customValidate) {
      return createValidationResult(response, 'none');
    }

    const customValidationMessage = customValidate(customValue, values, response);
    return customValidationMessage
      ? createValidationResult(response, 'invalid', { message: customValidationMessage })
      : createValidationResult(response, 'none');
  }

  if (shouldBypassValidationForStandaloneDontKnow(response, dontKnowChecked)) {
    return createValidationResult(response, 'none');
  }

  if (isOtherSelectionIncomplete(response, value, values)) {
    return createValidationResult(response, 'invalid', { message: 'Please fill in Other to continue.' });
  }

  if (response.type === 'date') {
    if (value === null || value === undefined || value === '') {
      return createValidationResult(response, response.required === false ? 'none' : 'unanswered');
    }
    const dateError = typeof value === 'string'
      ? getDateValidationMessage(response, value)
      : INVALID_DATE_MESSAGE;
    if (dateError) {
      return createValidationResult(response, 'invalid', { message: dateError });
    }
    if (response.requiredValue != null && value !== response.requiredValue.toString()) {
      return createValidationResult(response, 'invalid', { reason: 'requiredValueMismatch' });
    }
    return createValidationResult(response, 'none');
  }
  if (response.type === 'time') {
    if (value === null || value === undefined || value === '') {
      return createValidationResult(response, response.required === false ? 'none' : 'unanswered');
    }
    const timeError = typeof value === 'string'
      ? getTimeValidationMessage(response, value)
      : 'Please select a valid time.';
    if (timeError) {
      return createValidationResult(response, 'invalid', { message: timeError });
    }
    if (response.requiredValue != null && value !== response.requiredValue.toString()) {
      return createValidationResult(response, 'invalid', { reason: 'requiredValueMismatch' });
    }
    return createValidationResult(response, 'none');
  }
  if (response.type === 'shortText' || response.type === 'longText') {
    if (value === null || value === undefined || value === '') {
      return createValidationResult(response, response.required ? 'unanswered' : 'none');
    }

    if (typeof value !== 'string') {
      return createValidationResult(response, 'invalid', { message: 'Please enter a valid text response.' });
    }

    if (response.requiredValue != null && value !== response.requiredValue.toString()) {
      return createValidationResult(response, 'invalid', { reason: 'requiredValueMismatch' });
    }

    const textError = checkTextResponse(response, value);
    return textError
      ? createValidationResult(response, 'invalid', { message: textError })
      : createValidationResult(response, 'none');
  }

  if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
    if (response.type === 'matrix-radio' || response.type === 'matrix-checkbox') {
      const matrixValue = value as Record<string, string>;
      const hasAnsweredAtLeastOne = Object.values(matrixValue).some((entry) => entry !== '');

      if (!hasAnsweredAtLeastOne) {
        return createValidationResult(response, response.required ? 'unanswered' : 'none');
      }

      const matrixError = checkMatrixResponse(response, matrixValue);
      return matrixError
        ? createValidationResult(response, 'invalid', { message: matrixError })
        : createValidationResult(response, 'none');
    }

    if (response.type === 'ranking-sublist' || response.type === 'ranking-categorical' || response.type === 'ranking-pairwise') {
      if (Object.keys(value).length === 0) {
        return createValidationResult(response, response.required ? 'unanswered' : 'none');
      }

      if (response.type === 'ranking-pairwise') {
        const pairwiseError = checkPairwiseRankingResponse(response, value as Record<string, string>);
        return pairwiseError
          ? createValidationResult(response, 'invalid', { message: pairwiseError })
          : createValidationResult(response, 'none');
      }

      return createValidationResult(response, 'none');
    }
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return createValidationResult(response, response.required ? 'unanswered' : 'none');
    }

    if (response.type === 'dropdown') {
      const dropdownError = checkDropdownResponse(response, value as string[]);
      if (dropdownError) {
        return createValidationResult(response, 'invalid', { message: dropdownError });
      }
    }

    if (response.requiredValue != null && !Array.isArray(response.requiredValue)) {
      return createValidationResult(response, 'invalid', { message: 'Incorrect required value. Contact study administrator.' });
    }

    if (Array.isArray(response.requiredValue)) {
      const sortedRequired = [...response.requiredValue].sort();
      const sortedValue = [...value].sort();
      const matches = sortedRequired.length === sortedValue.length
        && sortedRequired.every((entry, idx) => entry === sortedValue[idx]);

      if (!matches) {
        return createValidationResult(response, 'invalid', { reason: 'requiredValueMismatch' });
      }
    }

    if (response.type === 'checkbox') {
      const checkboxError = checkCheckboxResponseForValidation(response, value as string[], dontKnowChecked);
      return checkboxError
        ? createValidationResult(response, 'invalid', { message: checkboxError })
        : createValidationResult(response, 'none');
    }

    if (response.type === 'dropdown') {
      const dropdownError = checkDropdownResponse(response, value as string[]);
      return dropdownError
        ? createValidationResult(response, 'invalid', { message: dropdownError })
        : createValidationResult(response, 'none');
    }

    return createValidationResult(response, 'none');
  }

  if (value === null || value === undefined || value === '') {
    return createValidationResult(response, response.required ? 'unanswered' : 'none');
  }

  if (response.type === 'dropdown') {
    const dropdownError = checkDropdownResponse(response, [value.toString()]);
    if (dropdownError) {
      return createValidationResult(response, 'invalid', { message: dropdownError });
    }
  }

  if (response.requiredValue != null && value.toString() !== response.requiredValue.toString()) {
    return createValidationResult(response, 'invalid', { reason: 'requiredValueMismatch' });
  }

  if (response.type === 'numerical') {
    const numericalError = checkNumericalResponse(response, value as unknown as number);
    return numericalError
      ? createValidationResult(response, 'invalid', { message: numericalError })
      : createValidationResult(response, 'none');
  }

  return createValidationResult(response, 'none');
}
