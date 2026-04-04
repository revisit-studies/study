import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { ParticipantMetadata, StudyConfig } from '../../parser/types';
import testConfigSimple from './testConfigSimple.json';
import { generateSequenceArray } from '../../utils/handleRandomSequences';
import { LocalStorageEngine } from '../engines/LocalStorageEngine';
import { StageInfo, StorageEngine } from '../engines/types';
import { download } from '../../components/downloader/DownloadTidy';
import { validateStageName } from '../../analysis/individualStudy/management/StageManagementItem';

const studyId = 'test-study-manage';
const configSimple = testConfigSimple as StudyConfig;
const participantMetadata: ParticipantMetadata = {
  userAgent: 'test-user-agent',
  resolution: { width: 1920, height: 1080 },
  language: 'en-US',
  ip: '122.122.122.122',
};
const existingStages: StageInfo[] = [
  { stageName: 'DEFAULT', color: '#F05A30' },
  { stageName: 'REVIEW', color: '#00AAFF' },
];

describe('analysis data management tests', () => {
  afterEach(() => {
    vi.restoreAllMocks();
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

describe('validateStageName', () => {
  test('rejects duplicate names', () => {
    expect(validateStageName('REVIEW', existingStages)).toBe('A stage with this name already exists');
  });

  test('rejects reserved name DEFAULT', () => {
    expect(validateStageName('DEFAULT', existingStages)).toBe('Stage name "DEFAULT" is reserved and cannot be used');
  });

  test('rejects reserved name ALL', () => {
    expect(validateStageName('ALL', existingStages)).toBe('Stage name "ALL" is reserved and cannot be used');
  });

  test('rejects reserved name N/A', () => {
    expect(validateStageName('N/A', existingStages)).toBe('Stage name "N/A" is reserved and cannot be used');
  });

  test('rejects reserved names case-insensitively with whitespace', () => {
    expect(validateStageName('  default  ', existingStages)).toBe('Stage name "DEFAULT" is reserved and cannot be used');
    expect(validateStageName(' all ', existingStages)).toBe('Stage name "ALL" is reserved and cannot be used');
    expect(validateStageName(' n/A ', existingStages)).toBe('Stage name "N/A" is reserved and cannot be used');
  });

  test('returns error for an empty or whitespace-only name', () => {
    expect(validateStageName('', existingStages)).toBe('Stage name cannot be empty');
    expect(validateStageName('   ', existingStages)).toBe('Stage name cannot be empty');
  });

  test('accepts a new non-reserved unique name', () => {
    expect(validateStageName('ANALYSIS', existingStages)).toBeNull();
  });
});

describe.each([
  { TestEngine: LocalStorageEngine },
])('stage management db tests for $TestEngine', ({ TestEngine }) => {
  let storageEngine: StorageEngine;

  beforeEach(async () => {
    storageEngine = new TestEngine(true);
    await storageEngine.connect();
    await storageEngine.initializeStudyDb(studyId);
    const sequenceArray = await generateSequenceArray(configSimple);
    await storageEngine.setSequenceArray(sequenceArray);
  });

  afterEach(async () => {
    // @ts-expect-error using protected method for testing
    await storageEngine._testingReset(studyId);
  });

  test('get stage and set stage', async () => {
    const initialStageData = await storageEngine.getStageData(studyId);
    expect(initialStageData.currentStage.stageName).toBe('DEFAULT');

    await storageEngine.setCurrentStage(studyId, 'REVIEW', '#00AAFF');
    const stageData = await storageEngine.getStageData(studyId);
    expect(stageData.currentStage).toEqual({ stageName: 'REVIEW', color: '#00AAFF' });
  });

  test('update stage color', async () => {
    await storageEngine.setCurrentStage(studyId, 'REVIEW', '#00AAFF');
    await storageEngine.updateStageColor(studyId, 'REVIEW', '#ABCDEF');

    const stageData = await storageEngine.getStageData(studyId);
    expect(stageData.currentStage).toEqual({ stageName: 'REVIEW', color: '#ABCDEF' });
    expect(stageData.allStages.find((stage) => stage.stageName === 'REVIEW')?.color).toBe('#ABCDEF');
  });

  test('filter by stage name and stage color', async () => {
    await storageEngine.setCurrentStage(studyId, 'REVIEW', '#ABCDEF');
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

    await storageEngine.setCurrentStage(studyId, 'VALIDATION', '#445566');
    await storageEngine.clearCurrentParticipantId();
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

    const stageData = await storageEngine.getStageData(studyId);
    const participants = await storageEngine.getAllParticipantsData(studyId);

    const byStageName = participants.filter((participant) => participant.stage === 'REVIEW');
    expect(byStageName.length).toBe(1);

    const colorByStageName = Object.fromEntries(stageData.allStages.map((stage) => [stage.stageName, stage.color]));
    const byStageColor = participants.filter((participant) => colorByStageName[participant.stage] === '#ABCDEF');
    expect(byStageColor.length).toBe(1);
    expect(byStageColor[0].stage).toBe('REVIEW');
  });
});
