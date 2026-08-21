import { describe, expect, test } from 'vitest';
import { StoredAnswer } from './types';
import {
  getLegacyStoredAnswerProvenance,
  splitProvenanceFromAnswers,
} from './provenance';

function makeStoredAnswer(identifier: string): StoredAnswer {
  return {
    answer: {},
    identifier,
    componentName: 'intro',
    trialOrder: '0',
    incorrectAnswers: {},
    startTime: 1,
    endTime: 2,
    windowEvents: [],
    timedOut: false,
    helpButtonClickedCount: 0,
    parameters: {},
    correctAnswer: [],
    optionOrders: {},
    questionOrders: {},
  };
}

describe('provenance helpers', () => {
  test('legacy answer provenance reads tolerate null and non-object answers', () => {
    expect(getLegacyStoredAnswerProvenance(null)).toBeNull();
    expect(getLegacyStoredAnswerProvenance(undefined)).toBeNull();
    expect(getLegacyStoredAnswerProvenance('not-an-answer')).toBeNull();
    expect(getLegacyStoredAnswerProvenance({
      ...makeStoredAnswer('intro_0'),
      provenanceGraph: null,
    })).toBeNull();
  });

  test('splitProvenanceFromAnswers strips null inline provenance without saving a provenance asset', () => {
    const answerWithNullProvenance = {
      ...makeStoredAnswer('intro_0'),
      provenanceGraph: null,
    };

    const { answers, provenanceByIdentifier } = splitProvenanceFromAnswers({
      intro_0: answerWithNullProvenance,
    });

    expect(provenanceByIdentifier).toEqual({});
    expect('provenanceGraph' in answers.intro_0).toBe(false);
  });
});
