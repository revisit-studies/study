import { describe, expect, it } from 'vitest';
import type { IndividualComponent } from '../parser/types';
import { randomizeQuestionOrder } from './handleResponseRandomization';

describe('randomizeQuestionOrder', () => {
  it('stores matrix question order by value when rows have side labels', () => {
    const componentConfig = {
      type: 'questionnaire',
      response: [
        {
          id: 'matrix-side-labels',
          prompt: 'Matrix prompt',
          type: 'matrix-radio',
          answerOptions: ['1', '2', '3'],
          questionOptions: [
            {
              label: 'Obstructive - Supportive',
              value: 'obstructive-supportive',
              leftLabel: 'Obstructive',
              rightLabel: 'Supportive',
            },
            {
              label: 'Annoying - Enjoyable',
              value: 'annoying-enjoyable',
              leftLabel: 'Annoying',
              rightLabel: 'Enjoyable',
            },
          ],
        },
      ],
    } as IndividualComponent;

    expect(randomizeQuestionOrder(componentConfig)).toEqual({
      'matrix-side-labels': ['obstructive-supportive', 'annoying-enjoyable'],
    });
  });
});
