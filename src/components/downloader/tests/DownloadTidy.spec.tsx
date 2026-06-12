import {
  cleanup, render, waitFor,
} from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import {
  afterEach, describe, expect, test, vi,
} from 'vitest';
import { DownloadTidy, getTableData } from '../DownloadTidy';
import type { StudyConfig } from '../../../parser/types';
import type { StorageEngine } from '../../../storage/engines/types';
import type { ParticipantDataWithStatus } from '../../../storage/types';
import testConfigSimple from '../../../storage/tests/testConfigSimple.json';

const storageEngineHookMock = vi.hoisted(() => ({
  storageEngine: undefined as StorageEngine | undefined,
}));

vi.mock('../../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({ storageEngine: storageEngineHookMock.storageEngine }),
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

const configSimple = testConfigSimple as StudyConfig;
const configWithComponentMetadata = {
  ...configSimple,
  components: {
    testComponent: {
      ...configSimple.components.testComponent,
      description: 'Config description',
      instruction: 'Config instruction',
      response: [{
        id: 'response',
        prompt: 'Config prompt',
        type: 'numerical',
        min: 0,
        max: 10,
      }],
      meta: { source: 'config' },
    },
  },
} as StudyConfig;

function makeParticipant(overrides: Partial<ParticipantDataWithStatus> = {}): ParticipantDataWithStatus {
  return {
    participantId: 'p1',
    participantConfigHash: 'hash-1',
    participantIndex: 0,
    sequence: {
      orderPath: 'root',
      order: 'fixed',
      components: ['testComponent'],
      skip: [],
    },
    answers: {
      testComponent_0: {
        answer: { response: 'participant answer' },
        identifier: 'testComponent_0',
        componentName: 'testComponent',
        trialOrder: '0',
        incorrectAnswers: {},
        startTime: 100,
        endTime: 200,
        windowEvents: [],
        timedOut: false,
        helpButtonClickedCount: 0,
        parameters: { speed: 'fast' },
        correctAnswer: [{ id: 'response', answer: 'answer from participant data' }],
        optionOrders: {},
        questionOrders: {},
      },
    },
    searchParams: {},
    metadata: {
      userAgent: '',
      resolution: { width: 0, height: 0 },
      language: '',
      ip: '',
    },
    completed: false,
    rejected: false,
    participantTags: [],
    stage: 'DEFAULT',
    ...overrides,
  };
}

function makeStorageEngine(
  configs: Record<string, StudyConfig>,
  getTranscription = vi.fn(),
  engine = 'firebase',
): StorageEngine {
  return {
    getAllConfigsFromHash: vi.fn().mockResolvedValue(configs),
    getEngine: vi.fn(() => engine),
    getTranscription,
  } as unknown as StorageEngine;
}

describe('getTableData', () => {
  afterEach(() => {
    cleanup();
    storageEngineHookMock.storageEngine = undefined;
    vi.clearAllMocks();
  });

  test('builds tidy rows with participant and config-derived fields', async () => {
    const storageEngine = makeStorageEngine({
      'hash-1': configWithComponentMetadata,
    });

    const tableData = await getTableData(
      ['answer', 'description', 'instruction', 'responsePrompt', 'correctAnswer', 'duration', 'meta', 'responseMin', 'responseMax'],
      [makeParticipant()],
      storageEngine,
      'test-study',
    );

    const answerRow = tableData.rows.find((row) => row.participantId === 'p1' && row.responseId === 'response');
    expect(tableData.missingConfigCount).toBe(0);
    expect(tableData.header).toEqual(expect.arrayContaining(['participantId', 'trialId', 'responseId', 'answer', 'parameters_speed']));
    expect(answerRow).toEqual(expect.objectContaining({
      participantId: 'p1',
      trialId: 'testComponent',
      responseId: 'response',
      answer: 'participant answer',
      description: 'Config description',
      instruction: 'Config instruction',
      responsePrompt: 'Config prompt',
      correctAnswer: 'answer from participant data',
      duration: 100,
      meta: JSON.stringify({ source: 'config' }, null, 2),
      responseMin: 0,
      responseMax: 10,
      parameters_speed: 'fast',
    }));
  });

  test('keeps participant-derived rows when configs are missing', async () => {
    const participantWithConfig = makeParticipant({
      participantId: 'p1',
      participantConfigHash: 'hash-1',
    });
    const participantMissingConfig = makeParticipant({
      participantId: 'p2',
      participantConfigHash: 'missing-hash',
    });
    const storageEngine = makeStorageEngine({
      'hash-1': configSimple,
    });
    const selectedProperties = [
      'answer',
      'configHash',
      'description',
      'instruction',
      'responsePrompt',
      'correctAnswer',
      'duration',
      'startTime',
      'endTime',
      'meta',
      'responseMin',
      'responseMax',
    ] as const;

    const tableData = await getTableData(
      [...selectedProperties],
      [participantWithConfig, participantMissingConfig],
      storageEngine,
      'test-study',
    );

    expect(tableData.missingConfigCount).toBe(1);
    expect(tableData.header).toEqual(expect.arrayContaining(['answer', 'configHash']));
    const missingConfigRow = tableData.rows.find((row) => row.participantId === 'p2' && row.responseId === 'response');
    expect(tableData.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        participantId: 'p1',
        trialId: 'testComponent',
      }),
    ]));
    expect(missingConfigRow).toEqual(expect.objectContaining({
      participantId: 'p2',
      trialId: 'testComponent',
      trialOrder: '0',
      responseId: 'response',
      answer: 'participant answer',
      configHash: 'missing-hash',
      duration: 100,
      startTime: new Date(100).toISOString(),
      endTime: new Date(200).toISOString(),
      correctAnswer: 'answer from participant data',
      parameters_speed: 'fast',
    }));
    expect(missingConfigRow?.description).toBeUndefined();
    expect(missingConfigRow?.instruction).toBeUndefined();
    expect(missingConfigRow?.responsePrompt).toBeUndefined();
    expect(missingConfigRow?.meta).toBeUndefined();
    expect(missingConfigRow?.responseMin).toBeUndefined();
    expect(missingConfigRow?.responseMax).toBeUndefined();
  });

  test('returns participant-derived rows when all selected participant configs are missing', async () => {
    const storageEngine = makeStorageEngine({});

    const tableData = await getTableData(
      ['answer'],
      [makeParticipant({ participantId: 'p1', participantConfigHash: 'missing-a' })],
      storageEngine,
      'test-study',
    );

    expect(tableData.header).toEqual(expect.arrayContaining(['participantId', 'trialId', 'responseId', 'answer']));
    expect(tableData.missingConfigCount).toBe(1);
    expect(tableData.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        participantId: 'p1',
        trialId: 'testComponent',
      }),
    ]));
  });

  test('fetches transcripts for participants whose config is missing', async () => {
    const getTranscription = vi.fn().mockResolvedValue({
      results: [{ alternatives: [{ transcript: 'spoken answer' }] }],
    });
    const participantWithConfig = makeParticipant({
      participantId: 'p1',
      participantConfigHash: 'hash-1',
    });
    const participantMissingConfig = makeParticipant({
      participantId: 'p2',
      participantConfigHash: 'missing-hash',
    });
    const storageEngine = makeStorageEngine({
      'hash-1': configSimple,
    }, getTranscription);

    await getTableData(
      ['transcript'],
      [participantWithConfig, participantMissingConfig],
      storageEngine,
      'test-study',
      true,
    );

    expect(getTranscription).toHaveBeenCalledTimes(2);
    expect(getTranscription).toHaveBeenCalledWith('testComponent_0', 'p1');
    expect(getTranscription).toHaveBeenCalledWith('testComponent_0', 'p2');
  });

  test('includes participant status, condition, tags, and metadata rows', async () => {
    const rejectedAt = 300;
    const participant = makeParticipant({
      completed: true,
      rejected: {
        reason: 'low quality',
        timestamp: rejectedAt,
      },
      conditions: ['alpha', 'beta'],
      metadata: {
        userAgent: 'test-agent',
        resolution: { width: 1920, height: 1080 },
        language: 'en-US',
        ip: '127.0.0.1',
      },
      participantTags: ['pilot', 'review'],
      stage: 'COMPLETE',
    });
    const storageEngine = makeStorageEngine({
      'hash-1': configSimple,
    });

    const tableData = await getTableData(
      ['condition', 'stage', 'status', 'rejectReason', 'rejectTime', 'percentComplete', 'metaData'],
      [participant],
      storageEngine,
      'test-study',
    );

    const participantTagsRow = tableData.rows.find((row) => row.responseId === 'participantTags');
    const metaDataRow = tableData.rows.find((row) => row.responseId === 'metaData');
    const answerRow = tableData.rows.find((row) => row.responseId === 'response');

    expect(tableData.header).toEqual(expect.arrayContaining(['condition', 'stage', 'status', 'rejectReason', 'rejectTime', 'percentComplete']));
    expect(tableData.header).not.toContain('metaData');
    expect(participantTagsRow).toEqual(expect.objectContaining({
      participantId: 'p1',
      trialId: 'participantTags',
      responseId: 'participantTags',
      answer: JSON.stringify(['pilot', 'review']),
      condition: 'alpha,beta',
      stage: 'COMPLETE',
    }));
    expect(metaDataRow).toEqual(expect.objectContaining({
      participantId: 'p1',
      trialId: 'metaData',
      responseId: 'metaData',
      answer: JSON.stringify(participant.metadata),
      condition: 'alpha,beta',
      stage: 'COMPLETE',
    }));
    expect(answerRow).toEqual(expect.objectContaining({
      status: 'rejected',
      rejectReason: 'low quality',
      rejectTime: new Date(rejectedAt).toISOString(),
      percentComplete: '100.00',
    }));
  });

  test('exports empty answer rows and window event counts', async () => {
    const participant = makeParticipant({
      answers: {
        testComponent_0: {
          ...makeParticipant().answers.testComponent_0,
          answer: {},
          windowEvents: [
            [100, 'focus', 'visible'],
            [101, 'focus', 'hidden'],
            [102, 'input', 'typed'],
            [103, 'keydown', 'Enter'],
            [104, 'keyup', 'Enter'],
            [105, 'mousemove', [1, 2]],
            [106, 'mousedown', [1, 2]],
            [107, 'mouseup', [1, 2]],
            [108, 'resize', [800, 600]],
            [109, 'scroll', [0, 100]],
            [110, 'visibility', 'visible'],
          ],
        },
      },
    });
    const storageEngine = makeStorageEngine({
      'hash-1': configSimple,
    });

    const tableData = await getTableData(
      ['answer'],
      [participant],
      storageEngine,
      'test-study',
    );

    const emptyAnswerRow = tableData.rows.find((row) => row.responseId === '');
    const windowEventsRow = tableData.rows.find((row) => row.responseId === 'windowEvents');

    expect(emptyAnswerRow).toEqual(expect.objectContaining({
      participantId: 'p1',
      trialId: 'testComponent',
      responseId: '',
    }));
    expect(emptyAnswerRow?.answer).toBeUndefined();
    expect(windowEventsRow).toEqual(expect.objectContaining({
      participantId: 'p1',
      trialId: 'testComponent',
      responseId: 'windowEvents',
      answer: JSON.stringify({
        focus: 2,
        input: 1,
        keydown: 1,
        keyup: 1,
        mousemove: 1,
        mousedown: 1,
        mouseup: 1,
        resize: 1,
        scroll: 1,
        visibility: 1,
      }),
    }));
  });

  test('keeps participant-derived rows when an answer references a missing component in an available config', async () => {
    const participant = makeParticipant({
      answers: {
        missingComponent_0: {
          ...makeParticipant().answers.testComponent_0,
          componentName: 'missingComponent',
          identifier: 'missingComponent_0',
        },
      },
    });
    const storageEngine = makeStorageEngine({
      'hash-1': configSimple,
    });

    const tableData = await getTableData(
      ['answer', 'description', 'instruction', 'responsePrompt', 'responseMin', 'responseMax'],
      [participant],
      storageEngine,
      'test-study',
    );

    const answerRow = tableData.rows.find((row) => row.responseId === 'response');
    expect(tableData.missingConfigCount).toBe(0);
    expect(answerRow).toEqual(expect.objectContaining({
      participantId: 'p1',
      trialId: 'missingComponent',
      responseId: 'response',
      answer: 'participant answer',
    }));
    expect(answerRow?.description).toBeUndefined();
    expect(answerRow?.instruction).toBeUndefined();
    expect(answerRow?.responsePrompt).toBeUndefined();
    expect(answerRow?.responseMin).toBeUndefined();
    expect(answerRow?.responseMax).toBeUndefined();
  });

  test('does not fetch transcripts when audio is unavailable or storage is not firebase', async () => {
    const getTranscription = vi.fn();
    const storageEngine = makeStorageEngine({
      'hash-1': configSimple,
    }, getTranscription, 'localStorage');

    await getTableData(
      ['transcript'],
      [makeParticipant()],
      storageEngine,
      'test-study',
      true,
    );

    expect(getTranscription).not.toHaveBeenCalled();
  });

  test('keeps config lookup rejection as an export-blocking storage error', async () => {
    const storageEngine = {
      getAllConfigsFromHash: vi.fn().mockRejectedValue(new Error('storage unavailable')),
      getEngine: vi.fn(() => 'firebase'),
    } as unknown as StorageEngine;

    await expect(getTableData(
      ['answer'],
      [makeParticipant()],
      storageEngine,
      'test-study',
    )).rejects.toThrow('storage unavailable');
  });

  test('returns empty table data when storage engine is unavailable', async () => {
    const tableData = await getTableData(
      ['answer'],
      [makeParticipant()],
      undefined,
      'test-study',
    );

    expect(tableData).toEqual({
      header: [],
      rows: [],
      missingConfigCount: 0,
    });
  });
});

describe('DownloadTidy', () => {
  afterEach(() => {
    cleanup();
    storageEngineHookMock.storageEngine = undefined;
    vi.clearAllMocks();
  });

  test('shows an informational warning when selected participants reference missing configs', async () => {
    storageEngineHookMock.storageEngine = makeStorageEngine({});

    render(
      <MantineProvider>
        <DownloadTidy
          opened
          close={vi.fn()}
          filename="test-study_tidy.csv"
          data={[makeParticipant({ participantConfigHash: 'missing-hash' })]}
          studyId="test-study"
        />
      </MantineProvider>,
    );

    await waitFor(() => {
      expect(document.body.textContent).toContain('Stored study configs could not be loaded for 1 selected participant.');
    });
    expect(document.body.textContent).toContain('Config-derived columns, such as description and instruction, may be blank for those rows.');
    expect(document.body.textContent).toContain('To restore the current config, reload the study page.');
    expect(document.body.textContent).toContain('historical configs that differ from the current config must be restored from a storage snapshot or backup.');
  });
});
