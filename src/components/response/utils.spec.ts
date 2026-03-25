import {
  afterEach, beforeEach, describe, expect, it,
} from 'vitest';
import type { CheckboxResponse, MatrixResponse, Response } from '../../parser/types';
import {
  checkCheckboxResponseForValidation,
  generateErrorMessage,
  generateInitFields,
  mergeReactiveAnswers,
  normalizeCheckboxDontKnowValue,
  requiredAnswerIsEmpty,
  shouldBypassValidationForStandaloneDontKnow,
} from './utils';

describe('generateInitFields', () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    Object.defineProperty(globalThis, 'window', {
      value: { location: { search: '' } },
      configurable: true,
    });
  });

  afterEach(() => {
    if (originalWindow === undefined) {
      Object.defineProperty(globalThis, 'window', {
        value: undefined,
        configurable: true,
      });
      return;
    }

    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      configurable: true,
    });
  });

  it('uses question label when matrix question value is omitted', () => {
    const response: MatrixResponse = {
      id: 'matrix-question-fallback',
      prompt: 'Matrix prompt',
      type: 'matrix-checkbox',
      answerOptions: ['Option 1', 'Option 2'],
      questionOptions: [
        { label: 'Question without value' },
        { label: 'Question with value', value: 'question-2' },
      ],
    };

    const initialFields = generateInitFields([response], {});

    expect(initialFields).toEqual({
      'matrix-question-fallback': {
        'Question without value': '',
        'question-2': '',
      },
    });
  });

  it('uses response defaults when no stored answer exists', () => {
    const responses: Response[] = [
      {
        id: 'short-default',
        prompt: 'Short text',
        type: 'shortText',
        default: 'prefilled',
      },
      {
        id: 'checkbox-default',
        prompt: 'Checkbox',
        type: 'checkbox',
        options: ['A', 'B'],
        default: ['A'],
      },
      {
        id: 'matrix-default',
        prompt: 'Matrix',
        type: 'matrix-checkbox',
        answerOptions: ['A', 'B'],
        questionOptions: ['Q1', 'Q2'],
        default: {
          Q1: ['A', 'B'],
          Q2: ['A'],
        },
      },
      {
        id: 'likert-default',
        prompt: 'Likert',
        type: 'likert',
        numItems: 5,
        default: 3,
      },
      {
        id: 'multiselect-dropdown-default',
        prompt: 'Dropdown',
        type: 'dropdown',
        options: ['A', 'B', 'C'],
        minSelections: 1,
        default: 'B',
      },
    ];

    const initialFields = generateInitFields(responses, {});

    expect(initialFields).toEqual({
      'short-default': 'prefilled',
      'checkbox-default': ['A'],
      'matrix-default': {
        Q1: 'A|B',
        Q2: 'A',
      },
      'likert-default': '3',
      'multiselect-dropdown-default': ['B'],
    });
  });
});

describe('mergeReactiveAnswers', () => {
  it('merges all reactive response ids from a single submission', () => {
    const mergedValues = mergeReactiveAnswers(
      [
        {
          id: 'answer1',
          prompt: 'First reactive answer',
          type: 'reactive',
        },
        {
          id: 'answer2',
          prompt: 'Second reactive answer',
          type: 'reactive',
        },
      ],
      { answer1: 0, answer2: 0, other: 'keep-me' },
      { answer1: 1, answer2: 2 },
    );

    expect(mergedValues).toEqual({ answer1: 1, answer2: 2, other: 'keep-me' });
  });
});

describe('generateErrorMessage checkbox', () => {
  it('validates checkbox selections when checkbox group value is an array', () => {
    const checkboxResponse: Response = {
      id: 'checkbox-response',
      prompt: 'Checkbox response',
      type: 'checkbox',
      required: true,
      minSelections: 2,
      options: ['Option 1', 'Option 2', 'Option 3'],
    };

    const error = generateErrorMessage(checkboxResponse, { value: ['Option 1'] });

    expect(error).toBe('Please select at least 2 options');
  });

  it('suppresses checkbox min/max errors when dont-know is checked', () => {
    const checkboxResponse: Response = {
      id: 'checkbox-response',
      prompt: 'Checkbox response',
      type: 'checkbox',
      required: true,
      minSelections: 2,
      options: ['Option 1', 'Option 2', 'Option 3'],
      withDontKnow: true,
    };

    const error = generateErrorMessage(checkboxResponse, { value: [], dontKnowChecked: true });

    expect(error).toBeNull();
  });
});

describe('checkCheckboxResponseForValidation', () => {
  it('bypasses checkbox selection-count validation when dont-know is checked', () => {
    const checkboxResponse: CheckboxResponse = {
      id: 'checkbox-response',
      prompt: 'Checkbox response',
      type: 'checkbox',
      required: true,
      minSelections: 2,
      options: ['Option 1', 'Option 2', 'Option 3'],
      withDontKnow: true,
    };

    expect(checkCheckboxResponseForValidation(checkboxResponse, [], true)).toBeNull();
  });
});

describe('shouldBypassValidationForStandaloneDontKnow', () => {
  it('returns true for standalone dont-know responses', () => {
    const response: Response = {
      id: 'q-numerical',
      prompt: 'Numerical example',
      type: 'numerical',
      withDontKnow: true,
    };

    expect(shouldBypassValidationForStandaloneDontKnow(response, true)).toBe(true);
  });

  it('returns false for matrix responses because dont-know is inline', () => {
    const response: MatrixResponse = {
      id: 'matrix-validation',
      prompt: 'Matrix prompt',
      type: 'matrix-radio',
      required: true,
      answerOptions: ['0', '1'],
      questionOptions: ['q1', 'q2'],
      withDontKnow: true,
    };

    expect(shouldBypassValidationForStandaloneDontKnow(response, true)).toBe(false);
  });
});

describe('normalizeCheckboxDontKnowValue', () => {
  it('clears all selections when the legacy dont-know token is present', () => {
    expect(normalizeCheckboxDontKnowValue(["I don't know", 'Option 1'])).toEqual([]);
  });

  it('leaves regular checkbox selections unchanged', () => {
    expect(normalizeCheckboxDontKnowValue(['Option 1'])).toEqual(['Option 1']);
  });
});

describe('generateErrorMessage requiredValue with dont-know', () => {
  it('suppresses required-value errors when standalone dont-know is checked', () => {
    const numericalResponse: Response = {
      id: 'required-value-response',
      prompt: 'Required numerical response',
      type: 'numerical',
      required: true,
      requiredValue: 42,
      withDontKnow: true,
    };

    const error = generateErrorMessage(numericalResponse, {
      value: '',
      dontKnowChecked: true,
    });

    expect(error).toBeNull();
  });
});

describe('generateErrorMessage matrix', () => {
  const matrixResponse: MatrixResponse = {
    id: 'matrix-validation',
    prompt: 'Matrix prompt',
    type: 'matrix-radio',
    required: true,
    answerOptions: ['0', '1'],
    questionOptions: ['q1', 'q2'],
  };

  it('does not show matrix incomplete message when untouched', () => {
    const error = generateErrorMessage(matrixResponse, {
      value: { q1: '', q2: '' },
    });

    expect(error).toBeNull();
  });

  it('shows matrix incomplete message after at least one answer is selected', () => {
    const error = generateErrorMessage(matrixResponse, {
      value: { q1: '0', q2: '' },
    });

    expect(error).toBe('Please answer all questions in the matrix to continue.');
  });

  it('does not show matrix incomplete message when all rows are answered', () => {
    const error = generateErrorMessage(matrixResponse, {
      value: { q1: '0', q2: '1' },
    });

    expect(error).toBeNull();
  });
});

describe('requiredAnswerIsEmpty', () => {
  it('returns true for null', () => expect(requiredAnswerIsEmpty(null)).toBe(true));
  it('returns true for undefined', () => expect(requiredAnswerIsEmpty(undefined)).toBe(true));
  it('returns true for empty string', () => expect(requiredAnswerIsEmpty('')).toBe(true));
  it('returns true for empty array', () => expect(requiredAnswerIsEmpty([])).toBe(true));
  it('returns true for empty object', () => expect(requiredAnswerIsEmpty({})).toBe(true));
  it('returns true for object with empty-string value', () => expect(requiredAnswerIsEmpty({ q1: '' })).toBe(true));
  it('returns true for object with null value', () => expect(requiredAnswerIsEmpty({ q1: null })).toBe(true));
  it('returns true for object with undefined value', () => expect(requiredAnswerIsEmpty({ q1: undefined })).toBe(true));
  it('returns false for non-empty string', () => expect(requiredAnswerIsEmpty('hello')).toBe(false));
  it('returns false for non-empty array', () => expect(requiredAnswerIsEmpty(['a'])).toBe(false));
  it('returns false for object with all values answered', () => expect(requiredAnswerIsEmpty({ q1: '0', q2: '1' })).toBe(false));
  it('returns false for zero (numeric)', () => expect(requiredAnswerIsEmpty(0)).toBe(false));
  it('returns false for false (boolean)', () => expect(requiredAnswerIsEmpty(false)).toBe(false));
});

describe('generateErrorMessage showUnanswered', () => {
  const shortTextResponse: Response = {
    id: 'short-text',
    prompt: 'Short text',
    type: 'shortText',
    required: true,
  };

  const matrixResponse: MatrixResponse = {
    id: 'matrix-unanswered',
    prompt: 'Matrix',
    type: 'matrix-radio',
    required: true,
    answerOptions: ['0', '1'],
    questionOptions: ['q1', 'q2'],
  };

  it('returns prompt when showUnanswered=true, required, and value is empty string', () => {
    const error = generateErrorMessage(shortTextResponse, { value: '' }, undefined, true);
    expect(error).toBe('Please answer this question to continue.');
  });

  it('returns null when showUnanswered=false even if required and empty', () => {
    const error = generateErrorMessage(shortTextResponse, { value: '' }, undefined, false);
    expect(error).toBeNull();
  });

  it('returns null when showUnanswered=true but response is not required', () => {
    const optionalResponse: Response = { id: 'opt', prompt: 'Optional', type: 'shortText' };
    const error = generateErrorMessage(optionalResponse, { value: '' }, undefined, true);
    expect(error).toBeNull();
  });

  it('returns prompt for empty object (ranking/matrix initial state) when showUnanswered=true', () => {
    const error = generateErrorMessage(matrixResponse, { value: {} }, undefined, true);
    expect(error).toBe('Please answer this question to continue.');
  });

  it('returns null when matrix is fully answered and showUnanswered=true', () => {
    const error = generateErrorMessage(matrixResponse, { value: { q1: '0', q2: '1' } }, undefined, true);
    expect(error).toBeNull();
  });

  it('does not override existing validation errors with showUnanswered prompt', () => {
    // Partially answered matrix already returns its own error; showUnanswered should not change the message
    const error = generateErrorMessage(matrixResponse, { value: { q1: '0', q2: '' } }, undefined, true);
    expect(error).toBe('Please answer all questions in the matrix to continue.');
  });
});
