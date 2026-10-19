import {
  afterEach, beforeEach, describe, expect, test,
} from 'vitest';
import { ParticipantData } from '../../types';
import testConfigSimple from '../../tests/testConfigSimple.json';
import { StudyConfig } from '../../../parser/types';
import { ParticipantMetadata, Sequence } from '../../../store/types';
import { generateSequenceArray } from '../../../utils/handleRandomSequences';
import { LocalStorageEngine } from '../LocalStorageEngine';
import {
  getBetweenSubjectsCombinationKey, getStageParticipantCounts, StageCapacityExceededError, StageConditionCapacityExceededError, StageNoAvailableConditionsError, StageOnlyDisabledConditionsHaveCapacityError, StorageEngine, type SequenceAssignment, type StorageObject, type StorageObjectType,
} from '../types';

const studyId = 'stage-capacity-test';
const config = testConfigSimple as StudyConfig;
const betweenSubjectsConfig: StudyConfig = {
  ...config,
  uiConfig: { ...config.uiConfig, numSequences: 10 },
  factors: { version: ['control', 'treatment'] },
  betweenSubjects: ['version'],
};
const latinSquareConfig: StudyConfig = {
  ...betweenSubjectsConfig,
  uiConfig: { ...betweenSubjectsConfig.uiConfig, numSequences: 4 },
  components: { ...config.components, secondComponent: config.components.testComponent },
  sequence: { order: 'latinSquare', components: ['testComponent', 'secondComponent'] },
};
const metadata: ParticipantMetadata = {
  userAgent: 'test-user-agent',
  resolution: { width: 1920, height: 1080 },
  language: 'en-US',
  ip: '127.0.0.1',
};

// _getSequence writes the between-subjects combination key after it has already
// created the sequence assignment, so failing that write reproduces an
// initialization that dies with an assignment already on record.
class FailingAssignmentStorageEngine extends LocalStorageEngine {
  protected override async _updateSequenceAssignmentFields(): Promise<void> {
    throw new Error('Simulated sequence assignment failure');
  }
}

class FailingAssignmentCreationStorageEngine extends LocalStorageEngine {
  protected override async _createSequenceAssignment(): Promise<void> {
    throw new Error('Simulated assignment creation failure');
  }
}

class FailingInitialParticipantWriteStorageEngine extends LocalStorageEngine {
  private failParticipantWrite = true;

  protected override async _pushToStorage<T extends StorageObjectType>(
    prefix: string,
    type: T,
    objectToUpload: StorageObject<T>,
  ) {
    if (this.failParticipantWrite && type === 'participantData' && prefix.startsWith('participants/')) {
      this.failParticipantWrite = false;
      throw new Error('Simulated initial participant write failure');
    }
    return super._pushToStorage(prefix, type, objectToUpload);
  }
}

// Fails the initial participant write and the cleanup that would release its
// assignment, as a storage outage would, leaving an active assignment with no
// participant record.
class FailingInitialWriteAndCleanupStorageEngine extends FailingInitialParticipantWriteStorageEngine {
  private failRejection = true;

  protected override async _rejectParticipantRealtime(participantId: string) {
    if (this.failRejection) {
      this.failRejection = false;
      throw new Error('Simulated cleanup failure');
    }
    return super._rejectParticipantRealtime(participantId);
  }
}

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

  test('does not restore a rejected participant after its slot is reassigned', async () => {
    const firstParticipant = await storageEngine.initializeParticipantSession({}, config, metadata, 'first-participant');
    await storageEngine.rejectParticipant(firstParticipant.participantId, 'Test rejection');
    await storageEngine.clearCurrentParticipantId();
    await storageEngine.initializeParticipantSession({}, config, metadata, 'replacement-participant');

    await expect(storageEngine.undoRejectParticipant(firstParticipant.participantId))
      .rejects.toThrow('Cannot undo rejection after the participant slot has been reassigned');

    expect((await storageEngine.getParticipantData(firstParticipant.participantId))?.rejected).not.toBe(false);
    expect(getStageParticipantCounts(await storageEngine.getAllSequenceAssignments(studyId)))
      .toEqual({ LIMITED: 1 });
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

  test('tops up the condition that is behind instead of continuing the rotation', async () => {
    await storageEngine.setSequenceArray(await generateSequenceArray(betweenSubjectsConfig));
    const controlKey = getBetweenSubjectsCombinationKey({ version: 'control' }, ['version']);
    await storageEngine.updateStage(studyId, 'LIMITED', {
      maxParticipants: null,
      disabledBetweenSubjectsCombinations: [controlKey],
    });

    const assignVersion = async (participantId: string) => {
      const participant = await storageEngine.initializeParticipantSession(
        {},
        betweenSubjectsConfig,
        metadata,
        participantId,
      );
      await storageEngine.clearCurrentParticipantId();
      return String(participant.sequence.parameters?.version);
    };

    expect(await assignVersion('treatment-one')).toBe('treatment');
    expect(await assignVersion('treatment-two')).toBe('treatment');

    await storageEngine.updateStage(studyId, 'LIMITED', {
      disabledBetweenSubjectsCombinations: null,
    });

    // Control is two participants behind, so both new participants go to it
    // rather than resuming the latin-square alternation.
    expect(await assignVersion('catch-up-one')).toBe('control');
    expect(await assignVersion('catch-up-two')).toBe('control');

    const assignments = await storageEngine.getAllSequenceAssignments(studyId);
    const treatmentKey = getBetweenSubjectsCombinationKey({ version: 'treatment' }, ['version']);
    const countFor = (combinationKey: string) => assignments.filter(
      (assignment) => assignment.betweenSubjectsCombinationKey === combinationKey,
    ).length;
    expect(countFor(controlKey)).toBe(countFor(treatmentKey));
  });

  test.each([null, 8])('rotates Latin-square rows within each condition with stage maximum %s', async (maxParticipants) => {
    const sequences = generateSequenceArray(latinSquareConfig);
    await storageEngine.setSequenceArray(sequences);
    await storageEngine.updateStage(studyId, 'LIMITED', { maxParticipants });

    const assignedSequences: Sequence[] = [];
    for (let index = 0; index < 8; index += 1) {
      // eslint-disable-next-line no-await-in-loop
      const participant = await storageEngine.initializeParticipantSession({}, latinSquareConfig, metadata, `participant-${index}`);
      assignedSequences.push(participant.sequence);
    }

    ['control', 'treatment'].forEach((version) => {
      const expectedOrders = sequences.filter((sequence) => sequence.parameters?.version === version)
        .map((sequence) => sequence.components);
      expect(new Set(expectedOrders.map((order) => JSON.stringify(order))).size).toBe(2);
      expect(assignedSequences.filter((sequence) => sequence.parameters?.version === version)
        .map((sequence) => sequence.components)).toEqual([...expectedOrders, ...expectedOrders]);
    });
  });

  test.each([0, 1])('fills the missing order after rejecting participant %s', async (rejectedIndex) => {
    await storageEngine.setSequenceArray(generateSequenceArray(latinSquareConfig));
    await storageEngine.updateStage(studyId, 'LIMITED', { maxParticipants: 4 });
    const participants: ParticipantData[] = [];
    for (let index = 0; index < 4; index += 1) {
      // eslint-disable-next-line no-await-in-loop
      participants.push(await storageEngine.initializeParticipantSession({}, latinSquareConfig, metadata, `participant-${index}`));
    }
    const rejected = participants[rejectedIndex];
    await storageEngine.rejectParticipant(rejected.participantId, 'Timed out');
    const replacement = await storageEngine.initializeParticipantSession({}, latinSquareConfig, metadata, 'replacement');

    expect(replacement.sequence.parameters).toEqual(rejected.sequence.parameters);
    expect(replacement.sequence.components).toEqual(rejected.sequence.components);
  });

  test('initializes manual targets from the saved stage maximum', async () => {
    const keys = ['control', 'treatment'].map((version) => getBetweenSubjectsCombinationKey({ version }, ['version']));
    await storageEngine.updateStage(studyId, 'LIMITED', { maxParticipants: 4 });

    await storageEngine.setStageParticipantAssignmentMode(studyId, 'LIMITED', 'manual', keys);

    expect((await storageEngine.getStageData(studyId)).allStages).toContainEqual(expect.objectContaining({
      stageName: 'LIMITED',
      maxParticipants: 4,
      participantAssignmentMode: 'manual',
      manualDesiredParticipantsByCombination: { [keys[0]]: 2, [keys[1]]: 2 },
    }));
  });

  test('restores the enforced maximum when reactivating saved manual targets', async () => {
    const keys = ['control', 'treatment'].map((version) => getBetweenSubjectsCombinationKey({ version }, ['version']));
    const targets = { [keys[0]]: 6, [keys[1]]: 8 };
    await storageEngine.updateStage(studyId, 'LIMITED', {
      maxParticipants: 14,
      participantAssignmentMode: 'manual',
      manualDesiredParticipantsByCombination: targets,
    });
    await storageEngine.setStageParticipantAssignmentMode(studyId, 'LIMITED', 'even', keys);
    await storageEngine.updateStage(studyId, 'LIMITED', { maxParticipants: 2 });
    await storageEngine.setStageParticipantAssignmentMode(studyId, 'LIMITED', 'manual', keys);

    expect((await storageEngine.getStageData(studyId)).allStages).toContainEqual(expect.objectContaining({
      stageName: 'LIMITED',
      maxParticipants: 14,
      participantAssignmentMode: 'manual',
      manualDesiredParticipantsByCombination: targets,
    }));
  });

  test('keeps concurrent edits to different stages', async () => {
    const secondStorageEngine = new LocalStorageEngine(true);
    await secondStorageEngine.connect();
    await secondStorageEngine.initializeStudyDb(studyId);

    await Promise.all([
      storageEngine.updateStage(studyId, 'LIMITED', { maxParticipants: 7 }),
      secondStorageEngine.updateStage(studyId, 'DEFAULT', { color: '#123456' }),
    ]);

    const { allStages } = await storageEngine.getStageData(studyId);
    expect(allStages).toContainEqual(expect.objectContaining({ stageName: 'LIMITED', maxParticipants: 7 }));
    expect(allStages).toContainEqual(expect.objectContaining({ stageName: 'DEFAULT', color: '#123456' }));
  });

  test('keeps concurrent condition toggles from different admins', async () => {
    const secondStorageEngine = new LocalStorageEngine(true);
    await secondStorageEngine.connect();
    await secondStorageEngine.initializeStudyDb(studyId);
    const controlKey = getBetweenSubjectsCombinationKey({ version: 'control' }, ['version']);
    const treatmentKey = getBetweenSubjectsCombinationKey({ version: 'treatment' }, ['version']);

    await Promise.all([
      storageEngine.setStageCombinationEnabled(studyId, 'LIMITED', controlKey, false),
      secondStorageEngine.setStageCombinationEnabled(studyId, 'LIMITED', treatmentKey, false),
    ]);

    const limitedStage = (await storageEngine.getStageData(studyId)).allStages.find(
      (stage) => stage.stageName === 'LIMITED',
    );
    expect(limitedStage?.disabledBetweenSubjectsCombinations)
      .toEqual(expect.arrayContaining([controlKey, treatmentKey]));
  });

  test('releases the stage slot when initialization fails after the assignment is created', async () => {
    await storageEngine.setSequenceArray(await generateSequenceArray(betweenSubjectsConfig));
    const failingStorageEngine = new FailingAssignmentStorageEngine(true);
    await failingStorageEngine.connect();
    await failingStorageEngine.initializeStudyDb(studyId);

    await expect(failingStorageEngine.initializeParticipantSession(
      {},
      betweenSubjectsConfig,
      metadata,
      'failed-participant',
    )).rejects.toThrow('Simulated sequence assignment failure');

    // The abandoned assignment must not keep the single slot of the stage.
    expect(getStageParticipantCounts(await storageEngine.getAllSequenceAssignments(studyId))).toEqual({});

    const replacementParticipant = await storageEngine.initializeParticipantSession(
      {},
      betweenSubjectsConfig,
      metadata,
      'replacement-participant',
    );
    expect(replacementParticipant.sequence).toBeDefined();
    expect(getStageParticipantCounts(await storageEngine.getAllSequenceAssignments(studyId)))
      .toEqual({ LIMITED: 1 });
  });

  test('unclaims a reusable slot when replacement assignment creation fails', async () => {
    const firstParticipant = await storageEngine.initializeParticipantSession({}, config, metadata, 'source-participant');
    await storageEngine.rejectParticipant(firstParticipant.participantId, 'Test rejection');

    const failingStorageEngine = new FailingAssignmentCreationStorageEngine(true);
    await failingStorageEngine.connect();
    await failingStorageEngine.initializeStudyDb(studyId);

    await expect(failingStorageEngine.initializeParticipantSession(
      {},
      config,
      metadata,
      'failed-replacement',
    )).rejects.toThrow('Simulated assignment creation failure');

    expect(await storageEngine.getAllSequenceAssignments(studyId)).toContainEqual(
      expect.objectContaining({
        participantId: firstParticipant.participantId,
        rejected: true,
        claimed: false,
      }),
    );

    await storageEngine.clearCurrentParticipantId();
    const replacement = await storageEngine.initializeParticipantSession(
      {},
      config,
      metadata,
      'successful-replacement',
    );
    expect(replacement.participantId).toBe('successful-replacement');
  });

  test('releases the assignment and local snapshot when the initial participant write fails', async () => {
    const failingStorageEngine = new FailingInitialParticipantWriteStorageEngine(true);
    await failingStorageEngine.connect();
    await failingStorageEngine.initializeStudyDb(studyId);

    await expect(failingStorageEngine.initializeParticipantSession(
      {},
      config,
      metadata,
      'write-failure',
    )).rejects.toThrow('Simulated initial participant write failure');

    expect(getStageParticipantCounts(await storageEngine.getAllSequenceAssignments(studyId))).toEqual({});
    expect(await storageEngine.getParticipantData('write-failure')).toBeNull();

    const retriedParticipant = await failingStorageEngine.initializeParticipantSession(
      {},
      config,
      metadata,
      'write-failure',
    );
    expect(retriedParticipant.participantId).toBe('write-failure');
    expect(getStageParticipantCounts(await storageEngine.getAllSequenceAssignments(studyId)))
      .toEqual({ LIMITED: 1 });
  });

  test('restores a rejected participant only while the stage has room', async () => {
    const rejectedParticipant = await storageEngine.initializeParticipantSession({}, config, metadata, 'rejected-participant');
    await storageEngine.rejectParticipant(rejectedParticipant.participantId, 'Test rejection');
    await storageEngine.clearCurrentParticipantId();

    await storageEngine.undoRejectParticipant(rejectedParticipant.participantId);

    expect((await storageEngine.getParticipantData(rejectedParticipant.participantId))?.rejected).toBe(false);
    expect(getStageParticipantCounts(await storageEngine.getAllSequenceAssignments(studyId)))
      .toEqual({ LIMITED: 1 });
  });

  test('serializes restoration with admission so the stage limit is never exceeded', async () => {
    const rejectedParticipant = await storageEngine.initializeParticipantSession({}, config, metadata, 'rejected-participant');
    await storageEngine.rejectParticipant(rejectedParticipant.participantId, 'Test rejection');
    await storageEngine.clearCurrentParticipantId();

    const secondStorageEngine = new LocalStorageEngine(true);
    await secondStorageEngine.connect();
    await secondStorageEngine.initializeStudyDb(studyId);

    const results = await Promise.allSettled([
      storageEngine.undoRejectParticipant(rejectedParticipant.participantId),
      secondStorageEngine.initializeParticipantSession({}, config, metadata, 'new-participant'),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(getStageParticipantCounts(await storageEngine.getAllSequenceAssignments(studyId)))
      .toEqual({ LIMITED: 1 });
  });

  test('does not restore a participant into a stage that another stage\'s reused slot filled', async () => {
    // A rejection from an earlier stage is the oldest reusable slot, so the next
    // admission reuses it and leaves the restored participant's slot unclaimed.
    await storageEngine.setCurrentStage(studyId, 'OTHER');
    await storageEngine.initializeParticipantSession({}, config, metadata, 'other-stage-participant');
    await storageEngine.rejectParticipant('other-stage-participant', 'Test rejection');
    await storageEngine.clearCurrentParticipantId();
    await storageEngine.setCurrentStage(studyId, 'LIMITED');

    await storageEngine.initializeParticipantSession({}, config, metadata, 'rejected-participant');
    await storageEngine.rejectParticipant('rejected-participant', 'Test rejection');
    await storageEngine.clearCurrentParticipantId();
    await storageEngine.initializeParticipantSession({}, config, metadata, 'new-participant');

    expect(await storageEngine.getSequenceAssignment(studyId, 'rejected-participant'))
      .toMatchObject({ rejected: true, claimed: false });

    await expect(storageEngine.undoRejectParticipant('rejected-participant'))
      .rejects.toBeInstanceOf(StageCapacityExceededError);

    expect((await storageEngine.getParticipantData('rejected-participant'))?.rejected).not.toBe(false);
    expect(getStageParticipantCounts(await storageEngine.getAllSequenceAssignments(studyId)))
      .toEqual({ LIMITED: 1 });
  });

  test('does not restore a participant into a between-subjects condition that is full', async () => {
    await storageEngine.setSequenceArray(await generateSequenceArray(betweenSubjectsConfig));
    const controlKey = getBetweenSubjectsCombinationKey({ version: 'control' }, ['version']);
    const treatmentKey = getBetweenSubjectsCombinationKey({ version: 'treatment' }, ['version']);
    await storageEngine.setCurrentStage(studyId, 'OTHER');
    await storageEngine.initializeParticipantSession({}, betweenSubjectsConfig, metadata, 'other-stage-participant');
    await storageEngine.rejectParticipant('other-stage-participant', 'Test rejection');
    await storageEngine.clearCurrentParticipantId();
    await storageEngine.setCurrentStage(studyId, 'LIMITED');
    await storageEngine.updateStage(studyId, 'LIMITED', {
      maxParticipants: 2,
      participantAssignmentMode: 'manual',
      manualDesiredParticipantsByCombination: { [controlKey]: 1, [treatmentKey]: 1 },
    });

    const rejectedParticipant = await storageEngine.initializeParticipantSession(
      {},
      betweenSubjectsConfig,
      metadata,
      'rejected-participant',
    );
    const rejectedKey = getBetweenSubjectsCombinationKey(rejectedParticipant.sequence.parameters, ['version']);
    await storageEngine.rejectParticipant('rejected-participant', 'Test rejection');
    await storageEngine.clearCurrentParticipantId();
    // Only the rejected participant's condition stays open, so the next
    // participant fills it while the stage itself still has room.
    await storageEngine.setStageCombinationEnabled(
      studyId,
      'LIMITED',
      rejectedKey === controlKey ? treatmentKey : controlKey,
      false,
    );
    const newParticipant = await storageEngine.initializeParticipantSession(
      {},
      betweenSubjectsConfig,
      metadata,
      'new-participant',
    );
    expect(getBetweenSubjectsCombinationKey(newParticipant.sequence.parameters, ['version'])).toBe(rejectedKey);

    await expect(storageEngine.undoRejectParticipant('rejected-participant'))
      .rejects.toBeInstanceOf(StageConditionCapacityExceededError);
    expect((await storageEngine.getParticipantData('rejected-participant'))?.rejected).not.toBe(false);
  });

  test('repairs its own abandoned assignment when both the initial write and its cleanup failed', async () => {
    const failingStorageEngine = new FailingInitialWriteAndCleanupStorageEngine(true);
    await failingStorageEngine.connect();
    await failingStorageEngine.initializeStudyDb(studyId);

    await expect(failingStorageEngine.initializeParticipantSession(
      {},
      config,
      metadata,
      'abandoned-participant',
    )).rejects.toThrow('Simulated initial participant write failure');

    // The outage left the single slot occupied by an assignment with no record.
    expect(getStageParticipantCounts(await storageEngine.getAllSequenceAssignments(studyId)))
      .toEqual({ LIMITED: 1 });
    expect(await storageEngine.getParticipantData('abandoned-participant')).toBeNull();

    const retriedParticipant = await failingStorageEngine.initializeParticipantSession(
      {},
      config,
      metadata,
      'abandoned-participant',
    );

    expect(retriedParticipant.participantId).toBe('abandoned-participant');
    const assignments = await storageEngine.getAllSequenceAssignments(studyId);
    expect(assignments).toHaveLength(1);
    expect(assignments[0]).toMatchObject({ participantId: 'abandoned-participant', rejected: false, claimed: false });
    expect(assignments[0].claimedParticipantId).toBeUndefined();
  });

  test('lets an admin reject an abandoned assignment that has no participant record', async () => {
    const failingStorageEngine = new FailingInitialWriteAndCleanupStorageEngine(true);
    await failingStorageEngine.connect();
    await failingStorageEngine.initializeStudyDb(studyId);

    await expect(failingStorageEngine.initializeParticipantSession(
      {},
      config,
      metadata,
      'abandoned-participant',
    )).rejects.toThrow('Simulated initial participant write failure');

    await storageEngine.rejectParticipant('abandoned-participant', 'Abandoned');

    expect(getStageParticipantCounts(await storageEngine.getAllSequenceAssignments(studyId))).toEqual({});
    const newParticipant = await storageEngine.initializeParticipantSession({}, config, metadata, 'new-participant');
    expect(newParticipant.participantId).toBe('new-participant');
    expect(getStageParticipantCounts(await storageEngine.getAllSequenceAssignments(studyId)))
      .toEqual({ LIMITED: 1 });
  });

  test('keeps both a mode change and a stage edit that overlap', async () => {
    const secondStorageEngine = new LocalStorageEngine(true);
    await secondStorageEngine.connect();
    await secondStorageEngine.initializeStudyDb(studyId);

    await Promise.all([
      storageEngine.updateStage(studyId, 'LIMITED', { maxParticipants: 7 }),
      secondStorageEngine.setMode(studyId, 'dataCollectionEnabled', false),
    ]);

    const modes = await storageEngine.getModes(studyId);
    expect(modes.dataCollectionEnabled).toBe(false);
    expect(modes.stage?.allStages).toContainEqual(expect.objectContaining({ stageName: 'LIMITED', maxParticipants: 7 }));
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
