import {
  afterEach, beforeEach, describe, expect, it,
} from 'vitest';
import type {
  CheckboxResponse, CustomResponse, MatrixResponse, Response,
} from '../../parser/types';
import type { CustomResponseValidate } from '../../store/types';
import {
  checkCheckboxResponseForValidation,
  generateErrorMessage,
  generateInitFields,
  generateValidation,
  mergeReactiveAnswers,
  normalizeCheckboxDontKnowValue,
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
      {
        id: 'custom-default',
        prompt: 'Custom response',
        type: 'custom',
        path: 'demo-form-elements/assets/CustomResponseCard.tsx',
        default: {
          chartType: 'Line',
          confidence: 75,
          rationale: 'Preset',
        },
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
      'custom-default': {
        chartType: 'Line',
        confidence: 75,
        rationale: 'Preset',
      },
    });
  });

  it('preserves stored falsy answers instead of replacing them with defaults', () => {
    const responses: Response[] = [
      {
        id: 'stored-empty-string',
        prompt: 'Short text',
        type: 'shortText',
        default: 'prefilled',
      },
      {
        id: 'stored-zero',
        prompt: 'Number',
        type: 'numerical',
        default: 5,
      },
      {
        id: 'stored-false',
        prompt: 'Custom response',
        type: 'custom',
        path: 'demo-form-elements/assets/CustomResponseCard.tsx',
        default: true,
      },
    ];

    const initialFields = generateInitFields(responses, {
      'stored-empty-string': '',
      'stored-zero': 0,
      'stored-false': false,
    });

    expect(initialFields).toEqual({
      'stored-empty-string': '',
      'stored-zero': 0,
      'stored-false': false,
    });
  });
});

describe('generateValidation custom', () => {
  const response: CustomResponse = {
    id: 'custom-response-demo',
    prompt: 'Custom response',
    type: 'custom',
    path: 'custom-response/Example.tsx',
    parameters: {
      minimumConfidence: 70,
    },
  };

  const customValidate: CustomResponseValidate = (value, _values, customResponse) => {
    const minimumConfidence = customResponse.parameters?.minimumConfidence as number;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return 'Select a chart type to continue.';
    }
    if (typeof value.confidence !== 'number' || value.confidence < minimumConfidence) {
      return `Set confidence to at least ${minimumConfidence} to continue.`;
    }

    return null;
  };

  it('uses the module validate export when a partial object is present', () => {
    const validation = generateValidation([response], { [response.id]: customValidate });
    const error = validation[response.id]({
      chartType: 'Bar',
      confidence: 50,
      rationale: '',
    }, {});

    expect(error).toBe('Set confidence to at least 70 to continue.');
  });

  it('passes once the custom response module validation succeeds', () => {
    const validation = generateValidation([response], { [response.id]: customValidate });
    const error = validation[response.id]({
      chartType: 'Scatter',
      confidence: 80,
      rationale: 'Looks right',
    }, {});

    expect(error).toBeNull();
  });

  it('treats empty objects as missing required input', () => {
    const validation = generateValidation([response], { [response.id]: customValidate });
    const error = validation[response.id]({}, {});

    expect(error).toBe('Empty input');
  });

  it('treats nested empty string structures as missing required input', () => {
    const validation = generateValidation([response], { [response.id]: customValidate });
    const error = validation[response.id]({
      chartType: '',
      rationale: '',
      details: {
        note: '',
      },
      tags: ['', ''],
    }, {});

    expect(error).toBe('Empty input');
  });

  it('does not treat 0 or false as empty custom values', () => {
    const validation = generateValidation([response]);
    const error = validation[response.id]({
      confidence: 0,
      confirmed: false,
    }, {});

    expect(error).toBeNull();
  });

  it('skips custom validation for optional empty custom responses', () => {
    const optionalResponse: CustomResponse = {
      ...response,
      required: false,
    };

    const validation = generateValidation([optionalResponse], { [optionalResponse.id]: customValidate });
    const error = validation[optionalResponse.id](null, {});

    expect(error).toBeNull();
  });

  it('surfaces module load errors for optional custom responses', () => {
    const optionalResponse: CustomResponse = {
      ...response,
      required: false,
    };

    const validation = generateValidation(
      [optionalResponse],
      {},
      { [optionalResponse.id]: `Unable to load custom response module at ${optionalResponse.path}` },
    );
    const error = validation[optionalResponse.id](null, {});

    expect(error).toBe(`Unable to load custom response module at ${optionalResponse.path}`);
  });

  it('treats standalone dont-know as a completed custom response', () => {
    const validation = generateValidation([{
      ...response,
      withDontKnow: true,
    }], { [response.id]: customValidate });
    const error = validation[response.id](null, {
      [`${response.id}-dontKnow`]: true,
    });

    expect(error).toBeNull();
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
