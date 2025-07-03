import { expect, test, beforeEach } from 'vitest';
import { ParticipantMetadata, StudyConfig } from '../../parser/types';
import testConfigSimple from './testConfigSimple.json';
import { generateSequenceArray } from '../../utils/handleRandomSequences';
import { hash } from '../engines/utils';
import { Sequence } from '../../store/types';
import { LocalStorageEngine } from '../engines/LocalStorageEngine';

let storageEngine = new LocalStorageEngine();

const configSimple = testConfigSimple as StudyConfig;
let sequenceArray: Sequence[] = [];

const participantMetadata: ParticipantMetadata = {
  userAgent: 'test-user-agent',
  resolution: { width: 1920, height: 1080 },
  language: 'en-US',
  ip: '122.122.122.122',
};

// Before test harness
beforeEach(async () => {
  // Reset the storage engine before each test
  storageEngine = new LocalStorageEngine();
  await storageEngine.connect();
  await storageEngine.initializeStudyDb('test-study');
  sequenceArray = await generateSequenceArray(configSimple);
  await storageEngine.setSequenceArray(
    sequenceArray,
  );
});

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
