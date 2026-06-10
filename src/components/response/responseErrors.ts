import {
  CustomResponse, NumberOption, Response, StringOption,
} from '../../parser/types';
import { CustomResponseValidate, StoredAnswer } from '../../store/types';
import {
  checkCheckboxResponseForValidation,
  checkDropdownResponse,
  checkMatrixResponse,
  checkNumericalResponse,
  isEmptyCustomResponseValue,
  isOtherSelectionIncomplete,
  REQUIRED_ERROR_MESSAGE,
  ResponseIssueSummary,
  ResponseIssueType,
  ResponseValidationResult,
  shouldBypassValidationForStandaloneDontKnow,
  usesStandaloneDontKnowField,
  validateResponse,
} from './responseValidation';

export {
  checkCheckboxResponseForValidation,
  checkDropdownResponse,
  checkMatrixResponse,
  checkNumericalResponse,
  isEmptyCustomResponseValue,
  isOtherSelectionIncomplete,
  REQUIRED_ERROR_MESSAGE,
  shouldBypassValidationForStandaloneDontKnow,
  usesStandaloneDontKnowField,
};

export type {
  ResponseIssueSummary,
  ResponseIssueType,
  ResponseValidationResult,
};

export type ResponseValidationIssue = {
  type: 'none' | 'unanswered' | 'invalid';
  message?: string;
  reason?: 'requiredValueMismatch';
};

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

export function evaluateResponseIssue(
  response: Response,
  value: StoredAnswer['answer'][string] | undefined,
  values: StoredAnswer['answer'],
  customValidate?: CustomResponseValidate,
  loadError?: string,
): ResponseValidationIssue {
  const result = validateResponse(response, value, values, { customValidate, loadError });
  return {
    type: result.issueType,
    message: result.message,
    reason: result.reason,
  };
}

export function generateCustomResponseErrorMessage(
  response: CustomResponse,
  value: StoredAnswer['answer'][string],
  values: StoredAnswer['answer'],
  customValidate?: CustomResponseValidate,
  loadError?: string,
  options?: { showRequiredErrors?: boolean },
) {
  const result = validateResponse(
    response,
    value,
    {
      ...values,
      [response.id]: value,
    },
    { customValidate, loadError },
  );

  if (result.issueType === 'unanswered') {
    return options?.showRequiredErrors ? REQUIRED_ERROR_MESSAGE : null;
  }

  if (result.issueType === 'invalid') {
    if (!options?.showRequiredErrors) {
      return null;
    }
    return result.message ?? null;
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
  const result = validateResponse(response, responseValue, issueValues);

  if (result.issueType === 'unanswered') {
    return errorOptions?.showRequiredErrors ? REQUIRED_ERROR_MESSAGE : null;
  }

  if (result.issueType === 'invalid') {
    if (!errorOptions?.showRequiredErrors) {
      return null;
    }

    if (result.reason === 'requiredValueMismatch') {
      return getRequiredValueMismatchMessage(response, options);
    }

    return result.message ?? null;
  }

  return null;
}

export function getResponseIssueType(
  response: Response,
  values: StoredAnswer['answer'],
  customValidate?: CustomResponseValidate,
  loadError?: string,
): ResponseIssueType | null {
  const result = validateResponse(
    response,
    values[response.id],
    values,
    { customValidate, loadError },
  );

  return result.blocksProgression ? result.issueType as ResponseIssueType : null;
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
