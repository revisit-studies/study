import { describe, expect, test } from 'vitest';
import type { StorageEngine } from './types';
import type { StudyConfig } from '../../parser/types';
import type { ParticipantData } from '../types';
import { calculateProgressData, isCloudStorageEngine } from './utils';

// ---------------------------------------------------------------------------
// isCloudStorageEngine
// ---------------------------------------------------------------------------

describe('isCloudStorageEngine', () => {
  test('returns false when engine is undefined', () => {
    expect(isCloudStorageEngine(undefined)).toBe(false);
  });

  test('returns false when engine.isCloudEngine() returns false', () => {
    const engine = { isCloudEngine: () => false } as Partial<StorageEngine> as StorageEngine;
    expect(isCloudStorageEngine(engine)).toBe(false);
  });

  test('returns true when engine.isCloudEngine() returns true', () => {
    const engine = { isCloudEngine: () => true } as Partial<StorageEngine> as StorageEngine;
    expect(isCloudStorageEngine(engine)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// calculateProgressData
// ---------------------------------------------------------------------------

const makeAnswer = (componentName: string, endTime = 1000): ParticipantData['answers'][string] => ({
  componentName,
  trialOrder: '0',
  identifier: `${componentName}_0`,
  answer: {},
  incorrectAnswers: {},
  startTime: 0,
  endTime,
  windowEvents: [],
  timedOut: false,
  provenanceGraph: {} as ParticipantData['answers'][string]['provenanceGraph'],
} as Partial<ParticipantData['answers'][string]> as ParticipantData['answers'][string]);

const makeConfig = (componentKeys: string[]): StudyConfig => ({
  $schema: '',
  studyMetadata: {} as StudyConfig['studyMetadata'],
  sequence: { order: 'fixed', components: [] } as StudyConfig['sequence'],
  uiConfig: {
    logoPath: '', contactEmail: '', withProgressBar: false, withSidebar: false,
  },
  components: Object.fromEntries(componentKeys.map((k) => [k, {} as StudyConfig['components'][string]])),
});

describe('calculateProgressData', () => {
  test('counts answered components (endTime > -1)', () => {
    const answers: ParticipantData['answers'] = {
      intro_0: makeAnswer('intro'),
      trial1_1: makeAnswer('trial1'),
    };
    const { answered } = calculateProgressData(answers, ['intro', 'trial1'], makeConfig(['intro', 'trial1']), 0, undefined);
    expect(answered).toContain('intro');
    expect(answered).toContain('trial1');
  });

  test('excludes answers whose endTime is -1', () => {
    const answers: ParticipantData['answers'] = {
      intro_0: makeAnswer('intro', -1),
    };
    const { answered } = calculateProgressData(answers, ['intro'], makeConfig(['intro']), 0, undefined);
    expect(answered).toHaveLength(0);
  });

  test('total equals flatSequence length when all steps are in studyConfig.components', () => {
    const flatSequence = ['intro', 'trial1', 'end'];
    const { total } = calculateProgressData({}, flatSequence, makeConfig(flatSequence), 0, undefined);
    expect(total).toBe(3);
  });

  test('total counts dynamic-block answers via key prefix when step is not in components', () => {
    const answers: ParticipantData['answers'] = {
      funcBlock_0_0: makeAnswer('funcBlock'),
      funcBlock_0_1: makeAnswer('funcBlock'),
    };
    // 'funcBlock' is NOT in studyConfig.components → falls back to counting answer keys
    const { total } = calculateProgressData(answers, ['funcBlock'], makeConfig([]), 0, undefined);
    expect(total).toBe(2);
  });

  test('isDynamic is false when funcIndex is undefined', () => {
    const { isDynamic } = calculateProgressData({}, [], makeConfig([]), 0, undefined);
    expect(isDynamic).toBe(false);
  });

  test('isDynamic is true when funcIndex is provided', () => {
    const { isDynamic } = calculateProgressData({}, [], makeConfig([]), 0, '0');
    expect(isDynamic).toBe(true);
  });
});
