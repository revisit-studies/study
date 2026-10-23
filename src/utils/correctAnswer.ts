import isEqual from 'lodash.isequal';
import { parseStringOptionValue } from './stringOptions';
import {
  Answer, JsonValue, MatrixCheckboxResponse, Response, StoredAnswer, ValueCondition,
} from '../parser/types';
import type { CheckAnswerState } from '../store/types';
import { getCustomResponseModule, getResponseCodeModule } from '../components/response/customResponseModules';

type ResponseFunctionModule = {
  default?: unknown;
  validate?: (value: unknown, values: Record<string, unknown>, response: Response) => string | boolean | null;
  score?: (value: unknown, values: Record<string, unknown>, response: Response, expected?: unknown) => number | boolean | null;
};

export const RESPONSE_CORRECTNESS_THRESHOLD = 1;

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

export function isResponseAnswered(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0 && value.some(isResponseAnswered);
  if (typeof value === 'object') {
    const values = Object.values(value);
    return values.length > 0 && values.some(isResponseAnswered);
  }
  return true;
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

export function isResponseDontKnowSelected(response: Response | undefined, values: StoredAnswer['answer']): boolean {
  return !!response?.withDontKnow
    && response.type !== 'matrix-radio'
    && response.type !== 'matrix-checkbox'
    && !!values[`${response.id}-dontKnow`];
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

export type AnswerStatus = 'correct' | 'incorrect' | 'partially correct';

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

export function getMatrixQuestionIds(response?: Response): string[] | undefined {
  return response?.type === 'matrix-checkbox' || response?.type === 'matrix-radio'
    ? response.questionOptions.map(parseStringOptionValue)
    : undefined;
}

/** Use the complete accepted rule when no preferred exact answer is configured. */
export function getCorrectAnswerDisplayValue(rule?: Answer): unknown {
  if (rule?.answer !== undefined) return rule.answer;
  const { acceptableAnswers, acceptableLow, acceptableHigh } = rule ?? {};
  if (acceptableAnswers === undefined && acceptableLow === undefined && acceptableHigh === undefined) return undefined;
  if (acceptableAnswers !== undefined && acceptableLow === undefined && acceptableHigh === undefined) return acceptableAnswers;
  return {
    ...(acceptableAnswers !== undefined ? { acceptableAnswers } : {}),
    ...(acceptableLow !== undefined ? { acceptableLow } : {}),
    ...(acceptableHigh !== undefined ? { acceptableHigh } : {}),
  };
}

export function responseAnswerIsCorrect(
  responseUserAnswer: StoredAnswer['answer'][string] | undefined,
  responseCorrectAnswer: Answer['answer'],
  acceptableLow?: number,
  acceptableHigh?: number,
  options: {
    ignoreArrayOrder?: boolean;
    acceptableAnswers?: Answer['acceptableAnswers'];
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

  // Numeric bounds define accepted answers independently of a preferred answer.
  if (acceptableLow !== undefined || acceptableHigh !== undefined) {
    if ((typeof responseUserAnswer !== 'number' && typeof responseUserAnswer !== 'string')
      || String(responseUserAnswer).trim() === '') return false;
    const value = Number(responseUserAnswer);
    return Number.isFinite(value)
      && (acceptableLow === undefined || value >= acceptableLow)
      && (acceptableHigh === undefined || value <= acceptableHigh);
  }

  if (responseCorrectAnswer === undefined) return false;

  if (typeof responseUserAnswer === 'string' && typeof responseCorrectAnswer === 'string') {
    const matchesText = options.caseSensitive === false
      ? responseUserAnswer.toLowerCase() === responseCorrectAnswer.toLowerCase()
      : responseUserAnswer === responseCorrectAnswer;
    if (matchesText) return true;
  }

  // Handle numeric-string comparison for likert and slider responses.
  if ((typeof responseUserAnswer === 'number' || typeof responseUserAnswer === 'string')
    && (typeof responseCorrectAnswer === 'string' || typeof responseCorrectAnswer === 'number')) {
    const userAnswerNumber = Number(responseUserAnswer);
    const hasNumericAnswer = Number.isFinite(userAnswerNumber) && String(responseUserAnswer).trim() !== '';
    return String(responseUserAnswer) === String(responseCorrectAnswer)
      || (hasNumericAnswer && String(responseCorrectAnswer).trim() !== '' && userAnswerNumber === Number(responseCorrectAnswer));
  }

  // Checkbox and dropdown answers ignore selection order; ranking answers do not.
  if (Array.isArray(responseUserAnswer) && Array.isArray(responseCorrectAnswer)) {
    return compareResponseValues(responseUserAnswer, responseCorrectAnswer, 'equals', {
      ignoreArrayOrder: options.ignoreArrayOrder ?? true,
    });
  }

  // Handle array of object (e.g. matrix-radio and matrix-checkbox)
  if (responseUserAnswer !== null && typeof responseUserAnswer === 'object' && !Array.isArray(responseUserAnswer) && Array.isArray(responseCorrectAnswer)) {
    const userAnswerObject = responseUserAnswer as Record<string, unknown>;
    const userAnswerArray = options.matrixQuestionIds
      ? options.matrixQuestionIds.map((questionId) => userAnswerObject[questionId])
      : Object.values(userAnswerObject);

    if (options.matrixQuestionIds && (
      Object.keys(userAnswerObject).length !== options.matrixQuestionIds.length
      || options.matrixQuestionIds.some((questionId) => !Object.prototype.hasOwnProperty.call(userAnswerObject, questionId))
    )) return false;

    if (userAnswerArray.length !== responseCorrectAnswer.length) return false;

    // Check matrix-checkbox
    const isMatrixCheckbox = Array.isArray(responseCorrectAnswer[0]);
    if (isMatrixCheckbox) {
      return userAnswerArray.every((userVal, idx) => {
        const correctVal = responseCorrectAnswer[idx];
        if (!Array.isArray(correctVal)) return false;

        return matrixCheckboxSelectionsAreEqual(userVal, correctVal);
      });
    }

    return userAnswerArray.every((val, idx) => String(val) === String(responseCorrectAnswer[idx]));
  }

  return compareResponseValues(responseUserAnswer, responseCorrectAnswer, 'equals');
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
        correctAnswer.acceptableLow,
        correctAnswer.acceptableHigh,
        {
          ignoreArrayOrder: shouldIgnoreArrayOrder(response),
          acceptableAnswers: correctAnswer.acceptableAnswers,
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
      correctAnswer.acceptableLow,
      correctAnswer.acceptableHigh,
      {
        ignoreArrayOrder: shouldIgnoreArrayOrder(response),
        acceptableAnswers: correctAnswer.acceptableAnswers,
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
