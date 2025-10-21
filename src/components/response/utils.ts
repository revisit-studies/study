import { useForm } from '@mantine/form';
import { useEffect, useState } from 'react';
import {
  CheckboxResponse, DropdownResponse, MatrixResponse, NumberOption, NumericalResponse, RadioResponse, Response, StringOption,
} from '../../parser/types';
import { StoredAnswer } from '../../store/types';

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
  const unanswered = Object.values(value).some((val) => val === '');

  if (unanswered) {
    return 'Please answer all questions in the matrix to continue.';
  }

  return null;
}

const queryParameters = new URLSearchParams(window.location.search);

export const generateInitFields = (responses: Response[], storedAnswer: StoredAnswer['answer']) => {
  let initObj = {};

  responses.forEach((response) => {
    const answer = storedAnswer ? storedAnswer[response.id] : {};

    const dontKnowAnswer = storedAnswer && storedAnswer[`${response.id}-dontKnow`] !== undefined ? storedAnswer[`${response.id}-dontKnow`] : false;
    const dontKnowObj = response.withDontKnow ? { [`${response.id}-dontKnow`]: dontKnowAnswer } : {};

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
      if (response.paramCapture) {
        initField = queryParameters.get(response.paramCapture);
      } else if (response.type === 'reactive' || response.type === 'ranking-sublist' || response.type === 'ranking-categorical' || response.type === 'ranking-pairwise') {
        initField = [];
      } else if (response.type === 'matrix-radio' || response.type === 'matrix-checkbox') {
        initField = Object.fromEntries(
          response.questionOptions.map((entry) => [entry, '']),
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

const generateValidation = (responses: Response[]) => {
  let validateObj = {};
  responses.forEach((response) => {
    if (response.required) {
      validateObj = {
        ...validateObj,
        [response.id]: (value: StoredAnswer['answer'][string], values: StoredAnswer['answer']) => {
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
              return checkCheckboxResponse(response, value);
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
  answer: { value?: number | string | string[] | Record<string, string>; checked?: string[] },
  options?: (StringOption | NumberOption)[],
) {
  const { requiredValue, requiredLabel } = response;

  let error: string | null = '';

  if (answer.checked && Array.isArray(requiredValue)) {
    error = requiredValue && [...requiredValue].sort().toString() !== [...answer.checked].sort().toString() ? `Please ${options ? 'select' : 'enter'} ${requiredLabel || requiredValue.toString()} to continue.` : null;
  } else if (answer.checked && response.required && response.type === 'checkbox') {
    error = checkCheckboxResponse(response, answer.checked);
  } else if (answer.value && response.type === 'dropdown') {
    error = checkDropdownResponse(response, answer.value as string[]);
  } else if (answer.value && typeof answer.value === 'number' && response.type === 'numerical' && checkNumericalResponse(response, answer.value)) {
    error = checkNumericalResponse(response, answer.value);
  } else if (answer.value && typeof answer.value === 'object' && !Array.isArray(answer.value) && (response.type === 'matrix-radio' || response.type === 'matrix-checkbox')) {
    return checkMatrixResponse(response, answer.value);
  } else {
    error = answer.value && requiredValue && requiredValue.toString() !== answer.value.toString() ? `Please ${options ? 'select' : 'enter'} ${requiredLabel || (options ? options.find((opt) => opt.value === requiredValue)?.label : requiredValue.toString())} to continue.` : null;
  }

  return error;
}
