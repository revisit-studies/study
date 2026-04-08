import { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  render, act, cleanup, renderHook,
} from '@testing-library/react';
import {
  afterEach, beforeAll, beforeEach, describe, expect, test, vi,
} from 'vitest';
import * as d3 from 'd3';
import { TrrackedProvenance } from '../../store/types';
import { AudioProvenanceVis } from './AudioProvenanceVis';
import { syncEmitter } from '../../utils/syncReplay';
import {
  FORM_UPDATE_COLOR, ROOT_COLOR, ROOT_KEY, UNKNOWN_COLOR, UNKNOWN_KEY,
  buildProvenanceLegendEntries, getColorForKey, getNodeColor, getNodeColorKey, getNodeDisplayLabel, normalizeActionName,
} from './provenanceColors';
import { getSeekTimeFromSvgPosition } from './timerPosition';
import { TaskProvenanceNodes } from './TaskProvenanceNodes';

// ── mocks ────────────────────────────────────────────────────────────────────

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
  useThrottledCallback: (fn: (...args: never[]) => void) => fn,
}));

vi.mock('react-router', () => ({
  useLocation: () => ({ search: '' }),
  useNavigate: () => vi.fn(),
  useParams: () => ({ studyId: 'test-study' }),
  useSearchParams: () => {
    const params = new URLSearchParams();
    const setParams = vi.fn((updater: (p: URLSearchParams) => void) => {
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
  useEvent: (fn: (...args: never[]) => void) => fn,
}));

vi.mock('../../utils/encryptDecryptIndex', () => ({
  encryptIndex: (i: number) => String(i),
}));

vi.mock('../../utils/parseTrialOrder', () => ({
  parseTrialOrder: vi.fn(() => ({ step: 0, funcIndex: null })),
}));

const mockImportObject = vi.fn();
const mockGetState = vi.fn(() => ({ state: 'mocked' }));

vi.mock('./useUpdateProvenance', () => ({
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

vi.mock('../../store/hooks/useReplay', () => ({
  useReplayContext: () => mockReplayContext,
}));

vi.mock('../../utils/syncReplay', () => ({
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

let RealTaskProvenanceTimeline: typeof import('./TaskProvenanceTimeline').TaskProvenanceTimeline;
let RealTimer: typeof import('./Timer').Timer;
type UpdateProvenanceFn = (location: string, playTime: number, provGraph: TrrackedProvenance | undefined, currentNode: string | undefined, setCurrentNode: (...args: never[]) => void, saveProvenance: ((...args: never[]) => void) | undefined) => void;
let RealUseUpdateProvenance: UpdateProvenanceFn;

beforeAll(async () => {
  RealTaskProvenanceTimeline = ((await vi.importActual('./TaskProvenanceTimeline')) as { TaskProvenanceTimeline: typeof import('./TaskProvenanceTimeline').TaskProvenanceTimeline }).TaskProvenanceTimeline;
  RealTimer = ((await vi.importActual('./Timer')) as { Timer: typeof import('./Timer').Timer }).Timer;
  RealUseUpdateProvenance = ((await vi.importActual('./useUpdateProvenance')) as { useUpdateProvenance: typeof RealUseUpdateProvenance }).useUpdateProvenance;
});

// ── shared fixtures ──────────────────────────────────────────────────────────

function createGraph(nodes: TrrackedProvenance['nodes'], root: string): TrrackedProvenance {
  return { current: root, root, nodes } as TrrackedProvenance;
}

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
    state: { type: 'checkpoint' as const, val: {} },
    level: 0,
    event: parent ? 'action' : 'Root',
    sideEffects: { do: [] as { type: string }[], undo: [] },
    ...overrides,
  } as TrrackedProvenance['nodes'][string];
}

const rootNode = makeNode('root');

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { cleanup(); });

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Pure function tests — provenanceColors
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const zoomSideEffects = { do: [{ type: 'Signal/SetZoom', payload: null }], undo: [] };

describe('provenanceColors', () => {
  test('normalizeActionName collapses punctuation and whitespace', () => {
    expect(normalizeActionName('Zoom In')).toBe('zoom in');
    expect(normalizeActionName(' zoom-in ')).toBe('zoom in');
    expect(normalizeActionName('ZOOM   IN')).toBe('zoom in');
  });

  test('getNodeColorKey uses registry action type first', () => {
    const node = makeNode('n1', 'root', 0, [], { sideEffects: zoomSideEffects, label: 'Different Label' });
    expect(getNodeColorKey(node)).toBe('signal setzoom');
  });

  test('getNodeColorKey falls back to event, then label, and handles root', () => {
    const eventNode = makeNode('n1', 'root', 0, [], { event: 'BrushMove', label: '' });
    expect(getNodeColorKey(eventNode)).toBe('brushmove');

    const labelNode = makeNode('n2', 'root', 0, [], { event: '', label: ' Zoom In ' });
    expect(getNodeColorKey(labelNode)).toBe('zoom in');

    expect(getNodeColorKey(rootNode)).toBe(ROOT_KEY);
  });

  test('getColorForKey is deterministic and root key always uses root color', () => {
    expect(getColorForKey('signal setzoom')).toBe(getColorForKey('signal setzoom'));
    expect(getColorForKey(ROOT_KEY)).toBe(ROOT_COLOR);
    expect(getColorForKey('update')).toBe(FORM_UPDATE_COLOR);
  });

  test('different keys generally map to different colors', () => {
    expect(getColorForKey('action 2')).not.toBe(getColorForKey('action 3'));
  });

  test('getNodeColorKey returns UNKNOWN_KEY when no event, no label, no actionType', () => {
    const node = makeNode('n1', 'root', 0, [], { event: '', label: '' });
    expect(getNodeColorKey(node)).toBe(UNKNOWN_KEY);
  });

  test('getColorForKey returns UNKNOWN_COLOR for empty key', () => {
    expect(getColorForKey('')).toBe(UNKNOWN_COLOR);
    expect(getColorForKey(UNKNOWN_KEY)).toBe(UNKNOWN_COLOR);
  });

  test('getNodeColor delegates to getColorForKey(getNodeColorKey(node))', () => {
    expect(getNodeColor(rootNode)).toBe(ROOT_COLOR);
  });

  test('getNodeDisplayLabel returns label, action type, event, or UNKNOWN_KEY', () => {
    expect(getNodeDisplayLabel(makeNode('n1', 'root', 0, [], { label: 'My Label' }))).toBe('My Label');
    expect(getNodeDisplayLabel(makeNode('n4', 'root', 0, [], { label: '', event: '' }))).toBe(UNKNOWN_KEY);
  });

  test('buildProvenanceLegendEntries handles null/undefined graph', () => {
    expect(buildProvenanceLegendEntries([undefined, null] as never).size).toBe(0);
  });

  test('buildProvenanceLegendEntries de-dupes by canonical key', () => {
    const a1 = makeNode('a1', 'root', 1, [], { sideEffects: zoomSideEffects });
    const b1 = makeNode('b1', 'root', 2, [], { sideEffects: zoomSideEffects });

    const graphA = createGraph({ root: { ...rootNode, children: ['a1'] }, a1 }, 'root');
    const graphB = createGraph({ root: { ...rootNode, children: ['b1'] }, b1 }, 'root');

    const entries = buildProvenanceLegendEntries([graphA, graphB]);
    expect(entries.size).toBe(2);
    expect(entries.get('signal setzoom')?.color).toBe(getColorForKey('signal setzoom'));
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Pure function tests — timerPosition
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('getSeekTimeFromSvgPosition', () => {
  test('uses svg-local x coordinate', () => {
    const xScale = d3.scaleLinear([20, 220]).domain([0, 100]).clamp(true);
    expect(getSeekTimeFromSvgPosition(160, 100, xScale)).toBeCloseTo(20, 6);
  });

  test('normalizes to playback-relative time', () => {
    const xScale = d3.scaleLinear([0, 200]).domain([10, 110]).clamp(true);
    expect(getSeekTimeFromSvgPosition(50, 0, xScale)).toBeCloseTo(25, 6);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SSR tests — TaskProvenanceNodes (real component, not mocked)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('TaskProvenanceNodes', () => {
  function getFills(markup: string): string[] {
    return [...markup.matchAll(/fill="([^"]+)"/g)].map((m) => m[1]);
  }

  test('uses deterministic color per canonical action key', () => {
    const action = makeNode('n1', 'root', 1, [], { sideEffects: zoomSideEffects, event: 'signal' });

    const g1 = createGraph({ root: { ...rootNode, children: ['n1'] }, n1: action }, 'root');
    const g2 = createGraph({ n1: action, root: { ...rootNode, children: ['n1'] } }, 'root');
    const xScale = d3.scaleLinear([0, 100]).domain([0, 5]);

    const first = renderToStaticMarkup(<svg><TaskProvenanceNodes height={25} xScale={xScale} currentNode={null} provenance={g1} /></svg>);
    const second = renderToStaticMarkup(<svg><TaskProvenanceNodes height={25} xScale={xScale} currentNode={null} provenance={g2} /></svg>);

    expect(getFills(first).sort()).toEqual(getFills(second).sort());
    expect(getFills(first)).toContain(getColorForKey('signal setzoom'));
  });

  test('active-node overlay uses the same color as its base node', () => {
    const action = makeNode('n1', 'root', 1, [], { sideEffects: zoomSideEffects, event: 'signal' });

    const graph = createGraph({ root: { ...rootNode, children: ['n1'] }, n1: action }, 'root');
    const xScale = d3.scaleLinear([0, 100]).domain([0, 5]);
    const markup = renderToStaticMarkup(<svg><TaskProvenanceNodes height={25} xScale={xScale} currentNode="n1" provenance={graph} /></svg>);

    expect(getFills(markup).filter((f) => f === getColorForKey('signal setzoom')).length).toBe(2);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SSR tests — TaskProvenanceTimeline (real component via vi.importActual)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('TaskProvenanceTimeline', () => {
  const xScale = d3.scaleLinear().domain([0, 10]).range([0, 500]);
  const margin = {
    left: 10, right: 10, top: 5, bottom: 5,
  };

  test('renders an SVG element', () => {
    const html = renderToStaticMarkup(
      <RealTaskProvenanceTimeline xScale={xScale} answers={{}} width={500} height={50} currentNode={null} trialName="trial_0" startTime={0} margin={margin} />,
    );
    expect(html).toContain('<svg');
  });

  test('renders a baseline horizontal line', () => {
    const html = renderToStaticMarkup(
      <RealTaskProvenanceTimeline xScale={xScale} answers={{}} width={500} height={50} currentNode={null} trialName="trial_0" startTime={0} margin={margin} />,
    );
    expect(html).toContain('<line');
    expect(html).toContain('stroke="black"');
  });

  test('skips null provenanceGraph entries gracefully', () => {
    const answers = { trial_0: { endTime: 5000, startTime: 0, provenanceGraph: { vis: null } } } as never;
    const html = renderToStaticMarkup(
      <RealTaskProvenanceTimeline xScale={xScale} answers={answers} width={500} height={50} currentNode={null} trialName="trial_0" startTime={0} margin={margin} />,
    );
    expect(html).toContain('<svg');
  });

  test('applies left margin as marginLeft style', () => {
    const html = renderToStaticMarkup(
      <RealTaskProvenanceTimeline
        xScale={xScale}
        answers={{}}
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
    await act(async () => render(
      <RealTimer width={500} height={60} debounceUpdateTimer={mockDebounce} xScale={xScale} />,
    ));
    const entry = mockReplayContext.replayEvent.on.mock.calls.find((call: string[]) => call[0] === 'timeupdate');
    const callback = entry?.[1] as ((t: number) => void) | undefined;
    if (callback) act(() => { callback(2); });
    expect(mockDebounce).toHaveBeenCalledWith(2000, undefined);
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
  trial_0: {
    startTime: 1000,
    endTime: 6000,
    answer: {},
    provenanceGraph: {
      aboveStimulus: null, belowStimulus: null, sidebar: null, stimulus: null,
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
            id: 'root-id', children: [], parent: null, createdOn: 500,
          },
        },
      },
    },
    windowEvents: [],
    trialOrder: '0',
    conditions: [],
  },
} as never;

describe('AudioProvenanceVis', () => {
  test('renders wavesurfer element', async () => {
    const { getByTestId } = await act(async () => render(<AudioProvenanceVis {...defaultProps} />));
    expect(getByTestId('wavesurfer')).toBeDefined();
  });

  test('renders in provenanceVis context', async () => {
    const { getByTestId } = await act(async () => render(
      <AudioProvenanceVis {...defaultProps} context="provenanceVis" />,
    ));
    expect(getByTestId('wavesurfer')).toBeDefined();
  });

  test('renders provenance-timeline when startTime > 0', async () => {
    const { getByTestId } = await act(async () => render(
      <AudioProvenanceVis {...defaultProps} answers={answersWithTask} />,
    ));
    expect(getByTestId('provenance-timeline')).toBeDefined();
  });

  test('syncChannel.postMessage fires when answers have trialOrder', async () => {
    const { syncChannel } = await import('../../utils/syncReplay');
    await act(async () => render(
      <AudioProvenanceVis {...defaultProps} answers={answersWithTask} />,
    ));
    expect(vi.mocked(syncChannel.postMessage)).toHaveBeenCalled();
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

  test('cleanup removes syncEmitter listeners on unmount', async () => {
    const { unmount } = await act(async () => render(
      <AudioProvenanceVis {...defaultProps} />,
    ));
    unmount();
    expect(vi.mocked(syncEmitter.off)).toHaveBeenCalledWith('participantId', expect.any(Function));
    expect(vi.mocked(syncEmitter.off)).toHaveBeenCalledWith('trialOrder', expect.any(Function));
  });
});
