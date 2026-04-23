import { useForm } from '@mantine/form';
import { useEffect, useState } from 'react';
import isEqual from 'lodash.isequal';
import {
  CheckboxResponse, CustomResponse, DropdownResponse, JsonValue, MatrixResponse, NumberOption, NumericalResponse, RadioResponse, Response, StringOption,
} from '../../parser/types';
import { CustomResponseValidate, StoredAnswer } from '../../store/types';
import { parseStringOptionValue } from '../../utils/stringOptions';

type ResponseDefault = JsonValue;
type ResponseWithDefault = Response & { default?: ResponseDefault };

export const DONT_KNOW_DEFAULT_VALUE = "I don't know";
export const REQUIRED_ERROR_MESSAGE = 'Please answer this question to continue.';

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

function hasOtherText(value: StoredAnswer['answer'][string] | undefined) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isOtherSelectionIncomplete(
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
    return REQUIRED_ERROR_MESSAGE;
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

export const generateValidation = (
  responses: Response[],
  customResponseValidators: Record<string, CustomResponseValidate | undefined> = {},
  customResponseLoadErrors: Record<string, string | undefined> = {},
): Record<string, (value: StoredAnswer['answer'][string], values: StoredAnswer['answer']) => string | null> => {
  let validateObj: Record<string, (value: StoredAnswer['answer'][string], values: StoredAnswer['answer']) => string | null> = {};
  responses.forEach((response) => {
    if (response.required || response.type === 'custom') {
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

          if (isOtherSelectionIncomplete(response, value, values)) {
            return REQUIRED_ERROR_MESSAGE;
          }

          if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
            if (response.type === 'matrix-checkbox' || response.type === 'matrix-radio') {
              return checkMatrixResponse(response, value as Record<string, string>);
            }
            if (response.type === 'ranking-sublist' || response.type === 'ranking-categorical' || response.type === 'ranking-pairwise') {
              return Object.keys(value).length > 0 ? null : REQUIRED_ERROR_MESSAGE;
            }
            return Object.values(value).every((val) => val !== '') ? null : REQUIRED_ERROR_MESSAGE;
          }
          if (Array.isArray(value)) {
            if (response.requiredValue != null && !Array.isArray(response.requiredValue)) {
              return 'Incorrect required value. Contact study administrator.';
            }
            if (response.requiredValue != null && Array.isArray(response.requiredValue)) {
              if (response.requiredValue.length !== value.length) {
                return 'Incorrect input';
              }
              const sortedReq = [...response.requiredValue].sort();
              const sortedVal = [...value].sort();

              return sortedReq.every((val, index) => val === sortedVal[index]) ? null : 'Incorrect input';
            }
            if (response.type === 'checkbox') {
              return checkCheckboxResponseForValidation(response, value as string[], !!values[`${response.id}-dontKnow`]);
            }
            if (response.type === 'dropdown') {
              return checkDropdownResponse(response, value as string[]);
            }
            return value.length === 0 ? REQUIRED_ERROR_MESSAGE : null;
          }

          if (response.required && response.requiredValue != null && value != null) {
            return value.toString() !== response.requiredValue.toString() ? 'Incorrect input' : null;
          }
          if (response.required) {
            if ((value === null || value === undefined || value === '') && !values[`${response.id}-dontKnow`]) {
              return REQUIRED_ERROR_MESSAGE;
            }
            if (response.type === 'numerical') {
              return checkNumericalResponse(response, value as unknown as number);
            }
          }

          return value === null ? REQUIRED_ERROR_MESSAGE : null;
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
