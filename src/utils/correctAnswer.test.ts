import {
  describe, it, expect, beforeEach,
} from 'vitest';
import { responseAnswerIsCorrect, componentAnswersAreCorrect } from './correctAnswer';

describe('correctAnswer.ts', () => {
  beforeEach(() => {
    // Clear any mocks if needed in the future
  });

  // ============================================
  // responseAnswerIsCorrect tests
  // ============================================

  describe('responseAnswerIsCorrect', () => {
    describe('numeric and string comparisons', () => {
      it('matches exact numeric values', () => {
        expect(responseAnswerIsCorrect(5, 5)).toBe(true);
        expect(responseAnswerIsCorrect(0, 0)).toBe(true);
        expect(responseAnswerIsCorrect(-10, -10)).toBe(true);
      });

      it('matches string to number conversions', () => {
        expect(responseAnswerIsCorrect('5', 5)).toBe(true);
        expect(responseAnswerIsCorrect(5, '5')).toBe(true);
        expect(responseAnswerIsCorrect('42', '42')).toBe(true);
      });

      it('does not match different numeric values', () => {
        expect(responseAnswerIsCorrect(5, 10)).toBe(false);
        expect(responseAnswerIsCorrect('5', 10)).toBe(false);
        expect(responseAnswerIsCorrect(10, '5')).toBe(false);
      });

      it('handles invalid number strings', () => {
        // When conversion fails, it falls back to string comparison
        expect(responseAnswerIsCorrect('abc', 5)).toBe(false);
        expect(responseAnswerIsCorrect('abc', 'abc')).toBe(true);
      });

      it('handles zero correctly', () => {
        expect(responseAnswerIsCorrect(0, 0)).toBe(true);
        expect(responseAnswerIsCorrect('0', 0)).toBe(true);
        expect(responseAnswerIsCorrect(0, '0')).toBe(true);
      });
    });

    describe('numeric ranges with acceptableLow and acceptableHigh', () => {
      it('matches values within range (both bounds)', () => {
        expect(responseAnswerIsCorrect(5, 5, 3, 7)).toBe(true);
        expect(responseAnswerIsCorrect(6, 5, 3, 7)).toBe(true);
        expect(responseAnswerIsCorrect('5', 5, 3, 7)).toBe(true);
      });

      it('matches values at lower boundary', () => {
        expect(responseAnswerIsCorrect(3, 5, 3, 7)).toBe(true);
        expect(responseAnswerIsCorrect('3', 5, 3, 7)).toBe(true);
      });

      it('matches values at upper boundary', () => {
        expect(responseAnswerIsCorrect(7, 5, 3, 7)).toBe(true);
        expect(responseAnswerIsCorrect('7', 5, 3, 7)).toBe(true);
      });

      it('does not match values below lower boundary', () => {
        expect(responseAnswerIsCorrect(2, 5, 3, 7)).toBe(false);
        expect(responseAnswerIsCorrect('2', 5, 3, 7)).toBe(false);
      });

      it('does not match values above upper boundary', () => {
        expect(responseAnswerIsCorrect(8, 5, 3, 7)).toBe(false);
        expect(responseAnswerIsCorrect('8', 5, 3, 7)).toBe(false);
      });

      it('handles only acceptableLow specified', () => {
        expect(responseAnswerIsCorrect(5, 5, 3, undefined)).toBe(true);
        expect(responseAnswerIsCorrect(3, 5, 3, undefined)).toBe(true);
        expect(responseAnswerIsCorrect(2, 5, 3, undefined)).toBe(false);
        expect(responseAnswerIsCorrect(100, 5, 3, undefined)).toBe(true);
      });

      it('handles only acceptableHigh specified', () => {
        expect(responseAnswerIsCorrect(5, 5, undefined, 7)).toBe(true);
        expect(responseAnswerIsCorrect(7, 5, undefined, 7)).toBe(true);
        expect(responseAnswerIsCorrect(8, 5, undefined, 7)).toBe(false);
        expect(responseAnswerIsCorrect(-100, 5, undefined, 7)).toBe(true);
      });

      it('handles negative ranges', () => {
        expect(responseAnswerIsCorrect(-5, -5, -10, -1)).toBe(true);
        expect(responseAnswerIsCorrect(-10, -5, -10, -1)).toBe(true);
        expect(responseAnswerIsCorrect(-1, -5, -10, -1)).toBe(true);
        expect(responseAnswerIsCorrect(-11, -5, -10, -1)).toBe(false);
        expect(responseAnswerIsCorrect(0, -5, -10, -1)).toBe(false);
      });

      it('handles decimal values in ranges', () => {
        expect(responseAnswerIsCorrect(5.5, 5, 5.0, 6.0)).toBe(true);
        expect(responseAnswerIsCorrect(5.0, 5, 5.0, 6.0)).toBe(true);
        expect(responseAnswerIsCorrect(6.0, 5, 5.0, 6.0)).toBe(true);
        expect(responseAnswerIsCorrect(4.9, 5, 5.0, 6.0)).toBe(false);
        expect(responseAnswerIsCorrect(6.1, 5, 5.0, 6.0)).toBe(false);
      });
    });

    describe('array comparisons (checkbox answers)', () => {
      it('matches arrays with same elements regardless of order', () => {
        expect(responseAnswerIsCorrect(['1', '2', '3'], ['1', '2', '3'])).toBe(true);
        expect(responseAnswerIsCorrect(['3', '2', '1'], ['1', '2', '3'])).toBe(true);
        expect(responseAnswerIsCorrect(['2', '3', '1'], ['1', '2', '3'])).toBe(true);
      });

      it('matches arrays with string elements', () => {
        expect(responseAnswerIsCorrect(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(true);
        expect(responseAnswerIsCorrect(['c', 'a', 'b'], ['a', 'b', 'c'])).toBe(true);
      });

      it('does not match arrays with different lengths', () => {
        expect(responseAnswerIsCorrect(['1', '2'], ['1', '2', '3'])).toBe(false);
        expect(responseAnswerIsCorrect(['1', '2', '3', '4'], ['1', '2', '3'])).toBe(false);
      });

      it('does not match arrays with different elements', () => {
        expect(responseAnswerIsCorrect(['1', '2', '3'], ['1', '2', '4'])).toBe(false);
        expect(responseAnswerIsCorrect(['1', '5', '3'], ['1', '2', '3'])).toBe(false);
      });

      it('matches empty arrays', () => {
        expect(responseAnswerIsCorrect([], [])).toBe(true);
      });

      it('does not match empty array with non-empty array', () => {
        expect(responseAnswerIsCorrect([], ['1'])).toBe(false);
        expect(responseAnswerIsCorrect(['1'], [])).toBe(false);
      });

      it('matches single-element arrays', () => {
        expect(responseAnswerIsCorrect(['1'], ['1'])).toBe(true);
        expect(responseAnswerIsCorrect(['a'], ['a'])).toBe(true);
      });

      it('handles duplicate elements correctly', () => {
        expect(responseAnswerIsCorrect(['1', '1', '2'], ['1', '2', '1'])).toBe(true);
        expect(responseAnswerIsCorrect(['1', '2', '2'], ['1', '2', '1'])).toBe(false);
      });
    });

    describe('matrix-radio responses', () => {
      it('matches matrix-radio object values against array', () => {
        const userAnswer = { 0: '1', 1: '2', 2: '0' } as unknown as (string | number | boolean | string[]);
        const correctAnswer = ['1', '2', '0'];
        expect(responseAnswerIsCorrect(userAnswer, correctAnswer)).toBe(true);
      });

      it('matches with numeric string conversion', () => {
        const userAnswer = { 0: 1, 1: 2, 2: 0 } as unknown as (string | number | boolean | string[]);
        const correctAnswer = ['1', '2', '0'];
        expect(responseAnswerIsCorrect(userAnswer, correctAnswer)).toBe(true);
      });

      it('does not match incorrect matrix-radio values', () => {
        const userAnswer = { 0: '1', 1: '3', 2: '0' } as unknown as (string | number | boolean | string[]);
        const correctAnswer = ['1', '2', '0'];
        expect(responseAnswerIsCorrect(userAnswer, correctAnswer)).toBe(false);
      });

      it('does not match when lengths differ', () => {
        const userAnswer = { 0: '1', 1: '2' } as unknown as (string | number | boolean | string[]);
        const correctAnswer = ['1', '2', '0'];
        expect(responseAnswerIsCorrect(userAnswer, correctAnswer)).toBe(false);
      });
    });

    describe('matrix-checkbox responses', () => {
      it('matches matrix-checkbox with pipe-delimited strings', () => {
        const userAnswer = { 0: '1|2', 1: '0|2', 2: '1' } as unknown as (string | number | boolean | string[]);
        const correctAnswer = [['1', '2'], ['0', '2'], ['1']];
        expect(responseAnswerIsCorrect(userAnswer, correctAnswer)).toBe(true);
      });

      it('matches with order-independent checkbox values', () => {
        const userAnswer = { 0: '2|1', 1: '2|0', 2: '1' } as unknown as (string | number | boolean | string[]);
        const correctAnswer = [['1', '2'], ['0', '2'], ['1']];
        expect(responseAnswerIsCorrect(userAnswer, correctAnswer)).toBe(true);
      });

      it('matches empty strings for empty checkbox arrays', () => {
        const userAnswer = { 0: '', 1: '0', 2: '1' } as unknown as (string | number | boolean | string[]);
        const correctAnswer = [[], ['0'], ['1']];
        expect(responseAnswerIsCorrect(userAnswer, correctAnswer)).toBe(true);
      });

      it('does not match incorrect matrix-checkbox values', () => {
        const userAnswer = { 0: '1|2', 1: '0|1', 2: '1' } as unknown as (string | number | boolean | string[]);
        const correctAnswer = [['1', '2'], ['0', '2'], ['1']];
        expect(responseAnswerIsCorrect(userAnswer, correctAnswer)).toBe(false);
      });

      it('does not match when checkbox counts differ', () => {
        const userAnswer = { 0: '1|2|3', 1: '0|2', 2: '1' } as unknown as (string | number | boolean | string[]);
        const correctAnswer = [['1', '2'], ['0', '2'], ['1']];
        expect(responseAnswerIsCorrect(userAnswer, correctAnswer)).toBe(false);
      });

      it('does not match when row counts differ', () => {
        const userAnswer = { 0: '1|2', 1: '0|2' } as unknown as (string | number | boolean | string[]);
        const correctAnswer = [['1', '2'], ['0', '2'], ['1']];
        expect(responseAnswerIsCorrect(userAnswer, correctAnswer)).toBe(false);
      });

      it('handles single selections in matrix-checkbox', () => {
        const userAnswer = { 0: '1', 1: '0', 2: '2' } as unknown as (string | number | boolean | string[]);
        const correctAnswer = [['1'], ['0'], ['2']];
        expect(responseAnswerIsCorrect(userAnswer, correctAnswer)).toBe(true);
      });

      it('handles all empty selections', () => {
        const userAnswer = { 0: '', 1: '', 2: '' } as unknown as (string | number | boolean | string[]);
        const correctAnswer = [[], [], []];
        expect(responseAnswerIsCorrect(userAnswer, correctAnswer)).toBe(true);
      });
    });

    describe('deep equality fallback', () => {
      it('handles boolean values', () => {
        expect(responseAnswerIsCorrect(true, true)).toBe(true);
        expect(responseAnswerIsCorrect(false, false)).toBe(true);
        expect(responseAnswerIsCorrect(true, false)).toBe(false);
        expect(responseAnswerIsCorrect(false, true)).toBe(false);
      });

      it('handles nested arrays (uses array comparison path)', () => {
        // Nested arrays use the array comparison path, not deep equality
        expect(responseAnswerIsCorrect([['1', '2'], ['3', '4']] as unknown as (string | number | boolean | string[]), [['1', '2'], ['3', '4']])).toBe(true);
        expect(responseAnswerIsCorrect([['1', '2'], ['3', '4']] as unknown as (string | number | boolean | string[]), [['1', '2'], ['3', '5']])).toBe(false);
      });
    });

    describe('parameterized test cases', () => {
      describe.each([
        // [userAnswer, correctAnswer, acceptableLow, acceptableHigh, expected]
        [5, 5, undefined, undefined, true],
        ['5', 5, undefined, undefined, true],
        [5, '5', undefined, undefined, true],
        [5, 10, undefined, undefined, false],
        [7, 5, 5, 10, true],
        [5, 5, 5, 10, true],
        [10, 5, 5, 10, true],
        [4, 5, 5, 10, false],
        [11, 5, 5, 10, false],
        [['1', '2', '3'], ['3', '2', '1'], undefined, undefined, true],
        [['1', '2'], ['1', '2', '3'], undefined, undefined, false],
        [true, true, undefined, undefined, true],
        [false, true, undefined, undefined, false],
      ])('responseAnswerIsCorrect(%p, %p, %p, %p) returns %p', (user, correct, low, high, expected) => {
        it(`returns ${expected}`, () => {
          expect(responseAnswerIsCorrect(user, correct, low, high)).toBe(expected);
        });
      });
    });
  });

  // ============================================
  // componentAnswersAreCorrect tests
  // ============================================

  describe('componentAnswersAreCorrect', () => {
    it('returns true when all answers are correct', () => {
      const userAnswers = {
        q1: 5,
        q2: 'answer',
        q3: ['1', '2', '3'],
      };
      const correctAnswers = [
        { id: 'q1', answer: 5 },
        { id: 'q2', answer: 'answer' },
        { id: 'q3', answer: ['1', '2', '3'] },
      ];
      expect(componentAnswersAreCorrect(userAnswers, correctAnswers)).toBe(true);
    });

    it('returns false when one answer is incorrect', () => {
      const userAnswers = {
        q1: 5,
        q2: 'wrong',
        q3: ['1', '2', '3'],
      };
      const correctAnswers = [
        { id: 'q1', answer: 5 },
        { id: 'q2', answer: 'answer' },
        { id: 'q3', answer: ['1', '2', '3'] },
      ];
      expect(componentAnswersAreCorrect(userAnswers, correctAnswers)).toBe(false);
    });

    it('returns false when an answer is missing (undefined)', () => {
      const userAnswers = {
        q1: 5,
        q3: ['1', '2', '3'],
      };
      const correctAnswers = [
        { id: 'q1', answer: 5 },
        { id: 'q2', answer: 'answer' },
        { id: 'q3', answer: ['1', '2', '3'] },
      ];
      expect(componentAnswersAreCorrect(userAnswers, correctAnswers)).toBe(false);
    });

    it('returns true when correctAnswers is empty', () => {
      const userAnswers = {
        q1: 5,
        q2: 'answer',
      };
      const correctAnswers: never[] = [];
      expect(componentAnswersAreCorrect(userAnswers, correctAnswers)).toBe(true);
    });

    it('returns true when correctAnswers is undefined', () => {
      const userAnswers = {
        q1: 5,
        q2: 'answer',
      };
      expect(componentAnswersAreCorrect(userAnswers, undefined)).toBe(true);
    });

    it('handles answers with acceptableLow and acceptableHigh', () => {
      const userAnswers = {
        q1: 7,
      };
      const correctAnswers = [
        {
          id: 'q1', answer: 5, acceptableLow: 5, acceptableHigh: 10,
        },
      ];
      expect(componentAnswersAreCorrect(userAnswers, correctAnswers)).toBe(true);
    });

    it('returns false when answer outside acceptable range', () => {
      const userAnswers = {
        q1: 15,
      };
      const correctAnswers = [
        {
          id: 'q1', answer: 5, acceptableLow: 5, acceptableHigh: 10,
        },
      ];
      expect(componentAnswersAreCorrect(userAnswers, correctAnswers)).toBe(false);
    });

    it('handles multiple answers with mixed correctness (all correct)', () => {
      const userAnswers = {
        q1: 5,
        q2: ['1', '2'],
        q3: 'text',
        q4: true,
      };
      const correctAnswers = [
        { id: 'q1', answer: 5 },
        { id: 'q2', answer: ['2', '1'] }, // Order-independent
        { id: 'q3', answer: 'text' },
        { id: 'q4', answer: true },
      ];
      expect(componentAnswersAreCorrect(userAnswers, correctAnswers)).toBe(true);
    });

    it('returns false immediately on first incorrect answer', () => {
      const userAnswers = {
        q1: 5,
        q2: 'wrong',
        q3: ['1', '2'],
        q4: true,
      };
      const correctAnswers = [
        { id: 'q1', answer: 5 },
        { id: 'q2', answer: 'correct' },
        { id: 'q3', answer: ['1', '2'] },
        { id: 'q4', answer: true },
      ];
      expect(componentAnswersAreCorrect(userAnswers, correctAnswers)).toBe(false);
    });

    it('handles matrix responses', () => {
      const userAnswers = {
        matrix1: { 0: '1', 1: '2', 2: '0' } as unknown as (string | number | boolean | string[]),
      };
      const correctAnswers = [
        { id: 'matrix1', answer: ['1', '2', '0'] },
      ];
      expect(componentAnswersAreCorrect(userAnswers, correctAnswers)).toBe(true);
    });

    it('handles matrix-checkbox responses', () => {
      const userAnswers = {
        matrix1: { 0: '1|2', 1: '0', 2: '1|2' } as unknown as (string | number | boolean | string[]),
      };
      const correctAnswers = [
        { id: 'matrix1', answer: [['2', '1'], ['0'], ['1', '2']] },
      ];
      expect(componentAnswersAreCorrect(userAnswers, correctAnswers)).toBe(true);
    });

    it('handles extra user answers not in correctAnswers (ignored)', () => {
      const userAnswers = {
        q1: 5,
        q2: 'extra',
        q3: ['1', '2'],
      };
      const correctAnswers = [
        { id: 'q1', answer: 5 },
      ];
      expect(componentAnswersAreCorrect(userAnswers, correctAnswers)).toBe(true);
    });

    it('validates only specified correct answers', () => {
      const userAnswers = {
        q1: 5,
        q2: 'anything',
        q3: 'whatever',
      };
      const correctAnswers = [
        { id: 'q1', answer: 5 },
        { id: 'q3', answer: 'whatever' },
      ];
      // q2 is not validated, so it doesn't matter what it is
      expect(componentAnswersAreCorrect(userAnswers, correctAnswers)).toBe(true);
    });
  });
});
