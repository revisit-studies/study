import { useForm } from '@mantine/form';
import { useEffect, useState } from 'react';
import isEqual from 'lodash.isequal';
import {
  CheckboxResponse, CustomResponse, DropdownResponse, JsonValue, MatrixResponse, NumberOption, NumericalResponse, RadioResponse, Response, StringOption,
} from '../../parser/types';
import { CustomResponseValidate, StoredAnswer } from '../../store/types';
import { parseStringOptionValue, parseStringOptions } from '../../utils/stringOptions';

type ResponseDefault = JsonValue;
type ResponseWithDefault = Response & { default?: ResponseDefault };

export const DONT_KNOW_DEFAULT_VALUE = "I don't know";
export const GENERIC_UNANSWERED_MESSAGE = 'Please answer this question to continue.';
export const OTHER_FIELD_REQUIRED_MESSAGE = 'Please fill in the "Other" field to continue.';
export type ResponseBlockingStatus = 'satisfied' | 'unanswered' | 'invalid';

// Function for highlighting unanswered required questions
export function requiredAnswerIsEmpty(value: JsonValue | undefined): boolean {
  if (value === null || value === undefined || value === '') return true;
  if (typeof value === 'number' && Number.isNaN(value)) return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    // Treat an object with no keys as empty (e.g. initial ranking/matrix state)
    if (Object.keys(obj).length === 0) return true;
    // Treat properties with empty-string, null, or undefined values as empty as well
    if (Object.values(obj).some((v) => v === '' || v === null || v === undefined)) return true;
  }

  return false;
}

function isEmptyCustomResponseValue(value: JsonValue | undefined): boolean {
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

export function normalizeCheckboxDontKnowValue(value: string[]) {
  return value.includes(DONT_KNOW_DEFAULT_VALUE) ? [] : value;
}

function checkDropdownResponse(dropdownResponse: DropdownResponse, value: string[]) {
  // Check max and min selections
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

function checkMatrixResponse(response: MatrixResponse, value: Record<string, string>) {
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

function getOtherFieldError(
  response: Response,
  value: number | string | string[] | Record<string, string> | undefined,
  otherValue?: string,
) {
  const supportsOtherField = (response.type === 'radio' || response.type === 'checkbox') && response.withOther;

  if (!supportsOtherField) {
    return null;
  }

  const isOtherSelected = (
    // Radio uses a simple single-value sentinel, while checkbox uses a reserved
    // option token to avoid collisions with participant-defined option values.
    (response.type === 'radio' && value === 'other')
    || (response.type === 'checkbox' && Array.isArray(value) && value.includes('__other'))
  );

  if (!isOtherSelected) {
    return null;
  }

  return requiredAnswerIsEmpty(otherValue) ? OTHER_FIELD_REQUIRED_MESSAGE : null;
}

const getQueryParameters = () => {
  if (typeof window === 'undefined') {
    return new URLSearchParams('');
  }

  return new URLSearchParams(window.location.search);
};

// Matrix questions with "Don't know" option require a separate field to properly handle the "Don't know" state
export const usesStandaloneDontKnowField = (response: Response) => !!response.withDontKnow
  && response.type !== 'matrix-radio'
  && response.type !== 'matrix-checkbox';

export const shouldBypassValidationForStandaloneDontKnow = (response: Response, dontKnowChecked: boolean) => (
  usesStandaloneDontKnowField(response) && dontKnowChecked
);

export const getDefaultFieldValue = (response: Response) => {
  const responseDefault = (response as ResponseWithDefault).default;
  if (!Object.hasOwn(response, 'default') || responseDefault === undefined) {
    return null;
  }

  if (response.type === 'matrix-checkbox') {
    const matrixDefault = responseDefault as Record<string, string[] | string>;
    return Object.fromEntries(
      Object.entries(matrixDefault).map(([questionKey, value]) => [questionKey, (Array.isArray(value) ? value : [value]).join('|')]),
    );
  }

  if (response.type === 'matrix-radio') {
    return responseDefault as Record<string, string>;
  }

  if (response.type === 'checkbox') {
    return Array.isArray(responseDefault) ? responseDefault : (responseDefault === null ? [] : [responseDefault.toString()]);
  }

  if (response.type === 'likert') {
    return responseDefault === null ? '' : responseDefault.toString();
  }

  if (response.type === 'dropdown') {
    const dropdownDefault = responseDefault as string | string[];
    const isMultiselect = (
      (response.minSelections && response.minSelections >= 1)
      || (response.maxSelections && response.maxSelections > 1)
    );

    if (isMultiselect) {
      return Array.isArray(dropdownDefault) ? dropdownDefault : [dropdownDefault];
    }

    return Array.isArray(dropdownDefault) ? dropdownDefault[0] ?? '' : dropdownDefault;
  }

  if (response.type === 'custom') {
    return responseDefault;
  }

  return responseDefault;
};

export const generateInitFields = (responses: Response[], storedAnswer: StoredAnswer['answer']) => {
  let initObj = {};
  const queryParameters = getQueryParameters();

  responses.forEach((response) => {
    const hasStoredAnswer = Object.prototype.hasOwnProperty.call(storedAnswer, response.id);
    const answer = hasStoredAnswer ? storedAnswer[response.id] : undefined;
    const dontKnowObj = usesStandaloneDontKnowField(response)
      ? {
        [`${response.id}-dontKnow`]: storedAnswer && storedAnswer[`${response.id}-dontKnow`] !== undefined
          ? storedAnswer[`${response.id}-dontKnow`]
          : false,
      }
      : {};

    const otherAnswer = storedAnswer && storedAnswer[`${response.id}-other`] !== undefined ? storedAnswer[`${response.id}-other`] : '';
    const otherObj = (response as RadioResponse | CheckboxResponse).withOther ? { [`${response.id}-other`]: otherAnswer } : {};

    if (hasStoredAnswer) {
      initObj = {
        ...initObj,
        [response.id]: answer,
        ...dontKnowObj,
        ...otherObj,
      };
    } else {
      let initField: StoredAnswer['answer'][string] = '';
      const defaultFieldValue = getDefaultFieldValue(response);
      if (response.paramCapture) {
        initField = queryParameters.get(response.paramCapture);
      } else if (defaultFieldValue !== null) {
        initField = defaultFieldValue;
      } else if (response.type === 'reactive' || response.type === 'ranking-sublist' || response.type === 'ranking-categorical' || response.type === 'ranking-pairwise') {
        initField = [];
      } else if (response.type === 'matrix-radio' || response.type === 'matrix-checkbox') {
        initField = Object.fromEntries(
          response.questionOptions.map((entry) => [parseStringOptionValue(entry), '']),
        );
      } else if (response.type === 'custom') {
        initField = null;
      } else if (response.type === 'slider' && response.startingValue) {
        initField = response.startingValue.toString();
      }

      initObj = {
        ...initObj,
        [response.id]: initField,
        ...dontKnowObj,
        ...otherObj,
      };
    }
  });

  return { ...initObj };
};

export const mergeReactiveAnswers = (
  responses: Response[],
  currentValues: StoredAnswer['answer'],
  reactiveAnswers: Record<string, StoredAnswer['answer'][string]>,
) => {
  const reactiveResponses = responses.filter((response) => response.type === 'reactive');
  let mergedValues: StoredAnswer['answer'] | null = null;

  reactiveResponses.forEach((response) => {
    if (Object.prototype.hasOwnProperty.call(reactiveAnswers, response.id)) {
      if (mergedValues === null) {
        mergedValues = { ...currentValues };
      }
      mergedValues[response.id] = reactiveAnswers[response.id];
    }
  });

  return mergedValues ?? currentValues;
};

function validateCustomResponse(
  response: CustomResponse,
  value: StoredAnswer['answer'][string],
  values: StoredAnswer['answer'],
  customValidate?: CustomResponseValidate,
  loadError?: string,
) {
  if (loadError) {
    return loadError;
  }

  if (shouldBypassValidationForStandaloneDontKnow(response, !!values[`${response.id}-dontKnow`])) {
    return null;
  }

  if (response.required !== false && isEmptyCustomResponseValue(value)) {
    return 'Empty input';
  }

  if (response.requiredValue !== undefined && !isEmptyCustomResponseValue(value) && !isEqual(value, response.requiredValue)) {
    return 'Incorrect input';
  }

  if (!customValidate) {
    return null;
  }

  if (response.required === false && isEmptyCustomResponseValue(value)) {
    return null;
  }

  return customValidate(value, values, response);
}

export function generateCustomResponseErrorMessage(
  response: CustomResponse,
  value: StoredAnswer['answer'][string],
  values: StoredAnswer['answer'],
  customValidate?: CustomResponseValidate,
  loadError?: string,
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

export const generateValidation = (
  responses: Response[],
  customResponseValidators: Record<string, CustomResponseValidate | undefined> = {},
  customResponseLoadErrors: Record<string, string | undefined> = {},
): Record<string, (value: StoredAnswer['answer'][string], values: StoredAnswer['answer']) => string | null> => {
  let validateObj: Record<string, (value: StoredAnswer['answer'][string], values: StoredAnswer['answer']) => string | null> = {};
  responses.forEach((response) => {
    const validatesOtherField = (response.type === 'radio' || response.type === 'checkbox') && !!response.withOther;

    // Reactive answers are satisfied through stimulus controllers, so they should
    // not participate in form-response blocking or unanswered reveal logic.
    if (response.type === 'reactive') {
      return;
    }

    if (response.required || response.type === 'custom' || validatesOtherField) {
      validateObj = {
        ...validateObj,
        [response.id]: (value: StoredAnswer['answer'][string], values: StoredAnswer['answer']) => {
          if (response.type === 'custom') {
            return validateCustomResponse(
              response,
              value,
              values,
              customResponseValidators[response.id],
              customResponseLoadErrors[response.id],
            );
          }

          if (shouldBypassValidationForStandaloneDontKnow(response, !!values[`${response.id}-dontKnow`])) {
            return null;
          }

          let error: string | null = null;

          if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
            if (response.type === 'matrix-checkbox' || response.type === 'matrix-radio') {
              error = checkMatrixResponse(response, value as Record<string, string>);
            } else if (response.type === 'ranking-sublist' || response.type === 'ranking-categorical' || response.type === 'ranking-pairwise') {
              error = Object.keys(value).length > 0 ? null : 'Empty Input';
            } else {
              error = Object.values(value).every((val) => val !== '') ? null : 'Empty Input';
            }
          } else if (Array.isArray(value)) {
            if (response.requiredValue != null && !Array.isArray(response.requiredValue)) {
              error = 'Incorrect required value. Contact study administrator.';
            } else if (response.requiredValue != null && Array.isArray(response.requiredValue)) {
              if (response.requiredValue.length !== value.length) {
                error = 'Incorrect input';
              } else {
                const sortedReq = [...response.requiredValue].sort();
                const sortedVal = [...value].sort();

                error = sortedReq.every((val, index) => val === sortedVal[index]) ? null : 'Incorrect input';
              }
            } else if (response.type === 'checkbox') {
              error = checkCheckboxResponseForValidation(response, value as string[], !!values[`${response.id}-dontKnow`]);
            } else if (response.type === 'dropdown') {
              error = checkDropdownResponse(response, value as string[]);
            } else {
              error = value.length === 0 ? 'Empty input' : null;
            }
          } else if (response.required && response.requiredValue != null && value != null) {
            error = value.toString() !== response.requiredValue.toString() ? 'Incorrect input' : null;
          } else if (response.required) {
            if ((value === null || value === undefined || value === '') && !values[`${response.id}-dontKnow`]) {
              error = 'Empty input';
            } else if (response.type === 'numerical') {
              error = checkNumericalResponse(response, value as unknown as number);
            }
          } else {
            error = value === null ? 'Empty input' : null;
          }

          if (error) {
            return error;
          }

          return getOtherFieldError(
            response,
            value as number | string | string[] | Record<string, string> | undefined,
            values[`${response.id}-other`] as string | undefined,
          );
        },
      };
    }
  });
  return validateObj;
};

export function useAnswerField(
  responses: Response[],
  currentStep: string | number,
  storedAnswer: StoredAnswer['answer'],
  customResponseValidators: Record<string, CustomResponseValidate | undefined> = {},
  customResponseLoadErrors: Record<string, string | undefined> = {},
) {
  const [_id, setId] = useState<string | number | null>(null);

  const answerField = useForm<StoredAnswer['answer']>({
    initialValues: generateInitFields(responses, storedAnswer),
    validate: generateValidation(responses, customResponseValidators, customResponseLoadErrors),
  });

  useEffect(() => {
    if (_id !== currentStep) {
      setId(currentStep);
      answerField.reset();
    }
  }, [_id, answerField, currentStep]);

  return answerField;
}

export function generateErrorMessage(
  response: Response,
  answer: {
    value?: number | string | string[] | Record<string, string>;
    checked?: string[];
    dontKnowChecked?: boolean;
    otherValue?: string;
  },
  options?: (StringOption | NumberOption)[],
  showUnanswered?: boolean,
) {
  const { requiredValue, requiredLabel } = response;

  if (shouldBypassValidationForStandaloneDontKnow(response, !!answer.dontKnowChecked)) {
    return null;
  }

  let error: string | null = '';
  const checkboxValues = Array.isArray(answer.checked)
    ? answer.checked
    : (Array.isArray(answer.value) ? answer.value : undefined);

  if (checkboxValues && Array.isArray(requiredValue)) {
    error = requiredValue && [...requiredValue].sort().toString() !== [...checkboxValues].sort().toString() ? `Please ${options ? 'select' : 'enter'} ${requiredLabel || requiredValue.toString()} to continue.` : null;
  } else if (checkboxValues && response.required && response.type === 'checkbox') {
    error = checkCheckboxResponseForValidation(response, checkboxValues, !!answer.dontKnowChecked);
  } else if (response.type === 'dropdown' && Array.isArray(answer.value) && answer.value.length > 0) {
    error = checkDropdownResponse(response, answer.value as string[]);
  } else if (answer.value !== null && answer.value !== undefined && typeof answer.value === 'number' && response.type === 'numerical' && checkNumericalResponse(response, answer.value)) {
    error = checkNumericalResponse(response, answer.value);
  } else if (answer.value !== null && answer.value !== undefined && typeof answer.value === 'object' && !Array.isArray(answer.value) && (response.type === 'matrix-radio' || response.type === 'matrix-checkbox')) {
    error = checkMatrixResponseForMessage(response, answer.value);
  } else {
    error = answer.value && requiredValue && requiredValue.toString() !== answer.value.toString() ? `Please ${options ? 'select' : 'enter'} ${requiredLabel || (options ? options.find((opt) => opt.value === requiredValue)?.label : requiredValue.toString())} to continue.` : null;
  }

  if (!error) {
    error = getOtherFieldError(response, answer.value, answer.otherValue);
  }

  // If no existing error was found and the field is required and unanswered, show a prompt when showUnanswered is true
  if (!error && showUnanswered && response.required) {
    if (requiredAnswerIsEmpty(answer.value)) {
      error = 'Please answer this question to continue.';
    }
  }

  return error;
}

export function getResponseBlockingDetails(
  response: Response,
  values: Partial<StoredAnswer['answer']>,
  customValidate?: CustomResponseValidate,
  loadError?: string,
): {
  status: ResponseBlockingStatus;
  message: string | null;
} {
  if (response.hidden || response.type === 'textOnly' || response.type === 'divider' || response.type === 'reactive') {
    return { status: 'satisfied', message: null };
  }

  const value = values[response.id] as StoredAnswer['answer'][string];
  const dontKnowChecked = !!values[`${response.id}-dontKnow`];

  if (response.type === 'custom') {
    if (shouldBypassValidationForStandaloneDontKnow(response, dontKnowChecked)) {
      return { status: 'satisfied', message: null };
    }

    const customMessage = generateCustomResponseErrorMessage(
      response,
      value,
      values as StoredAnswer['answer'],
      customValidate,
      loadError,
    );

    if (customMessage) {
      return { status: 'invalid', message: customMessage };
    }

    if (response.required !== false && isEmptyCustomResponseValue(value)) {
      return { status: 'unanswered', message: GENERIC_UNANSWERED_MESSAGE };
    }

    return { status: 'satisfied', message: null };
  }

  if (!response.required && !((response.type === 'radio' || response.type === 'checkbox') && response.withOther)) {
    return { status: 'satisfied', message: null };
  }

  if (response.type === 'ranking-sublist' || response.type === 'ranking-categorical' || response.type === 'ranking-pairwise') {
    const rankingValue = (value && typeof value === 'object' && !Array.isArray(value))
      ? value as Record<string, string>
      : {};

    if (Object.keys(rankingValue).length === 0) {
      return { status: 'unanswered', message: GENERIC_UNANSWERED_MESSAGE };
    }

    return { status: 'satisfied', message: null };
  }

  const options = (
    response.type === 'checkbox'
    || response.type === 'radio'
    || response.type === 'buttons'
    || response.type === 'dropdown'
  ) ? parseStringOptions(response.options) : undefined;

  const message = generateErrorMessage(
    response,
    {
      value: value as number | string | string[] | Record<string, string> | undefined,
      checked: Array.isArray(value) ? value as string[] : undefined,
      dontKnowChecked,
      otherValue: values[`${response.id}-other`] as string | undefined,
    },
    options,
    true,
  );

  if (!message) {
    return { status: 'satisfied', message: null };
  }

  return {
    status: message === GENERIC_UNANSWERED_MESSAGE ? 'unanswered' : 'invalid',
    message,
  };
}

export function countBlockedResponses(
  responses: Response[],
  values: Partial<StoredAnswer['answer']>,
  customResponseValidators: Record<string, CustomResponseValidate | undefined> = {},
  customResponseLoadErrors: Record<string, string | undefined> = {},
) {
  return responses.reduce((acc, response) => {
    const { status } = getResponseBlockingDetails(
      response,
      values,
      customResponseValidators[response.id],
      customResponseLoadErrors[response.id],
    );

    if (status === 'unanswered') {
      acc.unansweredCount += 1;
    } else if (status === 'invalid') {
      acc.invalidCount += 1;
    }

    return acc;
  }, {
    unansweredCount: 0,
    invalidCount: 0,
  });
}

export function isRequiredResponseUnanswered(
  response: Response,
  values: Partial<StoredAnswer['answer']>,
) {
  if (response.hidden || response.type === 'textOnly' || response.type === 'divider' || !response.required) {
    return false;
  }

  if (shouldBypassValidationForStandaloneDontKnow(response, !!values[`${response.id}-dontKnow`])) {
    return false;
  }

  return getResponseBlockingDetails(response, values).status === 'unanswered';
}

export function countRequiredUnansweredResponses(
  responses: Response[],
  values: Partial<StoredAnswer['answer']>,
) {
  return responses.filter((response) => isRequiredResponseUnanswered(response, values)).length;
}
