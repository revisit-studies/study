import { useForm } from '@mantine/form';
import { useEffect, useState } from 'react';
import {
  CheckboxResponse, DropdownResponse, MatrixResponse, NumberOption, NumericalResponse, RadioResponse, Response, StringOption,
} from '../../parser/types';
import { StoredAnswer } from '../../store/types';
import { parseStringOptionValue } from '../../utils/stringOptions';

type ResponseDefault = string | number | string[] | Record<string, string | string[]>;
type ResponseWithDefault = Response & { default?: ResponseDefault };

export const DONT_KNOW_DEFAULT_VALUE = "I don't know";

// Function for highlighting unanswered required questions
export function requiredAnswerIsEmpty(value: string | number | boolean | string[] | Record<string, unknown> | null | undefined): boolean {
  if (value === null || value === undefined || value === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'object' && !Array.isArray(value) && Object.values(value as Record<string, unknown>).some((v) => v === '')) return true;
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
    return Array.isArray(responseDefault) ? responseDefault : [responseDefault.toString()];
  }

  if (response.type === 'likert') {
    return responseDefault.toString();
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

  return responseDefault;
};

export const generateInitFields = (responses: Response[], storedAnswer: StoredAnswer['answer']) => {
  let initObj = {};
  const queryParameters = getQueryParameters();

  responses.forEach((response) => {
    const answer = storedAnswer ? storedAnswer[response.id] : {};
    const dontKnowObj = usesStandaloneDontKnowField(response)
      ? {
        [`${response.id}-dontKnow`]: storedAnswer && storedAnswer[`${response.id}-dontKnow`] !== undefined
          ? storedAnswer[`${response.id}-dontKnow`]
          : false,
      }
      : {};

    const otherAnswer = storedAnswer && storedAnswer[`${response.id}-other`] !== undefined ? storedAnswer[`${response.id}-other`] : '';
    const otherObj = (response as RadioResponse | CheckboxResponse).withOther ? { [`${response.id}-other`]: otherAnswer } : {};

    if (answer) {
      initObj = {
        ...initObj,
        [response.id]: answer,
        ...dontKnowObj,
        ...otherObj,
      };
    } else {
      let initField: string | string[] | number | object | null = '';
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

const generateValidation = (responses: Response[]) => {
  let validateObj = {};
  responses.forEach((response) => {
    if (response.required) {
      validateObj = {
        ...validateObj,
        [response.id]: (value: StoredAnswer['answer'][string], values: StoredAnswer['answer']) => {
          if (shouldBypassValidationForStandaloneDontKnow(response, !!values[`${response.id}-dontKnow`])) {
            return null;
          }

          if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
            if (response.type === 'matrix-checkbox' || response.type === 'matrix-radio') {
              return checkMatrixResponse(response, value);
            }
            if (response.type === 'ranking-sublist' || response.type === 'ranking-categorical' || response.type === 'ranking-pairwise') {
              return Object.keys(value).length > 0 ? null : 'Empty Input';
            }
            return Object.values(value).every((val) => val !== '') ? null : 'Empty Input';
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
              return checkCheckboxResponseForValidation(response, value, !!values[`${response.id}-dontKnow`]);
            }
            if (response.type === 'dropdown') {
              return checkDropdownResponse(response, value);
            }
            return value.length === 0 ? 'Empty input' : null;
          }

          if (response.required && response.requiredValue != null && value != null) {
            return value.toString() !== response.requiredValue.toString() ? 'Incorrect input' : null;
          }
          if (response.required) {
            if ((value === null || value === undefined || value === '') && !values[`${response.id}-dontKnow`]) {
              return 'Empty input';
            }
            if (response.type === 'numerical') {
              return checkNumericalResponse(response, value as unknown as number);
              // return 'Empty input';
            }
          }

          return value === null ? 'Empty input' : null;
        },
      };
    }
  });
  return validateObj;
};

export function useAnswerField(responses: Response[], currentStep: string | number, storedAnswer: StoredAnswer['answer']) {
  const [_id, setId] = useState<string | number | null>(null);

  const answerField = useForm<StoredAnswer['answer']>({
    initialValues: generateInitFields(responses, storedAnswer),
    validate: generateValidation(responses),
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
  answer: { value?: number | string | string[] | Record<string, string>; checked?: string[]; dontKnowChecked?: boolean },
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
  } else if (answer.value && response.type === 'dropdown') {
    error = checkDropdownResponse(response, answer.value as string[]);
  } else if (answer.value && typeof answer.value === 'number' && response.type === 'numerical' && checkNumericalResponse(response, answer.value)) {
    error = checkNumericalResponse(response, answer.value);
  } else if (answer.value && typeof answer.value === 'object' && !Array.isArray(answer.value) && (response.type === 'matrix-radio' || response.type === 'matrix-checkbox')) {
    error = checkMatrixResponseForMessage(response, answer.value);
  } else {
    error = answer.value && requiredValue && requiredValue.toString() !== answer.value.toString() ? `Please ${options ? 'select' : 'enter'} ${requiredLabel || (options ? options.find((opt) => opt.value === requiredValue)?.label : requiredValue.toString())} to continue.` : null;
  }

  // If no existing error was found and the field is required and unanswered, show a prompt when showUnanswered is true
  if (!error && showUnanswered && response.required) {
    if (requiredAnswerIsEmpty(answer.value)) {
      error = 'Please answer this question to continue.';
    }
  }

  return error;
}
