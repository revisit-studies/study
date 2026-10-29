import isEqual from 'lodash.isequal';
import { checkNumericalResponse, checkTextResponse } from '../../utils/primitiveValidation';
import {
  getResponseFunctionModule, getResponseValidationResultError, isResponseAnswered,
  normalizeResponseValue,
} from '../../utils/correctAnswer';
import {
  CheckboxResponse,
  DateResponse,
  DropdownResponse,
  MatrixResponse,
  RankingCategoricalResponse,
  RankingPairwiseResponse,
  Response,
  TimeResponse,
} from '../../parser/types';
import { CustomResponseValidate, StoredAnswer } from '../../store/types';
import { isValidTime, parseDateValue } from '../../utils/dateTimeValidation';
import { getDropdownOptions } from '../../utils/dropdownOptions';
import { isMatrixDontKnowValue } from '../../utils/responseOptions';
import { parseStringOptions, parseStringOptionValue } from '../../utils/stringOptions';

export { checkNumericalResponse, checkTextResponse } from '../../utils/primitiveValidation';

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
  return !isResponseAnswered(value);
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

function minMaxValidation(min : number | undefined, max: number | undefined, num: number | undefined, rankingType : string) {
  let items = num;
  if (items === undefined) {
    return null;
  }
  let rankingSpecificString = '';
  // 'ranking-sublist' | 'ranking-categorical' | 'ranking-pairwise'
  switch (rankingType) {
    case 'ranking-sublist':
      rankingSpecificString = 'items';
      break;
    case 'ranking-categorical':
      rankingSpecificString = 'items per category';
      break;
    case 'ranking-pairwise':
      rankingSpecificString = 'pairs';
      items /= 2;
      break;
    default:
      rankingSpecificString = 'items';
      break;
  }

  if ((min !== undefined && items < min) || (max !== undefined && items > max)) {
    if (min !== undefined && max !== undefined) {
      if (min === max) {
        return `Please add exactly ${min} ${rankingSpecificString}.`;
      }
      return `Please add between ${min} and ${max} ${rankingSpecificString}.`;
    }

    if (min !== undefined) {
      return `Please add at least ${min} ${rankingSpecificString}.`;
    }

    return `Please add at most ${max} ${rankingSpecificString}.`;
  }

  return null;
}

function checkCategoricalRankingResponse(response: RankingCategoricalResponse, value: object) {
  const {
    min, max, categorizeAll, numItems,
  } = response;
  const validCategories = new Set(['HIGH', 'MEDIUM', 'LOW']);
  const configuredOptionValues = new Set(parseStringOptions(response.options).map((option) => option.value));
  const entries = Object.entries(value ?? {});

  if (configuredOptionValues.size > 0) {
    const unknownOptionKeys = entries
      .filter(([optionKey]) => !configuredOptionValues.has(optionKey))
      .map(([optionKey]) => optionKey);
    if (unknownOptionKeys.length > 0) {
      return 'Please categorize only configured items.';
    }

    const invalidCategoryEntries = entries
      .filter(([, category]) => typeof category !== 'string' || !validCategories.has(category))
      .map(([optionKey]) => optionKey);
    if (invalidCategoryEntries.length > 0) {
      return 'Please use only HIGH, MEDIUM, or LOW categories.';
    }
  }

  let minMaxError = null;
  for (const category of ['HIGH', 'MEDIUM', 'LOW'] as const) {
    const count = entries.filter(([, cat]) => cat === category).length;
    minMaxError = minMaxValidation(min, max, count, response.type);
    if (minMaxError) {
      return minMaxError;
    }
  }

  const categorizedItems = entries.length;
  if (numItems !== undefined && categorizedItems !== numItems) {
    return `Please categorize exactly ${numItems} items.`;
  }

  if (categorizeAll && configuredOptionValues.size > 0) {
    const valueObj = (value ?? {}) as Record<string, unknown>;
    const missingOptionKeys = [...configuredOptionValues].filter((optionValue) => !Object.hasOwn(valueObj, optionValue));
    if (missingOptionKeys.length > 0) {
      return 'Please categorize all items.';
    }
  }
  return null;
}

export function checkPairwiseRankingResponse(response: RankingPairwiseResponse, value: Record<string, string>) {
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

  const num = Object.keys(value).length; // each pair has two items
  const { min, max } = response;
  return minMaxValidation(min, max, num, response.type);
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
  if (response.type === 'matrix-checkbox') {
    const { min, max } = response;
    if (min !== undefined || max !== undefined) {
      const requiredAmountOfQuestionsAnswered = expectedQuestionKeys.every((questionKey) => {
        const rowValue = value[questionKey];
        if (response.withDontKnow && isMatrixDontKnowValue(rowValue)) {
          return true;
        }
        const rowSelectionCount = rowValue.split('|').length;
        return (min === undefined || rowSelectionCount >= min) && (max === undefined || rowSelectionCount <= max);
      });

      if (!requiredAmountOfQuestionsAnswered) {
        if (min && max) {
          return `Please select at least ${min} and at most ${max} answers per row.`;
        }

        if (min) {
          return `Please select at least ${min} answers per row.`;
        }

        return `Please select at most ${max} answers per row.`;
      }
    }
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

function validateResponseBase(
  response: Response,
  value: StoredAnswer['answer'][string] | undefined,
  values: StoredAnswer['answer'],
  options: ResponseValidationOptions = {},
): ResponseValidationResult {
  const dontKnowChecked = !!values[`${response.id}-dontKnow`];

  if (response.type === 'textOnly' || response.type === 'divider') {
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

    let customValidationMessage: unknown;
    try {
      customValidationMessage = customValidate(customValue, values, response);
    } catch (error) {
      console.error(`Validation function at ${response.path} failed`, error);
      return createValidationResult(response, 'invalid', { message: `Validation function at ${response.path} failed` });
    }
    const resultError = getResponseValidationResultError(customValidationMessage, response.path);
    if (resultError) return createValidationResult(response, 'invalid', { message: resultError });
    if (customValidationMessage === false) return createValidationResult(response, 'invalid', { message: 'The response is invalid.' });
    return typeof customValidationMessage === 'string' && customValidationMessage
      ? createValidationResult(response, 'invalid', { message: customValidationMessage })
      : createValidationResult(response, 'none');
  }

  if (shouldBypassValidationForStandaloneDontKnow(response, dontKnowChecked)) {
    return createValidationResult(response, 'none');
  }

  if (response.type === 'reactive') {
    if (response.requiredValue != null && !isEqual(value, response.requiredValue)) {
      return createValidationResult(response, 'invalid', { reason: 'requiredValueMismatch' });
    }

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
      const { min, max } = response;

      if (response.type === 'ranking-sublist') {
        const optionValues = new Set(parseStringOptions(response.options).map((option) => option.value));
        const unknownOptionKeys = Object.keys(value).filter((optionKey) => !optionValues.has(optionKey));
        const configuredEntries = Object.entries(value).filter(([optionKey]) => optionValues.has(optionKey));

        if (unknownOptionKeys.length > 0) {
          return createValidationResult(response, 'invalid', { message: 'Please rank only configured items.' });
        }

        if (configuredEntries.length === 0) {
          return createValidationResult(response, response.required ? 'unanswered' : 'none');
        }

        const effectiveMax = max ?? response.numItems;
        const sublistError = minMaxValidation(min, effectiveMax, configuredEntries.length, response.type);
        return sublistError
          ? createValidationResult(response, 'invalid', { message: sublistError })
          : createValidationResult(response, 'none');
      }

      const numItems = Object.keys(value).length;
      if (numItems === 0) {
        return createValidationResult(response, response.required ? 'unanswered' : 'none');
      }

      if (response.type === 'ranking-categorical') {
        const categoricalError = checkCategoricalRankingResponse(response, value);
        return categoricalError
          ? createValidationResult(response, 'invalid', { message: categoricalError })
          : createValidationResult(response, 'none');
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

export function validateResponse(
  response: Response,
  value: StoredAnswer['answer'][string] | undefined,
  values: StoredAnswer['answer'],
  options: ResponseValidationOptions = {},
): ResponseValidationResult {
  const result = validateResponseBase(response, value, values, options);
  if (!result.valid || !response.path || response.type === 'custom' || response.type === 'textOnly' || response.type === 'divider'
    || isEmptyCustomResponseValue(value)
    || shouldBypassValidationForStandaloneDontKnow(response, !!values[`${response.id}-dontKnow`])) return result;

  const module = getResponseFunctionModule(response.path);
  if (!module) {
    return createValidationResult(response, 'invalid', { message: `Unable to load response module at ${response.path}` });
  }
  if (!module.validate) return result;
  let message: unknown;
  try {
    message = module.validate(normalizeResponseValue(response, value), values, response);
  } catch (error) {
    console.error(`Validation function at ${response.path} failed`, error);
    return createValidationResult(response, 'invalid', { message: `Validation function at ${response.path} failed` });
  }
  const resultError = getResponseValidationResultError(message, response.path);
  if (resultError) return createValidationResult(response, 'invalid', { message: resultError });
  if (message === false) return createValidationResult(response, 'invalid', { message: 'The response is invalid.' });
  return typeof message === 'string' && message ? createValidationResult(response, 'invalid', { message }) : result;
}
