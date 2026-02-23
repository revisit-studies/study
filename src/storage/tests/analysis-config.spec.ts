import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { ParticipantMetadata, StudyConfig } from '../../parser/types';
import testConfigSimple from './testConfigSimple.json';
import testConfigSimple2 from './testConfigSimple2.json';
import { generateSequenceArray } from '../../utils/handleRandomSequences';
import { LocalStorageEngine } from '../engines/LocalStorageEngine';
import { StorageEngine } from '../engines/types';
import { hash } from '../engines/utils';
import { buildConfigRows, ConfigInfo } from '../../analysis/individualStudy/config/utils';
import { downloadConfigFile, downloadConfigFilesZip } from '../../utils/handleDownloadFiles';
import { ConfigDiffModal } from '../../analysis/individualStudy/config/ConfigDiffModal';

const studyId = 'test-study-analysis-config';
const configSimple = testConfigSimple as StudyConfig;
const configSimple2 = testConfigSimple2 as StudyConfig;
const participantMetadata: ParticipantMetadata = {
  userAgent: 'test-user-agent',
  resolution: { width: 1920, height: 1080 },
  language: 'en-US',
  ip: '122.122.122.122',
};

function makeConfigInfo(hashKey: string, version: string): ConfigInfo {
  return {
    hash: hashKey,
    version,
    date: '2026-02-23',
    timeFrame: 'N/A',
    participantCount: 1,
    config: {
      studyMetadata: {
        version,
        date: '2026-02-23',
      },
    } as ConfigInfo['config'],
  };
}

describe.each([
  { TestEngine: LocalStorageEngine },
])('analysis config tests for $TestEngine', ({ TestEngine }) => {
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

  test('config hash/version/date/participant count are built correctly from configs + participants', async () => {
    await storageEngine.saveConfig(configSimple);
    await storageEngine.saveConfig(configSimple2);
    const sequenceArray = await generateSequenceArray(configSimple);
    await storageEngine.setSequenceArray(sequenceArray);

    const configHash1 = await hash(JSON.stringify(configSimple));
    const configHash2 = await hash(JSON.stringify(configSimple2));

    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    await storageEngine.clearCurrentParticipantId();
    await storageEngine.initializeParticipantSession({}, configSimple2, participantMetadata);
    await storageEngine.clearCurrentParticipantId();
    await storageEngine.initializeParticipantSession({}, configSimple2, participantMetadata);

    const participants = await storageEngine.getAllParticipantsData(studyId);
    const fetchedConfigs = await storageEngine.getAllConfigsFromHash([configHash1, configHash2], studyId);
    const rows = buildConfigRows(fetchedConfigs, participants);

    expect(rows).toHaveLength(2);

    const row1 = rows.find((row) => row.hash === configHash1);
    const row2 = rows.find((row) => row.hash === configHash2);

    expect(row1).toBeDefined();
    expect(row2).toBeDefined();

    expect(row1!.config).toEqual(configSimple);
    expect(row2!.config).toEqual(configSimple2);

    expect(row1!.version).toBe(configSimple.studyMetadata.version);
    expect(row1!.date).toBe(configSimple.studyMetadata.date);
    expect(row2!.version).toBe(configSimple2.studyMetadata.version);
    expect(row2!.date).toBe(configSimple2.studyMetadata.date);

    expect(row1!.participantCount).toBe(1);
    expect(row2!.participantCount).toBe(2);
  });

  test('config filter by hash updates participant counts in config rows', async () => {
    await storageEngine.saveConfig(configSimple);
    await storageEngine.saveConfig(configSimple2);
    const sequenceArray = await generateSequenceArray(configSimple);
    await storageEngine.setSequenceArray(sequenceArray);

    const configHash1 = await hash(JSON.stringify(configSimple));
    const configHash2 = await hash(JSON.stringify(configSimple2));

    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    await storageEngine.clearCurrentParticipantId();
    await storageEngine.initializeParticipantSession({}, configSimple2, participantMetadata);
    await storageEngine.clearCurrentParticipantId();
    await storageEngine.initializeParticipantSession({}, configSimple2, participantMetadata);

    const participants = await storageEngine.getAllParticipantsData(studyId);
    const fetchedConfigs = await storageEngine.getAllConfigsFromHash([configHash1, configHash2], studyId);

    const onlyConfig2Participants = participants.filter((participant) => participant.participantConfigHash === configHash2);
    const filteredRows = buildConfigRows(fetchedConfigs, onlyConfig2Participants);

    const row1 = filteredRows.find((row) => row.hash === configHash1);
    const row2 = filteredRows.find((row) => row.hash === configHash2);

    expect(row1).toBeDefined();
    expect(row2).toBeDefined();
    expect(row1!.participantCount).toBe(0);
    expect(row2!.participantCount).toBe(2);
  });

  test('download config and download selected multiple configs', async () => {
    const anchor = { click: vi.fn() } as unknown as HTMLAnchorElement;
    const createElement = vi.fn().mockReturnValue(anchor);
    const createObjectURL = vi.fn().mockReturnValue('blob:mock');
    const revokeObjectURL = vi.fn();

    vi.stubGlobal('document', {
      createElement,
    });
    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL,
    });

    await downloadConfigFile({
      studyId,
      hash: 'hashA',
      config: configSimple,
    });

    expect(anchor.click).toHaveBeenCalled();
    expect((anchor as unknown as { download?: string }).download).toBe(`${studyId}_hashA_config.json`);

    await downloadConfigFilesZip({
      studyId,
      configs: [
        { hash: 'hashA', config: configSimple },
        { hash: 'hashB', config: configSimple2 },
      ],
      hashes: ['hashA', 'hashB'],
    });

    expect(anchor.click).toHaveBeenCalledTimes(2);
    expect((anchor as unknown as { download?: string }).download).toBe(`${studyId}_config.zip`);
    expect(revokeObjectURL).toHaveBeenCalled();
  });

  test('compare configs returns null when selected config count is not exactly 2', () => {
    const none = ConfigDiffModal({ configs: [] });
    const one = ConfigDiffModal({ configs: [makeConfigInfo('hashA', '1.0.0')] });
    const three = ConfigDiffModal({
      configs: [
        makeConfigInfo('hashA', '1.0.0'),
        makeConfigInfo('hashB', '2.0.0'),
        makeConfigInfo('hashC', '3.0.0'),
      ],
    });

    expect(none).toBeNull();
    expect(one).toBeNull();
    expect(three).toBeNull();
  });

  test('compare configs returns a diff view when exactly two configs are selected', () => {
    const view = ConfigDiffModal({
      configs: [
        makeConfigInfo('hashA', '1.0.0'),
        makeConfigInfo('hashB', '2.0.0'),
      ],
    });

    expect(view).not.toBeNull();
  });
});
