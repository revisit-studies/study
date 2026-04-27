import isEqual from 'lodash.isequal';
import {
  CheckboxResponse, CustomResponse, DropdownResponse, MatrixResponse, NumberOption, NumericalResponse, Response, StringOption,
} from '../../parser/types';
import { CustomResponseValidate, StoredAnswer } from '../../store/types';
import { parseStringOptionValue } from '../../utils/stringOptions';

export const REQUIRED_ERROR_MESSAGE = 'Please answer this question to continue.';
export type ResponseIssueType = 'unanswered' | 'invalid';
export type ResponseIssueSummary = { unansweredCount: number; invalidCount: number };
export type ResponseValidationIssue = {
  type: 'none' | 'unanswered' | 'invalid';
  message?: string;
  reason?: 'requiredValueMismatch';
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

function getRequiredValueMismatchMessage(
  response: Response,
  options?: (StringOption | NumberOption)[],
) {
  const { requiredValue, requiredLabel } = response;

  if (requiredValue == null) {
    return null;
  }

  if (Array.isArray(requiredValue)) {
    return `Please ${options ? 'select' : 'enter'} ${requiredLabel || requiredValue.join(', ')} to continue.`;
  }

  return `Please ${options ? 'select' : 'enter'} ${requiredLabel || (options ? options.find((opt) => opt.value === requiredValue)?.label : requiredValue.toString())} to continue.`;
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

export function evaluateResponseIssue(
  response: Response,
  value: StoredAnswer['answer'][string] | undefined,
  values: StoredAnswer['answer'],
  customValidate?: CustomResponseValidate,
  loadError?: string,
): ResponseValidationIssue {
  const dontKnowChecked = !!values[`${response.id}-dontKnow`];

  if (response.type === 'textOnly' || response.type === 'divider' || response.type === 'reactive') {
    return { type: 'none' };
  }

  if (response.type === 'custom') {
    if (loadError) {
      return { type: 'invalid', message: loadError };
    }

    if (shouldBypassValidationForStandaloneDontKnow(response, dontKnowChecked)) {
      return { type: 'none' };
    }

    if (response.required === false && isEmptyCustomResponseValue(value)) {
      return { type: 'none' };
    }

    if (isEmptyCustomResponseValue(value)) {
      return response.required === false ? { type: 'none' } : { type: 'unanswered' };
    }

    const customValue = value as StoredAnswer['answer'][string];

    if (response.requiredValue !== undefined && !isEqual(customValue, response.requiredValue)) {
      return { type: 'invalid', message: 'Incorrect input' };
    }

    if (!customValidate) {
      return { type: 'none' };
    }

    const customValidationMessage = customValidate(customValue, values, response);
    return customValidationMessage
      ? { type: 'invalid', message: customValidationMessage }
      : { type: 'none' };
  }

  if (shouldBypassValidationForStandaloneDontKnow(response, dontKnowChecked)) {
    return { type: 'none' };
  }

  // Selecting "Other" without filling its companion input is invalid
  if (isOtherSelectionIncomplete(response, value, values)) {
    return { type: 'invalid', message: 'Please fill in Other to continue.' };
  }

  if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
    if (response.type === 'matrix-radio' || response.type === 'matrix-checkbox') {
      const matrixValue = value as Record<string, string>;
      const hasAnsweredAtLeastOne = Object.values(matrixValue).some((entry) => entry !== '');

      if (!hasAnsweredAtLeastOne) {
        return response.required ? { type: 'unanswered' } : { type: 'none' };
      }

      // A partially answered matrix is invalid
      const matrixError = checkMatrixResponse(response, matrixValue);
      return matrixError ? { type: 'invalid', message: matrixError } : { type: 'none' };
    }

    if (response.type === 'ranking-sublist' || response.type === 'ranking-categorical' || response.type === 'ranking-pairwise') {
      return Object.keys(value).length === 0 && response.required ? { type: 'unanswered' } : { type: 'none' };
    }
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return response.required ? { type: 'unanswered' } : { type: 'none' };
    }

    if (Array.isArray(response.requiredValue)) {
      const sortedRequired = [...response.requiredValue].sort();
      const sortedValue = [...value].sort();
      const matches = sortedRequired.length === sortedValue.length
        && sortedRequired.every((entry, idx) => entry === sortedValue[idx]);

      // Array inputs are invalid when they do not exactly match the configured requiredValue
      if (!matches) {
        return { type: 'invalid', reason: 'requiredValueMismatch' };
      }
    }

    // Checkbox answers can be present but still invalid if they miss selection-count rule
    if (response.type === 'checkbox') {
      const checkboxError = checkCheckboxResponseForValidation(response, value as string[], dontKnowChecked);
      return checkboxError ? { type: 'invalid', message: checkboxError } : { type: 'none' };
    }

    // Dropdown answers can be present but still invalid if they miss selection-count rules
    if (response.type === 'dropdown') {
      const dropdownError = checkDropdownResponse(response, value as string[]);
      return dropdownError ? { type: 'invalid', message: dropdownError } : { type: 'none' };
    }

    return { type: 'none' };
  }

  if (value === null || value === undefined || value === '') {
    return response.required ? { type: 'unanswered' } : { type: 'none' };
  }

  // Single-value inputs (e.g. shortText, longText, numerical, radio, buttons, likert and single-select dropdown) are invalid when they do not match the configured requiredValue.
  if (response.requiredValue != null && value.toString() !== response.requiredValue.toString()) {
    return { type: 'invalid', reason: 'requiredValueMismatch' };
  }

  // Numerical answers can be present but still invalid when they fall outside the allowed range
  if (response.type === 'numerical') {
    const numericalError = checkNumericalResponse(response, value as unknown as number);
    return numericalError ? { type: 'invalid', message: numericalError } : { type: 'none' };
  }

  return { type: 'none' };
}

export function generateCustomResponseErrorMessage(
  response: CustomResponse,
  value: StoredAnswer['answer'][string],
  values: StoredAnswer['answer'],
  customValidate?: CustomResponseValidate,
  loadError?: string,
  options?: { showRequiredErrors?: boolean },
) {
  const issue = evaluateResponseIssue(
    response,
    value,
    {
      ...values,
      [response.id]: value,
    },
    customValidate,
    loadError,
  );

  if (issue.type === 'unanswered') {
    return options?.showRequiredErrors ? REQUIRED_ERROR_MESSAGE : null;
  }

  if (issue.type === 'invalid') {
    // Keep validation styling quiet until the participant attempts to submit,
    // so typing/selecting answers in order just shows the question text.
    if (!options?.showRequiredErrors) {
      return null;
    }
    return issue.message ?? null;
  }

  return null;
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
  const responseValue = Array.isArray(answer.checked)
    ? answer.checked
    : answer.value;
  const values = errorOptions?.values || {};
  const issueValues = responseValue === undefined
    ? values
    : {
      ...values,
      [response.id]: responseValue,
    };
  const issue = evaluateResponseIssue(
    response,
    responseValue,
    issueValues,
  );

  if (issue.type === 'unanswered') {
    return errorOptions?.showRequiredErrors ? REQUIRED_ERROR_MESSAGE : null;
  }

  if (issue.type === 'invalid') {
    // Keep validation styling quiet until the participant attempts to submit,
    // so typing/selecting answers in order just shows the question text.
    if (!errorOptions?.showRequiredErrors) {
      return null;
    }

    if (issue.reason === 'requiredValueMismatch') {
      return getRequiredValueMismatchMessage(response, options);
    }

    return issue.message ?? null;
  }

  return null;
}

// Checks whether a response has an issue that should block progression, and if so, what type of issue it is (unanswered vs. invalid)
export function getResponseIssueType(
  response: Response,
  values: StoredAnswer['answer'],
  customValidate?: CustomResponseValidate,
  loadError?: string,
): ResponseIssueType | null {
  const issue = evaluateResponseIssue(
    response,
    values[response.id],
    values,
    customValidate,
    loadError,
  );

  if (issue.type === 'none') return null;
  // Optional responses with invalid values still display an orange warning but they should not block progression — only required issues gate the Next button
  if (issue.type === 'invalid' && response.required === false) return null;
  return issue.type;
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
