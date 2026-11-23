import { expect, test } from 'vitest';
import { makeStoredAnswer, makeStudyConfig } from '../../tests/utils';
import { conditionIsTriggered, getStoredAnswersForSkipEvaluation } from '../skipConditions';

function makeConfig(path?: string) {
  return makeStudyConfig({
    components: {
      trial: {
        type: 'questionnaire',
        response: [{
          id: 'q', type: 'numerical', prompt: 'Score', ...(path ? { path } : {}),
        }],
        correctAnswer: [{ id: 'q', answer: 10 }],
      },
    },
    sequence: { order: 'fixed', components: ['trial'] },
  });
}

const skipOnIncorrect = {
  name: 'trial', check: 'responses' as const, to: 'end', firstIndex: 0, lastIndex: 0,
};

test('skip decisions preserve the dynamic threshold for saved fractional scores', () => {
  const answer = { q: 8 };
  const stored = makeStoredAnswer({
    answer,
    correctAnswer: [{ id: 'q', answer: 10, correctnessThreshold: 0.7 }],
    checkAnswer: {
      attemptsUsed: 1, correct: true, responses: { q: true }, scores: { q: 0.8 }, answerSnapshot: answer,
    },
  });
  const answers = getStoredAnswersForSkipEvaluation({ trial_0: stored });
  const config = makeConfig('test-response-functions/assets/GameScore.ts');

  expect(conditionIsTriggered(skipOnIncorrect, answers, config)).toBe(false);
  expect(conditionIsTriggered({
    ...skipOnIncorrect, check: 'block', condition: 'numCorrect', value: 1,
  }, answers, config)).toBe(true);
});

test('dynamic skip evaluation prefers the stored component name when an identifier prefix collides', () => {
  const config = makeConfig();
  config.components.adaptive_1_trial = {
    ...config.components.trial,
    correctAnswer: [{ id: 'q', answer: 8 }],
  };
  const stored = makeStoredAnswer({
    identifier: 'adaptive_1_trial_0',
    componentName: 'trial',
    trialOrder: '1_0',
    answer: { q: 8 },
    correctAnswer: [{ id: 'q', answer: 10 }],
  });
  const answers = getStoredAnswersForSkipEvaluation({ [stored.identifier]: stored });

  expect(conditionIsTriggered({
    ...skipOnIncorrect,
    firstIndex: 1,
    lastIndex: 1,
  }, answers, config)).toBe(true);
});

test('an explicitly empty dynamic rule list does not restore template grading during skips', () => {
  const answers = getStoredAnswersForSkipEvaluation({
    trial_0: makeStoredAnswer({ answer: { q: 5 }, correctAnswer: [] }),
  });
  expect(conditionIsTriggered(skipOnIncorrect, answers, makeConfig())).toBe(false);
});

test('archived dynamic answers are ignored by skip evaluation', () => {
  const answers = getStoredAnswersForSkipEvaluation({
    missing_0_0: makeStoredAnswer({
      identifier: 'missing_0_0', componentName: 'missing', trialOrder: '0_0', recordingArchived: true,
    }),
  });
  expect(answers).toEqual({});
  expect(conditionIsTriggered(
    {
      ...skipOnIncorrect,
      check: 'block',
      condition: 'numCorrect',
      value: 1,
    },
    answers,
    makeConfig(),
  )).toBe(false);
});
