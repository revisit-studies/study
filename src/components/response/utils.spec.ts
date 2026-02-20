import {
  afterEach, beforeEach, describe, expect, it,
} from 'vitest';
import type { MatrixResponse } from '../../parser/types';

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

  it('uses question label when matrix question value is omitted', async () => {
    const { generateInitFields } = await import('./utils');

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
});

describe('mergeReactiveAnswers', () => {
  it('merges all reactive response ids from a single submission', async () => {
    const { mergeReactiveAnswers } = await import('./utils');

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
