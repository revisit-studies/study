import {
  describe, expect, test,
} from 'vitest';
import type { ParticipantData } from '../../parser/types';
import { participantName } from '../participantName';
import { makeStudyConfig } from '../../tests/utils';

function makeParticipant(answers: Record<string, { answer: Record<string, string | number> }>): ParticipantData {
  return { answers } as ParticipantData;
}

function makeConfig(participantNameField?: string) {
  return makeStudyConfig({ uiConfig: { participantNameField } });
}

describe('participantName', () => {
  test('returns null when participantData is falsy', () => {
    // Runtime guard — function checks for falsy input even though type requires ParticipantData
    expect(participantName(null!)).toBeNull();
  });

  test('returns null when studyConfig is not provided', () => {
    const participant = makeParticipant({ intro_0: { answer: { name: 'Alice' } } });
    expect(participantName(participant)).toBeNull();
  });

  test('returns null when uiConfig has no participantNameField', () => {
    const participant = makeParticipant({ intro_0: { answer: { name: 'Alice' } } });
    const config = makeConfig();
    expect(participantName(participant, config)).toBeNull();
  });

  test('returns the answer value when participantNameField matches an answer key', () => {
    const participant = makeParticipant({ intro_0: { answer: { name: 'Alice' } } });
    const config = makeConfig('intro.name');
    expect(participantName(participant, config)).toBe('Alice');
  });

  test('matches answer key by prefix (task name before underscore)', () => {
    const participant = makeParticipant({ survey_3: { answer: { username: 'Bob' } } });
    const config = makeConfig('survey.username');
    expect(participantName(participant, config)).toBe('Bob');
  });

  test('returns null when no answer key starts with the task name', () => {
    const participant = makeParticipant({ other_0: { answer: { name: 'Carol' } } });
    const config = makeConfig('intro.name');
    expect(participantName(participant, config)).toBeNull();
  });

  test('returns the value as a string', () => {
    const participant = makeParticipant({ trial_0: { answer: { score: 42 } } });
    const config = makeConfig('trial.score');
    expect(participantName(participant, config)).toBe('42');
  });
});
