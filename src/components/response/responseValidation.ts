import isEqual from 'lodash.isequal';
import {
  CheckboxResponse,
  DropdownResponse,
  MatrixResponse,
  NumericalResponse,
  RankingResponse,
  Response,
} from '../../parser/types';
import { CustomResponseValidate, StoredAnswer } from '../../store/types';
import { isMatrixDontKnowValue } from '../../utils/responseOptions';
import { parseStringOptions, parseStringOptionValue } from '../../utils/stringOptions';

export const REQUIRED_ERROR_MESSAGE = 'Please answer this question to continue.';

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

  const {
    min, max, strictMin, strictMax,
  } = response;

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
      return `Please add between ${min} and ${max} ${rankingSpecificString}.`;
    }

    if (min !== undefined) {
      return `Please add at least ${min} ${rankingSpecificString}.`;
    }

    return `Please add at most ${max} ${rankingSpecificString}.`;
  }

  return null;
}

function checkCategoricalRankingResponse(response: RankingResponse, value: object) {
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
    const missingOptionKeys = [...configuredOptionValues].filter((optionValue) => !(optionValue in (value ?? {})));
    if (missingOptionKeys.length > 0) {
      return 'Please categorize all items.';
    }
  }
  return null;
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
        if (isMatrixDontKnowValue(rowValue)) {
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
      const numItems = Object.keys(value).length;
      const { min, max } = response;
      if (numItems === 0) {
        return createValidationResult(response, response.required ? 'unanswered' : 'none');
      }

      if (response.type === 'ranking-sublist') {
        const sublistError = minMaxValidation(min, max, numItems, response.type);
        return sublistError
          ? createValidationResult(response, 'invalid', { message: sublistError })
          : createValidationResult(response, 'none');
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
