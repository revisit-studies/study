import isEqual from 'lodash.isequal';
import {
  Answer, CustomResponse, JsonValue, Response, StoredAnswer, ValueCondition,
} from '../parser/types';
import type { CustomResponseValidate } from '../store/types';

type ResponseFunctionModule = {
  validate?: (value: unknown, values: Record<string, unknown>, response: Response, expected?: unknown) => string | boolean | number | null;
};

const responseFunctionModules = import.meta.glob('../public/**/*.response.{ts,tsx,js,jsx,mjs,mts}', { eager: true }) as Record<string, ResponseFunctionModule>;
let customResponseValidatorLookup: ((response: CustomResponse) => CustomResponseValidate | undefined) | undefined;

export function registerCustomResponseValidatorLookup(
  lookup?: (response: CustomResponse) => CustomResponseValidate | undefined,
) {
  customResponseValidatorLookup = lookup;
}

export function getResponseFunctionModule(path: string): ResponseFunctionModule | null {
  return responseFunctionModules[`../public/${path}`] ?? null;
}

/** Compare values without converting strings to numbers. */
export function compareResponseValues(
  value: unknown,
  expected: unknown,
  comparison: ValueCondition['comparison'],
  options: { ignoreArrayOrder?: boolean } = {},
): boolean {
  if (comparison === 'equals' || comparison === 'doesNotEqual') {
    const equal = Array.isArray(value) && Array.isArray(expected) && options.ignoreArrayOrder
      ? isEqual([...value].sort(), [...expected].sort())
      : isEqual(value, expected);
    return comparison === 'equals' ? equal : !equal;
  }

  if (comparison === 'contains' || comparison === 'doesNotContain' || comparison === 'matchesRegex') {
    if (typeof value !== 'string' || typeof expected !== 'string') return false;
    if (comparison === 'contains') return value.includes(expected);
    if (comparison === 'doesNotContain') return !value.includes(expected);
    try {
      return new RegExp(expected).test(value);
    } catch {
      return false;
    }
  }

  if (typeof value !== 'number' || typeof expected !== 'number'
    || !Number.isFinite(value) || !Number.isFinite(expected)) return false;
  switch (comparison) {
    case 'lessThan': return value < expected;
    case 'lessThanOrEqual': return value <= expected;
    case 'greaterThan': return value > expected;
    case 'greaterThanOrEqual': return value >= expected;
    default: return false;
  }
}

export function shouldIgnoreArrayOrder(response?: Response) {
  return response?.type === 'checkbox' || response?.type === 'dropdown';
}

export function responseAnswerIsCorrect(
  responseUserAnswer: StoredAnswer['answer'][string],
  responseCorrectAnswer: Answer['answer'],
  acceptableLow?: number,
  acceptableHigh?: number,
  options: { ignoreArrayOrder?: boolean } = {},
): boolean {
  // Handle numeric-string comparison for likert and slider responses
  if ((typeof responseUserAnswer === 'number' || typeof responseUserAnswer === 'string')
    && (typeof responseCorrectAnswer === 'string' || typeof responseCorrectAnswer === 'number')) {
    const userAnswerNumber = Number(responseUserAnswer);

    if (!Number.isNaN(userAnswerNumber)) {
      if (acceptableLow !== undefined && acceptableHigh !== undefined) {
        return userAnswerNumber >= acceptableLow && userAnswerNumber <= acceptableHigh;
      } if (acceptableLow !== undefined) {
        return userAnswerNumber >= acceptableLow;
      } if (acceptableHigh !== undefined) {
        return userAnswerNumber <= acceptableHigh;
      }
    }

    return String(responseUserAnswer) === String(responseCorrectAnswer) || Number(responseUserAnswer) === Number(responseCorrectAnswer);
  }

  // Checkbox and dropdown answers ignore selection order; ranking answers do not.
  if (Array.isArray(responseUserAnswer) && Array.isArray(responseCorrectAnswer)) {
    return compareResponseValues(responseUserAnswer, responseCorrectAnswer, 'equals', {
      ignoreArrayOrder: options.ignoreArrayOrder ?? true,
    });
  }

  // Handle array of object (e.g. matrix-radio and matrix-checkbox)
  if (responseUserAnswer !== null && typeof responseUserAnswer === 'object' && !Array.isArray(responseUserAnswer) && Array.isArray(responseCorrectAnswer)) {
    const userAnswerArray = Object.values(responseUserAnswer);

    if (userAnswerArray.length !== responseCorrectAnswer.length) return false;

    // Check matrix-checkbox
    const isMatrixCheckbox = Array.isArray(responseCorrectAnswer[0]);
    if (isMatrixCheckbox) {
      return userAnswerArray.every((userVal, idx) => {
        const correctVal = responseCorrectAnswer[idx];
        if (!Array.isArray(correctVal)) return false;

        const userValArray = typeof userVal === 'string' ? (userVal === '' ? [] : userVal.split('|')) : [];
        if (userValArray.length !== correctVal.length) return false;

        const sortedUserAnswer = [...userValArray].sort();
        const sortedCorrectAnswer = [...correctVal].sort();
        return sortedUserAnswer.every((val, i) => val === sortedCorrectAnswer[i]);
      });
    }

    return userAnswerArray.every((val, idx) => String(val) === String(responseCorrectAnswer[idx]));
  }

  return compareResponseValues(responseUserAnswer, responseCorrectAnswer, 'equals');
}

/** Return fractional correctness while preserving the existing comparison for unscored answers. */
export function scoreResponseAnswer(
  value: StoredAnswer['answer'][string] | undefined,
  correctAnswer: Answer,
  response?: Response,
  values: StoredAnswer['answer'] = {},
  customValidate?: CustomResponseValidate,
): number {
  if (value === undefined) return 0;

  const module = response?.path && response.type !== 'custom' ? getResponseFunctionModule(response.path) : null;
  if (response?.path && response.type !== 'custom' && !module) {
    throw new Error(`Unable to load response module at ${response.path}`);
  }
  const resolvedCustomValidate = response?.type === 'custom'
    ? customValidate ?? customResponseValidatorLookup?.(response)
    : undefined;
  const result = response?.type === 'custom' && resolvedCustomValidate
    ? resolvedCustomValidate(value as JsonValue | null, values, response as CustomResponse, correctAnswer.answer)
    : response && module?.validate
      ? module.validate(value, values, response, correctAnswer.answer)
      : null;
  if (result !== null) {
    if (typeof result === 'boolean') return Number(result);
    if (typeof result === 'number') {
      if (!Number.isFinite(result) || result < 0 || result > 1) {
        throw new Error(`Validation function at ${response?.path} must return a score between 0 and 1`);
      }
      return result;
    }
    if (typeof result === 'string') return 0;
  }

  return Number(responseAnswerIsCorrect(
    value,
    correctAnswer.answer,
    correctAnswer.acceptableLow,
    correctAnswer.acceptableHigh,
    { ignoreArrayOrder: shouldIgnoreArrayOrder(response) },
  ));
}
