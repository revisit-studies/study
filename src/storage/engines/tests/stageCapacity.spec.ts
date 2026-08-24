import {
  afterEach, beforeEach, describe, expect, test,
} from 'vitest';
import testConfigSimple from '../../tests/testConfigSimple.json';
import { StudyConfig } from '../../../parser/types';
import { ParticipantMetadata } from '../../../store/types';
import { generateSequenceArray } from '../../../utils/handleRandomSequences';
import { LocalStorageEngine } from '../LocalStorageEngine';
import {
  getBetweenSubjectsCombinationKey, getStageParticipantCounts, StageCapacityExceededError, StageNoAvailableConditionsError, StageOnlyDisabledConditionsHaveCapacityError, StorageEngine, type SequenceAssignment,
} from '../types';

const studyId = 'stage-capacity-test';
const config = testConfigSimple as StudyConfig;
const betweenSubjectsConfig: StudyConfig = {
  ...config,
  uiConfig: { ...config.uiConfig, numSequences: 10 },
  factors: { version: ['control', 'treatment'] },
  betweenSubjects: ['version'],
};
const metadata: ParticipantMetadata = {
  userAgent: 'test-user-agent',
  resolution: { width: 1920, height: 1080 },
  language: 'en-US',
  ip: '127.0.0.1',
};

describe('stage capacity', () => {
  let storageEngine: StorageEngine;

  beforeEach(async () => {
    storageEngine = new LocalStorageEngine(true);
    await storageEngine.connect();
    await storageEngine.initializeStudyDb(studyId);
    await storageEngine.setSequenceArray(await generateSequenceArray(config));
    await storageEngine.setCurrentStage(studyId, 'LIMITED', '#00AAFF', 1);
  });

  afterEach(async () => {
    // @ts-expect-error Protected test-only cleanup.
    await storageEngine._testingReset(studyId);
  });

  test('counts completed and in-progress participants but excludes rejected participants', () => {
    expect(getStageParticipantCounts([
      { stage: 'LIMITED', rejected: false },
      { stage: 'LIMITED', rejected: false },
      { stage: 'LIMITED', rejected: true },
      { stage: 'OTHER', rejected: false },
    ] as SequenceAssignment[])).toEqual({ LIMITED: 2, OTHER: 1 });
  });

  test('prevents a new participant from entering a full stage and allows replacement after rejection', async () => {
    const firstParticipant = await storageEngine.initializeParticipantSession({}, config, metadata);
    await storageEngine.clearCurrentParticipantId();

    await expect(storageEngine.initializeParticipantSession({}, config, metadata))
      .rejects.toBeInstanceOf(StageCapacityExceededError);

    const assignmentsBeforeReject = await storageEngine.getAllSequenceAssignments(studyId);
    expect(assignmentsBeforeReject).toHaveLength(1);

    await storageEngine.rejectParticipant(firstParticipant.participantId, 'Test rejection');
    await storageEngine.clearCurrentParticipantId();
    const replacementParticipant = await storageEngine.initializeParticipantSession({}, config, metadata);

    expect(replacementParticipant.participantId).not.toBe(firstParticipant.participantId);
    expect(getStageParticipantCounts(await storageEngine.getAllSequenceAssignments(studyId))).toEqual({ LIMITED: 1 });
  });

  test('serializes concurrent entries so a stage limit is never exceeded', async () => {
    const secondStorageEngine = new LocalStorageEngine(true);
    await secondStorageEngine.connect();
    await secondStorageEngine.initializeStudyDb(studyId);

    const results = await Promise.allSettled([
      storageEngine.initializeParticipantSession({}, config, metadata, 'first-participant'),
      secondStorageEngine.initializeParticipantSession({}, config, metadata, 'second-participant'),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(getStageParticipantCounts(await storageEngine.getAllSequenceAssignments(studyId)))
      .toEqual({ LIMITED: 1 });
  });

  test('assigns only enabled between-subjects combinations for the current stage', async () => {
    await storageEngine.setSequenceArray(await generateSequenceArray(betweenSubjectsConfig));
    await storageEngine.updateStage(studyId, 'LIMITED', {
      disabledBetweenSubjectsCombinations: [
        getBetweenSubjectsCombinationKey({ version: 'control' }, ['version']),
      ],
    });

    const participant = await storageEngine.initializeParticipantSession({}, betweenSubjectsConfig, metadata);

    expect(participant.sequence.parameters?.version).toBe('treatment');
  });

  test('stops entry when every between-subjects combination is disabled', async () => {
    await storageEngine.setSequenceArray(await generateSequenceArray(betweenSubjectsConfig));
    await storageEngine.updateStage(studyId, 'LIMITED', {
      disabledBetweenSubjectsCombinations: ['control', 'treatment'].map((version) => (
        getBetweenSubjectsCombinationKey({ version }, ['version'])
      )),
    });

    await expect(storageEngine.initializeParticipantSession({}, betweenSubjectsConfig, metadata))
      .rejects.toBeInstanceOf(StageNoAvailableConditionsError);
    expect(await storageEngine.getAllSequenceAssignments(studyId)).toHaveLength(0);
  });

  test('does not assign more participants to a combination than its desired count', async () => {
    await storageEngine.setSequenceArray(await generateSequenceArray(betweenSubjectsConfig));
    const controlKey = getBetweenSubjectsCombinationKey({ version: 'control' }, ['version']);
    const treatmentKey = getBetweenSubjectsCombinationKey({ version: 'treatment' }, ['version']);
    await storageEngine.updateStage(studyId, 'LIMITED', {
      maxParticipants: 4,
      participantAssignmentMode: 'manual',
      manualDesiredParticipantsByCombination: { [controlKey]: 1, [treatmentKey]: 3 },
    });

    const assignParticipants = async (remaining: number): Promise<string[]> => {
      if (remaining === 0) {
        return [];
      }
      const participant = await storageEngine.initializeParticipantSession({}, betweenSubjectsConfig, metadata);
      await storageEngine.clearCurrentParticipantId();
      return [
        String(participant.sequence.parameters?.version),
        ...await assignParticipants(remaining - 1),
      ];
    };
    const assignedVersions = await assignParticipants(4);

    expect(assignedVersions.filter((version) => version === 'control')).toHaveLength(1);
    expect(assignedVersions.filter((version) => version === 'treatment')).toHaveLength(3);
  });

  test('does not apply capacity limits while data collection is disabled', async () => {
    await storageEngine.setSequenceArray(await generateSequenceArray(betweenSubjectsConfig));
    const controlKey = getBetweenSubjectsCombinationKey({ version: 'control' }, ['version']);
    const treatmentKey = getBetweenSubjectsCombinationKey({ version: 'treatment' }, ['version']);
    await storageEngine.updateStage(studyId, 'LIMITED', {
      maxParticipants: 2,
      participantAssignmentMode: 'manual',
      manualDesiredParticipantsByCombination: { [controlKey]: 1, [treatmentKey]: 1 },
    });

    await storageEngine.initializeParticipantSession({}, betweenSubjectsConfig, metadata, 'collected-one');
    await storageEngine.initializeParticipantSession({}, betweenSubjectsConfig, metadata, 'collected-two');
    await storageEngine.setMode(studyId, 'dataCollectionEnabled', false);

    const previewParticipant = await storageEngine.initializeParticipantSession(
      {},
      betweenSubjectsConfig,
      metadata,
      'preview-participant',
    );

    expect(previewParticipant.sequence).toBeDefined();
    expect(await storageEngine.getAllSequenceAssignments(studyId)).toHaveLength(2);
  });

  test('retains manual allocation targets while even allocation is active', async () => {
    await storageEngine.setSequenceArray(await generateSequenceArray(betweenSubjectsConfig));
    const controlKey = getBetweenSubjectsCombinationKey({ version: 'control' }, ['version']);
    const treatmentKey = getBetweenSubjectsCombinationKey({ version: 'treatment' }, ['version']);
    const manualTargets = { [controlKey]: 1, [treatmentKey]: 3 };

    await storageEngine.updateStage(studyId, 'LIMITED', {
      maxParticipants: 4,
      participantAssignmentMode: 'manual',
      manualDesiredParticipantsByCombination: manualTargets,
    });
    await storageEngine.updateStage(studyId, 'LIMITED', {
      participantAssignmentMode: 'even',
    });

    expect((await storageEngine.getStageData(studyId)).allStages).toContainEqual(expect.objectContaining({
      stageName: 'LIMITED',
      participantAssignmentMode: 'even',
      manualDesiredParticipantsByCombination: manualTargets,
    }));
  });

  test('explains when remaining capacity is only in disabled combinations', async () => {
    await storageEngine.setSequenceArray(await generateSequenceArray(betweenSubjectsConfig));
    const controlKey = getBetweenSubjectsCombinationKey({ version: 'control' }, ['version']);
    const treatmentKey = getBetweenSubjectsCombinationKey({ version: 'treatment' }, ['version']);
    await storageEngine.updateStage(studyId, 'LIMITED', {
      maxParticipants: 2,
      desiredParticipantsByCombination: { [controlKey]: 1, [treatmentKey]: 1 },
      disabledBetweenSubjectsCombinations: [controlKey],
    });

    const participant = await storageEngine.initializeParticipantSession({}, betweenSubjectsConfig, metadata);
    expect(participant.sequence.parameters?.version).toBe('treatment');
    await storageEngine.clearCurrentParticipantId();

    await expect(storageEngine.initializeParticipantSession({}, betweenSubjectsConfig, metadata))
      .rejects.toBeInstanceOf(StageOnlyDisabledConditionsHaveCapacityError);
  });

  test('stores and clears manual desired participant counts for a combination', async () => {
    const combinationKey = getBetweenSubjectsCombinationKey({ version: 'treatment' }, ['version']);

    await storageEngine.updateStage(studyId, 'LIMITED', {
      desiredParticipantsByCombination: { [combinationKey]: 12 },
    });
    expect((await storageEngine.getStageData(studyId)).allStages[1])
      .toMatchObject({ desiredParticipantsByCombination: { [combinationKey]: 12 } });

    await storageEngine.updateStage(studyId, 'LIMITED', {
      desiredParticipantsByCombination: null,
    });
    expect((await storageEngine.getStageData(studyId)).allStages[1])
      .not.toHaveProperty('desiredParticipantsByCombination');
  });
});
