import {
  expect, test, beforeEach, describe,
} from 'vitest';
import { ParticipantMetadata, StudyConfig } from '../../parser/types';
import testConfigSimple from './testConfigSimple.json';
import { generateSequenceArray } from '../../utils/handleRandomSequences';
import { LocalStorageEngine } from '../engines/LocalStorageEngine';
import { StorageEngine } from '../engines/types';
import { hash } from '../engines/utils';

const studyId = 'test-study';
const configSimple = testConfigSimple as StudyConfig;
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

  // Before test harness
  beforeEach(async () => {
    // Reset the storage engine before each test
    storageEngine = new TestEngine();
    await storageEngine.connect();
    await storageEngine.initializeStudyDb(studyId);
    const sequenceArray = await generateSequenceArray(configSimple);
    await storageEngine.setSequenceArray(
      sequenceArray,
    );
  });

  // _pushToStorage, _getFromStorage, and _removeFromStorage tests
  test('_pushToStorage, _getFromStorage, and _removeFromStorage work correctly', async () => {
    const sequenceArray = generateSequenceArray(configSimple);
    const participantData = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    const randomBlob = new Blob(['test data'], { type: 'text/plain' });

    // @ts-expect-error using protected method for testing
    await storageEngine._pushToStorage('', 'sequenceArray', sequenceArray);
    // @ts-expect-error using protected method for testing
    const storedSequenceArray = await storageEngine._getFromStorage('', 'sequenceArray');
    expect(storedSequenceArray).toBeDefined();
    expect(storedSequenceArray).toEqual(sequenceArray);

    // @ts-expect-error using protected method for testing
    await storageEngine._pushToStorage('participants', 'participantData', participantData);
    // @ts-expect-error using protected method for testing
    const storedParticipantData = await storageEngine._getFromStorage('participants', 'participantData', studyId);
    expect(storedParticipantData).toBeDefined();
    expect(storedParticipantData!.participantId).toBe(participantData.participantId);

    // @ts-expect-error using protected method for testing
    await storageEngine._pushToStorage('testBlob', 'blob', randomBlob);
    // @ts-expect-error using protected method for testing
    const storedBlob = await storageEngine._getFromStorage('testBlob', 'blob');
    expect(storedBlob).toBeDefined();
    expect(storedBlob instanceof Blob).toBe(true);
  });

  // Cache storage object not testable in local storage environment

  // verifyStudyDatabase test
  test('_verifyStudyDatabase throws error if not initialized', async () => {
    const uninitializedStorageEngine = new TestEngine();
    // @ts-expect-error using protected method for testing
    await expect(uninitializedStorageEngine.verifyStudyDatabase()).rejects.toThrow('Study database not initialized');
  });

  // getCurrentConfigHash and setCurrentConfigHash tests
  test('_getCurrentConfigHash and _setCurrentConfigHash work correctly', async () => {
    // @ts-expect-error using protected method for testing
    const initialHash = await storageEngine._getCurrentConfigHash();
    expect(initialHash).toBe('');

    const configHash = await hash(JSON.stringify(configSimple));
    // @ts-expect-error using protected method for testing
    await storageEngine._setCurrentConfigHash(configHash);
    // @ts-expect-error using protected method for testing
    const updatedHash = await storageEngine._getCurrentConfigHash();
    expect(updatedHash).toBe(configHash);
  });

  // _getAllSequenceAssignments test
  test('_getAllSequenceAssignments returns sequence assignment for participant', async () => {
    const participantSession = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    const { participantId } = participantSession;

    // @ts-expect-error using protected method for testing
    const sequenceAssignments = await storageEngine._getAllSequenceAssignments(studyId);
    expect(sequenceAssignments).toBeDefined();

    const sequenceAssignment = sequenceAssignments[participantId];
    expect(sequenceAssignment).toBeDefined();
    expect(sequenceAssignment.participantId).toBe(participantId);
    expect(sequenceAssignment.timestamp).toBeDefined();
    expect(sequenceAssignment.rejected).toBe(false);
    expect(sequenceAssignment.claimed).toBe(false);
    expect(sequenceAssignment.completed).toBeNull();
    expect(sequenceAssignment.createdTime).toBeDefined();
    expect(sequenceAssignment.createdTime).equal(sequenceAssignment.timestamp);
  });

  // _completeCurrentParticipantRealtime test
  test('_completeCurrentParticipantRealtime updates sequence assignment', async () => {
    const participantSession = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    const { participantId } = participantSession;

    // @ts-expect-error using protected method for testing
    let sequenceAssignments = await storageEngine._getAllSequenceAssignments(studyId);
    expect(sequenceAssignments).toBeDefined();

    const sequenceAssignment = sequenceAssignments[participantId];
    expect(sequenceAssignment).toBeDefined();
    expect(sequenceAssignment.participantId).toBe(participantId);
    expect(sequenceAssignment.completed).toBeNull();

    // Complete the participant
    // @ts-expect-error using protected method for testing
    await storageEngine._completeCurrentParticipantRealtime();

    // @ts-expect-error using protected method for testing
    sequenceAssignments = await storageEngine._getAllSequenceAssignments(studyId);
    expect(sequenceAssignments).toBeDefined();

    const updatedSequenceAssignment = sequenceAssignments[participantId];
    expect(updatedSequenceAssignment).toBeDefined();
    expect(updatedSequenceAssignment.participantId).toBe(participantId);
    expect(updatedSequenceAssignment.completed).toBeDefined();
    expect(updatedSequenceAssignment.completed).toBeGreaterThan(typeof updatedSequenceAssignment.createdTime === 'number' ? updatedSequenceAssignment.createdTime : updatedSequenceAssignment.createdTime.seconds);
  });

  // Reject assignment and claim assignment tested by high-level tests

  // initializeStudy not testable in local storage environment

  // getModes test
  test('_getModes returns correct modes and _setMode updates correctly', async () => {
    const modes = await storageEngine.getModes(studyId);
    expect(modes).toBeDefined();
    expect(modes.analyticsInterfacePubliclyAccessible).toBe(true);
    expect(modes.dataCollectionEnabled).toBe(true);
    expect(modes.studyNavigatorEnabled).toBe(true);

    await storageEngine.setMode(studyId, 'dataCollectionEnabled', false);
    const updatedModes = await storageEngine.getModes(studyId);
    expect(updatedModes).toBeDefined();
    expect(updatedModes.analyticsInterfacePubliclyAccessible).toBe(true);
    expect(updatedModes.dataCollectionEnabled).toBe(false);
    expect(updatedModes.studyNavigatorEnabled).toBe(true);
  });

  // cannot test _getAudioUrl in local storage environment
});
