import { CSSProperties, forwardRef, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  render, act, cleanup, renderHook, fireEvent, waitFor,
} from '@testing-library/react';
import {
  afterEach, beforeAll, beforeEach, describe, expect, test, vi,
} from 'vitest';
import * as d3 from 'd3';
import { DEFAULT_THEME } from '@mantine/core';
import { WaveSurfer } from 'wavesurfer-react';
import WaveSurferType from 'wavesurfer.js';
import { StoredAnswer, StoredProvenance, TrrackedProvenance } from '../../../store/types';
import { makeStoredAnswer } from '../../../tests/utils';
import { AudioProvenanceVis } from '../AudioProvenanceVis';
import { syncChannel, syncEmitter } from '../../../utils/syncReplay';

// ── mocks ────────────────────────────────────────────────────────────────────

let mockColorScheme = 'light';
let mockSearchParams = new URLSearchParams('participantId=p1');
const mockProvenanceStartTime = vi.hoisted(() => vi.fn());
const mockAudioState = vi.hoisted(() => ({ isAnalysis: false, storageEngine: null as unknown }));
const mockWaveState = vi.hoisted(() => ({ onMount: undefined as ((waveSurfer: unknown) => void) | undefined }));
const mockNavigate = vi.hoisted(() => vi.fn());
let mockRouterLocationSearch = '';

vi.mock('wavesurfer-react', () => ({
  WaveSurfer: vi.fn(({ children, onMount }: { children?: ReactNode; onMount?: (waveSurfer: unknown) => void }) => {
    mockWaveState.onMount = onMount;
    return <div data-testid="wavesurfer">{children}</div>;
  }),
  WaveForm: () => <div data-testid="waveform" />,
}));

vi.mock('@mantine/core', async () => ({
  DEFAULT_THEME: (await vi.importActual<{ DEFAULT_THEME: typeof DEFAULT_THEME }>('@mantine/core')).DEFAULT_THEME,
  useMantineTheme: () => DEFAULT_THEME,
  useComputedColorScheme: () => mockColorScheme,
  Box: forwardRef<HTMLDivElement, { children?: ReactNode; style?: CSSProperties; 'data-testid'?: string }>(function Box({ children, ...props }, ref) { // eslint-disable-line prefer-arrow-callback
    return <div ref={ref} {...props}>{children}</div>;
  }),
  Text: ({ children, ...props }: { children?: ReactNode; [key: string]: unknown }) => <div {...props}>{children}</div>,
  Group: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  LoadingOverlay: ({ visible }: { visible: boolean }) => (
    visible ? <div data-testid="loading-overlay" /> : null
  ),
  Select: ({
    data, value, onChange, ...props
  }: {
    data: Array<{ value: string; label: string }>; value: string; onChange: (value: string) => void; [key: string]: unknown;
  }) => (
    <select {...props} value={value} onChange={(event) => onChange(event.target.value)}>
      {data.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
    </select>
  ),
  Stack: forwardRef<HTMLDivElement, { children?: ReactNode }>(function Stack({ children }, ref) { // eslint-disable-line prefer-arrow-callback
    return <div ref={ref}>{children}</div>;
  }),
}));

vi.mock('@mantine/hooks', () => ({
  useResizeObserver: () => [{ current: null }, { width: 500 }],
  useThrottledCallback: (fn: (...args: unknown[]) => unknown) => fn,
}));

vi.mock('react-router', () => ({
  useLocation: () => ({ search: mockRouterLocationSearch }),
  useNavigate: () => mockNavigate,
  useParams: () => ({ studyId: 'test-study' }),
  useSearchParams: () => {
    const params = mockSearchParams;
    const setParams = vi.fn((updater: (p: URLSearchParams) => void) => {
      if (typeof updater === 'function') updater(params);
    });
    return [params, setParams];
  },
}));

vi.mock('../../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({ storageEngine: mockAudioState.storageEngine }),
}));

vi.mock('../TaskProvenanceTimeline', () => ({
  TaskProvenanceTimeline: ({
    startTime, width, height, xScale, activityEvents = [],
  }: {
    startTime: number;
    width: number;
    height: number;
    xScale: d3.ScaleLinear<number, number>;
    activityEvents?: Array<{ event: [number, string, string | number[]]; label: string }>;
  }) => {
    mockProvenanceStartTime(startTime);
    return (
      <>
        <div data-testid="provenance-timeline" />
        {activityEvents.length > 0 && (
          <svg data-testid="task-activity-playback-timeline" width={width} height={height}>
            {activityEvents.map(({ event, label }, index) => (
              <circle key={`${event[0]}-${index}`} cx={xScale.copy().range([0, width])((event[0] - startTime) / 1000)} data-testid="task-activity-playback-marker">
                <title>{label}</title>
              </circle>
            ))}
          </svg>
        )}
      </>
    );
  },
}));

vi.mock('../../../store/hooks/useIsAnalysis', () => ({
  useIsAnalysis: () => mockAudioState.isAnalysis,
}));

vi.mock('../Timer', () => ({
  Timer: () => <div data-testid="timer" />,
}));

vi.mock('../../../utils/humanReadableDuration', () => ({
  youtubeReadableDuration: (ms: number) => String(ms),
}));

vi.mock('../../../store/hooks/useEvent', () => ({
  useEvent: (fn: (...args: unknown[]) => unknown) => fn,
}));

vi.mock('../../../utils/encryptDecryptIndex', () => ({
  encryptIndex: (i: number) => String(i),
}));

vi.mock('../../../utils/parseTrialOrder', () => ({
  parseTrialOrder: vi.fn((trialOrder: string) => {
    const [step, funcIndex] = trialOrder.split('_');
    return { step: Number(step), funcIndex: funcIndex === undefined ? null : Number(funcIndex) };
  }),
}));

const mockImportObject = vi.fn();
const mockGetState = vi.fn(() => ({ state: 'mocked' }));

vi.mock('../useUpdateProvenance', () => ({
  useUpdateProvenance: vi.fn(),
}));

const mockReplayContext = {
  audioRef: { current: null },
  updateReplayRef: vi.fn(),
  duration: 0,
  setDuration: vi.fn(),
  seekTime: 0,
  setSeekTime: vi.fn(),
  forceEmitTimeUpdate: vi.fn(),
  replayEvent: { on: vi.fn(), off: vi.fn() },
};

vi.mock('../../../store/hooks/useReplay', () => ({
  useReplayContext: () => mockReplayContext,
}));

vi.mock('../../../utils/syncReplay', () => ({
  syncChannel: { postMessage: vi.fn() },
  syncEmitter: { on: vi.fn(), off: vi.fn() },
}));

vi.mock('@trrack/core', () => {
  const Registry = { create: vi.fn(() => ({})) };
  const initializeTrrack = vi.fn(() => ({
    importObject: mockImportObject,
    getState: mockGetState,
    to: vi.fn(),
  }));
  const isRootNode = vi.fn((node: { parent?: string }) => !node.parent);
  return { Registry, initializeTrrack, isRootNode };
});

// ── real component references for sub-component tests ────────────────────────

let RealTaskProvenanceTimeline: typeof import('../TaskProvenanceTimeline').TaskProvenanceTimeline;
let RealTimer: typeof import('../Timer').Timer;
let RealUseUpdateProvenance: typeof import('../useUpdateProvenance').useUpdateProvenance;

beforeAll(async () => {
  RealTaskProvenanceTimeline = ((await vi.importActual('../TaskProvenanceTimeline')) as { TaskProvenanceTimeline: typeof import('../TaskProvenanceTimeline').TaskProvenanceTimeline }).TaskProvenanceTimeline;
  RealTimer = ((await vi.importActual('../Timer')) as { Timer: typeof import('../Timer').Timer }).Timer;
  RealUseUpdateProvenance = ((await vi.importActual('../useUpdateProvenance')) as { useUpdateProvenance: typeof RealUseUpdateProvenance }).useUpdateProvenance;
});

// ── shared fixtures ──────────────────────────────────────────────────────────

function makeNode(
  id: string,
  parent?: string,
  createdOn = 0,
  children: string[] = [],
  overrides: Partial<TrrackedProvenance['nodes'][string]> = {},
) {
  return {
    id,
    parent,
    createdOn,
    children,
    label: id,
    artifacts: [],
    meta: { annotation: [], bookmark: [] },
    state: { type: 'checkpoint', val: {} },
    level: 0,
    event: parent ? 'action' : 'Root',
    sideEffects: { do: [] as { type: string }[], undo: [] },
    ...overrides,
  } as TrrackedProvenance['nodes'][string];
}

const rootNode = makeNode('root');

beforeEach(() => {
  vi.clearAllMocks();
  mockColorScheme = 'light';
  mockSearchParams = new URLSearchParams('participantId=p1');
  mockAudioState.isAnalysis = false;
  mockAudioState.storageEngine = null;
  mockWaveState.onMount = undefined;
  mockRouterLocationSearch = '';
  mockReplayContext.seekTime = 0;
});
afterEach(() => { cleanup(); });

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SSR tests — TaskProvenanceTimeline (real component via vi.importActual)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('TaskProvenanceTimeline', () => {
  const xScale = d3.scaleLinear().domain([0, 10]).range([0, 500]);
  const margin = {
    left: 10, right: 10, top: 5, bottom: 5,
  };

  test('renders an SVG element', () => {
    const provenanceGraph = {
      aboveStimulus: undefined,
      belowStimulus: undefined,
      sidebar: undefined,
      stimulus: undefined,
    };
    const html = renderToStaticMarkup(
      <RealTaskProvenanceTimeline xScale={xScale} provenanceGraph={provenanceGraph} width={500} height={50} currentNode={null} trialName="trial_0" startTime={0} margin={margin} />,
    );
    expect(html).toContain('<svg');
  });

  test('renders a baseline horizontal line', () => {
    const provenanceGraph = {
      aboveStimulus: undefined,
      belowStimulus: undefined,
      sidebar: undefined,
      stimulus: undefined,
    };
    const html = renderToStaticMarkup(
      <RealTaskProvenanceTimeline xScale={xScale} provenanceGraph={provenanceGraph} width={500} height={50} currentNode={null} trialName="trial_0" startTime={0} margin={margin} />,
    );
    expect(html).toContain('<line');
    expect(html).toContain('data-testid="task-provenance-baseline"');
    expect(html).toContain('stroke="var(--mantine-color-dimmed)"');
  });

  test('skips null provenanceGraph entries gracefully', () => {
    const provenanceGraph = {
      aboveStimulus: undefined,
      belowStimulus: undefined,
      sidebar: undefined,
      stimulus: undefined,
    };
    const html = renderToStaticMarkup(
      <RealTaskProvenanceTimeline xScale={xScale} provenanceGraph={provenanceGraph} width={500} height={50} currentNode={null} trialName="trial_0" startTime={0} margin={margin} />,
    );
    expect(html).toContain('<svg');
  });

  test('applies left margin as marginLeft style', () => {
    const provenanceGraph = {
      aboveStimulus: undefined,
      belowStimulus: undefined,
      sidebar: undefined,
      stimulus: undefined,
    };
    const html = renderToStaticMarkup(
      <RealTaskProvenanceTimeline
        xScale={xScale}
        provenanceGraph={provenanceGraph}
        width={400}
        height={40}
        currentNode={null}
        trialName=""
        startTime={0}
        margin={{
          left: 20, right: 10, top: 5, bottom: 5,
        }}
      />,
    );
    expect(html).toContain('margin-left:20px');
  });

  test('shows compact marker tooltips on the existing centered timeline', () => {
    const html = renderToStaticMarkup(
      <RealTaskProvenanceTimeline
        xScale={d3.scaleLinear().domain([0, 2]).range([20, 180])}
        provenanceGraph={null}
        activityEvents={[
          { event: [1500, 'studyactivity', 'pointer-left'], label: 'Pointer left study page' },
          { event: [2000, 'displaystatus', 'multiple'], label: 'Display status: multiple' },
        ]}
        width={160}
        height={25}
        currentNode={null}
        trialName="trial_0"
        startTime={1000}
        margin={{
          left: 20, right: 20, top: 0, bottom: 0,
        }}
      />,
    );
    expect(html).toContain('data-testid="task-activity-playback-timeline"');
    expect(html).toContain('cx="40"');
    expect(html).toContain('aria-label="Pointer left · 00:01"');
    expect(html).toContain('<title>Pointer left · 00:01</title>');
    expect(html).toContain('<title>Multiple displays · 00:01</title>');
    expect(html).toContain('width:160px;height:25px;margin-left:20px');
  });

  test('shows an explicit event tooltip when hovering a marker', () => {
    const view = render(
      <RealTaskProvenanceTimeline
        xScale={d3.scaleLinear().domain([0, 2]).range([20, 180])}
        provenanceGraph={null}
        activityEvents={[{ event: [1500, 'studyactivity', 'pointer-left'], label: 'Pointer left study page' }]}
        width={160}
        height={25}
        currentNode={null}
        trialName="trial_0"
        startTime={1000}
        margin={{
          left: 20, right: 20, top: 0, bottom: 0,
        }}
      />,
    );

    fireEvent.mouseEnter(view.getByTestId('task-activity-playback-marker'));
    expect(view.getByRole('tooltip').textContent).toBe('Pointer left · 00:01');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DOM tests — Timer (real component via vi.importActual)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('Timer', () => {
  const xScale = d3.scaleLinear().domain([0, 100]).range([0, 500]);

  test('renders an SVG element', async () => {
    const { container } = await act(async () => render(
      <RealTimer width={500} height={60} debounceUpdateTimer={vi.fn()} xScale={xScale} />,
    ));
    expect(container.querySelector('svg')).not.toBeNull();
  });

  test('calls forceEmitTimeUpdate on mount', async () => {
    await act(async () => render(
      <RealTimer width={500} height={60} debounceUpdateTimer={vi.fn()} xScale={xScale} />,
    ));
    expect(mockReplayContext.forceEmitTimeUpdate).toHaveBeenCalled();
  });

  test('registers timeupdate listener on replayEvent', async () => {
    await act(async () => render(
      <RealTimer width={500} height={60} debounceUpdateTimer={vi.fn()} xScale={xScale} />,
    ));
    expect(mockReplayContext.replayEvent.on).toHaveBeenCalledWith('timeupdate', expect.any(Function));
  });

  test('unregisters listener on unmount', async () => {
    const { unmount } = await act(async () => render(
      <RealTimer width={500} height={60} debounceUpdateTimer={vi.fn()} xScale={xScale} />,
    ));
    await act(async () => { unmount(); });
    expect(mockReplayContext.replayEvent.off).toHaveBeenCalledWith('timeupdate', expect.any(Function));
  });

  test('timeupdate callback calls debounceUpdateTimer', async () => {
    const mockDebounce = vi.fn();
    const { container } = await act(async () => render(
      <RealTimer width={500} height={60} debounceUpdateTimer={mockDebounce} xScale={xScale} />,
    ));
    const entry = mockReplayContext.replayEvent.on.mock.calls.find((call: string[]) => call[0] === 'timeupdate');
    const callback = entry?.[1] as ((t: number) => void) | undefined;
    if (callback) act(() => { callback(2); });
    expect(mockDebounce).toHaveBeenCalledWith(2000, undefined);
    expect(container.querySelector('[data-testid="replay-timer"]')?.getAttribute('data-replay-time')).toBe('2');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Hook tests — useUpdateProvenance (real hook via vi.importActual)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('useUpdateProvenance', () => {
  const setCurrentNode = vi.fn();
  const saveProvenance = vi.fn();

  beforeEach(() => {
    setCurrentNode.mockReset();
    saveProvenance.mockReset();
    mockGetState.mockReturnValue({ state: 'mocked' });
  });

  function makeGraphForHook(nodes: Record<string, TrrackedProvenance['nodes'][string]>, root: string) {
    return { nodes, root, current: root } as TrrackedProvenance;
  }

  test('does nothing when saveProvenance is not provided', () => {
    renderHook(() => RealUseUpdateProvenance('sidebar', 0, makeGraphForHook({ root: rootNode }, 'root'), 'root', setCurrentNode, undefined));
    expect(setCurrentNode).not.toHaveBeenCalled();
  });

  test('clears node when provGraph is undefined and currentNode was set', () => {
    renderHook(() => RealUseUpdateProvenance('sidebar', 0, undefined, 'root', setCurrentNode, saveProvenance));
    expect(setCurrentNode).toHaveBeenCalledWith(null, 'sidebar');
  });

  test('sets root node when currentNode is not set and graph exists', () => {
    renderHook(() => RealUseUpdateProvenance('sidebar', 0, makeGraphForHook({ root: rootNode }, 'root'), undefined, setCurrentNode, saveProvenance));
    expect(setCurrentNode).toHaveBeenCalledWith('root', 'sidebar');
  });

  test('advances to child node when playTime passes child createdOn', () => {
    const child = makeNode('n1', 'root', 2000);
    const graph = makeGraphForHook({ root: { ...rootNode, children: ['n1'] }, n1: child }, 'root');
    renderHook(() => RealUseUpdateProvenance('sidebar', 3000, graph, 'root', setCurrentNode, saveProvenance));
    expect(setCurrentNode).toHaveBeenCalledWith('n1', 'sidebar');
  });

  test('retreats to parent when playTime is before current node createdOn', () => {
    const child = makeNode('n1', 'root', 5000);
    const graph = makeGraphForHook({ root: { ...rootNode, children: ['n1'] }, n1: child }, 'root');
    renderHook(() => RealUseUpdateProvenance('sidebar', 1000, graph, 'n1', setCurrentNode, saveProvenance));
    expect(setCurrentNode).toHaveBeenCalledWith('root', 'sidebar');
  });

  test('reacts to prop changes via re-render', async () => {
    const child = makeNode('n1', 'root', 2000);
    const graph = makeGraphForHook({ root: { ...rootNode, children: ['n1'] }, n1: child }, 'root');
    const { rerender } = renderHook(
      ({ playTime }: { playTime: number }) => RealUseUpdateProvenance('sidebar', playTime, graph, 'root', setCurrentNode, saveProvenance),
      { initialProps: { playTime: 0 } },
    );
    await act(async () => { rerender({ playTime: 3000 }); });
    expect(setCurrentNode).toHaveBeenCalledWith('n1', 'sidebar');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DOM tests — AudioProvenanceVis
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
  trial_0: makeStoredAnswer({
    startTime: 1000,
    endTime: 6000,
  }),
};

const stimulusGraph: TrrackedProvenance = {
  current: 'root-id',
  root: 'root-id',
  nodes: { 'root-id': makeNode('root-id', undefined, 500) },
} as TrrackedProvenance;

const answersWithStimulus: Record<string, StoredAnswer & { provenanceGraph: StoredProvenance }> = {
  trial_0: {
    ...makeStoredAnswer({
      startTime: 1000,
      endTime: 6000,
    }),
    provenanceGraph: {
      aboveStimulus: undefined,
      belowStimulus: undefined,
      sidebar: undefined,
      stimulus: stimulusGraph,
    },
  },
};

describe('AudioProvenanceVis', () => {
  test('recolors the mounted waveform when the theme changes without reloading audio', async () => {
    const { rerender } = render(<AudioProvenanceVis {...defaultProps} answers={answersWithTask} />);
    const waveform = { setOptions: vi.fn(), load: vi.fn(), destroy: vi.fn() };
    const { onMount } = vi.mocked(WaveSurfer).mock.calls.at(-1)![0];
    await act(async () => { onMount?.(waveform as unknown as WaveSurferType); });

    mockColorScheme = 'dark';
    rerender(<AudioProvenanceVis {...defaultProps} answers={answersWithTask} />);
    expect(waveform.setOptions).toHaveBeenLastCalledWith({ waveColor: DEFAULT_THEME.colors.dark[2], progressColor: DEFAULT_THEME.colors.blue[4] });

    mockColorScheme = 'light';
    rerender(<AudioProvenanceVis {...defaultProps} answers={answersWithTask} />);
    expect(waveform.setOptions).toHaveBeenLastCalledWith({ waveColor: DEFAULT_THEME.colors.gray[7], progressColor: DEFAULT_THEME.colors.blue[7] });
    expect(waveform.load).not.toHaveBeenCalled();
    expect(waveform.destroy).not.toHaveBeenCalled();
  });

  test('does not load a stale task that is absent from the participant answers', async () => {
    const { queryByTestId } = await act(async () => render(
      <AudioProvenanceVis {...defaultProps} />,
    ));
    expect(queryByTestId('loading-overlay')).toBeNull();
    expect(queryByTestId('wavesurfer')).toBeNull();
  });

  test('shows the loading overlay and renders wavesurfer for a stored task', async () => {
    const { getByTestId } = await act(async () => render(
      <AudioProvenanceVis {...defaultProps} answers={answersWithTask} />,
    ));
    const loadingOverlay = getByTestId('loading-overlay');
    expect(loadingOverlay.parentElement?.getAttribute('data-testid')).toBe('recording-area');
    expect(getByTestId('wavesurfer')).toBeDefined();
  });

  test('keeps the recording area height when loading fails', async () => {
    mockAudioState.isAnalysis = true;
    mockAudioState.storageEngine = {
      getAudio: vi.fn(async () => null),
      getScreenRecording: vi.fn(async () => { throw new Error('missing recording'); }),
      getProvenance: vi.fn(async () => null),
    };
    const failedRecordingAnswer = makeStoredAnswer({
      assetIdentifier: 'screen-segment',
      recordingChunkKeys: { 'screen-segment': ['chunk-0'] },
    });
    const view = await act(async () => render(
      <AudioProvenanceVis {...defaultProps} answers={{ trial_0: failedRecordingAnswer }} />,
    ));
    await act(async () => {
      await mockWaveState.onMount?.({ empty: vi.fn() });
    });

    expect(view.getByRole('alert').textContent).toContain('could not be loaded');
    expect(view.getByTestId('recording-area').style.height).toBe('50px');
  });

  test('renders in provenanceVis context', async () => {
    const { getByTestId } = await act(async () => render(
      <AudioProvenanceVis {...defaultProps} context="provenanceVis" answers={answersWithTask} />,
    ));
    expect(getByTestId('wavesurfer')).toBeDefined();
  });

  test('renders provenance-timeline when startTime > 0', async () => {
    const { getByTestId } = await act(async () => render(
      <AudioProvenanceVis {...defaultProps} answers={answersWithStimulus} />,
    ));
    expect(getByTestId('provenance-timeline')).toBeDefined();
  });

  test('shows recorded activity markers and accessible event times without a provenance graph', async () => {
    const { getByTestId, getAllByTestId, getByRole } = await act(async () => render(
      <AudioProvenanceVis
        {...defaultProps}
        answers={{
          trial_0: makeStoredAnswer({
            startTime: 1000,
            endTime: -1,
            recordingEndTime: 6000,
            windowEvents: [
              [2000, 'studyactivity', 'pointer-left'],
              [4000, 'displaystatus', 'multiple'],
            ],
          }),
        }}
      />,
    ));
    expect(getByTestId('task-activity-playback-timeline')).toBeDefined();
    expect(getByTestId('task-activity-playback-timeline').getAttribute('height')).toBe('25');
    expect(getAllByTestId('task-activity-playback-marker')).toHaveLength(2);
    const activityList = getByRole('list', { name: 'Task activity events' });
    expect(activityList.textContent).toContain('1000: Pointer left study page');
    expect(activityList.textContent).toContain('3000: Display status: multiple');
    const markerPositions = getAllByTestId('task-activity-playback-marker').map((marker) => marker.getAttribute('cx'));
    expect(markerPositions[0]).not.toBe(markerPositions[1]);
  });

  test('carries the latest display status into the selected segment timeline', async () => {
    const { getAllByTestId, getByRole } = await act(async () => render(
      <AudioProvenanceVis
        {...defaultProps}
        answers={{
          trial_0: makeStoredAnswer({
            assetIdentifier: 'segment-a',
            recordingSegments: ['segment-a'],
            recordingSegmentRanges: [{ assetIdentifier: 'segment-a', startTime: 5000, endTime: 7000 }],
            windowEvents: [
              [4500, 'displaystatus', 'multiple'],
              [6000, 'displaystatus', 'single'],
            ],
          }),
        }}
      />,
    ));
    const activityList = getByRole('list', { name: 'Task activity events' });
    expect(activityList.textContent).toContain('0: Display status: multiple');
    expect(activityList.textContent).toContain('1000: Display status: single');
    expect(getAllByTestId('task-activity-playback-marker')).toHaveLength(2);
  });

  test('aligns activity markers to the recording area when WaveSurfer reports a narrower width', async () => {
    mockAudioState.isAnalysis = true;
    mockAudioState.storageEngine = {
      getAudio: vi.fn(async () => null),
      getScreenRecording: vi.fn(async () => 'screen-recording-url'),
      getProvenance: vi.fn(async () => null),
    };
    const answer = makeStoredAnswer({
      assetIdentifier: 'segment-a',
      startTime: 1000,
      endTime: 2000,
      recordingEndTime: 2000,
      recordingSegmentRanges: [{ assetIdentifier: 'segment-a', startTime: 1000, endTime: 2000 }],
      windowEvents: [[2000, 'displaystatus', 'multiple']],
    });
    const view = await act(async () => render(
      <AudioProvenanceVis {...defaultProps} answers={{ trial_0: answer }} />,
    ));
    const waveSurfer = {
      load: vi.fn(async () => {}),
      getMediaElement: () => document.createElement('audio'),
      getWidth: () => 420,
      seekTo: vi.fn(),
      on: vi.fn(),
      empty: vi.fn(),
      setOptions: vi.fn(),
    };
    await act(async () => { await mockWaveState.onMount?.(waveSurfer); });

    const timeline = view.getByTestId('task-activity-playback-timeline');
    const marker = view.getByTestId('task-activity-playback-marker');
    expect(timeline.getAttribute('width')).toBe('500');
    expect(Number(marker.getAttribute('cx'))).toBeLessThanOrEqual(Number(timeline.getAttribute('width')));
    expect(marker.getAttribute('cx')).toBe('500');
  });

  test('offers prior recording segments for replay', async () => {
    const { getByRole } = await act(async () => render(
      <AudioProvenanceVis
        {...defaultProps}
        answers={{
          trial_0: makeStoredAnswer({
            assetIdentifier: 'segment-2',
            recordingSegments: ['segment-1', 'segment-2'],
            recordingSegmentRanges: [
              { assetIdentifier: 'segment-1', startTime: 1000, endTime: 4000 },
              { assetIdentifier: 'segment-2', startTime: 5000, endTime: 8000 },
            ],
            startTime: 1000,
            endTime: 8000,
          }),
        }}
      />,
    ));
    expect(getByRole('combobox', { name: 'Recording segment' })).toBeDefined();
  });

  test('loads audio from the selected earlier segment', async () => {
    mockAudioState.isAnalysis = true;
    mockSearchParams = new URLSearchParams('participantId=p1');
    const getAudio = vi.fn(async (identifier: string) => `audio-${identifier}`);
    mockAudioState.storageEngine = {
      getAudio,
      getScreenRecording: vi.fn(async () => null),
      getProvenance: vi.fn(async () => null),
    };
    const waveSurfer = {
      load: vi.fn(async () => {}),
      getMediaElement: () => document.createElement('audio'),
      getWidth: () => 500,
      seekTo: vi.fn(),
      on: vi.fn(),
      empty: vi.fn(),
      setOptions: vi.fn(),
    };
    const view = await act(async () => render(
      <AudioProvenanceVis
        {...defaultProps}
        answers={{
          trial_0: makeStoredAnswer({
            assetIdentifier: 'audio-latest',
            recordingSegments: ['audio-earlier', 'audio-latest'],
            recordingSegmentTimes: {
              'audio-earlier': { startTime: 1000, endTime: 3000 },
              'audio-latest': { startTime: 4000, endTime: 6000 },
            },
          }),
        }}
      />,
    ));
    await act(async () => { mockWaveState.onMount?.(waveSurfer); });
    fireEvent.change(view.getByRole('combobox', { name: 'Recording segment' }), { target: { value: 'audio-earlier' } });

    await waitFor(() => expect(waveSurfer.load).toHaveBeenLastCalledWith('audio-audio-earlier', undefined, expect.any(Number)));
    expect(getAudio).toHaveBeenCalledWith('audio-earlier', 'p1');
    await waitFor(() => expect(mockReplayContext.setDuration).toHaveBeenLastCalledWith(2));
  });

  test('renders a screen-only waveform without waiting for the screen video', async () => {
    mockAudioState.isAnalysis = true;
    mockSearchParams = new URLSearchParams('participantId=p1&recordingSegment=segment-a');
    const getScreenRecording = vi.fn(async () => 'video-segment-a');
    mockAudioState.storageEngine = {
      getAudio: vi.fn(async () => null),
      getScreenRecording,
      getProvenance: vi.fn(async () => null),
    };
    let finishLoad!: () => void;
    const waveSurfer = {
      load: vi.fn(() => new Promise<void>((resolve) => { finishLoad = resolve; })),
      getMediaElement: () => document.createElement('audio'),
      getWidth: () => 500,
      seekTo: vi.fn(),
      on: vi.fn(),
      empty: vi.fn(),
      setOptions: vi.fn(),
    };
    const props = {
      ...defaultProps,
      answers: {
        trial_0: makeStoredAnswer({
          assetIdentifier: 'segment-b',
          recordingSegments: ['segment-a', 'segment-b'],
          recordingSegmentRanges: [
            { assetIdentifier: 'segment-a', startTime: 1000, endTime: 3000 },
            { assetIdentifier: 'segment-b', startTime: 4000, endTime: 6000 },
          ],
        }),
      },
    };
    const view = await act(async () => render(<AudioProvenanceVis {...props} />));

    act(() => { mockWaveState.onMount?.(waveSurfer); });
    await waitFor(() => expect(waveSurfer.load).toHaveBeenCalledExactlyOnceWith('', [[0]], 2));
    expect(view.getByTestId('loading-overlay')).toBeDefined();
    mockReplayContext.duration = 2;
    await act(async () => { view.rerender(<AudioProvenanceVis {...props} />); });

    expect(getScreenRecording).not.toHaveBeenCalled();
    expect(waveSurfer.load).toHaveBeenCalledOnce();
    expect(view.getByTestId('loading-overlay')).toBeDefined();
    await act(async () => { finishLoad(); });
    await waitFor(() => expect(view.queryByTestId('loading-overlay')).toBeNull());
    mockReplayContext.duration = 0;
  });

  test('preserves the replay position while the initial waveform load is pending', async () => {
    mockAudioState.isAnalysis = true;
    mockSearchParams = new URLSearchParams('participantId=p1&t=7');
    mockReplayContext.seekTime = 7;
    mockReplayContext.setSeekTime.mockClear();
    mockAudioState.storageEngine = {
      getAudio: vi.fn(async () => 'audio-initial'),
      getScreenRecording: vi.fn(async () => null),
      getProvenance: vi.fn(async () => null),
    };
    let finishWaveformLoad!: () => void;
    const waveSurfer = {
      load: vi.fn(() => new Promise<void>((resolve) => { finishWaveformLoad = resolve; })),
      getMediaElement: () => document.createElement('audio'),
      getWidth: () => 500,
      seekTo: vi.fn(),
      on: vi.fn(),
      empty: vi.fn(),
      setOptions: vi.fn(),
    };
    const view = await act(async () => render(<AudioProvenanceVis {...defaultProps} answers={answersWithTask} />));
    act(() => { mockWaveState.onMount?.(waveSurfer); });
    await waitFor(() => expect(waveSurfer.load).toHaveBeenCalledWith('audio-initial', undefined, expect.any(Number)));

    mockReplayContext.seekTime = 12;
    mockReplayContext.setSeekTime(12);
    await act(async () => { finishWaveformLoad(); });

    expect(mockReplayContext.setSeekTime).toHaveBeenLastCalledWith(12);
    expect(mockReplayContext.setSeekTime).not.toHaveBeenCalledWith(0);
    expect(view.queryByTestId('loading-overlay')).toBeNull();
  });

  test('keeps standalone audio playable when screen reconstruction fails on mount and segment change', async () => {
    mockAudioState.isAnalysis = true;
    mockSearchParams = new URLSearchParams('participantId=p1&recordingSegment=segment-a');
    mockAudioState.storageEngine = {
      getAudio: vi.fn(async (identifier: string) => `blob:audio-${identifier}`),
      getScreenRecording: vi.fn(async () => null),
      getProvenance: vi.fn(async () => null),
    };
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const waveSurfer = {
      load: vi.fn(async () => {}),
      getMediaElement: () => document.createElement('audio'),
      getWidth: () => 500,
      seekTo: vi.fn(),
      on: vi.fn(),
      empty: vi.fn(),
      setOptions: vi.fn(),
    };
    const answers = {
      trial_0: {
        ...answersWithTask.trial_0,
        assetIdentifier: 'segment-b',
        recordingSegments: ['segment-a', 'segment-b'],
        recordingSegmentRanges: [
          { assetIdentifier: 'segment-a', startTime: 1000, endTime: 3000 },
          { assetIdentifier: 'segment-b', startTime: 4000, endTime: 6000 },
        ],
        recordingChunkKeys: {
          'segment-a': ['segment-a__chunk_0'],
          'segment-b': ['segment-b__chunk_0'],
        },
      },
    };
    const view = await act(async () => render(<AudioProvenanceVis {...defaultProps} answers={answers} />));

    await act(async () => { mockWaveState.onMount?.(waveSurfer); });
    await waitFor(() => expect(waveSurfer.load).toHaveBeenCalledWith('blob:audio-segment-a', undefined, 2));
    expect(view.getByText('The screen recording segment could not be loaded. Playing available audio instead.')).toBeDefined();
    expect(view.queryByTestId('loading-overlay')).toBeNull();

    fireEvent.change(view.getByRole('combobox', { name: 'Recording segment' }), { target: { value: 'segment-b' } });
    expect(mockSearchParams.get('recordingSegment')).toBe('segment-b');
    await waitFor(() => expect(waveSurfer.load).toHaveBeenLastCalledWith('blob:audio-segment-b', undefined, expect.any(Number)));
    expect(view.queryByTestId('loading-overlay')).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:audio-segment-a');
    view.unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:audio-segment-b');
  });

  test('returns to the latest segment when cross-window sync clears the segment selection', async () => {
    mockAudioState.isAnalysis = true;
    mockSearchParams = new URLSearchParams('participantId=p1&recordingSegment=segment-a');
    const answers = {
      trial_0: {
        ...answersWithTask.trial_0,
        assetIdentifier: 'segment-b',
        recordingSegments: ['segment-a', 'segment-b'],
      },
    };
    const view = await act(async () => render(<AudioProvenanceVis {...defaultProps} answers={answers} />));
    const segmentSelect = view.getByRole('combobox', { name: 'Recording segment' }) as HTMLSelectElement;
    expect(segmentSelect.value).toBe('segment-a');

    mockSearchParams = new URLSearchParams('participantId=p1');
    await act(async () => view.rerender(<AudioProvenanceVis {...defaultProps} answers={answers} />));

    expect(segmentSelect.value).toBe('segment-b');
  });

  test('uses retained recording timing for an incomplete task duration', async () => {
    mockAudioState.isAnalysis = true;
    mockAudioState.storageEngine = {
      getAudio: vi.fn(async () => 'archived-audio'),
      getScreenRecording: vi.fn(async () => null),
      getProvenance: vi.fn(async () => null),
    };
    await act(async () => render(
      <AudioProvenanceVis
        {...defaultProps}
        answers={{
          trial_0: makeStoredAnswer({
            startTime: 0,
            endTime: -1,
            recordingStartTime: 1000,
            recordingEndTime: 6000,
          }),
        }}
      />,
    ));

    await waitFor(() => expect(mockReplayContext.setDuration).toHaveBeenCalledWith(5));
  });

  test('uses the selected recording segment start for provenance markers', async () => {
    mockSearchParams = new URLSearchParams('participantId=p1&recordingSegment=segment-2');
    const { getAllByTestId, getByRole } = await act(async () => render(
      <AudioProvenanceVis
        {...defaultProps}
        answers={{
          trial_0: {
            ...answersWithStimulus.trial_0,
            ...makeStoredAnswer({
              assetIdentifier: 'segment-2',
              recordingSegments: ['segment-1', 'segment-2'],
              recordingSegmentRanges: [
                { assetIdentifier: 'segment-1', startTime: 1000, endTime: 4000 },
                { assetIdentifier: 'segment-2', startTime: 5000, endTime: 8000 },
              ],
              startTime: 1000,
              endTime: 8000,
              windowEvents: [
                [2000, 'studyactivity', 'pointer-left'],
                [6000, 'displaystatus', 'multiple'],
              ],
            }),
          },
        }}
      />,
    ));
    expect(mockProvenanceStartTime).toHaveBeenCalledWith(5000);
    expect(getAllByTestId('task-activity-playback-marker')).toHaveLength(1);
    const activityList = getByRole('list', { name: 'Task activity events' });
    expect(activityList.textContent).toContain('Display status: multiple');
    expect(activityList.textContent).not.toContain('Pointer left study page');
  });

  test('restores the requested source when selection returns to a segment with a deferred load in flight', async () => {
    mockAudioState.isAnalysis = true;
    mockSearchParams = new URLSearchParams('participantId=p1&recordingSegment=segment-a');
    mockAudioState.storageEngine = {
      getAudio: vi.fn(async (identifier: string) => `audio-${identifier}`),
      getScreenRecording: vi.fn(async (identifier: string) => `url-${identifier}`),
      getProvenance: vi.fn(async () => null),
    };
    let resolveSegmentB!: () => void;
    let currentSource = '';
    const waveSurfer = {
      load: vi.fn((url: string) => {
        currentSource = url;
        return url === 'url-segment-b' ? new Promise<void>((resolve) => { resolveSegmentB = resolve; }) : Promise.resolve();
      }),
      getMediaElement: () => document.createElement('audio'),
      getWidth: () => 500,
      seekTo: vi.fn(),
      on: vi.fn(),
      empty: vi.fn(),
      setOptions: vi.fn(),
    };
    const answers = {
      trial_0: {
        ...answersWithTask.trial_0,
        assetIdentifier: 'segment-c',
        recordingSegments: ['segment-a', 'segment-b', 'segment-c'],
        recordingSegmentRanges: [
          { assetIdentifier: 'segment-a', startTime: 1000, endTime: 3000 },
          { assetIdentifier: 'segment-b', startTime: 4000, endTime: 6000 },
          { assetIdentifier: 'segment-c', startTime: 7000, endTime: 9000 },
        ],
      },
    };
    const view = await act(async () => render(<AudioProvenanceVis {...defaultProps} answers={answers} />));
    await act(async () => { mockWaveState.onMount?.(waveSurfer); });
    await waitFor(() => expect(waveSurfer.load).toHaveBeenCalledWith('url-segment-a', undefined, 2));
    mockReplayContext.setSeekTime.mockClear();

    fireEvent.change(view.getByRole('combobox', { name: 'Recording segment' }), { target: { value: 'segment-b' } });
    await waitFor(() => expect(resolveSegmentB).toBeTypeOf('function'));
    expect(currentSource).toBe('url-segment-b');

    fireEvent.change(view.getByRole('combobox', { name: 'Recording segment' }), { target: { value: 'segment-a' } });
    await waitFor(() => expect(waveSurfer.load).toHaveBeenLastCalledWith('url-segment-a', undefined, 2));
    await waitFor(() => expect(currentSource).toBe('url-segment-a'));
    expect(mockReplayContext.setSeekTime).toHaveBeenCalledWith(0);
    await act(async () => { resolveSegmentB(); });
    expect(waveSurfer.load).toHaveBeenLastCalledWith('url-segment-a', undefined, 2);
    expect(view.queryByTestId('loading-overlay')).toBeNull();
  });

  test('stale initial load cannot revoke a newer segment URL', async () => {
    mockAudioState.isAnalysis = true;
    mockSearchParams = new URLSearchParams('participantId=p1&recordingSegment=segment-a');
    mockAudioState.storageEngine = {
      getAudio: vi.fn(async (identifier: string) => `blob:audio-${identifier}`),
      getScreenRecording: vi.fn(async (identifier: string) => `blob:screen-${identifier}`),
      getProvenance: vi.fn(async () => null),
    };
    let currentSource = '';
    const waveSurfer = {
      load: vi.fn((url: string) => {
        currentSource = url;
        return Promise.resolve();
      }),
      getMediaElement: () => document.createElement('audio'),
      getWidth: () => 500,
      seekTo: vi.fn(),
      on: vi.fn(),
      empty: vi.fn(),
      setOptions: vi.fn(),
    };
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const answers = {
      trial_0: {
        ...answersWithTask.trial_0,
        assetIdentifier: 'segment-b',
        recordingSegments: ['segment-a', 'segment-b'],
        recordingSegmentRanges: [
          { assetIdentifier: 'segment-a', startTime: 1000, endTime: 3000 },
          { assetIdentifier: 'segment-b', startTime: 4000, endTime: 6000 },
        ],
      },
    };
    const view = await act(async () => render(<AudioProvenanceVis {...defaultProps} answers={answers} />));
    act(() => { mockWaveState.onMount?.(waveSurfer); });
    await waitFor(() => expect(waveSurfer.load).toHaveBeenCalledWith('blob:screen-segment-a', undefined, 2));

    fireEvent.change(view.getByRole('combobox', { name: 'Recording segment' }), { target: { value: 'segment-b' } });
    await waitFor(() => expect(waveSurfer.load).toHaveBeenLastCalledWith('blob:screen-segment-b', undefined, expect.any(Number)));
    expect(currentSource).toBe('blob:screen-segment-b');

    expect(revokeObjectURL).not.toHaveBeenCalledWith('blob:screen-segment-b');
    expect(currentSource).toBe('blob:screen-segment-b');
    expect(view.queryByTestId('loading-overlay')).toBeNull();
    view.unmount();
  });

  test('revokes both blob media URLs when a segment load is canceled', async () => {
    mockAudioState.isAnalysis = true;
    mockSearchParams = new URLSearchParams('participantId=p1&recordingSegment=segment-a');
    let resolveScreenB!: (url: string) => void;
    mockAudioState.storageEngine = {
      getAudio: vi.fn(async (identifier: string) => (identifier === 'segment-b' ? 'blob:audio-b' : `audio-${identifier}`)),
      getScreenRecording: vi.fn((identifier: string) => (identifier === 'segment-b'
        ? new Promise<string>((resolve) => { resolveScreenB = resolve; })
        : Promise.resolve(`screen-${identifier}`))),
      getProvenance: vi.fn(async () => null),
    };
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const waveSurfer = {
      load: vi.fn(async () => {}),
      getMediaElement: () => document.createElement('audio'),
      getWidth: () => 500,
      seekTo: vi.fn(),
      on: vi.fn(),
      empty: vi.fn(),
      setOptions: vi.fn(),
    };
    const answers = {
      trial_0: {
        ...answersWithTask.trial_0,
        assetIdentifier: 'segment-c',
        recordingSegments: ['segment-a', 'segment-b', 'segment-c'],
        recordingSegmentRanges: [
          { assetIdentifier: 'segment-a', startTime: 1000, endTime: 3000 },
          { assetIdentifier: 'segment-b', startTime: 4000, endTime: 6000 },
          { assetIdentifier: 'segment-c', startTime: 7000, endTime: 9000 },
        ],
      },
    };
    const view = await act(async () => render(<AudioProvenanceVis {...defaultProps} answers={answers} />));
    await act(async () => { mockWaveState.onMount?.(waveSurfer); });
    await waitFor(() => expect(waveSurfer.load).toHaveBeenCalledWith('screen-segment-a', undefined, 2));

    fireEvent.change(view.getByRole('combobox', { name: 'Recording segment' }), { target: { value: 'segment-b' } });
    await waitFor(() => expect(resolveScreenB).toBeTypeOf('function'));
    fireEvent.change(view.getByRole('combobox', { name: 'Recording segment' }), { target: { value: 'segment-a' } });
    await act(async () => { resolveScreenB('blob:screen-b'); });

    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith('blob:audio-b'));
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:screen-b');
    view.unmount();
  });

  test('syncChannel.postMessage fires when answers have trialOrder', async () => {
    await act(async () => render(
      <AudioProvenanceVis {...defaultProps} answers={answersWithTask} />,
    ));
    expect(vi.mocked(syncChannel.postMessage)).toHaveBeenCalled();
    expect(vi.mocked(syncChannel.postMessage)).toHaveBeenCalledWith(expect.objectContaining({
      key: 'trialOrder',
      value: { trialOrder: '0', answerIdentifier: 'trial_0' },
    }));
  });

  test('_setCurrentNode in provenanceVis calls saveProvenance', async () => {
    const saveProv = vi.fn();
    await act(async () => render(
      <AudioProvenanceVis {...defaultProps} context="provenanceVis" answers={answersWithStimulus} saveProvenance={saveProv} />,
    ));
    expect(saveProv).toHaveBeenCalled();
  });
});

describe('AudioProvenanceVis — syncEmitter listeners', () => {
  test('a synchronized participant switch clears the previous participant history selection', async () => {
    mockSearchParams = new URLSearchParams('participantId=p1&globalStoreNode=old-node&revisitPageId=shared');
    await act(async () => render(<AudioProvenanceVis {...defaultProps} answers={answersWithTask} />));
    const listener = vi.mocked(syncEmitter.on).mock.calls.find(([event]) => event === 'participantId')?.[1];
    await act(async () => { listener?.('p2'); });
    expect(mockSearchParams.get('participantId')).toBe('p2');
    expect(mockSearchParams.has('globalStoreNode')).toBe(false);
    expect(mockSearchParams.get('revisitPageId')).toBe('shared');
    mockSearchParams = new URLSearchParams('participantId=p1');
  });

  test('participantId listener is registered', async () => {
    await act(async () => render(
      <AudioProvenanceVis {...defaultProps} answers={answersWithTask} />,
    ));
    expect(vi.mocked(syncEmitter.on).mock.calls.find(([event]) => event === 'participantId')).toBeDefined();
  });

  test('trialOrderListener with matching answer', async () => {
    await act(async () => render(
      <AudioProvenanceVis {...defaultProps} answers={answersWithTask} />,
    ));
    const entry = vi.mocked(syncEmitter.on).mock.calls.find(([event]) => event === 'trialOrder');
    const listener = entry?.[1] as ((v: string) => void) | undefined;
    expect(listener).toBeDefined();
    await act(async () => { listener?.('0'); });
  });

  test('trialOrderListener routes transcript sync to the exact colliding dynamic answer', async () => {
    mockRouterLocationSearch = '?participantId=p1&revisitPageId=shared&analysisAnswerId=old-answer';
    const syncedAnswers = {
      'old-answer': makeStoredAnswer({ identifier: 'old-answer', componentName: 'old', trialOrder: '2_0' }),
      'new-answer': makeStoredAnswer({ identifier: 'new-answer', componentName: 'new', trialOrder: '2_0' }),
    };
    await act(async () => render(<AudioProvenanceVis {...defaultProps} answers={syncedAnswers} />));
    const listener = vi.mocked(syncEmitter.on).mock.calls.find(([event]) => event === 'trialOrder')?.[1] as
      ((value: { trialOrder: string; answerIdentifier: string }) => void) | undefined;

    await act(async () => { listener?.({ trialOrder: '2_0', answerIdentifier: 'new-answer' }); });

    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: '/analysis/stats/test-study/tagging/new-answer',
      search: '?participantId=p1&revisitPageId=shared&analysisAnswerId=new-answer',
    });
  });

  test('trialOrderListener syncs exact selection into an Analyst replay route', async () => {
    mockAudioState.isAnalysis = true;
    mockRouterLocationSearch = '?participantId=p1&revisitPageId=shared&analysisAnswerId=old-answer';
    const syncedAnswers = {
      'old-answer': makeStoredAnswer({ identifier: 'old-answer', componentName: 'old', trialOrder: '2_0' }),
      'new-answer': makeStoredAnswer({ identifier: 'new-answer', componentName: 'new', trialOrder: '2_0' }),
    };
    await act(async () => render(<AudioProvenanceVis {...defaultProps} context="provenanceVis" answers={syncedAnswers} />));
    const listener = vi.mocked(syncEmitter.on).mock.calls.find(([event]) => event === 'trialOrder')?.[1] as
      ((value: { trialOrder: string; answerIdentifier: string }) => void) | undefined;

    await act(async () => { listener?.({ trialOrder: '2_0', answerIdentifier: 'new-answer' }); });

    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: '/test-study/2/0',
      search: '?participantId=p1&revisitPageId=shared&analysisAnswerId=new-answer',
    });
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
