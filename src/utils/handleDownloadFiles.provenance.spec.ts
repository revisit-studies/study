import {
  afterEach, describe, expect, test, vi,
} from 'vitest';
import { downloadParticipantsProvenanceZip } from './handleDownloadFiles';
import type { StorageEngine } from '../storage/engines/types';
import type { StoredAnswer } from '../store/types';

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
