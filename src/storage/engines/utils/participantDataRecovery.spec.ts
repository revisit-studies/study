import {
  describe,
  expect,
  test,
} from 'vitest';
import { Sequence, StoredAnswer } from '../../../store/types';
import { ParticipantData } from '../../types';
import { shouldPreferCachedParticipantData } from './participantDataRecovery';

const baseSequence: Sequence = {
  id: 'root',
  orderPath: 'root',
  order: 'fixed',
  components: ['intro'],
  skip: [],
};

function makeStoredAnswer(identifier: string, endTime: number): StoredAnswer {
  return {
    answer: { response: `answer-${endTime}` },
    identifier,
    componentName: 'intro',
    trialOrder: '0',
    incorrectAnswers: {},
    startTime: endTime - 10,
    endTime,
    provenanceGraph: {
      aboveStimulus: undefined,
      belowStimulus: undefined,
      stimulus: undefined,
      sidebar: undefined,
    },
    windowEvents: [],
    timedOut: false,
    helpButtonClickedCount: 0,
    parameters: {},
    correctAnswer: [],
    optionOrders: {},
    questionOrders: {},
  };
}

function makeParticipantData(overrides: Partial<ParticipantData> = {}): ParticipantData {
  return {
    participantId: 'participant-1',
    participantConfigHash: 'config-1',
    sequence: baseSequence,
    participantIndex: 1,
    answers: {},
    searchParams: {},
    metadata: {
      userAgent: 'test-agent',
      resolution: { width: 1920, height: 1080 },
      language: 'en-US',
      ip: '127.0.0.1',
    },
    rejected: false,
    participantTags: [],
    stage: 'DEFAULT',
    createdTime: 1,
    ...overrides,
  };
}

describe('shouldPreferCachedParticipantData', () => {
  test('prefers cached participant data when it has more answered questions', () => {
    const remoteParticipantData = makeParticipantData({
      answers: { intro_0: makeStoredAnswer('intro_0', 100) },
    });
    const cachedParticipantData = makeParticipantData({
      answers: {
        intro_0: makeStoredAnswer('intro_0', 100),
        intro_1: makeStoredAnswer('intro_1', 200),
      },
    });

    expect(shouldPreferCachedParticipantData(cachedParticipantData, remoteParticipantData)).toBe(true);
  });

  test('prefers cached participant data when answered questions are newer', () => {
    const remoteParticipantData = makeParticipantData({
      answers: { intro_0: makeStoredAnswer('intro_0', 100) },
    });
    const cachedParticipantData = makeParticipantData({
      answers: { intro_0: makeStoredAnswer('intro_0', 200) },
    });

    expect(shouldPreferCachedParticipantData(cachedParticipantData, remoteParticipantData)).toBe(true);
  });

  test('keeps remote participant data when answer metadata matches', () => {
    const remoteParticipantData = makeParticipantData({
      answers: { intro_0: makeStoredAnswer('intro_0', 100) },
    });
    const cachedParticipantData = makeParticipantData({
      answers: { intro_0: makeStoredAnswer('intro_0', 100) },
      participantTags: ['cached-only-tag'],
    });

    expect(shouldPreferCachedParticipantData(cachedParticipantData, remoteParticipantData)).toBe(false);
  });

  test('keeps remote participant data when cached differences are only non-answer fields', () => {
    const remoteParticipantData = makeParticipantData({
      answers: { intro_0: makeStoredAnswer('intro_0', 100) },
      searchParams: { source: 'remote' },
    });
    const cachedParticipantData = makeParticipantData({
      answers: { intro_0: makeStoredAnswer('intro_0', 100) },
      searchParams: { source: 'cached' },
      stage: 'FOLLOW_UP',
    });

    expect(shouldPreferCachedParticipantData(cachedParticipantData, remoteParticipantData)).toBe(false);
  });
});
