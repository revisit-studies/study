import { expect, test, vi } from 'vitest';
import type { IndividualComponent, JsonValue, Response } from '../../parser/types';
import { makeStoredAnswer, makeStudyConfig } from '../../tests/utils';
import { componentAnswersAreCorrect, getComponentAnswerStatus } from '../componentCorrectness';
import { getApplicableCorrectAnswers } from '../responseVisibility';
import { conditionIsTriggered, getSkipConditionCorrectAnswers } from '../skipConditions';

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

test('component status is unknown when its response module cannot load', () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  const answer = makeStoredAnswer({ answer: { score: 10 }, endTime: 100 });
  const responses: IndividualComponent['response'] = [{
    id: 'score', type: 'numerical', prompt: '', path: 'missing.response.ts',
  }];

  expect(getComponentAnswerStatus(answer, [{ id: 'score', answer: 10 }], responses)).toBe('unknown');

  const config = makeStudyConfig({
    components: {
      form: { type: 'questionnaire', response: responses, correctAnswer: [{ id: 'score', answer: 10 }] },
    },
  });
  const answers = { form_0: { answer: { score: 10 }, timedOut: false } };
  expect(getSkipConditionCorrectAnswers([['form_0', answers.form_0]], config)).toEqual([null]);
  expect(conditionIsTriggered({
    name: 'form', check: 'responses', to: 'end', firstIndex: 0, lastIndex: 0,
  }, answers, config)).toBe(false);
  expect(conditionIsTriggered({
    check: 'block', condition: 'numIncorrect', value: 1, to: 'end', firstIndex: 0, lastIndex: 0,
  }, answers, config)).toBe(false);
  consoleError.mockRestore();
});

test('component correctness prefers the score saved with the participant answer', () => {
  const responses: IndividualComponent['response'] = [{
    id: 'score', type: 'numerical', prompt: '', path: 'test-response-functions/assets/PartialScore.response.ts',
  }];
  const answer = makeStoredAnswer({
    answer: { score: 10 },
    endTime: 100,
    checkAnswer: {
      attemptsUsed: 1,
      correct: false,
      responses: { score: false },
      scores: { score: 0.75 },
      answerSnapshot: { score: 10 },
    },
  });

  expect(getComponentAnswerStatus(answer, [{ id: 'score', answer: 10 }], responses)).toBe('incorrect');

  const mostlyCorrectAnswer = makeStoredAnswer({
    ...answer,
    checkAnswer: {
      attemptsUsed: 1,
      correct: true,
      responses: { score: true },
      scores: { score: 0.8 },
      answerSnapshot: { score: 10 },
    },
  });
  expect(getComponentAnswerStatus(mostlyCorrectAnswer, [{ id: 'score', answer: 10, correctnessThreshold: 0.8 }], responses)).toBe('correct');

  const editedAnswer = makeStoredAnswer({
    ...answer,
    answer: { score: 5 },
    checkAnswer: {
      attemptsUsed: 1,
      correct: true,
      responses: { score: true },
      scores: { score: 1 },
      answerSnapshot: { score: 10 },
    },
  });
  expect(getComponentAnswerStatus(editedAnswer, [{ id: 'score', answer: 10 }], responses)).toBe('incorrect');
});

test('isCorrect visibility uses the saved controller score when resolving applicable answers', () => {
  const responses: IndividualComponent['response'] = [{
    id: 'controller',
    type: 'custom',
    prompt: '',
    path: 'test-response-functions/assets/CustomPartialScore.tsx',
  }, {
    id: 'followUp',
    type: 'shortText',
    prompt: '',
    visibleIf: { responseId: 'controller', comparison: 'isCorrect', value: false },
  }];
  const userAnswers = { controller: { score: 5 }, followUp: 'unneeded' };
  const checkAnswer = {
    attemptsUsed: 1,
    correct: true,
    responses: { controller: true },
    scores: { controller: 1 },
    answerSnapshot: userAnswers,
  };
  const correctAnswers = [{ id: 'controller', answer: { score: 10 } }, { id: 'followUp', answer: 'expected' }];

  expect(componentAnswersAreCorrect(userAnswers, correctAnswers, responses)).toBe(false);
  expect(componentAnswersAreCorrect(userAnswers, correctAnswers, responses, checkAnswer)).toBe(true);
});

test('scores a custom response without a configured correct answer', () => {
  const responses: IndividualComponent['response'] = [{
    id: 'score',
    type: 'custom',
    prompt: '',
    path: 'test-response-functions/assets/CustomPartialScore.tsx',
  }];
  const answer = makeStoredAnswer({
    endTime: 1,
    answer: { score: { score: 10 } },
    checkAnswer: {
      attemptsUsed: 0,
      correct: true,
      responses: {},
      scores: { score: 1 },
      answerSnapshot: { score: { score: 10 } },
    },
  });

  expect(componentAnswersAreCorrect(answer.answer, undefined, responses, answer.checkAnswer)).toBe(true);
  expect(getComponentAnswerStatus(answer, undefined, responses)).toBe('correct');
});

test('uses saved standalone scores when historical response metadata is unavailable', () => {
  const answer = makeStoredAnswer({
    answer: { score: 5 },
    endTime: 1,
    checkAnswer: {
      attemptsUsed: 0,
      correct: false,
      responses: {},
      scores: { score: 0.2 },
      answerSnapshot: { score: 5 },
    },
  });

  expect(componentAnswersAreCorrect(answer.answer, undefined, undefined, answer.checkAnswer)).toBe(false);
  expect(getComponentAnswerStatus(answer, undefined, undefined)).toBe('incorrect');

  const staleScoreAnswer = makeStoredAnswer({
    ...answer,
    answer: { score: 7 },
  });
  expect(componentAnswersAreCorrect(staleScoreAnswer.answer, undefined, undefined, staleScoreAnswer.checkAnswer)).toBeNull();
});

test('skip evaluation honors saved standalone scores when the scorer is unavailable', () => {
  const responses: IndividualComponent['response'] = [{
    id: 'score', type: 'numerical', prompt: '', path: 'missing.response.ts',
  }];
  const config = makeStudyConfig({
    components: { form: { type: 'questionnaire', response: responses } },
  });
  const storedAnswer = makeStoredAnswer({
    answer: { score: 5 },
    checkAnswer: {
      attemptsUsed: 1,
      correct: true,
      responses: { score: true },
      scores: { score: 1 },
      answerSnapshot: { score: 5 },
    },
  });

  expect(getSkipConditionCorrectAnswers([['form_0', storedAnswer]], config)).toEqual([true]);
  expect(getSkipConditionCorrectAnswers([['form_0', {
    ...storedAnswer,
    answer: { score: 4 },
  }]], config)).toEqual([null]);
});

test('skip evaluation keeps an unresolved configured standalone scorer unknown', () => {
  const responses: IndividualComponent['response'] = [{
    id: 'score', type: 'numerical', prompt: '', path: 'missing.response.ts',
  }];
  const config = makeStudyConfig({
    components: { form: { type: 'questionnaire', response: responses } },
  });
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  const storedAnswer = makeStoredAnswer({ answer: { score: 5 } });

  expect(getSkipConditionCorrectAnswers([['form_0', storedAnswer]], config)).toEqual([null]);
  expect(conditionIsTriggered({
    name: 'form', check: 'responses', to: 'end', firstIndex: 0, lastIndex: 0,
  }, { form_0: storedAnswer }, config)).toBe(false);
  expect(conditionIsTriggered({
    check: 'block', condition: 'numCorrect', value: 1, to: 'end', firstIndex: 0, lastIndex: 0,
  }, { form_0: storedAnswer }, config)).toBe(false);

  consoleError.mockRestore();
});

test('validation-only response functions do not create correctness grades', () => {
  const response: IndividualComponent['response'] = [{
    id: 'even', type: 'numerical', prompt: '', path: 'test-response-functions/assets/EvenNumber.response.ts',
  }];
  const answer = makeStoredAnswer({ answer: { even: 4 }, endTime: 100 });

  expect(componentAnswersAreCorrect(answer.answer, undefined, response)).toBeNull();
  expect(getComponentAnswerStatus(answer, undefined, response)).toBe('unknown');
});

test('validation-only modules do not change numCorrect skip grading', () => {
  const response: IndividualComponent['response'] = [{
    id: 'even', type: 'numerical', prompt: '', path: 'test-response-functions/assets/EvenNumber.response.ts',
  }];
  const config = makeStudyConfig({
    components: { form: { type: 'questionnaire', response } },
  });
  const storedAnswer = { answer: { even: 4 }, timedOut: false };
  const answers = { form_0: storedAnswer };
  const condition = {
    check: 'block' as const,
    condition: 'numCorrect' as const,
    value: 1,
    to: 'end',
    firstIndex: 0,
    lastIndex: 0,
  };

  expect(getSkipConditionCorrectAnswers([['form_0', storedAnswer]], config)).toEqual([true]);
  expect(conditionIsTriggered(condition, answers, config)).toBe(true);
});

test('an unanswered validation-only response with I do not know does not block correctness', () => {
  const responses: IndividualComponent['response'] = [{
    id: 'ordinary',
    type: 'shortText',
    prompt: '',
  }, {
    id: 'even',
    type: 'numerical',
    prompt: '',
    withDontKnow: true,
    path: 'test-response-functions/assets/EvenNumber.response.ts',
  }];
  const correctAnswers = [{ id: 'ordinary', answer: 'correct' }];
  const answer = { ordinary: 'correct', even: '', 'even-dontKnow': true };
  const config = makeStudyConfig({
    components: { form: { type: 'questionnaire', response: responses, correctAnswer: correctAnswers } },
  });

  expect(componentAnswersAreCorrect(answer, correctAnswers, responses)).toBe(true);
  expect(getSkipConditionCorrectAnswers([['form_0', { answer }]], config)).toEqual([true]);
  expect(conditionIsTriggered({
    check: 'block', condition: 'numCorrect', value: 1, to: 'end', firstIndex: 0, lastIndex: 0,
  }, { form_0: { answer, timedOut: false } }, config)).toBe(true);
});

test.each([
  ['empty string', ''],
  ['empty array', [] as unknown[]],
  ['null', null],
])('unanswered standalone scorer values (%s) are unknown, not incorrect or correct', (_label, value) => {
  const response: IndividualComponent['response'] = [{
    id: 'even', type: 'numerical', prompt: '', path: 'test-response-functions/assets/PartialScore.response.ts',
  }, { id: 'other', type: 'shortText', prompt: '' }];
  const answers = { other: 'answered', even: value as JsonValue };
  const config = makeStudyConfig({ components: { form: { type: 'questionnaire', response } } });

  expect(componentAnswersAreCorrect(answers, undefined, response)).toBeNull();
  expect(getSkipConditionCorrectAnswers([['form_0', { answer: answers }]], config)).toEqual([null]);
});

test('a missing standalone scorer answer does not make the component vacuously correct', () => {
  const responses: IndividualComponent['response'] = [{
    id: 'even', type: 'numerical', prompt: '', path: 'test-response-functions/assets/PartialScore.response.ts',
  }, { id: 'other', type: 'shortText', prompt: '' }];

  expect(componentAnswersAreCorrect({ other: 'answered' }, undefined, responses)).toBeNull();
  expect(componentAnswersAreCorrect({}, undefined, responses)).toBeNull();
});

test('an unanswered required scorer-only response keeps a mixed component unknown', () => {
  const responses: IndividualComponent['response'] = [{
    id: 'ordinary', type: 'shortText', prompt: '',
  }, {
    id: 'even',
    type: 'numerical',
    prompt: '',
    withDontKnow: true,
    path: 'test-response-functions/assets/PartialScore.response.ts',
  }];
  const correctAnswers = [{ id: 'ordinary', answer: 'correct' }];
  const answer = { ordinary: 'correct', even: '', 'even-dontKnow': true };
  const config = makeStudyConfig({
    components: {
      form: {
        type: 'questionnaire', response: responses, correctAnswer: correctAnswers,
      },
    },
  });

  expect(componentAnswersAreCorrect(answer, correctAnswers, responses)).toBeNull();
  expect(getSkipConditionCorrectAnswers([['form_0', { answer }]], config)).toEqual([null]);
  expect(conditionIsTriggered({
    name: 'form', check: 'responses', to: 'end', firstIndex: 0, lastIndex: 0,
  }, { form_0: { answer, timedOut: false } }, config)).toBe(false);
});

test('an unanswered response with an unavailable scorer keeps a mixed component unknown', () => {
  const responses: IndividualComponent['response'] = [{
    id: 'ordinary', type: 'shortText', prompt: '',
  }, {
    id: 'scored', type: 'numerical', prompt: '', path: 'missing.response.ts',
  }];
  const correctAnswers = [{ id: 'ordinary', answer: 'correct' }];

  expect(componentAnswersAreCorrect({ ordinary: 'correct' }, correctAnswers, responses)).toBeNull();
});

test('an unanswered optional scorer-only response does not invalidate a graded answer', () => {
  const responses: IndividualComponent['response'] = [{
    id: 'ordinary', type: 'shortText', prompt: '',
  }, {
    id: 'even',
    type: 'numerical',
    prompt: '',
    required: false,
    path: 'test-response-functions/assets/PartialScore.response.ts',
  }];

  expect(componentAnswersAreCorrect({ ordinary: 'correct' }, [{ id: 'ordinary', answer: 'correct' }], responses)).toBe(true);
});

test('a default-valued optional scorer is graded while an empty optional numerical scorer is ignored', () => {
  const responses: IndividualComponent['response'] = [{
    id: 'ordinary', type: 'shortText', prompt: '',
  }, {
    id: 'defaultScore',
    type: 'numerical',
    prompt: '',
    required: false,
    path: 'test-response-functions/assets/PartialScore.response.ts',
    default: 5,
  }, {
    id: 'emptyNumber',
    type: 'numerical',
    prompt: '',
    required: false,
    path: 'test-response-functions/assets/PartialScore.response.ts',
  }];
  const correctAnswers = [
    { id: 'ordinary', answer: 'correct' },
    { id: 'defaultScore', answer: 10 },
    { id: 'emptyNumber', answer: 10 },
  ];

  expect(componentAnswersAreCorrect({ ordinary: 'correct', defaultScore: 5 }, correctAnswers, responses)).toBe(false);
  expect(componentAnswersAreCorrect({ ordinary: 'correct', defaultScore: 10 }, correctAnswers, responses)).toBe(true);
});

test('a scorer failure cannot be masked by another correct response', () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  const responses: IndividualComponent['response'] = [{
    id: 'ordinary', type: 'shortText', prompt: '',
  }, {
    id: 'scored', type: 'numerical', prompt: '', path: 'missing.response.ts',
  }];
  const correctAnswers = [{ id: 'ordinary', answer: 'correct' }];
  const answer = { ordinary: 'correct', scored: 5 };
  const config = makeStudyConfig({
    components: {
      form: {
        type: 'questionnaire', response: responses, correctAnswer: correctAnswers,
      },
    },
  });

  expect(componentAnswersAreCorrect(answer, correctAnswers, responses)).toBeNull();
  expect(getSkipConditionCorrectAnswers([['form_0', { answer }]], config)).toEqual([null]);
  expect(conditionIsTriggered({
    name: 'form', check: 'responses', to: 'end', firstIndex: 0, lastIndex: 0,
  }, { form_0: { answer, timedOut: false } }, config)).toBe(false);
  consoleError.mockRestore();
});

test('answer threshold overrides the default full-credit score cutoff', () => {
  const responses: Response[] = [{
    id: 'score', type: 'numerical', prompt: '', path: 'test-response-functions/assets/GameScore.ts',
  }];
  const answer = { score: 7 };
  const correctAnswers = [{ id: 'score', answer: 10, correctnessThreshold: 0.7 }];

  expect(componentAnswersAreCorrect(answer, [{ id: 'score', answer: 10 }], responses)).toBe(false);
  expect(componentAnswersAreCorrect(answer, correctAnswers, responses)).toBe(true);
});

test.each(['', [], null, undefined])('a required blank answer is incorrect with a zero threshold (%s)', (value) => {
  const responses: Response[] = [{ id: 'score', type: 'numerical', prompt: '' }];
  const correctAnswers = [{ id: 'score', answer: 10, correctnessThreshold: 0 }];

  expect(componentAnswersAreCorrect({ score: value } as Record<string, JsonValue>, correctAnswers, responses)).toBe(false);
});

test('I do not know overrides a populated default in component correctness', () => {
  const responses: Response[] = [{
    id: 'score',
    type: 'numerical',
    prompt: '',
    withDontKnow: true,
    path: 'test-response-functions/assets/GameScore.ts',
  }];
  const correctAnswers = [{ id: 'score', answer: 10 }];

  expect(componentAnswersAreCorrect({ score: 10, 'score-dontKnow': true }, correctAnswers, responses)).toBe(false);
});

test('a required scorer with no grade keeps mixed component correctness unknown', () => {
  const responses: Response[] = [{
    id: 'ordinary', type: 'shortText', prompt: '',
  }, {
    id: 'scored',
    type: 'numerical',
    prompt: '',
    path: 'test-response-functions/assets/PartialScore.response.ts',
  }];

  expect(componentAnswersAreCorrect(
    { ordinary: 'correct', scored: 5 },
    [{ id: 'ordinary', answer: 'correct' }],
    responses,
  )).toBeNull();
});
