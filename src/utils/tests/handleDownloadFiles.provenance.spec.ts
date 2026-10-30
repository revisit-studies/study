import {
  afterEach, describe, expect, test, vi,
} from 'vitest';
import { createGlobalStoreSubmission, GLOBAL_STORE_TASK } from '../../store/globalStoreProvenance';
import { downloadParticipantsAudioZip, downloadParticipantsProvenanceZip } from '../handleDownloadFiles';
import type { StorageEngine } from '../../storage/engines/types';
import type { StoredAnswer } from '../../store/types';

const mockZipState = vi.hoisted(() => {
  const instances: Array<{
    files: Record<string, unknown>;
    file: (name: string, content: unknown) => unknown;
  }> = [];

  class MockJSZip {
    files: Record<string, unknown> = {};

    file = vi.fn((name: string, content: unknown) => {
      this.files[name] = content;
      return this;
    });

    generateAsync = vi.fn(async () => new Blob(['zip']));

    constructor() {
      instances.push(this);
    }
  }

  return { instances, MockJSZip };
});

vi.mock('jszip', () => ({
  default: mockZipState.MockJSZip,
}));

function makeStoredAnswer(overrides: Partial<StoredAnswer> = {}): StoredAnswer {
  return {
    answer: {},
    identifier: 'intro_0',
    componentName: 'intro',
    trialOrder: '0',
    correctAnswer: [],
    incorrectAnswers: {},
    startTime: 10,
    endTime: 20,
    windowEvents: [],
    timedOut: false,
    helpButtonClickedCount: 0,
    parameters: {},
    optionOrders: {},
    questionOrders: {},
    ...overrides,
  };
}

describe('provenance downloads', () => {
  afterEach(() => {
    mockZipState.instances.splice(0, mockZipState.instances.length);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test('downloads provenance as a zip alongside the expected per-answer file name', async () => {
    const anchor = {
      href: '',
      download: '',
      click: vi.fn(),
      remove: vi.fn(),
    } as unknown as HTMLAnchorElement;
    const createElement = vi.fn().mockReturnValue(anchor);
    const appendChild = vi.fn();
    vi.stubGlobal('document', {
      createElement,
      body: {
        appendChild,
      },
    });
    if (!URL.createObjectURL) {
      URL.createObjectURL = vi.fn();
    }
    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = vi.fn();
    }
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:zip');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    const provenanceGraph = {
      aboveStimulus: undefined,
      belowStimulus: undefined,
      sidebar: undefined,
      stimulus: {
        root: 'root',
        nodes: {
          root: {
            id: 'root',
            createdOn: 10,
            children: [],
          },
        },
      },
    };

    const storageEngine = {
      getProvenance: vi.fn().mockResolvedValue(provenanceGraph),
    } as unknown as StorageEngine;

    await downloadParticipantsProvenanceZip({
      storageEngine,
      participants: [
        {
          participantId: 'p1',
          answers: {
            intro_0: makeStoredAnswer(),
          },
        },
      ],
      studyId: 'study-1',
    });

    expect(storageEngine.getProvenance).toHaveBeenCalledWith('intro_0', 'p1');
    expect(mockZipState.instances).toHaveLength(1);
    expect(mockZipState.instances[0].files['study-1_p1_intro_0_provenance.json']).toBe(
      JSON.stringify(provenanceGraph, null, 2),
    );
    expect(anchor.download).toBe('study-1_provenance.zip');
    expect(anchor.click).toHaveBeenCalled();
  });
});

test('provenance archives include the global graph and assets for invalidated trials', async () => {
  const anchor = { click: vi.fn() };
  vi.stubGlobal('document', { createElement: () => anchor });
  URL.createObjectURL = vi.fn(() => 'blob:zip');
  URL.revokeObjectURL = vi.fn();
  const original = createGlobalStoreSubmission(undefined, { budget: { initialValue: 100 } }, makeStoredAnswer({ identifier: 'original_0', componentName: 'original' }), { budget: 70 }, [], {});
  const later = createGlobalStoreSubmission(original.graph, { budget: { initialValue: 100 } }, makeStoredAnswer({ identifier: 'removed_1', trialOrder: '1', componentName: 'removed' }), { budget: 50 }, [], {});
  const revised = createGlobalStoreSubmission(later.graph, { budget: { initialValue: 100 } }, makeStoredAnswer({ identifier: 'original_0', componentName: 'original', answer: { cost: 10 } }), { budget: 90 }, [], {});
  const stored = { globalStore: revised.graph };
  const getProvenance = vi.fn(async (task: string) => (task === GLOBAL_STORE_TASK ? stored : { stimulus: { root: 'retained' } }));
  await downloadParticipantsProvenanceZip({
    storageEngine: { getProvenance } as unknown as StorageEngine,
    participants: [{ participantId: 'p1', answers: { original_0: makeStoredAnswer({ identifier: 'original_0' }) } }],
    studyId: 'budget',
  });
  expect(getProvenance).toHaveBeenCalledWith('removed_1', 'p1');
  const { files } = (mockZipState.instances.at(-1)!);
  expect(files['budget_p1___globalStore_provenance.json']).toBe(JSON.stringify(stored, null, 2));
  expect(files['budget_p1_removed_1_provenance.json']).toBeDefined();
});

test('media exports follow the retained recording references for original and revised submissions', async () => {
  vi.stubGlobal('document', { createElement: () => ({ click: vi.fn() }) });
  URL.createObjectURL = vi.fn(() => 'blob:zip');
  URL.revokeObjectURL = vi.fn();
  const originalAnswer = makeStoredAnswer({ assetIdentifier: 'original-recording', answer: { cost: 30 } });
  const first = createGlobalStoreSubmission(undefined, { budget: { initialValue: 100 } }, originalAnswer, { budget: 70 }, [], {});
  const revisedAnswer = makeStoredAnswer({ assetIdentifier: 'revised-recording', answer: { cost: 10 } });
  const revised = createGlobalStoreSubmission(first.graph, { budget: { initialValue: 100 } }, revisedAnswer, { budget: 90 }, [], {});
  const getAudioUrl = vi.fn(async () => null);
  const storageEngine = { getAudioUrl, getTranscriptUrl: vi.fn(async () => null), getProvenance: vi.fn(async () => ({ globalStore: revised.graph })) } as unknown as StorageEngine;
  await downloadParticipantsAudioZip({ storageEngine, participants: [{ participantId: 'p1', answers: { intro_0: revisedAnswer } }], studyId: 'budget' });
  expect(getAudioUrl).toHaveBeenCalledWith('original-recording', 'p1');
  expect(getAudioUrl).toHaveBeenCalledWith('revised-recording', 'p1');
  expect(getAudioUrl).toHaveBeenCalledTimes(2);
});
