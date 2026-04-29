import {
  expect, test, beforeEach, describe, afterEach,
} from 'vitest';
import { ParticipantMetadata, StudyConfig } from '../../parser/types';
import testConfigSimple from './testConfigSimple.json';
import { generateSequenceArray } from '../../utils/handleRandomSequences';
import { LocalStorageEngine } from '../engines/LocalStorageEngine';
import { StageInfo, StorageEngine } from '../engines/types';
import { validateStageName } from '../../analysis/individualStudy/management/StageManagementItem';

const studyId = 'test-study-stage-management';
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

describe('validateStageName', () => {
  test('rejects duplicate names', () => {
    const result = validateStageName('REVIEW', existingStages);
    expect(result).toBe('A stage with this name already exists');
  });

  test('rejects reserved name DEFAULT', () => {
    const result = validateStageName('DEFAULT', existingStages);
    expect(result).toBe('Stage name "DEFAULT" is reserved and cannot be used');
  });

  test('rejects reserved name ALL', () => {
    const result = validateStageName('ALL', existingStages);
    expect(result).toBe('Stage name "ALL" is reserved and cannot be used');
  });

  test('rejects reserved name N/A', () => {
    const result = validateStageName('N/A', existingStages);
    expect(result).toBe('Stage name "N/A" is reserved and cannot be used');
  });

  test('rejects reserved names case-insensitively with whitespace', () => {
    expect(validateStageName('  default  ', existingStages)).toBe('Stage name "DEFAULT" is reserved and cannot be used');
    expect(validateStageName(' all ', existingStages)).toBe('Stage name "ALL" is reserved and cannot be used');
    expect(validateStageName(' n/A ', existingStages)).toBe('Stage name "N/A" is reserved and cannot be used');
  });

  test('accepts a new non-reserved unique name', () => {
    const result = validateStageName('ANALYSIS', existingStages);
    expect(result).toBeNull();
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
