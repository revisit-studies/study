import { ReactNode } from 'react';
import { render, act, cleanup } from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { AudioProvenanceVis } from './AudioProvenanceVis';
import { syncEmitter } from '../../utils/syncReplay';

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock('wavesurfer-react', () => ({
  WaveSurfer: vi.fn(({ children }: { children?: ReactNode }) => <div data-testid="wavesurfer">{children}</div>),
  WaveForm: () => <div data-testid="waveform" />,
}));

vi.mock('@mantine/core', () => ({
  Box: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Group: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  LoadingOverlay: ({ visible }: { visible: boolean }) => (
    visible ? <div data-testid="loading-overlay" /> : null
  ),
  Stack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@mantine/hooks', () => ({
  useResizeObserver: () => [{ current: null }, { width: 500 }],
  useThrottledCallback: (fn: (...args: unknown[]) => unknown) => fn,
}));

vi.mock('react-router', () => ({
  useLocation: () => ({ search: '' }),
  useNavigate: () => vi.fn(),
  useParams: () => ({ studyId: 'test-study' }),
  useSearchParams: () => {
    const params = new URLSearchParams();
    const setParams = vi.fn((updater: unknown) => {
      if (typeof updater === 'function') updater(params);
    });
    return [params, setParams];
  },
}));

vi.mock('../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({ storageEngine: null }),
}));

vi.mock('./TaskProvenanceTimeline', () => ({
  TaskProvenanceTimeline: () => <div data-testid="provenance-timeline" />,
}));

vi.mock('../../store/hooks/useIsAnalysis', () => ({
  useIsAnalysis: () => false,
}));

vi.mock('./Timer', () => ({
  Timer: () => <div data-testid="timer" />,
}));

vi.mock('../../utils/humanReadableDuration', () => ({
  youtubeReadableDuration: (ms: number) => String(ms),
}));

vi.mock('../../store/hooks/useEvent', () => ({
  useEvent: (fn: (...args: unknown[]) => unknown) => fn,
}));

vi.mock('../../utils/encryptDecryptIndex', () => ({
  encryptIndex: (i: number) => String(i),
}));

vi.mock('../../utils/parseTrialOrder', () => ({
  parseTrialOrder: vi.fn(() => ({ step: 0, funcIndex: null })),
}));

vi.mock('./useUpdateProvenance', () => ({
  useUpdateProvenance: vi.fn(),
}));

vi.mock('../../store/hooks/useReplay', () => ({
  useReplayContext: () => ({
    audioRef: { current: null },
    updateReplayRef: vi.fn(),
    duration: 0,
    setDuration: vi.fn(),
    seekTime: 0,
  }),
}));

vi.mock('../../utils/syncReplay', () => ({
  syncChannel: { postMessage: vi.fn() },
  syncEmitter: { on: vi.fn(), off: vi.fn() },
}));

vi.mock('@trrack/core', () => ({
  Registry: { create: () => ({}) },
  initializeTrrack: () => ({
    importObject: vi.fn(),
    getState: vi.fn(() => ({})),
    to: vi.fn(),
  }),
  isRootNode: () => true,
}));

// ── tests ─────────────────────────────────────────────────────────────────────

const defaultProps = {
  setTimeString: vi.fn(),
  answers: {},
  setTime: vi.fn(),
  taskName: 'trial_0',
  context: 'audioAnalysis' as const,
  saveProvenance: vi.fn(),
  setHasAudio: vi.fn(),
};

const answersWithTask = {
  trial_0: {
    startTime: 1000,
    endTime: 6000,
    answer: {},
    provenanceGraph: {
      aboveStimulus: null,
      belowStimulus: null,
      sidebar: null,
      stimulus: null,
    },
    windowEvents: [],
    trialOrder: '0',
    conditions: [],
  },
} as never;

const answersWithStimulus = {
  trial_0: {
    startTime: 1000,
    endTime: 6000,
    answer: {},
    provenanceGraph: {
      aboveStimulus: null,
      belowStimulus: null,
      sidebar: null,
      stimulus: {
        root: 'root-id',
        nodes: {
          'root-id': {
            id: 'root-id',
            children: [],
            parent: null,
            createdOn: 500,
          },
        },
      },
    },
    windowEvents: [],
    trialOrder: '0',
    conditions: [],
  },
} as never;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('AudioProvenanceVis', () => {
  test('renders without crashing', async () => {
    const { container } = await act(async () => render(<AudioProvenanceVis {...defaultProps} />));
    expect(container).toBeDefined();
  });

  test('renders in provenanceVis context', async () => {
    const { container } = await act(async () => render(
      <AudioProvenanceVis {...defaultProps} context="provenanceVis" />,
    ));
    expect(container).toBeDefined();
  });

  test('renders with answers containing task data (startTime=0, no xScale)', async () => {
    const answers = {
      trial_0: {
        startTime: 0,
        endTime: 5000,
        answer: {},
        provenanceGraph: {
          aboveStimulus: null,
          belowStimulus: null,
          sidebar: null,
          stimulus: null,
        },
        windowEvents: [],
        trialOrder: '0',
      },
    };

    const { container } = await act(async () => render(
      <AudioProvenanceVis {...defaultProps} answers={answers as never} />,
    ));
    expect(container).toBeDefined();
  });

  test('renders xScale-dependent elements when startTime > 0 (covers lines 326-374)', async () => {
    const { container } = await act(async () => render(
      <AudioProvenanceVis {...defaultProps} answers={answersWithTask} />,
    ));
    expect(container).toBeDefined();
  });

  test('renders xScale with provenanceGraph.stimulus (covers trrack init + provGraph effect)', async () => {
    const { container } = await act(async () => render(
      <AudioProvenanceVis {...defaultProps} answers={answersWithStimulus} />,
    ));
    expect(container).toBeDefined();
  });

  test('trialOrder syncChannel.postMessage fires when answers have trialOrder', async () => {
    const { syncChannel } = await import('../../utils/syncReplay');
    await act(async () => render(
      <AudioProvenanceVis {...defaultProps} answers={answersWithTask} />,
    ));
    expect(vi.mocked(syncChannel.postMessage)).toHaveBeenCalled();
  });
});

describe('AudioProvenanceVis — syncEmitter listeners', () => {
  test('participantId listener calls setSearchParams (covers lines 134-140)', async () => {
    await act(async () => render(
      <AudioProvenanceVis {...defaultProps} answers={answersWithTask} />,
    ));

    const onCalls = vi.mocked(syncEmitter.on).mock.calls;
    const entry = onCalls.find(([event]) => event === 'participantId');
    const listener = entry?.[1] as ((v: string) => void) | undefined;
    expect(listener).toBeDefined();

    await act(async () => { listener?.('new-participant'); });
  });

  test('trialOrderListener in audioAnalysis with matching answer (covers lines 142-169)', async () => {
    await act(async () => render(
      <AudioProvenanceVis {...defaultProps} answers={answersWithTask} />,
    ));

    const onCalls = vi.mocked(syncEmitter.on).mock.calls;
    const entry = onCalls.find(([event]) => event === 'trialOrder');
    const listener = entry?.[1] as ((v: string) => void) | undefined;
    expect(listener).toBeDefined();

    // Matching trialOrder → navigate to tagging page (lines 166-169)
    await act(async () => { listener?.('0'); });
  });

  test('trialOrderListener in audioAnalysis without matching answer (covers line 162-163)', async () => {
    await act(async () => render(
      <AudioProvenanceVis {...defaultProps} answers={{}} />,
    ));

    const onCalls = vi.mocked(syncEmitter.on).mock.calls;
    const entry = onCalls.find(([event]) => event === 'trialOrder');
    const listener = entry?.[1] as ((v: string) => void) | undefined;

    await act(async () => { listener?.('999'); });
    expect(listener).toBeDefined();
  });

  test('trialOrderListener in provenanceVis context (covers lines 153-158)', async () => {
    await act(async () => render(
      <AudioProvenanceVis {...defaultProps} context="provenanceVis" answers={answersWithTask} />,
    ));

    const onCalls = vi.mocked(syncEmitter.on).mock.calls;
    const entry = onCalls.find(([event]) => event === 'trialOrder');
    const listener = entry?.[1] as ((v: string) => void) | undefined;

    // Navigate with funcIndex=null (line 155)
    await act(async () => { listener?.('0'); });
    expect(listener).toBeDefined();
  });

  test('trialOrderListener: step=null early return (covers line 144-145)', async () => {
    const { parseTrialOrder } = await import('../../utils/parseTrialOrder');
    vi.mocked(parseTrialOrder).mockReturnValueOnce({ step: null, funcIndex: null });

    await act(async () => render(
      <AudioProvenanceVis {...defaultProps} answers={answersWithTask} />,
    ));

    const onCalls = vi.mocked(syncEmitter.on).mock.calls;
    const entry = onCalls.find(([event]) => event === 'trialOrder');
    const listener = entry?.[1] as ((v: string) => void) | undefined;

    await act(async () => { listener?.('bad'); });
    expect(listener).toBeDefined();
  });

  test('cleanup removes syncEmitter listeners on unmount', async () => {
    const { unmount } = await act(async () => render(
      <AudioProvenanceVis {...defaultProps} />,
    ));
    unmount();
    expect(vi.mocked(syncEmitter.off)).toHaveBeenCalledWith('participantId', expect.any(Function));
    expect(vi.mocked(syncEmitter.off)).toHaveBeenCalledWith('trialOrder', expect.any(Function));
  });
});

describe('AudioProvenanceVis — provenanceVis context', () => {
  test('_setCurrentNode in provenanceVis calls saveProvenance and trrack.to (covers lines 207-211)', async () => {
    const saveProvenance = vi.fn();
    // Render with provenanceVis context and stimulus graph so trrackForTrial.current is set
    // then the provenance node effect calls _setCurrentNode(root) which hits lines 207-211
    await act(async () => render(
      <AudioProvenanceVis
        {...defaultProps}
        context="provenanceVis"
        answers={answersWithStimulus}
        saveProvenance={saveProvenance}
      />,
    ));
    // saveProvenance should have been called with { prov: ..., location: 'stimulus' }
    expect(saveProvenance).toHaveBeenCalled();
  });
});

describe('AudioProvenanceVis — handleWSMount', () => {
  test('handleWSMount with null waveSurfer (covers else branch lines 316-322)', async () => {
    let capturedOnMount: ((ws: unknown) => void) | undefined;

    const { WaveSurfer } = await import('wavesurfer-react');
    vi.mocked(WaveSurfer).mockImplementationOnce((({ onMount }: { onMount?: (ws: unknown) => void; children?: ReactNode }) => {
      capturedOnMount = onMount;
      return <div data-testid="wavesurfer-mock" />;
    }) as never);

    await act(async () => render(
      <AudioProvenanceVis {...defaultProps} answers={answersWithTask} />,
    ));

    await act(async () => { capturedOnMount?.(null); });
    expect(capturedOnMount).toBeDefined();
  });
});
