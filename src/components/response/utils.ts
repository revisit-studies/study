import { useForm } from '@mantine/form';
import { useEffect, useState } from 'react';
import isEqual from 'lodash.isequal';
import {
  CheckboxResponse, CustomResponse, JsonValue, RadioResponse, Response,
} from '../../parser/types';
import { CustomResponseValidate, StoredAnswer } from '../../store/types';
import { parseStringOptionValue } from '../../utils/stringOptions';
import {
  checkCheckboxResponseForValidation,
  checkMatrixResponse,
  isEmptyCustomResponseValue,
  isOtherSelectionIncomplete,
  REQUIRED_ERROR_MESSAGE,
  shouldBypassValidationForStandaloneDontKnow,
  usesStandaloneDontKnowField,
} from './responseErrors';

type ResponseDefault = JsonValue;
type ResponseWithDefault = Response & { default?: ResponseDefault };

export const DONT_KNOW_DEFAULT_VALUE = "I don't know";

export function normalizeCheckboxDontKnowValue(value: string[]) {
  return value.includes(DONT_KNOW_DEFAULT_VALUE) ? [] : value;
}

function checkDropdownResponse(dropdownResponse: { minSelections?: number; maxSelections?: number }, value: string[]) {
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

function checkNumericalResponse(response: { min?: number; max?: number }, value: number) {
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

const getQueryParameters = () => {
  if (typeof window === 'undefined') {
    return new URLSearchParams('');
  }

  return new URLSearchParams(window.location.search);
};

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
