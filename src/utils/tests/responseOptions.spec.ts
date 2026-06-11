import { describe, expect, test } from 'vitest';
import { MatrixResponse } from '../../parser/types';
import { getMatrixAnswerOptions, isMatrixDontKnowValue, MATRIX_DONT_KNOW_OPTION } from '../responseOptions';

describe('responseOptions', () => {
  test('appends the synthetic dont-know option for matrix responses', () => {
    const response: MatrixResponse = {
      id: 'matrix',
      prompt: 'Matrix prompt',
      type: 'matrix-radio',
      answerOptions: ['A', 'B'],
      questionOptions: ['Q1'],
      withDontKnow: true,
    };

    expect(getMatrixAnswerOptions(response)).toEqual([
      { label: 'A', value: 'A' },
      { label: 'B', value: 'B' },
      MATRIX_DONT_KNOW_OPTION,
    ]);
  });

  test('expands preset answer options before appending dont-know', () => {
    const response: MatrixResponse = {
      id: 'matrix-preset',
      prompt: 'Matrix prompt',
      type: 'matrix-radio',
      answerOptions: 'satisfaction5',
      questionOptions: ['Q1'],
      withDontKnow: true,
    };

    expect(getMatrixAnswerOptions(response).at(-1)).toEqual(MATRIX_DONT_KNOW_OPTION);
    expect(getMatrixAnswerOptions(response)[0]).toEqual({
      label: 'Highly Unsatisfied',
      value: 'Highly Unsatisfied',
    });
  });

  test('detects the synthetic dont-know value case-insensitively', () => {
    expect(isMatrixDontKnowValue("I don't know")).toBe(true);
    expect(isMatrixDontKnowValue("i don't know")).toBe(true);
    expect(isMatrixDontKnowValue('A')).toBe(false);
  });
});
