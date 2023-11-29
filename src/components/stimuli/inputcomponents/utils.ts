import { useForm } from '@mantine/form';
import { useEffect, useState } from 'react';
import { BaseResponse, Option, Response } from '../../../parser/types';
import { StoredAnswer } from '../../../store/types';

export const generateInitFields = (responses: Response[], storedAnswer: StoredAnswer['answer']) => {
  let initObj = {};

  responses.forEach((response) => {
    const answer = storedAnswer ? storedAnswer[response.id] : {};
    if (answer) {
      console.log(response.id, answer);
      initObj = { ...initObj, [response.id]: answer };
    } else {
      initObj = { ...initObj, [response.id]: response.type === 'iframe' ? [] : '' };
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
        [response.id]: (value: string | string[]) => {
          if (Array.isArray(value)) {
            if(response.requiredValue != null && !Array.isArray(response.requiredValue)) {
              return 'Incorrect required value';
            } else if (response.requiredValue != null && Array.isArray(response.requiredValue)) {
              if(response.requiredValue.length !== value.length) {
                return 'Incorrect input';
              }
              const sortedReq = [...response.requiredValue].sort();
              const sortedVal = [...value].sort();

              return sortedReq.every((val, index) => val === sortedVal[index]) ? null : 'Incorrect input';
            }
            return value.length === 0 ? 'Empty input' : null;
          }
          if (response.required && response.requiredValue != null && value != null) {
            return value.toString() !== response.requiredValue.toString() ? 'Incorrect input' : null;
          }
          if (response.required) {
            return value === null || value === undefined || value === '' ? 'Empty input' : null;
          }
          return value === null ? 'Empty input' : null;
        }
      };
    }
  });
  return validateObj;
};

export function useAnswerField(responses: Response[], currentStep: string, storedAnswer: StoredAnswer['answer']) {
  const [_id, setId] = useState<string | null>(null);

  const answerField = useForm({
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
  ob2: Record<string, unknown>
) {
  if (Object.keys(ob1).length !== Object.keys(ob2).length) return false;

  const keys = Object.keys(ob1);

  for (let i = 0; i < keys.length; ++i) {
    const v1 = ob1[keys[i]];
    const v2 = ob2[keys[i]];

    if (JSON.stringify(v1) !== JSON.stringify(v2)) return false;
  }

  return true;
}

export function generateErrorMessage(
  response: BaseResponse,
  answer: { value?: string | string[]; checked?: string[] },
  options?: Option[]
) {
  const { requiredValue, requiredLabel } = response;

  let error: string | null = ''; 
  if(answer.checked && Array.isArray(requiredValue)) {
    error = requiredValue && [...requiredValue].sort().toString() !== [...answer.checked].sort().toString() ? `Please ${options ? 'select' : 'enter'} ${requiredLabel ? requiredLabel : requiredValue.toString()} to continue.` : null;
  }
  else {
    error = answer.value && requiredValue && requiredValue.toString() !== answer.value.toString() ?  `Please ${options ? 'select' : 'enter'} ${requiredLabel ? requiredLabel : options ? options.find((opt) => opt.value === requiredValue)?.label : requiredValue.toString()} to continue.` : null;
  }

  return error;
}
