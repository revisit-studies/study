import { describe, expect, test } from 'vitest';
import { Answer, StoredAnswer } from '../parser/types';
import { componentAnswersAreCorrect, responseAnswerIsCorrect } from './correctAnswer';

// Test responseAnswerIsCorrect function and componentAnswersAreCorrect function

type TestStoredAnswer = StoredAnswer['answer'][string];
type TestCorrectAnswer = Answer['answer'];

const asStoredAnswer = (value: unknown) => value as TestStoredAnswer;
const asCorrectAnswer = (value: unknown) => value as TestCorrectAnswer;

describe('correctAnswer utilities', () => {
  describe('responseAnswerIsCorrect', () => {
    test('matches numeric and string values', () => {
      expect(responseAnswerIsCorrect(5, 5)).toBe(true);
      expect(responseAnswerIsCorrect('5', 5)).toBe(true);
      expect(responseAnswerIsCorrect(5, '5')).toBe(true);
      expect(responseAnswerIsCorrect('4', 5)).toBe(false);
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

    test('treats numeric strings consistently with acceptable bounds', () => {
      expect(responseAnswerIsCorrect('8', 0, 7, 10)).toBe(true);
      expect(responseAnswerIsCorrect('6', 0, 7, 10)).toBe(false);
    });

    test('compares checkbox arrays ignoring order', () => {
      expect(responseAnswerIsCorrect(['b', 'a'], ['a', 'b'])).toBe(true);
      expect(responseAnswerIsCorrect(['a'], ['a', 'b'])).toBe(false);
      expect(responseAnswerIsCorrect(['a', 'c'], ['a', 'b'])).toBe(false);
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
        asStoredAnswer(null),
        asCorrectAnswer(null),
      )).toBe(true);
      expect(responseAnswerIsCorrect(
        asStoredAnswer(null),
        asCorrectAnswer(undefined),
      )).toBe(false);
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
  });
});
