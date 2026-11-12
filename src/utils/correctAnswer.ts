import isEqual from 'lodash.isequal';
import { compareResponseValues } from './compareResponseValues';
import { parseStringOptionValue } from './stringOptions';
import {
  Answer, JsonValue, MatrixCheckboxResponse, Response, StoredAnswer,
} from '../parser/types';
import type { CheckAnswerState } from '../store/types';
import { getCustomResponseModule, getResponseCodeModule } from '../components/response/customResponseModules';
import { isResponseAnswered, isResponseDontKnowSelected } from './responseValue';

export { compareResponseValues } from './compareResponseValues';

export { isResponseAnswered, isResponseDontKnowSelected } from './responseValue';

type ResponseFunctionModule = {
  default?: unknown;
  validate?: (value: unknown, values: Record<string, unknown>, response: Response) => string | boolean | null;
  score?: (value: unknown, values: Record<string, unknown>, response: Response, expected?: unknown) => number | boolean | null;
};

export const RESPONSE_CORRECTNESS_THRESHOLD = 1;

function getCorrectAnswerBoundsError(answer: Answer, allowTemplate = false): string | undefined {
  const boundPairs = [
    ['acceptableLow', answer.acceptableLow, 'acceptableHigh', answer.acceptableHigh],
    ['lowestCorrect', answer.lowestCorrect, 'highestCorrect', answer.highestCorrect],
  ] as const;
  const hasBounds = boundPairs.some(([, low, , high]) => low !== undefined || high !== undefined);
  if (!hasBounds) return undefined;

  for (const [lowName, low, highName, high] of boundPairs) {
    if (low !== undefined && !Number.isFinite(low)) return `${lowName} must be a finite number`;
    if (high !== undefined && !Number.isFinite(high)) return `${highName} must be a finite number`;
    if (low !== undefined && high !== undefined && low > high) {
      return `${lowName} cannot be greater than ${highName}`;
    }
  }

  if (answer.answer === undefined) return undefined;
  if (allowTemplate && typeof answer.answer === 'string' && /\{\{\s*[A-Za-z_][\w-]*\s*\}\}/.test(answer.answer)) return undefined;
  const numericAnswer = typeof answer.answer === 'number'
    ? Number.isFinite(answer.answer) ? answer.answer : undefined
    : typeof answer.answer === 'string' && answer.answer.trim() !== '' && Number.isFinite(Number(answer.answer))
      ? Number(answer.answer)
      : undefined;
  if (numericAnswer === undefined) return 'answer must be a finite number when numeric bounds are set';

  for (const [lowName, low, highName, high] of boundPairs) {
    if (low !== undefined && numericAnswer < low) return `answer must be greater than or equal to ${lowName} (${low})`;
    if (high !== undefined && numericAnswer > high) return `answer must be less than or equal to ${highName} (${high})`;
  }
  return undefined;
}

export function getCorrectAnswerConfigError(answer: Answer, allowTemplate = false): string | undefined {
  const hasAnswer = answer.answer !== undefined;
  const hasAlmostCorrectBounds = answer.acceptableLow !== undefined || answer.acceptableHigh !== undefined;
  const hasCorrectBounds = answer.lowestCorrect !== undefined || answer.highestCorrect !== undefined;
  if ((!hasAnswer && !answer.acceptableAnswers?.length && !hasCorrectBounds)
    || (hasAlmostCorrectBounds && !hasAnswer)) {
    return 'A correctAnswer must define an answer, a non-empty acceptableAnswers list, or a lowestCorrect/highestCorrect numeric bound; acceptableLow/acceptableHigh require a numeric answer';
  }
  return getCorrectAnswerBoundsError(answer, allowTemplate);
}

export function answerSnapshotMatches(
  checkAnswer: Pick<CheckAnswerState, 'answerSnapshot'> | undefined,
  answer: StoredAnswer['answer'],
) {
  return !!checkAnswer?.answerSnapshot && isEqual(checkAnswer.answerSnapshot, answer);
}

export function getSavedScoresForAnswer(
  checkAnswer: Pick<CheckAnswerState, 'answerSnapshot' | 'scores'> | undefined,
  answer: StoredAnswer['answer'],
) {
  return answerSnapshotMatches(checkAnswer, answer) ? checkAnswer?.scores : undefined;
}

export function hasSavedScores(checkAnswer?: Pick<CheckAnswerState, 'scores'>) {
  return Object.keys(checkAnswer?.scores ?? {}).length > 0;
}

export function normalizeResponseValue(response: Response | undefined, value: unknown): unknown {
  return response?.type === 'numerical'
    && typeof value === 'string'
    && value.trim() !== ''
    && Number.isFinite(Number(value))
    ? Number(value)
    : value;
}

export function isResponseScoreCorrect(score: number | null, threshold = RESPONSE_CORRECTNESS_THRESHOLD): boolean | null {
  return score === null ? null : score >= threshold;
}

export function getResponseFunctionModule(path: string): ResponseFunctionModule | null {
  return getResponseCodeModule(path) as unknown as ResponseFunctionModule | null;
}

export function hasResponseScorer(response?: Response): boolean {
  if (!response?.path) return false;
  const module = response.type === 'custom'
    ? getCustomResponseModule(response)
    : getResponseFunctionModule(response.path);
  return typeof module?.score === 'function';
}

export function isResponseScorerUnavailable(response?: Response): boolean {
  if (!response?.path) return false;
  return response.type === 'custom'
    ? !getCustomResponseModule(response)
    : !getResponseFunctionModule(response.path);
}

export function isResponseAnsweredForScoring(
  response: Response | undefined,
  value: unknown,
  values: StoredAnswer['answer'] = {},
): boolean {
  return !isResponseDontKnowSelected(response, values) && isResponseAnswered(value);
}

export function isRequiredResponseUngraded(response: Response, value: unknown, values: StoredAnswer['answer'] = {}): boolean {
  return response.required !== false
    && (hasResponseScorer(response) || isResponseScorerUnavailable(response))
    && !isResponseAnsweredForScoring(response, value, values);
}

export function getResponseScoreResultError(result: unknown, path: string): string | null {
  if (typeof result === 'number' && (!Number.isFinite(result) || result < 0 || result > 1)) {
    return `Score function at ${path} must return a score between 0 and 1`;
  }
  if (result !== null && typeof result !== 'boolean' && typeof result !== 'number') {
    return `Score function at ${path} must return a number, boolean, or null`;
  }
  return null;
}

export function getResponseValidationResultError(result: unknown, path: string): string | null {
  if (result !== null && result !== '' && typeof result !== 'string' && typeof result !== 'boolean') {
    return `Validation function at ${path} must return a string, boolean, or null`;
  }
  return null;
}

export type AnswerStatus = 'correct' | 'almost correct' | 'incorrect' | 'partially correct';

export function evaluateSelectionAnswer(
  userAnswer: unknown,
  correctAnswer: unknown,
  acceptableAnswers: unknown[] = [],
): AnswerStatus {
  const selected = Array.isArray(userAnswer)
    ? userAnswer
    : typeof userAnswer === 'string' && userAnswer !== '' ? userAnswer.split('|') : [];
  const correctAnswers = [correctAnswer, ...acceptableAnswers].filter(Array.isArray) as unknown[][];
  const statuses = correctAnswers.map((correctValues) => {
    if (isEqual([...selected].sort(), [...correctValues].sort())) return 'correct';
    const matched = selected.filter((value) => correctValues.includes(value));
    if (matched.length === 0) return 'incorrect';
    return 'partially correct';
  });

  return statuses.includes('correct')
    ? 'correct'
    : statuses.includes('partially correct') ? 'partially correct' : 'incorrect';
}

function matrixCheckboxSelectionsAreEqual(userAnswer: unknown, correctAnswer: unknown[]): boolean {
  const selected = typeof userAnswer === 'string' && userAnswer !== '' ? userAnswer.split('|') : [];
  if (selected.length !== correctAnswer.length) return false;
  const sortedSelected = [...selected].sort();
  const sortedCorrect = [...correctAnswer].sort();
  return sortedSelected.every((value, index) => value === sortedCorrect[index]);
}

export function getMatrixCheckboxRowStatuses(
  response: MatrixCheckboxResponse,
  userAnswer: unknown,
  correctAnswer: Answer,
): Record<string, AnswerStatus> {
  const questions = response.questionOptions.map(parseStringOptionValue);
  const userRows = userAnswer && typeof userAnswer === 'object' && !Array.isArray(userAnswer)
    ? userAnswer as Record<string, unknown>
    : {};
  const answerSets = [correctAnswer.answer, ...(correctAnswer.acceptableAnswers ?? [])];

  let bestStatuses: AnswerStatus[] = [];
  let bestCorrectCount = -1;
  let bestPartialCount = -1;

  answerSets.forEach((answerSet) => {
    const statuses: AnswerStatus[] = questions.map((question, index) => {
      const selected = typeof userRows[question] === 'string' && userRows[question] !== ''
        ? (userRows[question] as string).split('|')
        : [];
      if (Array.isArray(answerSet)) {
        const expected = answerSet[index];
        if (expected === undefined) return 'incorrect';
        if (!Array.isArray(answerSet[0]) && String(userRows[question]) === String(expected)) return 'correct';
        if (Array.isArray(expected) && matrixCheckboxSelectionsAreEqual(userRows[question], expected)) return 'correct';
        const expectedValues = Array.isArray(expected)
          ? expected
          : typeof expected === 'string' && expected.includes('|') ? expected.split('|') : [expected];
        return selected.some((value) => expectedValues.includes(value)) ? 'partially correct' : 'incorrect';
      }
      const expected = answerSet && typeof answerSet === 'object'
        ? (answerSet as Record<string, unknown>)[question]
        : undefined;
      if (expected === undefined) return 'incorrect';
      if (Array.isArray(expected) ? matrixCheckboxSelectionsAreEqual(userRows[question], expected) : isEqual(userRows[question], expected)) return 'correct';
      const expectedValues = Array.isArray(expected)
        ? expected
        : typeof expected === 'string' && expected.includes('|') ? expected.split('|') : [expected];
      return selected.some((value) => expectedValues.includes(value)) ? 'partially correct' : 'incorrect';
    });
    const correctCount = statuses.filter((status) => status === 'correct').length;
    const partialCount = statuses.filter((status) => status === 'partially correct').length;
    if (correctCount > bestCorrectCount || (correctCount === bestCorrectCount && partialCount > bestPartialCount)) {
      bestStatuses = statuses;
      bestCorrectCount = correctCount;
      bestPartialCount = partialCount;
    }
  });

  return Object.fromEntries(questions.map((question, index) => [question, bestStatuses[index] ?? 'incorrect']));
}

export function shouldIgnoreArrayOrder(response?: Response) {
  return response?.type === 'checkbox' || response?.type === 'dropdown';
}

export function getMatrixQuestionIds(response?: Response): string[] | undefined {
  return response?.type === 'matrix-checkbox' || response?.type === 'matrix-radio'
    ? response.questionOptions.map(parseStringOptionValue)
    : undefined;
}

/** Describe the configured answer and any correctness ranges. */
export function getCorrectAnswerDisplayValue(rule?: Answer): unknown {
  if (!rule) return undefined;
  const {
    answer, acceptableAnswers, lowestCorrect, highestCorrect, acceptableLow, acceptableHigh,
  } = rule;
  const hasAdditionalRules = acceptableAnswers !== undefined
    || lowestCorrect !== undefined
    || highestCorrect !== undefined
    || acceptableLow !== undefined
    || acceptableHigh !== undefined;
  if (answer !== undefined && !hasAdditionalRules) return answer;
  if (answer === undefined && acceptableAnswers !== undefined
    && lowestCorrect === undefined && highestCorrect === undefined
    && acceptableLow === undefined && acceptableHigh === undefined) return acceptableAnswers;
  if (!hasAdditionalRules && answer === undefined) return undefined;
  return {
    ...(answer !== undefined ? { answer } : {}),
    ...(acceptableAnswers !== undefined ? { acceptableAnswers } : {}),
    ...(lowestCorrect !== undefined ? { lowestCorrect } : {}),
    ...(highestCorrect !== undefined ? { highestCorrect } : {}),
    ...(acceptableLow !== undefined ? { acceptableLow } : {}),
    ...(acceptableHigh !== undefined ? { acceptableHigh } : {}),
  };
}

function numericAnswerIsInRange(value: unknown, lowest?: number, highest?: number): boolean {
  if (lowest === undefined && highest === undefined) return false;
  if ((typeof value !== 'number' && typeof value !== 'string')
    || String(value).trim() === '') return false;
  const numericValue = Number(value);
  return Number.isFinite(numericValue)
    && (lowest === undefined || numericValue >= lowest)
    && (highest === undefined || numericValue <= highest);
}

function responseAnswerMatchesValue(
  responseUserAnswer: Exclude<StoredAnswer['answer'][string], undefined>,
  responseCorrectAnswer: Answer['answer'],
  options: {
    ignoreArrayOrder?: boolean;
    caseSensitive?: boolean;
    matrixQuestionIds?: string[];
  },
): boolean {
  if (typeof responseUserAnswer === 'string' && typeof responseCorrectAnswer === 'string') {
    const stringMatches = options.caseSensitive === false
      ? responseUserAnswer.toLowerCase() === responseCorrectAnswer.toLowerCase()
      : responseUserAnswer === responseCorrectAnswer;
    if (stringMatches) return true;
    const userAnswerNumber = Number(responseUserAnswer);
    const correctAnswerNumber = Number(responseCorrectAnswer);
    return responseUserAnswer.trim() !== ''
      && responseCorrectAnswer.trim() !== ''
      && Number.isFinite(userAnswerNumber)
      && Number.isFinite(correctAnswerNumber)
      && userAnswerNumber === correctAnswerNumber;
  }

  if ((typeof responseUserAnswer === 'number' || typeof responseUserAnswer === 'string')
    && (typeof responseCorrectAnswer === 'string' || typeof responseCorrectAnswer === 'number')) {
    const userAnswerNumber = Number(responseUserAnswer);
    const hasNumericAnswer = Number.isFinite(userAnswerNumber) && String(responseUserAnswer).trim() !== '';
    return String(responseUserAnswer) === String(responseCorrectAnswer)
      || (hasNumericAnswer && String(responseCorrectAnswer).trim() !== '' && userAnswerNumber === Number(responseCorrectAnswer));
  }

  if (Array.isArray(responseUserAnswer) && Array.isArray(responseCorrectAnswer)) {
    return compareResponseValues(responseUserAnswer, responseCorrectAnswer, 'equals', {
      ignoreArrayOrder: options.ignoreArrayOrder ?? true,
    });
  }

  if (responseUserAnswer !== null && typeof responseUserAnswer === 'object'
    && !Array.isArray(responseUserAnswer) && Array.isArray(responseCorrectAnswer)) {
    const userAnswerObject = responseUserAnswer as Record<string, unknown>;
    const userAnswerArray = options.matrixQuestionIds
      ? options.matrixQuestionIds.map((questionId) => userAnswerObject[questionId])
      : Object.values(userAnswerObject);

    if (options.matrixQuestionIds && (
      Object.keys(userAnswerObject).length !== options.matrixQuestionIds.length
      || options.matrixQuestionIds.some((questionId) => !Object.prototype.hasOwnProperty.call(userAnswerObject, questionId))
    )) return false;

    if (userAnswerArray.length !== responseCorrectAnswer.length) return false;

    const isMatrixCheckbox = Array.isArray(responseCorrectAnswer[0]);
    if (isMatrixCheckbox) {
      return userAnswerArray.every((userVal, idx) => {
        const correctVal = responseCorrectAnswer[idx];
        return Array.isArray(correctVal) && matrixCheckboxSelectionsAreEqual(userVal, correctVal);
      });
    }

    return userAnswerArray.every((val, idx) => String(val) === String(responseCorrectAnswer[idx]));
  }

  return compareResponseValues(responseUserAnswer, responseCorrectAnswer, 'equals');
}

export function responseAnswerIsCorrect(
  responseUserAnswer: StoredAnswer['answer'][string] | undefined,
  responseCorrectAnswer: Answer['answer'],
  lowestCorrect?: number,
  highestCorrect?: number,
  options: {
    ignoreArrayOrder?: boolean;
    acceptableAnswers?: Answer['acceptableAnswers'];
    acceptableLow?: number;
    acceptableHigh?: number;
    caseSensitive?: boolean;
    matrixQuestionIds?: string[];
  } = {},
): boolean {
  if (responseUserAnswer === undefined) return false;
  if (options.acceptableAnswers?.some((answer) => responseAnswerIsCorrect(responseUserAnswer, answer, undefined, undefined, {
    ignoreArrayOrder: options.ignoreArrayOrder,
    caseSensitive: options.caseSensitive,
    matrixQuestionIds: options.matrixQuestionIds,
  }))) return true;

  if (numericAnswerIsInRange(responseUserAnswer, lowestCorrect, highestCorrect)) return true;
  if (responseCorrectAnswer === undefined) return false;
  const exact = responseAnswerMatchesValue(responseUserAnswer, responseCorrectAnswer, options);
  const almostRange = numericAnswerIsInRange(responseUserAnswer, options.acceptableLow, options.acceptableHigh);
  if (exact) return true;
  return almostRange;
}

export function responseAnswerIsAlmostCorrect(
  responseUserAnswer: StoredAnswer['answer'][string] | undefined,
  correctAnswer: Answer | undefined,
  options: {
    ignoreArrayOrder?: boolean;
    acceptableAnswers?: Answer['acceptableAnswers'];
    caseSensitive?: boolean;
    matrixQuestionIds?: string[];
  } = {},
): boolean {
  if (!correctAnswer || correctAnswer.answer === undefined
    || (correctAnswer.acceptableLow === undefined && correctAnswer.acceptableHigh === undefined)
    || !numericAnswerIsInRange(responseUserAnswer, correctAnswer.acceptableLow, correctAnswer.acceptableHigh)) {
    return false;
  }
  return !responseAnswerIsCorrect(
    responseUserAnswer,
    correctAnswer.answer,
    correctAnswer.lowestCorrect,
    correctAnswer.highestCorrect,
    {
      ...options,
      acceptableAnswers: correctAnswer.acceptableAnswers,
    },
  );
}

export type ResponseAnswerScoreResult = { score: number | null; error: boolean };

/** Return a score and distinguish a valid ungraded result from a failed scoring configuration. */
export function scoreResponseAnswerWithStatus(
  value: StoredAnswer['answer'][string] | undefined,
  correctAnswer: Answer | undefined,
  response?: Response,
  values: StoredAnswer['answer'] = {},
): ResponseAnswerScoreResult {
  const module = response?.path && response.type !== 'custom' ? getResponseFunctionModule(response.path) : null;
  const customModule = response?.type === 'custom' && response.path ? getCustomResponseModule(response) : null;
  if (response?.path && response.type === 'custom' && !customModule) {
    console.error(`Unable to load custom response module at ${response.path}`);
    return { score: null, error: true };
  }
  if (response?.path && response.type !== 'custom' && !module) {
    console.error(`Unable to load response module at ${response.path}`);
    return { score: null, error: true };
  }
  let scoreFunction: ((currentValue: unknown) => unknown) | undefined;
  if (response?.type === 'custom') {
    const customScorer = customModule?.score;
    if (customScorer) {
      scoreFunction = (currentValue: unknown) => customScorer(
        currentValue as JsonValue | null,
        values,
        response,
        correctAnswer?.answer,
      );
    }
  } else if (module && response) {
    if (module.score) scoreFunction = (currentValue: unknown) => module.score?.(currentValue, values, response, correctAnswer?.answer);
  }
  if (value === undefined) {
    return { score: correctAnswer ? 0 : null, error: false };
  }
  const scoringValue = normalizeResponseValue(response, value);
  if (!isResponseAnsweredForScoring(response, value, values)) {
    const gradingValue = isResponseDontKnowSelected(response, values) ? null : value;
    if (!correctAnswer) {
      return { score: null, error: false };
    }
    return {
      score: Number(responseAnswerIsCorrect(
        gradingValue,
        correctAnswer.answer,
        correctAnswer.lowestCorrect,
        correctAnswer.highestCorrect,
        {
          ignoreArrayOrder: shouldIgnoreArrayOrder(response),
          acceptableAnswers: correctAnswer.acceptableAnswers,
          acceptableLow: correctAnswer.acceptableLow,
          acceptableHigh: correctAnswer.acceptableHigh,
          caseSensitive: correctAnswer.caseSensitive,
          matrixQuestionIds: getMatrixQuestionIds(response),
        },
      )),
      error: false,
    };
  }
  let result: unknown = null;
  try {
    result = scoreFunction ? scoreFunction(scoringValue) : null;
  } catch (error) {
    console.error(`Validation function at ${response?.path} failed`, error);
    return { score: null, error: true };
  }
  const resultError = getResponseScoreResultError(result, response?.path ?? 'unknown path');
  if (resultError) {
    console.error(resultError);
    return { score: null, error: true };
  }
  if (result !== null) {
    if (typeof result === 'boolean') return { score: Number(result), error: false };
    if (typeof result === 'number') return { score: result, error: false };
  }

  if (!correctAnswer) {
    return { score: null, error: false };
  }

  return {
    score: Number(responseAnswerIsCorrect(
      value,
      correctAnswer.answer,
      correctAnswer.lowestCorrect,
      correctAnswer.highestCorrect,
      {
        ignoreArrayOrder: shouldIgnoreArrayOrder(response),
        acceptableAnswers: correctAnswer.acceptableAnswers,
        acceptableLow: correctAnswer.acceptableLow,
        acceptableHigh: correctAnswer.acceptableHigh,
        caseSensitive: correctAnswer.caseSensitive,
        matrixQuestionIds: getMatrixQuestionIds(response),
      },
    )),
    error: false,
  };
}

/** Return fractional correctness, or null when the response has no grade. */
export function scoreResponseAnswer(
  value: StoredAnswer['answer'][string] | undefined,
  correctAnswer: Answer | undefined,
  response?: Response,
  values: StoredAnswer['answer'] = {},
): number | null {
  return scoreResponseAnswerWithStatus(value, correctAnswer, response, values).score;
}
