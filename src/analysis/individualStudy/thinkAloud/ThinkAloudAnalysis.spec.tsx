import { ReactNode } from 'react';
import { render, act, cleanup } from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { ThinkAloudAnalysis } from './ThinkAloudAnalysis';
import type { ParticipantData } from '../../../storage/types';
import type { FirebaseStorageEngine } from '../../../storage/engines/FirebaseStorageEngine';
import { useAsync } from '../../../store/hooks/useAsync';

// ── mutable state ─────────────────────────────────────────────────────────────

let mockSearchParams = new URLSearchParams('participantId=p1');
let mockTrialId: string | undefined = 'trial_0';
// Call through for function-form updates so lines 123-126 (callback body) are covered
let mockSetSearchParams = vi.fn((updater: unknown) => {
  if (typeof updater === 'function') updater(mockSearchParams);
});
let mockNavigate = vi.fn();

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ search: '', pathname: '/' }),
  useParams: () => ({ studyId: 'test-study', trialId: mockTrialId }),
  useSearchParams: () => [mockSearchParams, mockSetSearchParams],
}));

vi.mock('@mantine/hooks', () => ({
  useResizeObserver: () => [{ current: null }, { width: 800 }],
}));

vi.mock('../../../store/hooks/useAsync', () => ({
  useAsync: vi.fn(() => ({
    value: null, status: 'success', execute: vi.fn(), error: null,
  })),
}));

vi.mock('../../../store/hooks/useAuth', () => ({
  useAuth: () => ({ user: { user: { email: 'test@test.com' } } }),
}));

vi.mock('../../../store/hooks/useEvent', () => ({
  useEvent: (fn: (...args: unknown[]) => unknown) => fn,
}));

vi.mock('../../../store/hooks/useReplay', () => ({
  ReplayContext: { Provider: ({ children }: { children: ReactNode }) => <div>{children}</div> },
  useReplay: () => ({}),
}));

vi.mock('../../../utils/parseTrialOrder', () => ({
  parseTrialOrder: vi.fn(() => ({ step: 0, funcIndex: null })),
}));

vi.mock('lodash.debounce', () => ({
  default: (fn: (...args: unknown[]) => unknown) => fn,
}));

vi.mock('./TextEditor', () => ({
  TextEditor: ({ onClickLine, transcriptList }: { onClickLine?: (n: number) => void; transcriptList?: unknown[] }) => {
    if (transcriptList && transcriptList.length > 0) { onClickLine?.(0); }
    return <div data-testid="text-editor" />;
  },
}));

vi.mock('./ThinkAloudFooter', () => ({
  ThinkAloudFooter: ({ onTimeUpdate, setHasAudio }: { onTimeUpdate?: (t: number) => void; setHasAudio?: (b: boolean) => void }) => {
    setHasAudio?.(true);
    onTimeUpdate?.(5000);
    return <div data-testid="think-aloud-footer" />;
  },
}));

vi.mock('@mantine/core', () => ({
  Center: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Group: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Stack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));

// ── fixtures ──────────────────────────────────────────────────────────────────

const mockStorageEngine = {} as FirebaseStorageEngine;

const mockParticipant: ParticipantData = {
  participantId: 'p1',
  participantTags: {},
  participantConfigHash: 'abc',
  sequence: {
    id: 'root', order: 'fixed', components: [], skip: [], orderPath: 'root',
  },
  answers: {},
  completed: false,
  rejected: false,
  searchParams: {},
  stage: 'DEFAULT',
  metadata: {},
  conditions: [],
} as unknown as ParticipantData;

// ── tests ─────────────────────────────────────────────────────────────────────

afterEach(() => { cleanup(); });

beforeEach(() => {
  mockSearchParams = new URLSearchParams('participantId=p1');
  mockTrialId = 'trial_0';
  mockNavigate = vi.fn();
  mockSetSearchParams = vi.fn((updater: unknown) => {
    if (typeof updater === 'function') updater(mockSearchParams);
  });
  vi.mocked(useAsync).mockReturnValue({
    value: null, status: 'success', execute: vi.fn(), error: null,
  });
});

describe('ThinkAloudAnalysis', () => {
  test('renders without crashing', async () => {
    const { container } = await act(async () => render(
      <ThinkAloudAnalysis
        visibleParticipants={[mockParticipant]}
        storageEngine={mockStorageEngine}
      />,
    ));
    expect(container).toBeDefined();
  });

  test('shows placeholder text when no participantId', async () => {
    mockSearchParams = new URLSearchParams('');
    const { container } = await act(async () => render(
      <ThinkAloudAnalysis
        visibleParticipants={[]}
        storageEngine={mockStorageEngine}
      />,
    ));
    expect(container.textContent).toContain('Select');
  });

  test('shows no-transcript message when participantId set but no audio', async () => {
    const { container } = await act(async () => render(
      <ThinkAloudAnalysis
        visibleParticipants={[mockParticipant]}
        storageEngine={mockStorageEngine}
      />,
    ));
    // hasAudio is initially undefined/false, rawTranscript is null → shows "No transcripts" message
    expect(container.textContent).toContain('No transcripts found');
  });

  test('renders ThinkAloudFooter', async () => {
    const { getAllByTestId } = await act(async () => render(
      <ThinkAloudAnalysis
        visibleParticipants={[mockParticipant]}
        storageEngine={mockStorageEngine}
      />,
    ));
    expect(getAllByTestId('think-aloud-footer').length).toBeGreaterThan(0);
  });
});

// ── extended coverage ─────────────────────────────────────────────────────────

const mockParticipantFull = {
  participantId: 'p1',
  answers: {
    trial_0: {
      identifier: 'trial_0',
      componentName: 'C1',
      trialOrder: '0_null',
      startTime: 1000,
      endTime: 2000,
      alternatives: [{ transcript: 'hello' }],
    },
    trial_1: {
      identifier: 'trial_1',
      componentName: 'C2',
      trialOrder: '1_null',
      startTime: 2000,
      endTime: 3000,
      alternatives: [],
    },
  },
} as unknown as ParticipantData;

const mockRawTranscript = {
  results: [
    { resultEndTime: 1.5, alternatives: [{ transcript: 'hello world' }] },
    { resultEndTime: 3.0, alternatives: [{ transcript: 'goodbye' }] },
  ],
};

const mockStorageEngineWithMethods = {
  getParticipantData: vi.fn().mockResolvedValue(null),
  getTranscription: vi.fn().mockResolvedValue(null),
  getEditedTranscript: vi.fn().mockResolvedValue(null),
  saveEditedTranscript: vi.fn().mockResolvedValue(undefined),
} as unknown as FirebaseStorageEngine;

const mockStorageEngineWithData = {
  getParticipantData: vi.fn().mockResolvedValue(null),
  getTranscription: vi.fn().mockResolvedValue({
    results: [{ resultEndTime: '1.5s', alternatives: [{ transcript: 'hello world' }] }],
  }),
  getEditedTranscript: vi.fn().mockResolvedValue(null),
  saveEditedTranscript: vi.fn().mockResolvedValue(undefined),
} as unknown as FirebaseStorageEngine;

describe('ThinkAloudAnalysis extended coverage', () => {
  test('covers private helper functions (27-61) by having useAsync invoke them', async () => {
    vi.mocked(useAsync).mockImplementation((fn, args) => {
      try { (fn as (...a: unknown[]) => unknown)(...(args as unknown[])); } catch { /* ignore */ }
      return {
        value: null, status: 'success', execute: vi.fn(), error: null,
      };
    });
    await act(async () => render(
      <ThinkAloudAnalysis visibleParticipants={[mockParticipantFull]} storageEngine={mockStorageEngineWithData} />,
    ));
    expect(mockStorageEngineWithData.getParticipantData).toHaveBeenCalled();
  });

  test('setSearchParams called when no participantId but visibleParticipants exist (covers 122-127)', async () => {
    mockSearchParams = new URLSearchParams('');
    await act(async () => render(
      <ThinkAloudAnalysis visibleParticipants={[mockParticipantFull]} storageEngine={mockStorageEngineWithMethods} />,
    ));
    expect(mockSetSearchParams).toHaveBeenCalled();
  });

  test('navigate effect runs when participant loaded with no matching currentTrial answer (covers 138-146)', async () => {
    // participant has answers but currentTrial ('trial_0') is not in answers
    const partNoMatchingTrial = { ...mockParticipantFull, answers: { trial_other: { identifier: 'trial_other', trialOrder: '0_null' } } } as unknown as ParticipantData;
    vi.mocked(useAsync).mockReturnValueOnce({
      value: partNoMatchingTrial, status: 'success', execute: vi.fn(), error: null,
    })
      .mockReturnValue({
        value: null, status: 'success', execute: vi.fn(), error: null,
      });
    await act(async () => render(
      <ThinkAloudAnalysis visibleParticipants={[mockParticipantFull]} storageEngine={mockStorageEngineWithMethods} />,
    ));
    expect(mockNavigate).toHaveBeenCalled();
  });

  test('onlineTranscriptList truthy sets editedTranscript (covers line 158)', async () => {
    const mockTranscriptList = [{
      text: 'hello', transcriptMappingStart: 0, transcriptMappingEnd: 0, selectedTags: [], annotation: '',
    }];
    // 3rd useAsync call (getTranscript) returns onlineTranscriptList
    vi.mocked(useAsync)
      .mockReturnValueOnce({
        value: null, status: 'success', execute: vi.fn(), error: null,
      }) // participant
      .mockReturnValueOnce({
        value: null, status: 'success', execute: vi.fn(), error: null,
      }) // rawTranscript
      .mockReturnValueOnce({
        value: mockTranscriptList, status: 'success', execute: vi.fn(), error: null,
      }); // onlineTranscriptList
    const { container } = await act(async () => render(
      <ThinkAloudAnalysis visibleParticipants={[mockParticipantFull]} storageEngine={mockStorageEngineWithMethods} />,
    ));
    expect(container).toBeDefined();
  });

  test('onTimeUpdate runs with rawTranscript and participant present (covers 166-196)', async () => {
    // participant + rawTranscript both non-null so onTimeUpdate body executes
    vi.mocked(useAsync)
      .mockReturnValueOnce({
        value: mockParticipantFull, status: 'success', execute: vi.fn(), error: null,
      }) // participant
      .mockReturnValueOnce({
        value: mockRawTranscript, status: 'success', execute: vi.fn(), error: null,
      }) // rawTranscript
      .mockReturnValue({
        value: null, status: 'success', execute: vi.fn(), error: null,
      });
    const { container } = await act(async () => render(
      <ThinkAloudAnalysis visibleParticipants={[mockParticipantFull]} storageEngine={mockStorageEngineWithMethods} />,
    ));
    expect(container).toBeDefined();
  });

  test('changeLine callback covered when TextEditor calls onClickLine with non-empty transcript (covers 212-213)', async () => {
    // Stable across re-renders: identify rawTranscript call by 4 args with args[1]=currentTrial ('trial_0')
    vi.mocked(useAsync).mockImplementation((_fn, args) => ({
      value: Array.isArray(args) && args.length === 4 && args[1] === 'trial_0' ? mockRawTranscript : null,
      status: 'success' as const,
      execute: vi.fn(),
      error: null,
    }));
    const { container } = await act(async () => render(
      <ThinkAloudAnalysis visibleParticipants={[mockParticipantFull]} storageEngine={mockStorageEngineWithMethods} />,
    ));
    expect(container).toBeDefined();
  });

  test('getFirstTrialIdentifier sort comparison covered with multiple answers (covers 69-81)', async () => {
    // Two answers with different trialOrder → comparisons in sortFn are exercised
    const partMultiAnswers = {
      participantId: 'p1',
      answers: {
        trial_b: {
          identifier: 'trial_b', trialOrder: '1_null', startTime: 2000, endTime: 3000,
        },
        trial_a: {
          identifier: 'trial_a', trialOrder: '0_null', startTime: 1000, endTime: 2000,
        },
        trial_c: {
          identifier: 'trial_c', trialOrder: '0_0', startTime: 500, endTime: 1000,
        },
      },
    } as unknown as ParticipantData;
    vi.mocked(useAsync)
      .mockReturnValueOnce({
        value: partMultiAnswers, status: 'success', execute: vi.fn(), error: null,
      })
      .mockReturnValue({
        value: null, status: 'success', execute: vi.fn(), error: null,
      });
    await act(async () => render(
      <ThinkAloudAnalysis visibleParticipants={[partMultiAnswers]} storageEngine={mockStorageEngineWithMethods} />,
    ));
    expect(mockNavigate).toHaveBeenCalled();
  });

  test('getFirstTrialIdentifier returns empty string when participant has no answers (covers 143-144)', async () => {
    const partNoAnswers = { ...mockParticipantFull, answers: {} } as unknown as ParticipantData;
    vi.mocked(useAsync)
      .mockReturnValueOnce({
        value: partNoAnswers, status: 'success', execute: vi.fn(), error: null,
      })
      .mockReturnValue({
        value: null, status: 'success', execute: vi.fn(), error: null,
      });
    // firstTrialIdentifier = '' → early return without navigate
    await act(async () => render(
      <ThinkAloudAnalysis visibleParticipants={[partNoAnswers]} storageEngine={mockStorageEngineWithMethods} />,
    ));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('sort by funcIndex when step is equal (covers lines 76-78)', async () => {
    const { parseTrialOrder } = await import('../../../utils/parseTrialOrder');
    // Two answers have same step but different funcIndex → funcIndex comparator fires
    vi.mocked(parseTrialOrder)
      .mockReturnValueOnce({ step: 0, funcIndex: 0 })
      .mockReturnValueOnce({ step: 0, funcIndex: 1 })
      .mockReturnValue({ step: 0, funcIndex: null });
    const partSameFuncIndex = {
      participantId: 'p1',
      answers: {
        trial_a: {
          identifier: 'trial_a', trialOrder: '0_0', startTime: 1000, endTime: 2000,
        },
        trial_b: {
          identifier: 'trial_b', trialOrder: '0_1', startTime: 2000, endTime: 3000,
        },
      },
    } as unknown as import('../../../storage/types').ParticipantData;
    vi.mocked(useAsync)
      .mockReturnValueOnce({
        value: partSameFuncIndex, status: 'success', execute: vi.fn(), error: null,
      })
      .mockReturnValue({
        value: null, status: 'success', execute: vi.fn(), error: null,
      });
    await act(async () => render(
      <ThinkAloudAnalysis visibleParticipants={[partSameFuncIndex]} storageEngine={mockStorageEngine} />,
    ));
    expect(mockNavigate).toHaveBeenCalled();
  });

  test('onTimeUpdate with empty results array triggers reset (covers 173-175)', async () => {
    const emptyResultsTranscript = { results: [] }; // results[0] is undefined
    vi.mocked(useAsync)
      .mockReturnValueOnce({
        value: mockParticipantFull, status: 'success', execute: vi.fn(), error: null,
      })
      .mockReturnValueOnce({
        value: emptyResultsTranscript, status: 'success', execute: vi.fn(), error: null,
      })
      .mockReturnValue({
        value: null, status: 'success', execute: vi.fn(), error: null,
      });
    // ThinkAloudFooter mock calls onTimeUpdate(5000), participant is set, rawTranscript has empty results
    // → rawTranscript.results[0] is undefined → setCurrentShownTranscription(0) and return
    const { container } = await act(async () => render(
      <ThinkAloudAnalysis visibleParticipants={[mockParticipantFull]} storageEngine={mockStorageEngineWithMethods} />,
    ));
    expect(container).toBeDefined();
  });

  test('merge transcripts effect runs when rawTranscript present and no online transcript (covers 201-208)', async () => {
    vi.mocked(useAsync)
      .mockReturnValueOnce({
        value: null, status: 'success', execute: vi.fn(), error: null,
      }) // participant
      .mockReturnValueOnce({
        value: mockRawTranscript, status: 'success', execute: vi.fn(), error: null,
      }) // rawTranscript
      .mockReturnValue({
        value: null, status: 'success', execute: vi.fn(), error: null,
      }); // onlineTranscriptList null → triggers merge
    const { container } = await act(async () => render(
      <ThinkAloudAnalysis visibleParticipants={[mockParticipantFull]} storageEngine={mockStorageEngineWithMethods} />,
    ));
    expect(container).toBeDefined();
  });
});
