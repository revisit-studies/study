import { describe, expect, test } from 'vitest';
import {
  Answer, Response, StoredAnswer,
} from '../../parser/types';
import { makeStoredAnswer } from '../../tests/utils';
import {
  compareResponseValues, evaluateSelectionAnswer, getMatrixCheckboxRowStatuses, getResponseScoreResultError, isResponseAnswered, isResponseScoreCorrect, responseAnswerIsCorrect, scoreResponseAnswer, scoreResponseAnswerWithStatus,
} from '../correctAnswer';

import { componentAnswersAreCorrect, getComponentAnswerStatus } from '../componentCorrectness';

type TestStoredAnswer = StoredAnswer['answer'][string];
type TestCorrectAnswer = Answer['answer'];

const asStoredAnswer = (value: TestStoredAnswer) => value;
const asCorrectAnswer = (value: TestCorrectAnswer) => value;

describe('correctAnswer utilities', () => {
  test.each([undefined, null, '', [], {}, { row: '' }, { row: [] }, { rows: { first: '', second: null } }])(
    'treats recursively empty values as unanswered: %j',
    (value) => expect(isResponseAnswered(value)).toBe(false),
  );

  test.each([{ row: 'selected' }, { rows: { first: '', second: 'selected' } }, ['selected']])(
    'recognizes values with at least one non-empty nested value: %j',
    (value) => expect(isResponseAnswered(value)).toBe(true),
  );

  test('custom response scoring uses the existing custom module validator', () => {
    const response: Response = {
      id: 'custom-score',
      type: 'custom',
      prompt: 'Score',
      path: 'test-response-functions/assets/CustomPartialScore.tsx',
    };

    expect(scoreResponseAnswer({ score: 5 }, { id: 'custom-score', answer: { score: 10 } }, response)).toBe(0.5);
  });

  test('custom responses without a scorer use ordinary equality', () => {
    const response: Response = {
      id: 'custom-card', type: 'custom', prompt: 'Card', path: 'demo-form-elements/assets/CustomResponseCard.tsx',
    };
    const answer = { chartType: 'bar', confidence: 80 };
    expect(scoreResponseAnswer(answer, { id: response.id, answer }, response, { [response.id]: answer })).toBe(1);
  });

  test('a study score module returns partial credit and full credit controls correctness', () => {
    const answer = { id: 'q', answer: 10 };
    const response: Response = {
      id: 'q', type: 'numerical', prompt: 'Score', path: 'test-response-functions/assets/PartialScore.response.ts',
    };
    expect(scoreResponseAnswer(5, answer, response, { q: 5 })).toBe(0.5);
    expect(scoreResponseAnswer(10, answer, response, { q: 10 })).toBe(1);
    expect(scoreResponseAnswer(undefined, answer, response)).toBe(0);
    expect(componentAnswersAreCorrect({ q: 5 }, [answer], [response])).toBe(false);
    expect(componentAnswersAreCorrect({ q: 10 }, [answer], [response])).toBe(true);
  });

  test('ordinary scoring preserves accepted answers, case rules, bounds, and matrix row order', () => {
    const textResponse: Response = { id: 'q', type: 'shortText', prompt: '' };
    const textAnswer: Answer = { id: 'q', acceptableAnswers: ['USA'], caseSensitive: false };
    expect(scoreResponseAnswer('usa', textAnswer, textResponse)).toBe(1);
    expect(scoreResponseAnswer('Canada', textAnswer, textResponse)).toBe(0);
    expect(componentAnswersAreCorrect({ q: 'usa' }, [textAnswer], [textResponse])).toBe(true);
    expect(scoreResponseAnswer(3, { id: 'q', acceptableLow: 1, acceptableHigh: 5 }, { id: 'q', type: 'numerical', prompt: '' })).toBe(1);

    const matrixResponse: Response = {
      id: 'q', type: 'matrix-checkbox', prompt: '', questionOptions: ['10', '2'], answerOptions: ['A', 'B'],
    };
    const matrixAnswer: Answer = { id: 'q', acceptableAnswers: [[['A'], ['B']]] };
    expect(scoreResponseAnswer({ 2: 'B', 10: 'A' }, matrixAnswer, matrixResponse)).toBe(1);
    expect(scoreResponseAnswer({ 2: 'A', 10: 'B' }, matrixAnswer, matrixResponse)).toBe(0);
  });

  test('built-in responses can use a custom component file as their scoring module', () => {
    const response: Response = {
      id: 'q', type: 'numerical', prompt: 'Score', path: 'test-response-functions/assets/CustomPartialScore.tsx',
    };
    expect(scoreResponseAnswer({ score: 5 }, { id: 'q', answer: { score: 10 } }, response)).toBe(0.5);
  });

  test('a response module can export score instead of validate', () => {
    const response: Response = {
      id: 'q', type: 'numerical', prompt: 'Score', path: 'test-response-functions/assets/GameScore.ts',
    };
    expect(scoreResponseAnswer(5, undefined, response)).toBe(0.5);
    expect(scoreResponseAnswer('10', undefined, response)).toBe(1);
  });

  test('a validation-only module does not score answers', () => {
    const response: Response = {
      id: 'q',
      type: 'numerical',
      prompt: 'Answer',
      path: 'test-response-functions/assets/EmptyStringValidation.response.ts',
    };
    expect(scoreResponseAnswer('accepted', { id: 'q', answer: 'accepted' }, response)).toBe(1);
    // A validation error does not alter grading; this module has no score export.
    expect(scoreResponseAnswer('other', { id: 'q', answer: 'other' }, response)).toBe(1);
  });

  test('the score slider awards credit by value range and applies an explicit 80% correctness threshold', () => {
    const response: Response = {
      id: 'slider',
      type: 'slider',
      prompt: 'Score',
      options: [],
      path: 'test-response-functions/assets/SliderScore.ts',
    };
    const answer = { id: 'slider', answer: 10 };
    [
      [10, 1], [9, 0.8], [7, 0.8], [6, 0.6], [5, 0.6], [4, 0.2], [3, 0], [0, 0],
    ].forEach(([value, expected]) => {
      expect(scoreResponseAnswer(value, answer, response)).toBe(expected);
    });
    expect(isResponseScoreCorrect(0.8)).toBe(false);
    expect(isResponseScoreCorrect(0.8, 0.8)).toBe(true);
    expect(isResponseScoreCorrect(0.79)).toBe(false);
    expect(isResponseScoreCorrect(0.7, 0.7)).toBe(true);
    expect(isResponseScoreCorrect(null)).toBeNull();
  });

  test('a selected I do not know flag ignores a populated default while grading', () => {
    const response: Response = {
      id: 'score', type: 'numerical', prompt: 'Score', path: 'test-response-functions/assets/GameScore.ts', withDontKnow: true,
    };
    const answers = { score: 10, 'score-dontKnow': true };
    expect(scoreResponseAnswerWithStatus(10, { id: 'score', answer: 10 }, response, answers)).toEqual({ score: 0, error: false });
    expect(scoreResponseAnswerWithStatus(10, undefined, response, answers)).toEqual({ score: null, error: false });
  });

  test('a study score module can score partial overlap for a built-in checkbox', () => {
    const response: Response = {
      id: 'fruit',
      type: 'checkbox',
      prompt: 'Select fruit',
      options: ['Apple', 'Banana', 'Carrot'],
      path: 'test-response-functions/assets/SelectionScore.response.ts',
    };
    const answer = { id: 'fruit', answer: ['Apple', 'Banana'] };

    expect(scoreResponseAnswer(['Apple', 'Carrot'], answer, response)).toBeCloseTo(1 / 3);
    expect(scoreResponseAnswer(['Apple', 'Banana'], answer, response)).toBe(1);
  });

  test('invalid or unavailable score modules return an unknown score', () => {
    expect(scoreResponseAnswer(5, { id: 'q', answer: 10 }, {
      id: 'q', type: 'numerical', prompt: '', path: 'missing.ts',
    })).toBeNull();
    expect(scoreResponseAnswer(
      { score: 5 },
      { id: 'custom-score', answer: { score: 10 } },
      {
        id: 'custom-score', type: 'custom', prompt: '', path: 'test-response-functions/assets/InvalidScore.tsx',
      },
    )).toBeNull();
    expect(getResponseScoreResultError(1.5, 'score.ts')).toBe('Score function at score.ts must return a score between 0 and 1');
  });

  describe('responseAnswerIsCorrect', () => {
    test('matches numeric and string values', () => {
      expect(responseAnswerIsCorrect(5, 5)).toBe(true);
      expect(responseAnswerIsCorrect('5', 5)).toBe(true);
      expect(responseAnswerIsCorrect(5, '5')).toBe(true);
      expect(responseAnswerIsCorrect('05', '5')).toBe(true);
      expect(responseAnswerIsCorrect('4', 5)).toBe(false);
    });

    test('matches textual answers case-insensitively only when configured', () => {
      expect(responseAnswerIsCorrect('usa', 'USA')).toBe(false);
      expect(responseAnswerIsCorrect('usa', 'USA', undefined, undefined, { caseSensitive: false })).toBe(true);
      expect(responseAnswerIsCorrect('uSa', undefined, undefined, undefined, {
        acceptableAnswers: ['USA'],
        caseSensitive: false,
      })).toBe(true);
    });

    test.each([
      [0, -1, 1, true], [-1, -1, 1, true], [1, -1, 1, true], [2, -1, 1, false],
      ['0', 0, undefined, true], [-1, 0, undefined, false],
      ['0', undefined, 0, true], [1, undefined, 0, false],
    ])('grades %s using only bounds %s and %s', (value, low, high, expected) => {
      expect(responseAnswerIsCorrect(value, undefined, low, high)).toBe(expected);
    });

    test('accepts list-only scalar and selection definitions', () => {
      expect(responseAnswerIsCorrect('US', undefined, undefined, undefined, { acceptableAnswers: ['USA', 'US'] })).toBe(true);
      expect(responseAnswerIsCorrect('Canada', undefined, undefined, undefined, { acceptableAnswers: ['USA', 'US'] })).toBe(false);
      expect(responseAnswerIsCorrect(['B', 'A'], undefined, undefined, undefined, { acceptableAnswers: [['A', 'B']] })).toBe(true);
      expect(responseAnswerIsCorrect(['A'], undefined, undefined, undefined, { acceptableAnswers: [['A', 'B']] })).toBe(false);
    });

    test('does not treat missing inputs or missing definitions as correct', () => {
      expect(responseAnswerIsCorrect(undefined, undefined)).toBe(false);
      expect(responseAnswerIsCorrect(0, undefined)).toBe(false);
      expect(responseAnswerIsCorrect(null, undefined)).toBe(false);
      expect(responseAnswerIsCorrect(undefined, undefined, undefined, undefined, { acceptableAnswers: [null] })).toBe(false);
    });

    test('accepts preferred and near-perfect values with ranges and one-sided bounds', () => {
      expect(responseAnswerIsCorrect(50, 50, 45, 55)).toBe(true);
      expect(responseAnswerIsCorrect(45, 50, 45, 55)).toBe(true);
      expect(responseAnswerIsCorrect(44, 50, 45, 55)).toBe(false);
      expect(responseAnswerIsCorrect(50, 50, 45)).toBe(true);
      expect(responseAnswerIsCorrect(46, 50, 45)).toBe(true);
      expect(responseAnswerIsCorrect(50, 50, undefined, 55)).toBe(true);
      expect(responseAnswerIsCorrect(54, 50, undefined, 55)).toBe(true);
    });

    test('supports acceptable range when numeric answer is provided', () => {
      expect(responseAnswerIsCorrect(8, 0, 7, 10)).toBe(true);
      expect(responseAnswerIsCorrect(6, 0, 7, 10)).toBe(false);
      expect(responseAnswerIsCorrect(11, 0, 7, 10)).toBe(false);
    });

    test('supports acceptable low-only and high-only bounds', () => {
      expect(responseAnswerIsCorrect(8, 0, 7)).toBe(true);
      expect(responseAnswerIsCorrect(6, 0, 7)).toBe(false);
      expect(responseAnswerIsCorrect(4, 0, undefined, 5)).toBe(true);
      expect(responseAnswerIsCorrect(6, 0, undefined, 5)).toBe(false);
    });

    test('supports zero-value acceptable bounds', () => {
      expect(responseAnswerIsCorrect(0, 5, 0, 2)).toBe(true);
      expect(responseAnswerIsCorrect(2, 5, 0, 2)).toBe(true);
      expect(responseAnswerIsCorrect(3, 5, 0, 2)).toBe(false);
      expect(responseAnswerIsCorrect(0, 5, 0)).toBe(true);
      expect(responseAnswerIsCorrect(-1, 5, 0)).toBe(false);
      expect(responseAnswerIsCorrect(0, 5, undefined, 0)).toBe(true);
      expect(responseAnswerIsCorrect(1, 5, undefined, 0)).toBe(false);
    });

    test('treats numeric strings consistently with acceptable bounds', () => {
      expect(responseAnswerIsCorrect('8', 0, 7, 10)).toBe(true);
      expect(responseAnswerIsCorrect('6', 0, 7, 10)).toBe(false);
    });

    test.each(['', ' ', 'not a number', Infinity, -Infinity, NaN, null, undefined])('rejects invalid numerical answers %s even with a zero or open bound', (value) => {
      expect(responseAnswerIsCorrect(value, 0, 0, 10)).toBe(false);
      expect(responseAnswerIsCorrect(value, 0, undefined, 10)).toBe(false);
      expect(responseAnswerIsCorrect(value, undefined, 0, 10)).toBe(false);
      expect(responseAnswerIsCorrect(value, undefined, undefined, 10)).toBe(false);
    });

    test('does not treat blank answers as an exact zero', () => {
      expect(responseAnswerIsCorrect('', 0)).toBe(false);
      expect(responseAnswerIsCorrect(' ', 0)).toBe(false);
    });

    test('accepts alternative scalar answers without losing the primary answer', () => {
      const options = { acceptableAnswers: ['four', 4] };
      expect(responseAnswerIsCorrect('IV', 'IV', undefined, undefined, options)).toBe(true);
      expect(responseAnswerIsCorrect('four', 'IV', undefined, undefined, options)).toBe(true);
      expect(responseAnswerIsCorrect('4', 'IV', undefined, undefined, options)).toBe(true);
      expect(responseAnswerIsCorrect('five', 'IV', undefined, undefined, options)).toBe(false);
    });

    test('combines numeric ranges and exact alternative answers', () => {
      const options = { acceptableAnswers: [20] };
      expect(responseAnswerIsCorrect(7, 8, 7, 10, options)).toBe(true);
      expect(responseAnswerIsCorrect(10, 8, 7, 10, options)).toBe(true);
      expect(responseAnswerIsCorrect(20, 8, 7, 10, options)).toBe(true);
      expect(responseAnswerIsCorrect(11, 8, 7, 10, options)).toBe(false);
    });

    test('treats each alternative array as a complete answer and preserves ranking order', () => {
      const options = { acceptableAnswers: [['c', 'd']], ignoreArrayOrder: true };
      expect(responseAnswerIsCorrect(['d', 'c'], ['a', 'b'], undefined, undefined, options)).toBe(true);
      expect(responseAnswerIsCorrect(['c'], ['a', 'b'], undefined, undefined, options)).toBe(false);
      expect(responseAnswerIsCorrect(['d', 'c'], ['a', 'b'], undefined, undefined, { ...options, ignoreArrayOrder: false })).toBe(false);
    });

    test('compares checkbox arrays ignoring order', () => {
      expect(responseAnswerIsCorrect(['b', 'a'], ['a', 'b'])).toBe(true);
      expect(responseAnswerIsCorrect(['a'], ['a', 'b'])).toBe(false);
      expect(responseAnswerIsCorrect(['a', 'c'], ['a', 'b'])).toBe(false);
    });

    test('can preserve array order when requested', () => {
      expect(responseAnswerIsCorrect(
        asStoredAnswer(['b', 'a']),
        asCorrectAnswer(['a', 'b']),
        undefined,
        undefined,
        { ignoreArrayOrder: false },
      )).toBe(false);
      expect(responseAnswerIsCorrect(
        asStoredAnswer(['a', 'b']),
        asCorrectAnswer(['a', 'b']),
        undefined,
        undefined,
        { ignoreArrayOrder: false },
      )).toBe(true);
    });

    test('handles duplicate checkbox options correctly', () => {
      expect(responseAnswerIsCorrect(['a', 'a', 'b'], ['b', 'a', 'a'])).toBe(true);
      expect(responseAnswerIsCorrect(['a', 'a', 'b'], ['a', 'b', 'b'])).toBe(false);
    });

    test('compares matrix-radio style object answers by index order', () => {
      const userAnswer = { row1: 'A', row2: 'B' };
      const correctAnswer = ['A', 'B'];
      const wrongAnswer = ['A', 'C'];

      expect(responseAnswerIsCorrect(
        asStoredAnswer(userAnswer),
        asCorrectAnswer(correctAnswer),
      )).toBe(true);
      expect(responseAnswerIsCorrect(
        asStoredAnswer(userAnswer),
        asCorrectAnswer(wrongAnswer),
      )).toBe(false);
    });

    test('compares matrix-checkbox style object answers as unordered sets per row', () => {
      const userAnswer = { row1: 'A|C', row2: 'B' };
      const correctAnswer = [['C', 'A'], ['B']];
      const wrongAnswer = [['C', 'A'], ['D']];

      expect(responseAnswerIsCorrect(
        asStoredAnswer(userAnswer),
        asCorrectAnswer(correctAnswer),
      )).toBe(true);
      expect(responseAnswerIsCorrect(
        asStoredAnswer(userAnswer),
        asCorrectAnswer(wrongAnswer),
      )).toBe(false);
    });

    test('treats empty matrix-checkbox row string as empty selection', () => {
      const userAnswer = { row1: '' };
      const correctAnswer = [[]];
      expect(responseAnswerIsCorrect(
        asStoredAnswer(userAnswer),
        asCorrectAnswer(correctAnswer),
      )).toBe(true);
    });

    test('returns false when matrix answer lengths do not match', () => {
      expect(responseAnswerIsCorrect(
        asStoredAnswer({ row1: 'A' }),
        asCorrectAnswer(['A', 'B']),
      )).toBe(false);
      expect(responseAnswerIsCorrect(
        asStoredAnswer({ row1: 'A', row2: 'B' }),
        asCorrectAnswer(['A']),
      )).toBe(false);
    });

    test('returns false for matrix-radio answers when row order does not match', () => {
      expect(responseAnswerIsCorrect(
        asStoredAnswer({ row1: 'B', row2: 'A' }),
        asCorrectAnswer(['A', 'B']),
      )).toBe(false);
    });

    test('falls back to deep equality for non-special types', () => {
      expect(responseAnswerIsCorrect(true, true)).toBe(true);
      expect(responseAnswerIsCorrect(true, false)).toBe(false);
      expect(responseAnswerIsCorrect(
        asStoredAnswer({ chartType: 'Bar', confidence: 80, rationale: 'Looks good' }),
        asCorrectAnswer({ chartType: 'Bar', confidence: 80, rationale: 'Looks good' }),
      )).toBe(true);
      expect(responseAnswerIsCorrect(
        asStoredAnswer(null),
        asCorrectAnswer(null),
      )).toBe(true);
      expect(responseAnswerIsCorrect(
        asStoredAnswer(null),
        asCorrectAnswer(undefined),
      )).toBe(false);
    });
  });

  describe('selection answer status', () => {
    test('distinguishes correct, incorrect, and partially correct selections', () => {
      expect(evaluateSelectionAnswer(['A', 'B'], ['A', 'B'])).toBe('correct');
      expect(evaluateSelectionAnswer(['C'], ['A', 'B'])).toBe('incorrect');
      expect(evaluateSelectionAnswer(['A', 'C'], ['A', 'B'])).toBe('partially correct');
      expect(evaluateSelectionAnswer(['A'], ['A', 'B'])).toBe('partially correct');
      expect(evaluateSelectionAnswer(['4', 'X'], [4])).toBe('incorrect');
    });

    test('accepts an empty selection when the correct selection is empty', () => {
      expect(evaluateSelectionAnswer([], [])).toBe('correct');
      expect(evaluateSelectionAnswer([], ['A'])).toBe('incorrect');
    });

    test('accepts an alternative complete selection', () => {
      expect(evaluateSelectionAnswer(['C'], ['A', 'B'], [['C']])).toBe('correct');
    });

    test('grades each matrix-checkbox row by its selected options', () => {
      expect(getMatrixCheckboxRowStatuses({
        type: 'matrix-checkbox',
        id: 'matrix',
        prompt: '',
        answerOptions: ['A', 'B', 'C'],
        questionOptions: ['row-1', { label: 'Row Two', value: 'row-2' }],
      }, {
        'row-1': 'A|C',
        'row-2': 'B',
      }, {
        id: 'matrix',
        answer: [['A', 'B'], ['B']],
      })).toEqual({
        'row-1': 'partially correct',
        'row-2': 'correct',
      });
    });

    test('uses one complete accepted matrix for all row feedback', () => {
      const response = {
        type: 'matrix-checkbox' as const,
        id: 'matrix',
        prompt: '',
        answerOptions: ['A', 'B'],
        questionOptions: ['row-1', 'row-2'],
      };
      const answer = {
        id: 'matrix',
        answer: [['A'], ['A']],
        acceptableAnswers: [[['B'], ['B']]],
      };

      expect(responseAnswerIsCorrect({ 'row-1': 'A', 'row-2': 'B' }, answer.answer, undefined, undefined, {
        acceptableAnswers: answer.acceptableAnswers,
      })).toBe(false);
      expect(getMatrixCheckboxRowStatuses(response, { 'row-1': 'A', 'row-2': 'B' }, answer)).toEqual({
        'row-1': 'correct',
        'row-2': 'incorrect',
      });
      expect(getMatrixCheckboxRowStatuses(response, { 'row-1': 'B', 'row-2': 'B' }, answer)).toEqual({
        'row-1': 'correct',
        'row-2': 'correct',
      });
    });

    test('accepts an empty matrix row when the correct row is empty', () => {
      expect(getMatrixCheckboxRowStatuses({
        type: 'matrix-checkbox',
        id: 'matrix',
        prompt: '',
        answerOptions: ['A', 'B'],
        questionOptions: ['row-1'],
      }, { 'row-1': '' }, {
        id: 'matrix',
        answer: [[]],
      })).toEqual({ 'row-1': 'correct' });
    });

    test('matches matrix row types using the canonical grader', () => {
      const response = {
        type: 'matrix-checkbox' as const,
        id: 'matrix',
        prompt: '',
        answerOptions: ['4'],
        questionOptions: ['row-1'],
      };
      const answer = { id: 'matrix', answer: [[4]] };

      expect(responseAnswerIsCorrect({ 'row-1': '4' }, answer.answer)).toBe(false);
      expect(getMatrixCheckboxRowStatuses(response, { 'row-1': '4' }, answer)).toEqual({ 'row-1': 'incorrect' });
    });

    test('matches flat matrix answers using the canonical grader string comparison', () => {
      const response = {
        type: 'matrix-checkbox' as const,
        id: 'matrix',
        prompt: '',
        answerOptions: ['4'],
        questionOptions: ['row-1'],
      };
      const userAnswer = { 'row-1': '4' };
      const answer = { id: 'matrix', answer: [4] };

      expect(responseAnswerIsCorrect(userAnswer, answer.answer)).toBe(true);
      expect(getMatrixCheckboxRowStatuses(response, userAnswer, answer)).toEqual({ 'row-1': 'correct' });
    });

    test('grades keyed matrix answers consistently with the canonical grader', () => {
      const response = {
        type: 'matrix-checkbox' as const,
        id: 'matrix',
        prompt: '',
        answerOptions: ['A', 'B'],
        questionOptions: ['cat', 'dog'],
      };
      const userAnswer = { cat: 'A', dog: 'B' };
      const answer = { id: 'matrix', answer: { cat: 'A', dog: 'B' } };

      expect(responseAnswerIsCorrect(userAnswer, answer.answer)).toBe(true);
      expect(getMatrixCheckboxRowStatuses(response, userAnswer, answer)).toEqual({ cat: 'correct', dog: 'correct' });
    });
  });

  describe('componentAnswersAreCorrect', () => {
    test('returns true when there are no correct answers configured', () => {
      expect(componentAnswersAreCorrect({ any: 'value' }, [])).toBe(true);
      expect(componentAnswersAreCorrect({ any: 'value' }, undefined)).toBe(true);
    });

    test('returns true only when all required answers are correct', () => {
      const userAnswers = { q1: 'A', q2: 5 };
      const correctAnswers = [
        { id: 'q1', answer: 'A' },
        { id: 'q2', answer: 5 },
      ];

      expect(componentAnswersAreCorrect(userAnswers, correctAnswers)).toBe(true);
      expect(componentAnswersAreCorrect({ ...userAnswers, q2: 4 }, correctAnswers)).toBe(false);
    });

    test('returns false when any required answer is missing', () => {
      const userAnswers = { q1: 'A' };
      const correctAnswers = [
        { id: 'q1', answer: 'A' },
        { id: 'q2', answer: 'B' },
      ];

      expect(componentAnswersAreCorrect(userAnswers, correctAnswers)).toBe(false);
    });

    test('returns false when one of several required answers is incorrect', () => {
      const userAnswers = { q1: 'A', q2: 'C', q3: 3 };
      const correctAnswers = [
        { id: 'q1', answer: 'A' },
        { id: 'q2', answer: 'B' },
        { id: 'q3', answer: 3 },
      ];

      expect(componentAnswersAreCorrect(userAnswers, correctAnswers)).toBe(false);
    });

    test('grades matrix rows in configured question order for integer-like IDs', () => {
      const response: Extract<Response, { type: 'matrix-checkbox' }> = {
        id: 'matrix',
        prompt: '',
        type: 'matrix-checkbox',
        answerOptions: ['A', 'B'],
        questionOptions: ['10', '2'],
      };
      const matrixUserAnswer = { 10: 'A', 2: 'B' };
      const userAnswer = { matrix: matrixUserAnswer };
      const correctAnswers = [{ id: 'matrix', answer: [['A'], ['B']] }];

      expect(responseAnswerIsCorrect(matrixUserAnswer, correctAnswers[0].answer)).toBe(false);
      expect(responseAnswerIsCorrect(matrixUserAnswer, correctAnswers[0].answer, undefined, undefined, { matrixQuestionIds: ['10', '2'] })).toBe(true);
      expect(componentAnswersAreCorrect(userAnswer, correctAnswers, [response])).toBe(true);
      expect(getMatrixCheckboxRowStatuses(response, matrixUserAnswer, correctAnswers[0])).toEqual({
        10: 'correct',
        2: 'correct',
      });
    });

    test('keeps configured row order when grading a list-only matrix alternative', () => {
      const response: Extract<Response, { type: 'matrix-checkbox' }> = {
        id: 'matrix',
        prompt: '',
        type: 'matrix-checkbox',
        answerOptions: ['A', 'B'],
        questionOptions: ['10', '2'],
      };
      const submitted = { 10: 'A', 2: 'B' };
      const correctAnswers: Answer[] = [{ id: 'matrix', acceptableAnswers: [[['A'], ['B']]] }];

      expect(responseAnswerIsCorrect(submitted, undefined, undefined, undefined, {
        acceptableAnswers: correctAnswers[0].acceptableAnswers,
        matrixQuestionIds: ['10', '2'],
      })).toBe(true);
      expect(componentAnswersAreCorrect({ matrix: submitted }, correctAnswers, [response])).toBe(true);
      expect(componentAnswersAreCorrect({ matrix: { 10: 'B', 2: 'A' } }, correctAnswers, [response])).toBe(false);
    });

    test('uses acceptable range settings from correct answer entries', () => {
      const userAnswers = { slider1: 8 };
      const correctAnswers = [
        {
          id: 'slider1',
          answer: 0,
          acceptableLow: 7,
          acceptableHigh: 10,
        },
      ];

      expect(componentAnswersAreCorrect(userAnswers, correctAnswers)).toBe(true);
      expect(componentAnswersAreCorrect({ slider1: 6 }, correctAnswers)).toBe(false);
    });

    test('uses alternative answers for component correctness', () => {
      const answers = [{ id: 'q1', answer: 'A', acceptableAnswers: ['B', 'C'] }];
      expect(componentAnswersAreCorrect({ q1: 'C' }, answers)).toBe(true);
      expect(componentAnswersAreCorrect({ q1: 'D' }, answers)).toBe(false);
    });

    test('supports mixed exact and ranged validations together', () => {
      const userAnswers = { q1: 'A', slider1: 9 };
      const correctAnswers = [
        { id: 'q1', answer: 'A' },
        {
          id: 'slider1',
          answer: 0,
          acceptableLow: 7,
          acceptableHigh: 10,
        },
      ];

      expect(componentAnswersAreCorrect(userAnswers, correctAnswers)).toBe(true);
      expect(componentAnswersAreCorrect({ q1: 'A', slider1: 11 }, correctAnswers)).toBe(false);
    });

    test('preserves order for custom arrays when response definitions are provided', () => {
      const userAnswers = { customSequence: ['B', 'A'] };
      const correctAnswers = [{ id: 'customSequence', answer: ['A', 'B'] }];
      const responses: Response[] = [{
        id: 'customSequence',
        prompt: 'Order the items',
        type: 'custom',
        path: 'libraries/test/assets/test.tsx',
      }];

      expect(componentAnswersAreCorrect(userAnswers, correctAnswers, responses)).toBe(false);
      expect(componentAnswersAreCorrect({ customSequence: ['A', 'B'] }, correctAnswers, responses)).toBe(true);
    });
  });

  describe('getComponentAnswerStatus', () => {
    test('returns null for missing, incomplete, and unanswered components', () => {
      expect(getComponentAnswerStatus(undefined, [])).toBeNull();
      expect(getComponentAnswerStatus(makeStoredAnswer({
        answer: { q1: 'A' },
        endTime: -1,
      }), [])).toBeNull();
      expect(getComponentAnswerStatus(makeStoredAnswer({
        answer: {},
        endTime: 100,
      }), [])).toBeNull();
    });

    test('returns unknown for a completed submitted response without correct answers', () => {
      expect(getComponentAnswerStatus(makeStoredAnswer({
        answer: { q1: 'A' },
        endTime: 100,
      }), [])).toBe('unknown');
    });

    test('returns correct or incorrect when correct answers are configured', () => {
      const componentAnswer = makeStoredAnswer({
        answer: { q1: 'A', notes: 'Participant explanation' },
        endTime: 100,
      });
      const correctAnswers = [{ id: 'q1', answer: 'A' }];

      expect(getComponentAnswerStatus(componentAnswer, correctAnswers)).toBe('correct');
      expect(getComponentAnswerStatus(
        { ...componentAnswer, answer: { ...componentAnswer.answer, q1: 'B' } },
        correctAnswers,
      )).toBe('incorrect');
    });
  });
});

test('equality preserves numeric-looking text and value types', () => {
  expect(compareResponseValues('01', '1', 'equals')).toBe(false);
  expect(compareResponseValues('21', 21, 'equals')).toBe(false);
  expect(compareResponseValues('01', '1', 'doesNotEqual')).toBe(true);
  expect(compareResponseValues('01', '01', 'equals')).toBe(true);
});

test('array equality ignores order only when requested', () => {
  expect(compareResponseValues(['a', 'b'], ['b', 'a'], 'equals')).toBe(false);
  expect(compareResponseValues(['a', 'b'], ['b', 'a'], 'equals', { ignoreArrayOrder: true })).toBe(true);
  expect(compareResponseValues(['a'], ['a', 'b'], 'equals', { ignoreArrayOrder: true })).toBe(false);
});

test('numeric comparisons reject non-numeric and non-finite values', () => {
  expect(compareResponseValues('20', 21, 'lessThan')).toBe(false);
  expect(compareResponseValues(null, 21, 'lessThan')).toBe(false);
  expect(compareResponseValues(Infinity, 21, 'greaterThan')).toBe(false);
  expect(compareResponseValues(20, 21, 'lessThan')).toBe(true);
});

test('text comparisons do not convert non-string inputs', () => {
  expect(compareResponseValues(21, '2', 'contains')).toBe(false);
  expect(compareResponseValues('21', '2', 'contains')).toBe(true);
  expect(compareResponseValues('21', '^2', 'matchesRegex')).toBe(true);
  expect(compareResponseValues('21', '[', 'matchesRegex')).toBe(false);
});
