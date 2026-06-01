import {
  describe, expect, test, vi,
} from 'vitest';
import { getTableData } from '../DownloadTidy';
import { ParticipantDataWithStatus } from '../../../storage/types';
import { StorageEngine } from '../../../storage/engines/types';
import { StudyConfig } from '../../../parser/types';

const startTime = Date.UTC(2026, 0, 1, 12, 0, 0);
const endTime = startTime + 2500;

const studyConfig = {
  $schema: '',
  studyMetadata: {
    title: 'Tidy export study',
    version: '1.0.0',
    authors: ['Test Author'],
    description: 'Test study',
    date: '2026-01-01',
    organizations: ['Test Org'],
  },
  uiConfig: {
    contactEmail: 'test@example.com',
    logoPath: '',
    withProgressBar: true,
    withSidebar: true,
    numSequences: 1,
  },
  components: {
    trialA: {
      type: 'questionnaire',
      description: 'Trial description',
      instruction: 'Read the chart',
      meta: {
        chart: 'bar',
      },
      response: [
        {
          id: 'q1',
          type: 'shortText',
          prompt: 'What did you notice?',
          location: 'aboveStimulus',
          required: true,
        },
        {
          id: 'confidence',
          type: 'numerical',
          prompt: 'Confidence',
          location: 'belowStimulus',
          required: false,
          min: 0,
          max: 100,
        },
      ],
      correctAnswer: [
        {
          id: 'q1',
          answer: 'trend',
        },
      ],
    },
  },
  sequence: {
    order: 'fixed',
    components: ['trialA'],
  },
} as StudyConfig;

const participant = {
  participantId: 'participant-1',
  participantConfigHash: 'hash-1',
  participantIndex: 0,
  sequence: {
    id: 'root',
    orderPath: 'root',
    order: 'fixed',
    components: ['trialA'],
    skip: [],
  },
  searchParams: {},
  metadata: {
    userAgent: 'test-agent',
    resolution: { width: 1200, height: 800 },
    language: 'en-US',
    ip: '127.0.0.1',
  },
  rejected: false,
  participantTags: ['expert'],
  stage: 'pilot',
  conditions: ['condition-a', 'condition-b'],
  completed: true,
  answers: {
    trialA_0: {
      answer: {
        q1: 'trend',
        confidence: 80,
      },
      identifier: 'trialA_0',
      componentName: 'trialA',
      trialOrder: '0',
      incorrectAnswers: {},
      startTime,
      endTime,
      provenanceGraph: {
        sidebar: undefined,
        aboveStimulus: undefined,
        belowStimulus: undefined,
        stimulus: undefined,
      },
      windowEvents: [
        [startTime + 1, 'focus', 'INPUT'],
        [startTime + 2, 'keydown', 'A'],
        [startTime + 3, 'mousemove', [10, 20]],
      ],
      timedOut: false,
      helpButtonClickedCount: 0,
      parameters: {
        difficulty: 'easy',
      },
      correctAnswer: [],
      optionOrders: {},
      questionOrders: {},
    },
  },
} as ParticipantDataWithStatus;

type TestStorageEngine = StorageEngine & {
  getTranscription: ReturnType<typeof vi.fn>;
};

function makeStorageEngine(overrides: Partial<TestStorageEngine> = {}) {
  return {
    getEngine: vi.fn().mockReturnValue('firebase'),
    getAllConfigsFromHash: vi.fn().mockResolvedValue({ 'hash-1': studyConfig }),
    getTranscription: vi.fn().mockResolvedValue({
      results: [
        {
          alternatives: [
            {
              transcript: 'participant described the trend',
            },
          ],
        },
      ],
    }),
    ...overrides,
  } as unknown as TestStorageEngine;
}

describe('getTableData', () => {
  test('returns empty table data when storage engine is unavailable', async () => {
    const tableData = await getTableData(['answer'] as Parameters<typeof getTableData>[0], [participant], undefined, 'study-1');

    expect(tableData).toEqual({ header: [], rows: [] });
  });

  test('builds tidy rows with selected columns, dynamic parameters, and window event counts', async () => {
    const storageEngine = makeStorageEngine();

    const tableData = await getTableData(
      ['condition', 'stage', 'status', 'description', 'instruction', 'answer', 'correctAnswer', 'duration', 'cleanedDuration', 'meta', 'responseMin', 'responseMax', 'configHash'] as Parameters<typeof getTableData>[0],
      [participant],
      storageEngine,
      'study-1',
    );

    expect(storageEngine.getAllConfigsFromHash).toHaveBeenCalledWith(['hash-1'], 'study-1');
    expect(tableData.header).toEqual(expect.arrayContaining([
      'participantId',
      'trialId',
      'trialOrder',
      'responseId',
      'condition',
      'stage',
      'status',
      'answer',
      'correctAnswer',
      'duration',
      'cleanedDuration',
      'meta',
      'responseMin',
      'responseMax',
      'configHash',
      'parameters_difficulty',
    ]));

    expect(tableData.rows).toHaveLength(4);
    expect(tableData.rows[0]).toEqual(expect.objectContaining({
      participantId: 'participant-1',
      trialId: 'participantTags',
      responseId: 'participantTags',
      answer: JSON.stringify(['expert']),
      condition: 'condition-a,condition-b',
      stage: 'pilot',
    }));

    const textRow = tableData.rows.find((row) => row.responseId === 'q1');
    expect(textRow).toEqual(expect.objectContaining({
      participantId: 'participant-1',
      trialId: 'trialA',
      trialOrder: '0',
      answer: 'trend',
      correctAnswer: 'trend',
      duration: 2500,
      cleanedDuration: 2500,
      description: 'Trial description',
      instruction: 'Read the chart',
      parameters_difficulty: 'easy',
      meta: JSON.stringify({ chart: 'bar' }, null, 2),
      status: 'completed',
      configHash: 'hash-1',
    }));

    const confidenceRow = tableData.rows.find((row) => row.responseId === 'confidence');
    expect(confidenceRow).toEqual(expect.objectContaining({
      responseMin: 0,
      responseMax: 100,
      answer: 80,
    }));

    expect(tableData.rows.find((row) => row.responseId === 'windowEvents')).toEqual(expect.objectContaining({
      answer: JSON.stringify({
        focus: 1,
        input: 0,
        keydown: 1,
        keyup: 0,
        mousemove: 1,
        mousedown: 0,
        mouseup: 0,
        resize: 0,
        scroll: 0,
        visibility: 0,
      }),
    }));
  });

  test('fetches transcripts only for firebase audio exports', async () => {
    const storageEngine = makeStorageEngine();

    const tableData = await getTableData(
      ['transcript', 'answer'] as Parameters<typeof getTableData>[0],
      [participant],
      storageEngine,
      'study-1',
      true,
    );

    expect(storageEngine.getTranscription).toHaveBeenCalledWith('trialA_0', 'participant-1');
    expect(tableData.rows.find((row) => row.responseId === 'q1')).toEqual(expect.objectContaining({
      transcript: 'participant described the trend',
    }));
  });
});
