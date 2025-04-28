import { useForm } from '@mantine/form';
import { useEffect, useState } from 'react';
import {
  CheckboxResponse, NumberOption, RadioResponse, Response, StringOption,
} from '../../parser/types';
import { StoredAnswer } from '../../store/types';

function checkCheckboxResponse(response: Response, value: string[]) {
  if (response.type === 'checkbox') {
    // Check max and min selections
    const checkboxResponse = response as CheckboxResponse;
    const minNotSelected = checkboxResponse.minSelections && value.length < checkboxResponse.minSelections;
    const maxNotSelected = checkboxResponse.maxSelections && value.length > checkboxResponse.maxSelections;

    if (minNotSelected && maxNotSelected) {
      return `Please select between ${checkboxResponse.minSelections} and ${checkboxResponse.maxSelections} options`;
    }
    if (minNotSelected) {
      return `Please select at least ${checkboxResponse.minSelections} options`;
    }
    if (maxNotSelected) {
      return `Please select at most ${checkboxResponse.maxSelections} options`;
    }
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
      let initField: string | string[] | object | null = '';
      if (response.paramCapture) {
        initField = queryParameters.get(response.paramCapture);
      } else if (response.type === 'reactive') {
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
            return value.length === 0 ? 'Empty input' : null;
          }
          if (response.required && response.requiredValue != null && value != null) {
            return value.toString() !== response.requiredValue.toString() ? 'Incorrect input' : null;
          }
          if (response.required) {
            return (value === null || value === undefined || value === '') && !values[`${response.id}-dontKnow`] ? 'Empty input' : null;
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

export function areAnswersEqual(
  ob1: Record<string, unknown>,
  ob2: Record<string, unknown>,
) {
  if (Object.keys(ob1).length !== Object.keys(ob2).length) return false;

  const keys = Object.keys(ob1);

  return keys.every((key) => JSON.stringify(ob1[key]) === JSON.stringify(ob2[key]));
}

export function generateErrorMessage(
  response: Response,
  answer: { value?: string | string[] | Record<string, string>; checked?: string[] },
  options?: (StringOption | NumberOption)[],
) {
  const { requiredValue, requiredLabel } = response;

  let error: string | null = '';
  if (answer.checked && Array.isArray(requiredValue)) {
    error = requiredValue && [...requiredValue].sort().toString() !== [...answer.checked].sort().toString() ? `Please ${options ? 'select' : 'enter'} ${requiredLabel || requiredValue.toString()} to continue.` : null;
  } else if (answer.checked && response.required) {
    error = checkCheckboxResponse(response, answer.checked);
  } else {
    error = answer.value && requiredValue && requiredValue.toString() !== answer.value.toString() ? `Please ${options ? 'select' : 'enter'} ${requiredLabel || (options ? options.find((opt) => opt.value === requiredValue)?.label : requiredValue.toString())} to continue.` : null;
  }

  return error;
}
