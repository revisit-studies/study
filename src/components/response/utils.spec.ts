import {
  afterEach, beforeEach, describe, expect, it,
} from 'vitest';
import type { MatrixResponse, Response } from '../../parser/types';
import { generateInitFields, mergeReactiveAnswers } from './utils';

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
          Q2: 'A',
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
