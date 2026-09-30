import { expect, test } from 'vitest';
import type { IndividualComponent } from '../../parser/types';
import { makeStoredAnswer, makeStudyConfig } from '../../tests/utils';
import { componentAnswersAreCorrect, getComponentAnswerStatus } from '../componentCorrectness';
import { getApplicableCorrectAnswers } from '../responseVisibility';
import { getSkipConditionCorrectAnswers } from '../skipConditions';

const component: IndividualComponent = {
  type: 'questionnaire',
  response: [
    {
      id: 'gate', type: 'radio', prompt: '', options: ['yes', 'no'],
    },
    {
      id: 'followUp',
      type: 'shortText',
      prompt: '',
      visibleIf: { responseId: 'gate', comparison: 'equals', value: 'yes' },
    },
  ],
  correctAnswer: [{ id: 'gate', answer: 'no' }, { id: 'followUp', answer: 'expected' }],
};

test('Check Answer, correctness skips and analysis exclude hidden correct answers', () => {
  const answer = { gate: 'no' };
  expect(getApplicableCorrectAnswers(component.response, answer, component.correctAnswer)).toEqual([{ id: 'gate', answer: 'no' }]);
  expect(componentAnswersAreCorrect(answer, component.correctAnswer, component.response)).toBe(true);
  const config = makeStudyConfig({ components: { form: component } });
  expect(getSkipConditionCorrectAnswers([['form_0', { answer }]], config)).toEqual([true]);
  expect(getComponentAnswerStatus(makeStoredAnswer({ answer, endTime: 100 }), component.correctAnswer, component.response)).toBe('correct');
});

test('visible unanswered responses remain incorrect', () => {
  const correctAnswers = [{ id: 'gate', answer: 'yes' }, { id: 'followUp', answer: 'expected' }];
  expect(componentAnswersAreCorrect({ gate: 'yes' }, correctAnswers, component.response)).toBe(false);
  expect(componentAnswersAreCorrect({ gate: 'yes', followUp: 'expected' }, correctAnswers, component.response)).toBe(true);
});

test('isCorrect visibility uses controller correctness without recursively scoring the component', () => {
  const responses = component.response.map((response) => (response.id === 'followUp'
    ? { ...response, visibleIf: { responseId: 'gate', comparison: 'isCorrect' as const, value: false } }
    : response));
  expect(componentAnswersAreCorrect({ gate: 'no' }, component.correctAnswer, responses)).toBe(true);
  expect(componentAnswersAreCorrect({ gate: 'yes' }, component.correctAnswer, responses)).toBe(false);
});
