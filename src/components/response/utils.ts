import { useForm } from '@mantine/form';
import { useEffect, useState } from 'react';
import {
  CheckboxResponse, JsonValue, RadioResponse, Response,
} from '../../parser/types';
import { CustomResponseValidate, StoredAnswer } from '../../store/types';
import { parseStringOptionValue } from '../../utils/stringOptions';
import {
  generateInvalidResponseErrorMessage,
  usesStandaloneDontKnowField,
} from './responseErrors';

type ResponseDefault = JsonValue;
type ResponseWithDefault = Response & { default?: ResponseDefault };

export const DONT_KNOW_DEFAULT_VALUE = "I don't know";

export function normalizeCheckboxDontKnowValue(value: string[]) {
  return value.includes(DONT_KNOW_DEFAULT_VALUE) ? [] : value;
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
        [response.id]: (value: StoredAnswer['answer'][string], values: StoredAnswer['answer']) => generateInvalidResponseErrorMessage(
          response,
          value,
          values,
          {
            customValidate: customResponseValidators[response.id],
            loadError: customResponseLoadErrors[response.id],
          },
        ),
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
