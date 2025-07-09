import {
  expect, test, beforeEach, describe, afterEach,
} from 'vitest';
import { ParticipantMetadata, StudyConfig } from '../../parser/types';
import testConfigSimple from './testConfigSimple.json';
import { generateSequenceArray } from '../../utils/handleRandomSequences';
import { LocalStorageEngine } from '../engines/LocalStorageEngine';
import { StorageEngine } from '../engines/types';
import { hash } from '../engines/utils';
// import { SupabaseStorageEngine } from '../engines/SupabaseStorageEngine';

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
  // { TestEngine: SupabaseStorageEngine }, // Uncomment to test with Supabase
  // { TestEngine: FirebaseStorageEngine }, TODO
])('describe object $TestEngine', ({ TestEngine }) => {
  let storageEngine: StorageEngine;

  // Before test harness
  beforeEach(async () => {
    // Reset the storage engine before each test
    storageEngine = new TestEngine(true);
    await storageEngine.connect();
    await storageEngine.initializeStudyDb(studyId);
    const sequenceArray = await generateSequenceArray(configSimple);
    await storageEngine.setSequenceArray(
      sequenceArray,
    );
  });

  afterEach(async () => {
    // @ts-expect-error using protected method for testing
    await storageEngine._testingReset(studyId);
    // @ts-expect-error using protected method for testing
    await storageEngine._testingReset('test-realtime-copy');
  });

  // _pushToStorage, _getFromStorage, and _removeFromStorage tests
  test('_pushToStorage, _getFromStorage, and _removeFromStorage work correctly', async () => {
    const sequenceArray = generateSequenceArray(configSimple);
    const participantData = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    const randomBuffer = { test: 1 };

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
    await storageEngine._pushToStorage('testBlob', 'blob', randomBuffer);
    // @ts-expect-error using protected method for testing
    const storedBlob = await storageEngine._getFromStorage('testBlob', 'blob');
    expect(storedBlob).toBeDefined();
    expect(storedBlob).toBeInstanceOf(Object);
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
    expect(initialHash).toBeNull();

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

    const sequenceAssignment = sequenceAssignments.find((assignment) => assignment.participantId === participantId);
    expect(sequenceAssignment).toBeDefined();
    expect(sequenceAssignment!.participantId).toBe(participantId);
    expect(sequenceAssignment!.timestamp).toBeDefined();
    expect(sequenceAssignment!.rejected).toBe(false);
    expect(sequenceAssignment!.claimed).toBe(false);
    expect(sequenceAssignment!.completed).toBeNull();
    expect(sequenceAssignment!.createdTime).toBeDefined();
    expect(sequenceAssignment!.createdTime).equal(sequenceAssignment!.timestamp);
  });

  // _completeCurrentParticipantRealtime test
  test('_completeCurrentParticipantRealtime updates sequence assignment', async () => {
    const participantSession = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    const { participantId } = participantSession;

    // @ts-expect-error using protected method for testing
    let sequenceAssignments = await storageEngine._getAllSequenceAssignments(studyId);
    expect(sequenceAssignments).toBeDefined();

    const sequenceAssignment = sequenceAssignments.find((assignment) => assignment.participantId === participantId);
    expect(sequenceAssignment).toBeDefined();
    expect(sequenceAssignment!.participantId).toBe(participantId);
    expect(sequenceAssignment!.completed).toBeNull();

    // Complete the participant
    // @ts-expect-error using protected method for testing
    await storageEngine._completeCurrentParticipantRealtime();

    // @ts-expect-error using protected method for testing
    sequenceAssignments = await storageEngine._getAllSequenceAssignments(studyId);
    expect(sequenceAssignments).toBeDefined();

    const updatedSequenceAssignment = sequenceAssignments.find((assignment) => assignment.participantId === participantId);
    expect(updatedSequenceAssignment).toBeDefined();
    expect(updatedSequenceAssignment!.participantId).toBe(participantId);
    expect(updatedSequenceAssignment!.completed).toBeDefined();
    expect(updatedSequenceAssignment!.completed).toBeGreaterThanOrEqual(updatedSequenceAssignment!.createdTime);
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

  /* Snapshots ----------------------------------------------------------- */
  // // Gets the snapshot doc for the given studyId.
  // protected abstract _getSnapshotData(studyId: string): Promise<SnapshotDocContent>;

  // // Checks if the storage directory for the given source exists.
  // protected abstract _directoryExists(source: string): Promise<boolean>;

  // // Copies a storage directory and all its contents.
  // protected abstract _copyDirectory(source: string, target: string): Promise<void>;

  // // Deletes a storage directory and all its contents.
  // protected abstract _deleteDirectory(target: string): Promise<void>;

  // // Copies the realtime data from the source to the target. This is used by createSnapshot to copy the realtime data associated with a snapshot.
  // protected abstract _copyRealtimeData(source: string, target: string): Promise<void>;

  // // Deletes the realtime data for the given target. This is used by removeSnapshotOrLive to delete the realtime data associated with a snapshot or live data.
  // protected abstract _deleteRealtimeData(target: string): Promise<void>;

  // // Adds a directory name to the metadata. This is used by createSnapshot
  // protected abstract _addDirectoryNameToSnapshots(directoryName: string): Promise<void>;

  // // Removes a snapshot from the metadata. This is used by removeSnapshotOrLive
  // protected abstract _removeDirectoryNameFromSnapshots(directoryName: string): Promise<void>;

  // // Updates a snapshot in the metadata. This is used by renameSnapshot
  // protected abstract _changeDirectoryNameInSnapshots(oldName: string, newName: string): Promise<void>;

  /* Snapshots ----------------------------------------------------------- */
  // _getSnapshotData test
  test('_getSnapshotData is empty on initialization', async () => {
    // @ts-expect-error using protected value for testing
    const snapshotData = await storageEngine.getSnapshots(`${storageEngine.collectionPrefix}${studyId}`);
    expect(snapshotData).toBeDefined();
    expect(Object.keys(snapshotData).length).toBe(0);
  });

  // _directoryExists test
  test('_directoryExists returns false for non-existent directory', async () => {
    // @ts-expect-error using protected method for testing
    const exists = await storageEngine._directoryExists('missing-study');
    expect(exists).toBe(false);
  });

  test('_directoryExists returns true for existing directory', async () => {
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    // @ts-expect-error using protected method and value for testing
    const exists = await storageEngine._directoryExists(`${storageEngine.collectionPrefix}${studyId}`);
    expect(exists).toBe(true);
  });

  // _copyDirectory, _deleteDirectory test
  test('_copyDirectory copies directory and contents', async () => {
    // @ts-expect-error using protected value for testing
    const source = `${storageEngine.collectionPrefix}${studyId}`;
    // @ts-expect-error using protected value for testing
    const target = `${storageEngine.collectionPrefix}test-copy`;

    // Ensure source directory exists
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    // @ts-expect-error using protected method for testing
    const sourceExists = await storageEngine._directoryExists(source);
    expect(sourceExists).toBe(true);

    // Copy the directory
    // @ts-expect-error using protected method for testing
    await storageEngine._copyDirectory(source, target);

    // Check if target directory exists
    // @ts-expect-error using protected method for testing
    const targetExists = await storageEngine._directoryExists(target);
    expect(targetExists).toBe(true);

    // Clean up by deleting the copied directory
    // @ts-expect-error using protected method for testing
    await storageEngine._deleteDirectory(target);

    // Verify the target directory is deleted
    // @ts-expect-error using protected method for testing
    const targetDeleted = await storageEngine._directoryExists(target);
    expect(targetDeleted).toBe(false);
  });

  // _copyRealtimeData, _deleteRealtimeData test
  test('_copyRealtimeData copies realtime data', async () => {
    const targetId = 'test-realtime-copy';
    // @ts-expect-error using protected value for testing
    const source = `${storageEngine.collectionPrefix}${studyId}`;
    // @ts-expect-error using protected value for testing
    const target = `${storageEngine.collectionPrefix}test-realtime-copy`;

    // Ensure source directory exists
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

    // @ts-expect-error using protected method for testing
    const sourceSequenceAssignments1 = await storageEngine._getAllSequenceAssignments(studyId);
    expect(sourceSequenceAssignments1).toBeDefined();
    expect(sourceSequenceAssignments1.length).toEqual(1);

    // @ts-expect-error using protected method for testing
    let targetSequenceAssignments = await storageEngine._getAllSequenceAssignments(targetId);
    expect(targetSequenceAssignments).toBeDefined();
    expect(targetSequenceAssignments.length).toBe(0);

    // Copy the realtime data
    // @ts-expect-error using protected method for testing
    await storageEngine._copyRealtimeData(source, target);

    // Check if target directory has the copied data
    // @ts-expect-error using protected method for testing
    const sourceSequenceAssignments2 = await storageEngine._getAllSequenceAssignments(studyId);
    expect(sourceSequenceAssignments2).toBeDefined();
    expect(sourceSequenceAssignments2.length).toEqual(1);

    // @ts-expect-error using protected method for testing
    targetSequenceAssignments = await storageEngine._getAllSequenceAssignments(targetId);
    expect(targetSequenceAssignments).toBeDefined();
    expect(targetSequenceAssignments.length).toEqual(1);
    expect(targetSequenceAssignments[0].participantId).toBe(sourceSequenceAssignments2[0].participantId);

    // Delete the target realtime data
    // @ts-expect-error using protected method for testing
    await storageEngine._deleteRealtimeData(target);

    // Verify the target directory is empty
    // @ts-expect-error using protected method for testing
    targetSequenceAssignments = await storageEngine._getAllSequenceAssignments(targetId);
    expect(targetSequenceAssignments).toBeDefined();
    expect(targetSequenceAssignments.length).toBe(0);
  });

  // _addDirectoryNameToSnapshots, removeDirectoryNameFromSnapshots, _changeDirectoryNameInSnapshots tests
  test('_addDirectoryNameToSnapshots, _removeDirectoryNameFromSnapshots, and _changeDirectoryNameInSnapshots work correctly', async () => {
    // Ensure the study database is initialized
    const directoryName = 'test-directory';

    // Make sure the directory name is not already in the snapshots
    // @ts-expect-error using protected method for testing
    const snapshotData1 = await storageEngine.getSnapshots(`${storageEngine.collectionPrefix}${studyId}`);
    expect(snapshotData1).toBeDefined();
    expect(snapshotData1[directoryName]).not.toBeDefined();

    // @ts-expect-error using protected method for testing
    await storageEngine._addDirectoryNameToSnapshots(directoryName, studyId);

    // Verify the directory name is added to the snapshot metadata
    const snapshotData2 = await storageEngine.getSnapshots(studyId);
    expect(snapshotData2).toBeDefined();
    expect(snapshotData2[directoryName]).toBeDefined();
    expect(snapshotData2[directoryName].name).toBe(directoryName);

    // Change the directory name in the snapshot metadata
    const newDirectoryName = 'renamed-directory';
    // @ts-expect-error using protected method for testing
    await storageEngine._changeDirectoryNameInSnapshots(directoryName, newDirectoryName, studyId);

    // Verify the directory name is updated in the snapshot metadata
    const updatedSnapshotData = await storageEngine.getSnapshots(studyId);
    expect(updatedSnapshotData).toBeDefined();
    expect(updatedSnapshotData[directoryName]).toBeDefined();
    expect(updatedSnapshotData[directoryName].name).toBe(newDirectoryName);
    expect(updatedSnapshotData[newDirectoryName]).not.toBeDefined();

    // Clean up by removing the directory name
    // @ts-expect-error using protected method for testing
    await storageEngine._removeDirectoryNameFromSnapshots(directoryName, studyId);

    // Verify the directory name is removed from the snapshot metadata
    const snapshotData3 = await storageEngine.getSnapshots(studyId);
    expect(snapshotData3).toBeDefined();
    expect(snapshotData3[directoryName]).not.toBeDefined();
  });
});
