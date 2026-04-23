import isEqual from 'lodash.isequal';
import {
  CheckboxResponse, CustomResponse, DropdownResponse, MatrixResponse, NumberOption, NumericalResponse, Response, StringOption,
} from '../../parser/types';
import { CustomResponseValidate, StoredAnswer } from '../../store/types';
import { parseStringOptionValue } from '../../utils/stringOptions';

export const REQUIRED_ERROR_MESSAGE = 'Please answer this question to continue.';
export type ResponseIssueType = 'unanswered' | 'invalid';
export type ResponseIssueSummary = { unansweredCount: number; invalidCount: number };

export function isEmptyCustomResponseValue(value: StoredAnswer['answer'][string]): boolean {
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

function checkDropdownResponse(dropdownResponse: DropdownResponse, value: string[]) {
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

function checkNumericalResponse(response: NumericalResponse, value: number) {
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

function checkMatrixResponseForMessage(response: MatrixResponse, value: Record<string, string>) {
  const hasAnsweredAtLeastOne = Object.values(value).some((val) => val !== '');
  if (!hasAnsweredAtLeastOne) {
    return null;
  }

  return checkMatrixResponse(response, value);
}

function hasOtherText(value: StoredAnswer['answer'][string] | undefined) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isOtherSelectionIncomplete(
  response: Response,
  value: StoredAnswer['answer'][string],
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

// Matrix questions with "Don't know" option require a separate field to properly handle the "Don't know" state
export const usesStandaloneDontKnowField = (response: Response) => !!response.withDontKnow
  && response.type !== 'matrix-radio'
  && response.type !== 'matrix-checkbox';

export const shouldBypassValidationForStandaloneDontKnow = (response: Response, dontKnowChecked: boolean) => (
  usesStandaloneDontKnowField(response) && dontKnowChecked
);

export function generateCustomResponseErrorMessage(
  response: CustomResponse,
  value: StoredAnswer['answer'][string],
  values: StoredAnswer['answer'],
  customValidate?: CustomResponseValidate,
  loadError?: string,
  options?: { showRequiredErrors?: boolean },
) {
  if (loadError) {
    return loadError;
  }

  if (shouldBypassValidationForStandaloneDontKnow(response, !!values[`${response.id}-dontKnow`])) {
    return null;
  }

  if (response.required === false && isEmptyCustomResponseValue(value)) {
    return null;
  }

  if (isEmptyCustomResponseValue(value)) {
    if (options?.showRequiredErrors) {
      return REQUIRED_ERROR_MESSAGE;
    }
    return null;
  }

  if (response.requiredValue !== undefined && !isEqual(value, response.requiredValue)) {
    return 'Incorrect input';
  }

  if (!customValidate) {
    return null;
  }

  return customValidate(value, values, response);
}

export function generateErrorMessage(
  response: Response,
  answer: {
    value?: number | string | string[] | Record<string, string>;
    checked?: string[];
  },
  options?: (StringOption | NumberOption)[],
  errorOptions?: {
    showRequiredErrors?: boolean;
    values?: StoredAnswer['answer'];
  },
) {
  const { requiredValue, requiredLabel } = response;
  const showRequiredErrors = !!errorOptions?.showRequiredErrors;
  const values = errorOptions?.values || {};
  const dontKnowChecked = !!values[`${response.id}-dontKnow`];
  const otherValue = values[`${response.id}-other`];

  if (shouldBypassValidationForStandaloneDontKnow(response, dontKnowChecked)) {
    return null;
  }

  let error: string | null = '';
  const checkboxValues = Array.isArray(answer.checked)
    ? answer.checked
    : (Array.isArray(answer.value) ? answer.value : undefined);
  const isEmptyMatrixResponse = typeof answer.value === 'object'
    && !Array.isArray(answer.value)
    && answer.value !== null
    && Object.values(answer.value).every((val) => val === '');

  if (showRequiredErrors && response.required) {
    if (checkboxValues && checkboxValues.length === 0) {
      return REQUIRED_ERROR_MESSAGE;
    }

    if ((response.type === 'matrix-radio' || response.type === 'matrix-checkbox') && isEmptyMatrixResponse) {
      return REQUIRED_ERROR_MESSAGE;
    }

    if ((answer.value === null || answer.value === undefined || answer.value === '')
      && !dontKnowChecked) {
      return REQUIRED_ERROR_MESSAGE;
    }
  }

  if ('withOther' in response && response.withOther) {
    if (response.type === 'radio' && answer.value === 'other' && !hasOtherText(otherValue)) {
      return 'Please fill in Other to continue.';
    }

    if (response.type === 'checkbox' && checkboxValues?.includes('__other') && !hasOtherText(otherValue)) {
      return 'Please fill in Other to continue.';
    }
  }

  if (checkboxValues && Array.isArray(requiredValue)) {
    error = requiredValue && [...requiredValue].sort().toString() !== [...checkboxValues].sort().toString() ? `Please ${options ? 'select' : 'enter'} ${requiredLabel || requiredValue.toString()} to continue.` : null;
  } else if (checkboxValues && response.required && response.type === 'checkbox') {
    error = checkCheckboxResponseForValidation(response, checkboxValues, dontKnowChecked);
  } else if (answer.value && response.type === 'dropdown') {
    error = checkDropdownResponse(response, answer.value as string[]);
  } else if (answer.value && typeof answer.value === 'number' && response.type === 'numerical' && checkNumericalResponse(response, answer.value)) {
    error = checkNumericalResponse(response, answer.value);
  } else if (answer.value && typeof answer.value === 'object' && !Array.isArray(answer.value) && (response.type === 'matrix-radio' || response.type === 'matrix-checkbox')) {
    return checkMatrixResponseForMessage(response, answer.value);
  } else {
    error = answer.value && requiredValue && requiredValue.toString() !== answer.value.toString() ? `Please ${options ? 'select' : 'enter'} ${requiredLabel || (options ? options.find((opt) => opt.value === requiredValue)?.label : requiredValue.toString())} to continue.` : null;
  }

  return error;
}

// Checks whether a response has an issue that should block progression, and if so, what type of issue it is (unanswered vs. invalid)
export function getResponseIssueType(
  response: Response,
  values: StoredAnswer['answer'],
  customValidate?: CustomResponseValidate,
  loadError?: string,
): ResponseIssueType | null {
  const value = values[response.id];
  const dontKnowChecked = !!values[`${response.id}-dontKnow`];

  // No need to validate
  if (response.type === 'textOnly' || response.type === 'divider' || response.type === 'reactive') {
    return null;
  }

  if (response.type === 'custom') {
    if (loadError) {
      return 'invalid';
    }

    if (shouldBypassValidationForStandaloneDontKnow(response, dontKnowChecked)) {
      return null;
    }

    if (response.required === false && isEmptyCustomResponseValue(value)) {
      return null;
    }

    if (isEmptyCustomResponseValue(value)) {
      return response.required === false ? null : 'unanswered';
    }

    if (response.requiredValue !== undefined && !isEqual(value, response.requiredValue)) {
      return 'invalid';
    }

    if (!customValidate) {
      return null;
    }

    return customValidate(value, values, response) ? 'invalid' : null;
  }

  if (shouldBypassValidationForStandaloneDontKnow(response, dontKnowChecked)) {
    return null;
  }

  // If the "Other" option is selected but the accompanying text input is not filled out, consider the response invalid
  if (isOtherSelectionIncomplete(response, value, values)) {
    return 'invalid';
  }

  if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
    if (response.type === 'matrix-radio' || response.type === 'matrix-checkbox') {
      const matrixValue = value as Record<string, string>;
      const hasAnsweredAtLeastOne = Object.values(matrixValue).some((entry) => entry !== '');

      if (!hasAnsweredAtLeastOne) {
        return response.required ? 'unanswered' : null;
      }

      // If at least one question in the matrix has been answered, but not all questions have been answered, consider it invalid
      return checkMatrixResponse(response, matrixValue) ? 'invalid' : null;
    }

    if (response.type === 'ranking-sublist' || response.type === 'ranking-categorical' || response.type === 'ranking-pairwise') {
      return Object.keys(value).length === 0 && response.required ? 'unanswered' : null;
    }
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return response.required ? 'unanswered' : null;
    }

    if (Array.isArray(response.requiredValue)) {
      const sortedRequired = [...response.requiredValue].sort();
      const sortedValue = [...value].sort();
      const matches = sortedRequired.length === sortedValue.length
        && sortedRequired.every((entry, idx) => entry === sortedValue[idx]);

      // If there is a requiredValue and the array value doesn't match it, consider it invalid
      if (!matches) {
        return 'invalid';
      }
    }

    // For checkboxes, if there is a value but it doesn't meet min/max selection criteria, consider it invalid
    if (response.type === 'checkbox') {
      return checkCheckboxResponseForValidation(response, value as string[], dontKnowChecked) ? 'invalid' : null;
    }

    // For dropdowns, if there is a value but it doesn't meet min/max selection criteria, consider it invalid
    if (response.type === 'dropdown') {
      return checkDropdownResponse(response, value as string[]) ? 'invalid' : null;
    }

    return null;
  }

  if (value === null || value === undefined || value === '') {
    return response.required ? 'unanswered' : null;
  }

  // If there is a value but it doesn't match the requiredValue, consider it invalid
  if (response.requiredValue != null && value.toString() !== response.requiredValue.toString()) {
    return 'invalid';
  }

  // For numerical responses, if there is a value but it doesn't meet min/max criteria, consider it invalid
  if (response.type === 'numerical') {
    return checkNumericalResponse(response, value as unknown as number) ? 'invalid' : null;
  }

  return null;
}

export function summarizeResponseIssues(
  responses: Response[],
  values: StoredAnswer['answer'],
  customResponseValidators: Record<string, CustomResponseValidate | undefined> = {},
  customResponseLoadErrors: Record<string, string | undefined> = {},
): ResponseIssueSummary {
  return responses.reduce<ResponseIssueSummary>((summary, response) => {
    const issueType = getResponseIssueType(
      response,
      values,
      customResponseValidators[response.id],
      customResponseLoadErrors[response.id],
    );

    if (issueType === 'unanswered') {
      return { ...summary, unansweredCount: summary.unansweredCount + 1 };
    }

    if (issueType === 'invalid') {
      return { ...summary, invalidCount: summary.invalidCount + 1 };
    }

    return summary;
  }, { unansweredCount: 0, invalidCount: 0 });
}
