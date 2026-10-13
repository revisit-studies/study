import isEqual from 'lodash.isequal';
import {
  Answer, MatrixCheckboxResponse, Response, StoredAnswer, ValueCondition,
} from '../parser/types';
import { parseStringOptionValue } from './stringOptions';

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

  return Object.fromEntries(questions.map((question, index) => {
    const selected = typeof userRows[question] === 'string' && userRows[question] !== ''
      ? (userRows[question] as string).split('|')
      : [];
    const expectedRows = answerSets.map((answerSet) => {
      if (Array.isArray(answerSet)) return answerSet[index];
      return answerSet && typeof answerSet === 'object' ? (answerSet as Record<string, unknown>)[question] : undefined;
    }).filter((value) => value !== undefined);
    const matchesExactly = expectedRows.some((expected) => (Array.isArray(expected)
      ? matrixCheckboxSelectionsAreEqual(userRows[question], expected)
      : isEqual(userRows[question], expected)));
    const matchesPartially = expectedRows.some((expected) => {
      const expectedValues = Array.isArray(expected)
        ? expected
        : typeof expected === 'string' && expected.includes('|') ? expected.split('|') : [expected];
      return selected.some((value) => expectedValues.includes(value));
    });
    return [question, matchesExactly ? 'correct' : matchesPartially ? 'partially correct' : 'incorrect'];
  }));
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
  responseUserAnswer: StoredAnswer['answer'][string] | undefined,
  responseCorrectAnswer: Answer['answer'],
  acceptableLow?: number,
  acceptableHigh?: number,
  options: { ignoreArrayOrder?: boolean; acceptableAnswers?: Answer['acceptableAnswers']; caseSensitive?: boolean } = {},
): boolean {
  if (responseUserAnswer === undefined) return false;
  if (options.acceptableAnswers?.some((answer) => responseAnswerIsCorrect(responseUserAnswer, answer, undefined, undefined, {
    ignoreArrayOrder: options.ignoreArrayOrder,
    caseSensitive: options.caseSensitive,
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
    const userAnswerArray = Object.values(responseUserAnswer);

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
