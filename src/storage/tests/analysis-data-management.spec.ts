import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { ParticipantMetadata, StudyConfig } from '../../parser/types';
import testConfigSimple from './testConfigSimple.json';
import { generateSequenceArray } from '../../utils/handleRandomSequences';
import { LocalStorageEngine } from '../engines/LocalStorageEngine';
import { StorageEngine } from '../engines/types';
import { download } from '../../components/downloader/DownloadTidy';

const studyId = 'test-study-data-management';
const configSimple = testConfigSimple as StudyConfig;
const participantMetadata: ParticipantMetadata = {
  userAgent: 'test-user-agent',
  resolution: { width: 1920, height: 1080 },
  language: 'en-US',
  ip: '122.122.122.122',
};

describe.each([
  { TestEngine: LocalStorageEngine },
])('data management tests for $TestEngine', ({ TestEngine }) => {
  let storageEngine: StorageEngine;

  beforeEach(async () => {
    storageEngine = new TestEngine(true);
    await storageEngine.connect();
    await storageEngine.initializeStudyDb(studyId);
    const sequenceArray = await generateSequenceArray(configSimple);
    await storageEngine.setSequenceArray(sequenceArray);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    // @ts-expect-error using protected method for testing
    await storageEngine._testingReset(studyId);
  });

  test('create/archive(delete live)/delete/rename/restore snapshot flows work', async () => {
    const emptySnapshot = await storageEngine.createSnapshot('non-existent-study', false);
    expect(emptySnapshot.status).toBe('FAILED');

    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

    const createResponse = await storageEngine.createSnapshot(studyId, false);
    expect(createResponse.status).toBe('SUCCESS');

    let snapshots = await storageEngine.getSnapshots(studyId);
    expect(Object.keys(snapshots).length).toBe(1);

    const snapshotKey = Object.keys(snapshots)[0];
    const renameResponse = await storageEngine.renameSnapshot(snapshotKey, 'renamed-snapshot', studyId);
    expect(renameResponse.status).toBe('SUCCESS');

    const removeResponse = await storageEngine.removeSnapshotOrLive(snapshotKey, studyId);
    expect(removeResponse.status).toBe('SUCCESS');

    snapshots = await storageEngine.getSnapshots(studyId);
    expect(Object.keys(snapshots).length).toBe(0);

    const archiveLiveResponse = await storageEngine.createSnapshot(studyId, true);
    expect(archiveLiveResponse.status).toBe('SUCCESS');

    snapshots = await storageEngine.getSnapshots(studyId);
    expect(Object.keys(snapshots).length).toBe(1);

    const restoreSnapshotName = Object.keys(snapshots)[0];
    const restoreResponse = await storageEngine.restoreSnapshot(studyId, restoreSnapshotName);
    expect(restoreResponse.status).toBe('SUCCESS');
  });

  test('download helper supports participant data JSON and tidy CSV filenames', () => {
    const anchor = {
      setAttribute: vi.fn(),
      click: vi.fn(),
      remove: vi.fn(),
    } as unknown as HTMLAnchorElement;
    const createElement = vi.fn().mockReturnValue(anchor);
    const appendChild = vi.fn().mockReturnValue(anchor as unknown as Node);
    vi.stubGlobal('document', {
      createElement,
      body: {
        appendChild,
      },
    });

    download('{"participantId":"p1"}', `${studyId}_all.json`);
    expect(anchor.setAttribute).toHaveBeenCalledWith('download', `${studyId}_all.json`);
    expect(anchor.click).toHaveBeenCalled();

    download('participantId,trialId\np1,t1', `${studyId}_all_tidy.csv`);
    expect(anchor.setAttribute).toHaveBeenCalledWith('download', `${studyId}_all_tidy.csv`);
    expect(anchor.click).toHaveBeenCalledTimes(2);
  });
});
