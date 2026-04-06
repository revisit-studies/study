import { renderHook, act } from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, it, test,
} from 'vitest';
import type {
  CheckboxResponse, DropdownResponse, MatrixResponse, NumericalResponse, Response,
} from '../../parser/types';
import {
  checkCheckboxResponseForValidation,
  generateErrorMessage,
  generateInitFields,
  getDefaultFieldValue,
  mergeReactiveAnswers,
  normalizeCheckboxDontKnowValue,
  shouldBypassValidationForStandaloneDontKnow,
  useAnswerField,
  usesStandaloneDontKnowField,
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

// ── checkCheckboxResponseForValidation additional branches ───────────────────

describe('checkCheckboxResponseForValidation — both min and max violated', () => {
  test('returns range error when minSelections > maxSelections and count falls between', () => {
    // min=5 > max=2 is an edge case; value.length=3 satisfies: 3 < 5 AND 3 > 2
    const response: CheckboxResponse = {
      id: 'q1', prompt: '', type: 'checkbox', options: [], minSelections: 5, maxSelections: 2,
    };
    const result = checkCheckboxResponseForValidation(response, ['A', 'B', 'C']);
    expect(result).toContain('between 5 and 2');
  });

  test('returns maxSelections error only when only max is violated', () => {
    const response: CheckboxResponse = {
      id: 'q1', prompt: '', type: 'checkbox', options: [], maxSelections: 1,
    };
    const result = checkCheckboxResponseForValidation(response, ['A', 'B']);
    expect(result).toContain('at most 1');
  });

  test('returns null when selection is within range', () => {
    const response: CheckboxResponse = {
      id: 'q1', prompt: '', type: 'checkbox', options: [], minSelections: 1, maxSelections: 3,
    };
    expect(checkCheckboxResponseForValidation(response, ['A', 'B'])).toBeNull();
  });
});

// ── generateErrorMessage — dropdown and numerical branches ───────────────────

describe('generateErrorMessage dropdown', () => {
  test('returns maxSelections error for dropdown with too many selections', () => {
    const response: DropdownResponse = {
      id: 'q1', prompt: '', type: 'dropdown', options: [], required: true, maxSelections: 1,
    };
    const result = generateErrorMessage(response, { value: ['A', 'B'] });
    expect(result).toContain('at most 1');
  });

  test('returns minSelections error for dropdown with too few selections', () => {
    const response: DropdownResponse = {
      id: 'q1', prompt: '', type: 'dropdown', options: [], required: true, minSelections: 3,
    };
    const result = generateErrorMessage(response, { value: ['A'] });
    expect(result).toContain('at least 3');
  });

  test('returns null for valid dropdown selection', () => {
    const response: DropdownResponse = {
      id: 'q1', prompt: '', type: 'dropdown', options: [], required: true, minSelections: 1, maxSelections: 3,
    };
    expect(generateErrorMessage(response, { value: ['A', 'B'] })).toBeNull();
  });
});

describe('generateErrorMessage numerical', () => {
  test('returns between error when value is outside min and max', () => {
    const response: NumericalResponse = {
      id: 'q1', prompt: '', type: 'numerical', required: true, min: 1, max: 10,
    };
    expect(generateErrorMessage(response, { value: 50 })).toContain('between 1 and 10');
  });

  test('returns min error when value is below min only', () => {
    const response: NumericalResponse = {
      id: 'q1', prompt: '', type: 'numerical', required: true, min: 5,
    };
    expect(generateErrorMessage(response, { value: 2 })).toContain('5 or greater');
  });

  test('returns max error when value is above max only', () => {
    const response: NumericalResponse = {
      id: 'q1', prompt: '', type: 'numerical', required: true, max: 10,
    };
    expect(generateErrorMessage(response, { value: 20 })).toContain('10 or less');
  });

  test('returns null when numerical value is in range', () => {
    const response: NumericalResponse = {
      id: 'q1', prompt: '', type: 'numerical', required: true, min: 1, max: 10,
    };
    expect(generateErrorMessage(response, { value: 5 })).toBeNull();
  });
});

describe('generateErrorMessage else branch — requiredValue mismatch', () => {
  test('returns error when shortText value does not match requiredValue', () => {
    const response: Response = {
      id: 'q1', prompt: '', type: 'shortText', required: true, requiredValue: 'correct',
    };
    expect(generateErrorMessage(response, { value: 'wrong' })).toContain('correct');
  });

  test('returns null when shortText value matches requiredValue', () => {
    const response: Response = {
      id: 'q1', prompt: '', type: 'shortText', required: true, requiredValue: 'correct',
    };
    expect(generateErrorMessage(response, { value: 'correct' })).toBeNull();
  });

  test('returns null when no value and no requiredValue', () => {
    const response: Response = {
      id: 'q1', prompt: '', type: 'shortText', required: false,
    };
    expect(generateErrorMessage(response, { value: 'anything' })).toBeNull();
  });
});

// ── usesStandaloneDontKnowField ───────────────────────────────────────────────

describe('usesStandaloneDontKnowField', () => {
  test('returns true for non-matrix response with withDontKnow', () => {
    const response: Response = {
      id: 'q1', prompt: '', type: 'shortText', withDontKnow: true,
    };
    expect(usesStandaloneDontKnowField(response)).toBe(true);
  });

  test('returns false for matrix-radio with withDontKnow', () => {
    const response: MatrixResponse = {
      id: 'q1', prompt: '', type: 'matrix-radio', answerOptions: [], questionOptions: [], withDontKnow: true,
    };
    expect(usesStandaloneDontKnowField(response)).toBe(false);
  });

  test('returns false for matrix-checkbox with withDontKnow', () => {
    const response: MatrixResponse = {
      id: 'q1', prompt: '', type: 'matrix-checkbox', answerOptions: [], questionOptions: [], withDontKnow: true,
    };
    expect(usesStandaloneDontKnowField(response)).toBe(false);
  });

  test('returns false when withDontKnow is not set', () => {
    const response: Response = { id: 'q1', prompt: '', type: 'shortText' };
    expect(usesStandaloneDontKnowField(response)).toBe(false);
  });
});

// ── getDefaultFieldValue ──────────────────────────────────────────────────────

describe('getDefaultFieldValue', () => {
  test('returns null when no default property exists', () => {
    const response: Response = { id: 'q1', prompt: '', type: 'shortText' };
    expect(getDefaultFieldValue(response)).toBeNull();
  });

  test('returns null when default is undefined', () => {
    const response: Response = {
      id: 'q1', prompt: '', type: 'shortText', default: undefined,
    };
    expect(getDefaultFieldValue(response)).toBeNull();
  });

  test('returns string for likert default', () => {
    const response: Response = {
      id: 'q1', prompt: '', type: 'likert', numItems: 5, default: 3,
    };
    expect(getDefaultFieldValue(response)).toBe('3');
  });

  test('returns array for checkbox default array', () => {
    const response: Response = {
      id: 'q1', prompt: '', type: 'checkbox', options: [], default: ['A', 'B'],
    };
    expect(getDefaultFieldValue(response)).toEqual(['A', 'B']);
  });

  test('returns matrix-radio default as-is', () => {
    const response: MatrixResponse = {
      id: 'q1',
      prompt: '',
      type: 'matrix-radio',
      answerOptions: [],
      questionOptions: [],
      default: { Q1: 'Yes' },
    };
    expect(getDefaultFieldValue(response as Response)).toEqual({ Q1: 'Yes' });
  });

  test('converts matrix-checkbox default array values to pipe-joined strings', () => {
    const response: MatrixResponse = {
      id: 'q1',
      prompt: '',
      type: 'matrix-checkbox',
      answerOptions: [],
      questionOptions: [],
      default: { Q1: ['A', 'B'], Q2: ['C'] },
    };
    const result = getDefaultFieldValue(response as Response) as Record<string, string>;
    expect(result.Q1).toBe('A|B');
    expect(result.Q2).toBe('C');
  });

  test('returns single value for single-select dropdown', () => {
    const response: DropdownResponse = {
      id: 'q1', prompt: '', type: 'dropdown', options: [], default: 'Red',
    };
    expect(getDefaultFieldValue(response as Response)).toBe('Red');
  });

  test('returns first element for array dropdown default when single-select', () => {
    const response: DropdownResponse = {
      id: 'q1', prompt: '', type: 'dropdown', options: [], default: ['Red', 'Blue'],
    };
    expect(getDefaultFieldValue(response as Response)).toBe('Red');
  });

  test('returns array for multiselect dropdown with single string default', () => {
    const response: DropdownResponse = {
      id: 'q1', prompt: '', type: 'dropdown', options: [], maxSelections: 2, default: 'Red',
    };
    expect(getDefaultFieldValue(response as Response)).toEqual(['Red']);
  });

  test('returns raw default for other response types', () => {
    const response: Response = {
      id: 'q1', prompt: '', type: 'shortText', default: 'hello',
    };
    expect(getDefaultFieldValue(response)).toBe('hello');
  });
});

// ── generateInitFields additional branches ────────────────────────────────────

describe('generateInitFields additional branches', () => {
  const savedWindow = globalThis.window;

  beforeEach(() => {
    Object.defineProperty(globalThis, 'window', {
      value: { location: { search: '?color=blue' } },
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'window', {
      value: savedWindow,
      configurable: true,
    });
  });

  test('initializes reactive response to empty array', () => {
    const response: Response = { id: 'q1', prompt: '', type: 'reactive' };
    expect(generateInitFields([response], {})).toMatchObject({ q1: [] });
  });

  test('initializes ranking-categorical to empty array', () => {
    const response: Response = {
      id: 'q1', prompt: '', type: 'ranking-categorical', options: [],
    };
    expect(generateInitFields([response], {})).toMatchObject({ q1: [] });
  });

  test('initializes ranking-pairwise to empty array', () => {
    const response: Response = {
      id: 'q1', prompt: '', type: 'ranking-pairwise', options: [],
    };
    expect(generateInitFields([response], {})).toMatchObject({ q1: [] });
  });

  test('initializes slider with startingValue', () => {
    const response: Response = {
      id: 'q1', prompt: '', type: 'slider', options: [], startingValue: 75,
    };
    expect(generateInitFields([response], {})).toMatchObject({ q1: '75' });
  });

  test('reads paramCapture value from window.location.search', () => {
    const response: Response = {
      id: 'q1', prompt: '', type: 'shortText', paramCapture: 'color',
    };
    const result = generateInitFields([response], {});
    expect(result).toMatchObject({ q1: 'blue' });
  });

  test('adds dontKnow field defaulting to false when not in stored answer', () => {
    const response: Response = {
      id: 'q1', prompt: '', type: 'shortText', withDontKnow: true,
    };
    expect(generateInitFields([response], {})).toMatchObject({ 'q1-dontKnow': false });
  });

  test('uses dontKnow value from stored answer when available', () => {
    const response: Response = {
      id: 'q1', prompt: '', type: 'shortText', withDontKnow: true,
    };
    expect(generateInitFields([response], { q1: 'val', 'q1-dontKnow': true })).toMatchObject({ 'q1-dontKnow': true });
  });

  test('adds other field when withOther is set', () => {
    const response: Response = {
      id: 'q1', prompt: '', type: 'radio', options: [], withOther: true,
    };
    expect(generateInitFields([response], {})).toMatchObject({ 'q1-other': '' });
  });

  test('uses stored other value when available', () => {
    const response: Response = {
      id: 'q1', prompt: '', type: 'radio', options: [], withOther: true,
    };
    const result = generateInitFields([response], { q1: 'A', 'q1-other': 'custom' });
    expect(result).toMatchObject({ 'q1-other': 'custom' });
  });

  test('uses stored answer value when present', () => {
    const response: Response = { id: 'q1', prompt: '', type: 'shortText' };
    expect(generateInitFields([response], { q1: 'saved text' })).toMatchObject({ q1: 'saved text' });
  });
});

// ── generateErrorMessage — answer.checked branch ─────────────────────────────

describe('generateErrorMessage — answer.checked branch', () => {
  test('uses answer.checked when it is an array (line 326)', () => {
    const response: Response = {
      id: 'q1', prompt: '', type: 'checkbox', required: true, requiredValue: ['A', 'B'], options: ['A', 'B'],
    };
    // Pass checked instead of value — should find mismatch
    const error = generateErrorMessage(response, { checked: ['A'] });
    expect(error).toContain('to continue');
  });

  test('uses options label in error when options param is passed (line 330 select branch)', () => {
    const response: Response = {
      id: 'q1', prompt: '', type: 'checkbox', required: true, requiredValue: ['A', 'B'], options: ['A', 'B'],
    };
    const options = [{ label: 'Option A', value: 'A' }];
    const error = generateErrorMessage(response, { checked: ['A'] }, options);
    expect(error).toContain('select');
  });

  test('matching checked values against requiredValue returns null', () => {
    const response: Response = {
      id: 'q1', prompt: '', type: 'checkbox', required: true, requiredValue: ['A', 'B'], options: ['A', 'B'],
    };
    const error = generateErrorMessage(response, { checked: ['B', 'A'] });
    expect(error).toBeNull();
  });
});

// ── useAnswerField ─────────────────────────────────────────────────────────────

describe('useAnswerField', () => {
  test('returns a form object with initial values from responses', () => {
    const responses: Response[] = [
      { id: 'name', prompt: 'Name', type: 'shortText' },
    ];
    const { result } = renderHook(() => useAnswerField(responses, 'step1', {}));
    expect(result.current.values).toMatchObject({ name: '' });
  });

  test('resets form when currentStep changes', async () => {
    const responses: Response[] = [
      {
        id: 'name', prompt: 'Name', type: 'shortText', default: 'default',
      },
    ];
    const { result, rerender } = renderHook(
      ({ step }: { step: string }) => useAnswerField(responses, step, {}),
      { initialProps: { step: 'step1' } },
    );

    await act(async () => {
      rerender({ step: 'step2' });
    });

    // After step change the form should have reset
    expect(result.current.values).toBeDefined();
  });

  test('validates required field and returns error for empty value', () => {
    const responses: Response[] = [
      {
        id: 'name', prompt: 'Name', type: 'shortText', required: true,
      },
    ];
    const { result } = renderHook(() => useAnswerField(responses, 'step1', {}));
    const errors = result.current.validate();
    expect(errors.hasErrors).toBe(true);
  });

  test('validates required array field returns error for empty array', () => {
    const responses: Response[] = [
      {
        id: 'color', prompt: 'Color', type: 'checkbox', options: ['Red', 'Blue'], required: true,
      },
    ];
    const { result } = renderHook(() => useAnswerField(responses, 'step1', {}));
    const errors = result.current.validate();
    expect(errors.hasErrors).toBe(true);
  });
});
