import {
  expect, test, beforeEach, describe,
} from 'vitest';
import { ParticipantMetadata, StudyConfig } from '../../parser/types';
import testConfigSimple from './testConfigSimple.json';
import testConfigSimple2 from './testConfigSimple2.json';
import { generateSequenceArray } from '../../utils/handleRandomSequences';
import { hash } from '../engines/utils';
import { Sequence } from '../../store/types';
import { LocalStorageEngine } from '../engines/LocalStorageEngine';
import { StorageEngine } from '../engines/types';

const studyId = 'test-study';
const configSimple = testConfigSimple as StudyConfig;
const configSimple2 = testConfigSimple2 as StudyConfig;
const participantMetadata: ParticipantMetadata = {
  userAgent: 'test-user-agent',
  resolution: { width: 1920, height: 1080 },
  language: 'en-US',
  ip: '122.122.122.122',
};

describe.each([
  { TestEngine: LocalStorageEngine },
  // { TestEngine: FirebaseStorageEngine }, TODO
])('describe object $TestEngine', ({ TestEngine }) => {
  let storageEngine: StorageEngine;
  let sequenceArray: Sequence[];

  // Before test harness
  beforeEach(async () => {
    // Reset the storage engine before each test
    storageEngine = new TestEngine();
    await storageEngine.connect();
    await storageEngine.initializeStudyDb(studyId);
    sequenceArray = await generateSequenceArray(configSimple);
    await storageEngine.setSequenceArray(
      sequenceArray,
    );
  });

  // saveConfig and getAllConfigsFromHash tests
  test('saveConfig and getAllConfigsFromHash work correctly', async () => {
    const configHash = await hash(JSON.stringify(configSimple));
    await storageEngine.saveConfig(configSimple);

    let storedHashes = await storageEngine.getAllConfigsFromHash([configHash], studyId);
    expect(Object.keys(storedHashes).length).toBe(1);
    expect(storedHashes[configHash]).toBeDefined();
    expect(storedHashes[configHash]).toEqual(configSimple);

    // Save a new config with a different hash
    const configComplexHash = await hash(JSON.stringify(configSimple2));
    await storageEngine.saveConfig(configSimple2);
    storedHashes = await storageEngine.getAllConfigsFromHash([configHash, configComplexHash], studyId);
    expect(Object.keys(storedHashes).length).toBe(2);
    expect(storedHashes[configComplexHash]).toBeDefined();
    expect(storedHashes[configComplexHash]).toEqual(configSimple2);
  });

  test('getCurrentParticipantId returns the current participant ID', async () => {
    const participantSession = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    const { participantId } = participantSession;

    const currentParticipantId = await storageEngine.getCurrentParticipantId();
    expect(currentParticipantId).toBe(participantId);
  });

  test('getCurrentParticipantId returns value even if no participant session is initialized', async () => {
    const currentParticipantId = await storageEngine.getCurrentParticipantId();
    expect(currentParticipantId).toBeDefined();
  });

  // clearCurrentParticipantId tested in rejectParticipant test

  // _getSequence tested in rejectParticipant test

  // initializeParticipantSession test
  test('initializeParticipantSession makes data', async () => {
    const participantSession = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

    const participantId = await storageEngine.getCurrentParticipantId();
    expect(participantId).toBeDefined();

    const participantData = await storageEngine.getParticipantData(participantId);
    expect(participantData).toBeDefined();
    expect(participantData).toEqual(participantSession);
    expect(participantData!.participantId).toBe(participantId);
    expect(participantData!.participantId).toBe(participantSession.participantId);
    expect(participantData!.participantConfigHash).toEqual(await hash(JSON.stringify(configSimple)));
    expect(participantData!.sequence).toEqual(sequenceArray[0]);
    expect(participantData!.participantIndex).toEqual(1);
    expect(participantData!.answers).toEqual({});
    expect(participantData!.searchParams).toEqual({});
    expect(participantData!.metadata).toEqual(participantMetadata);
    expect(participantData!.completed).toBe(false);
    expect(participantData!.rejected).toBe(false);
    expect(participantData!.participantTags).toEqual([]);
  });

  test('initializeParticipantSession with urlParticipantId', async () => {
    const urlParticipantId = 'url-participant-id';

    const participantData = await storageEngine.getParticipantData(urlParticipantId);
    expect(participantData).toBeNull();

    const participantSession = await storageEngine.initializeParticipantSession(
      {},
      configSimple,
      participantMetadata,
      urlParticipantId,
    );

    expect(participantSession.participantId).toBe(urlParticipantId);
  });

  // getAllParticipantIds tested in rejectParticipant test

  test('getParticipantData returns null for non-existent participant', async () => {
    const participantId = 'non-existent-participant';
    const participantData = await storageEngine.getParticipantData(participantId);
    expect(participantData).toBeNull();
  });

  test('getParticipantData returns data for existing participant', async () => {
    const participantSession = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    const { participantId } = participantSession;

    const participantData = await storageEngine.getParticipantData(participantId);
    expect(participantData).toBeDefined();
    expect(participantData!.participantId).toBe(participantId);
  });

  // getParticipantTags, addParticipantTags, removeParticipantTags tests
  test('getParticipantTags returns empty array for new participant', async () => {
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

    const tags = await storageEngine.getParticipantTags();
    expect(tags).toEqual([]);

    await storageEngine.addParticipantTags(['tag1', 'tag2']);
    const updatedTags = await storageEngine.getParticipantTags();
    expect(updatedTags).toEqual(['tag1', 'tag2']);

    // Add duplicate tags
    await storageEngine.addParticipantTags(['tag1', 'tag3']);
    const tagsAfterDuplicates = await storageEngine.getParticipantTags();
    expect(tagsAfterDuplicates).toEqual(['tag1', 'tag2', 'tag3']);

    await storageEngine.removeParticipantTags(['tag1', 'tag3']);
    const tagsAfterRemoval = await storageEngine.getParticipantTags();
    expect(tagsAfterRemoval).toEqual(['tag2']);

    await storageEngine.removeParticipantTags(['tag2']);
    const tagsAfterRemoval2 = await storageEngine.getParticipantTags();
    expect(tagsAfterRemoval2).toEqual([]);
  });

  test('rejectParticipant on participants allows ', async () => {
    const participantSession = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    const { participantId: participantId1 } = participantSession;

    await storageEngine.rejectParticipant(participantId1, 'Participant rejected for testing');

    // @ts-expect-error using protected method for testing
    let sequenceAssignments = await storageEngine._getAllSequenceAssignments(studyId);
    expect(sequenceAssignments).toBeDefined();

    let sequenceAssignment1 = sequenceAssignments[participantId1];
    expect(sequenceAssignment1).toBeDefined();
    expect(sequenceAssignment1.rejected).toBe(true);
    expect(sequenceAssignment1.claimed).toBe(false);

    // Initialize a new participant session
    await storageEngine.clearCurrentParticipantId();
    const newParticipantSession = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    const participantId2 = newParticipantSession.participantId;
    expect(participantId2).not.toBe(participantId1);

    // @ts-expect-error using protected method for testing
    sequenceAssignments = await storageEngine._getAllSequenceAssignments(studyId);
    expect(sequenceAssignments).toBeDefined();

    let sequenceAssignment2 = sequenceAssignments[participantId2];
    expect(sequenceAssignment2).toBeDefined();
    expect(sequenceAssignment2.participantId).toBe(participantId2);
    expect(sequenceAssignment2.timestamp).toBeDefined();
    expect(sequenceAssignment2.timestamp).toEqual(sequenceAssignment1.timestamp);
    expect(sequenceAssignment2.rejected).toBe(false);
    expect(sequenceAssignment2.claimed).toBe(false);
    expect(sequenceAssignment2.createdTime).toBeDefined();
    expect(typeof sequenceAssignment2.createdTime === 'number' ? sequenceAssignment2.createdTime : sequenceAssignment2.createdTime.seconds).toBeGreaterThan(typeof sequenceAssignment1.createdTime === 'number' ? sequenceAssignment1.createdTime : sequenceAssignment1.createdTime.seconds);

    expect(sequenceAssignment1.participantId).toBe(participantId1);

    // Reject the new participant
    await storageEngine.rejectParticipant(participantId2, 'Participant rejected for testing');

    // @ts-expect-error using protected method for testing
    sequenceAssignments = await storageEngine._getAllSequenceAssignments(studyId);
    expect(sequenceAssignments).toBeDefined();
    sequenceAssignment2 = sequenceAssignments[participantId2];
    expect(sequenceAssignment2).toBeDefined();
    expect(sequenceAssignment2.timestamp).not.toEqual(sequenceAssignment1.timestamp);

    // Check if the first rejected participant's sequence is available for reuse
    sequenceAssignment1 = sequenceAssignments[participantId1];
    expect(sequenceAssignment1).toBeDefined();
    expect(sequenceAssignment1.rejected).toBe(true);
    expect(sequenceAssignment1.claimed).toBe(false);
    expect(sequenceAssignment1.completed).toBeNull();

    // Make a new participant session
    await storageEngine.clearCurrentParticipantId();
    const { participantId: participantId3 } = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    expect(participantId3).not.toBe(participantId1);
    expect(participantId3).not.toBe(participantId2);

    // @ts-expect-error using protected method for testing
    sequenceAssignments = await storageEngine._getAllSequenceAssignments(studyId);
    expect(sequenceAssignments).toBeDefined();
    const sequenceAssignment3 = sequenceAssignments[participantId3];
    expect(sequenceAssignment3).toBeDefined();
    expect(sequenceAssignment3.participantId).toBe(participantId3);
    expect(sequenceAssignment3.timestamp).toEqual(sequenceAssignment1.timestamp);
    expect(sequenceAssignment3.rejected).toBe(false);
    expect(sequenceAssignment3.claimed).toBe(false);
    expect(sequenceAssignment3.createdTime).toBeDefined();
    expect(typeof sequenceAssignment3.createdTime === 'number' ? sequenceAssignment3.createdTime : sequenceAssignment3.createdTime.seconds).toBeGreaterThan(typeof sequenceAssignment1.createdTime === 'number' ? sequenceAssignment1.createdTime : sequenceAssignment1.createdTime.seconds);
    expect(sequenceAssignment3.completed).toBeNull();

    // Ensure first rejected participant's sequence is claimed again
    sequenceAssignment1 = sequenceAssignments[participantId1];
    expect(sequenceAssignment1).toBeDefined();
    expect(sequenceAssignment1.participantId).toBe(participantId1);
    expect(sequenceAssignment1.timestamp).toEqual(sequenceAssignment3.timestamp);
    expect(sequenceAssignment1.rejected).toBe(true);
    expect(sequenceAssignment1.claimed).toBe(true);
    expect(sequenceAssignment1.createdTime).toBeDefined();
    expect(typeof sequenceAssignment1.createdTime === 'number' ? sequenceAssignment1.createdTime : sequenceAssignment1.createdTime.seconds).toBeLessThan(typeof sequenceAssignment3.createdTime === 'number' ? sequenceAssignment3.createdTime : sequenceAssignment3.createdTime.seconds);

    // Check that a new participant gets the other rejected sequence assignment
    await storageEngine.clearCurrentParticipantId();
    const { participantId: participantId4 } = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    expect(participantId4).not.toBe(participantId1);
    expect(participantId4).not.toBe(participantId2);
    expect(participantId4).not.toBe(participantId3);
    // @ts-expect-error using protected method for testing
    sequenceAssignments = await storageEngine._getAllSequenceAssignments(studyId);
    expect(sequenceAssignments).toBeDefined();
    const sequenceAssignment4 = sequenceAssignments[participantId4];
    expect(sequenceAssignment4).toBeDefined();
    expect(sequenceAssignment4.participantId).toBe(participantId4);
    expect(sequenceAssignment4.timestamp).toBeDefined();
    expect(sequenceAssignment4.rejected).toBe(false);
    expect(sequenceAssignment4.claimed).toBe(false);
    expect(sequenceAssignment4.createdTime).toBeDefined();
    expect(typeof sequenceAssignment4.createdTime === 'number' ? sequenceAssignment4.createdTime : sequenceAssignment4.createdTime.seconds).toBeGreaterThanOrEqual(typeof sequenceAssignment3.createdTime === 'number' ? sequenceAssignment3.createdTime : sequenceAssignment3.createdTime.seconds);
    expect(sequenceAssignment4.completed).toBeNull();

    // Check the length of sequence assignments
    // @ts-expect-error using protected method for testing
    sequenceAssignments = await storageEngine._getAllSequenceAssignments(studyId);
    expect(sequenceAssignments[participantId1]).toBeDefined();
    expect(sequenceAssignments[participantId2]).toBeDefined(); // participant 2 was rejected
    expect(sequenceAssignments[participantId3]).toBeDefined();
    expect(sequenceAssignments[participantId4]).toBeDefined();

    const participantIds = await storageEngine.getAllParticipantIds();
    expect(participantIds).toBeDefined();
    expect(participantIds.length).toBe(5);
    expect(participantIds).toContain(participantId1);
    expect(participantIds).toContain(participantId2);
    expect(participantIds).toContain(participantId3);
    expect(participantIds).toContain(participantId4);
  });

  // rejectCurrentParticipant test

  // getParticipantStatusCounts test

  // saveAnswers test

  // verifyCompletion test

  // getAudio and saveAudio untestable due to browser-specific implementation

  test('getSequenceArray returns the sequence array', async () => {
    const sequences = await storageEngine.getSequenceArray();
    expect(sequences).toEqual(sequenceArray);
  });

  test('getSequenceArray returns empty array if no sequences are set', async () => {
    const emptyStorageEngine = new LocalStorageEngine();
    await emptyStorageEngine.connect();
    await emptyStorageEngine.initializeStudyDb('test-study-empty');
    const sequences = await emptyStorageEngine.getSequenceArray();
    expect(sequences).toEqual(null);
  });

  test('setSequenceArray sets the sequence array', async () => {
    const newSequenceArray: Sequence[] = [
      {
        id: 'test-block',
        orderPath: 'root-0',
        order: 'fixed',
        components: ['component-1', 'component-2'],
        skip: [
          {
            name: 'component-1',
            check: 'responses',
            to: 'end',
          },
        ],
      },
    ];
    await storageEngine.setSequenceArray(newSequenceArray);
    const sequences = await storageEngine.getSequenceArray();
    expect(sequences).toEqual(newSequenceArray);
  });

  test('setSequenceArray throws error if not connected', async () => {
    const disconnectedStorageEngine = new LocalStorageEngine();
    await expect(disconnectedStorageEngine.setSequenceArray([])).rejects.toThrow('Study database not initialized');
  });
});
