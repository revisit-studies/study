import isEqual from 'lodash.isequal';
import {
  CheckboxResponse,
  DropdownResponse,
  MatrixResponse,
  NumericalResponse,
  Response,
} from '../../parser/types';
import { CustomResponseValidate, StoredAnswer } from '../../store/types';
import { parseStringOptionValue } from '../../utils/stringOptions';

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
      return createValidationResult(response, Object.keys(value).length === 0 && response.required ? 'unanswered' : 'none');
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
