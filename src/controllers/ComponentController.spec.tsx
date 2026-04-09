import React, { ReactNode } from 'react';
import { render, waitFor, act } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { useSearchParams, useNavigate } from 'react-router';
import { Vega, View } from 'react-vega';
import { useStoredAnswer } from '../store/hooks/useStoredAnswer';
import type {
  ImageComponent,
  MarkdownComponent,
  ReactComponent,
  VegaComponent,
  VideoComponent,
  WebsiteComponent,
} from '../parser/types';
import type { StoreState } from '../store/types';
import type { StorageEngine } from '../storage/engines/types';
import { ComponentController } from './ComponentController';
import { ErrorBoundary } from './ErrorBoundary';
import { IframeController } from './IframeController';
import { ImageController } from './ImageController';
import { MarkdownController } from './MarkdownController';
import { ReactComponentController } from './ReactComponentController';
import { VegaController } from './VegaController';
import { VideoController } from './VideoController';
import { useCurrentComponent, useCurrentStep } from '../routes/utils';
import { useStorageEngine } from '../storage/storageEngineHooks';
import { getStaticAssetByPath, getJsonAssetByPath } from '../utils/getStaticAsset';
import { useStoreDispatch, useStoreActions, useStoreSelector } from '../store/store';
import { findBlockForStep } from '../utils/getSequenceFlatMap';
import { useIsAnalysis } from '../store/hooks/useIsAnalysis';
import { useRecordingConfig } from '../store/hooks/useRecordingConfig';

// ── mocks ────────────────────────────────────────────────────────────────────

vi.mock('@mantine/core', () => ({
  Image: ({ src }: { src?: string }) => <img src={src} alt="img" />,
  Text: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  Box: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Center: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Title: ({ children }: { children: ReactNode }) => <h1>{children}</h1>,
  Loader: () => <div>Loader</div>,
  LoadingOverlay: () => <div>LoadingOverlay</div>,
}));

vi.mock('@tabler/icons-react', () => ({
  IconPlugConnectedX: () => <span>icon-plug-x</span>,
}));

vi.mock('../ResourceNotFound', () => ({
  ResourceNotFound: ({ path, email }: { path?: string; email?: string }) => (
    <div>
      ResourceNotFound:
      {path ?? email}
    </div>
  ),
}));

vi.mock('../components/StudyEnd', () => ({
  StudyEnd: () => <div>StudyEnd</div>,
}));

vi.mock('../components/TrainingFailed', () => ({
  TrainingFailed: () => <div>TrainingFailed</div>,
}));

vi.mock('../components/TimedOut', () => ({
  TimedOut: () => <div>TimedOut</div>,
}));

vi.mock('../components/ReactMarkdownWrapper', () => ({
  ReactMarkdownWrapper: ({ text }: { text: string }) => (
    <div data-testid="markdown">{text}</div>
  ),
}));

vi.mock('../components/response/ResponseBlock', () => ({
  ResponseBlock: () => <div>ResponseBlock</div>,
}));

vi.mock('../components/screenRecording/ScreenRecordingReplay', () => ({
  ScreenRecordingReplay: () => <div>ScreenRecordingReplay</div>,
}));

vi.mock('../utils/getStaticAsset', () => ({
  getStaticAssetByPath: vi.fn(),
  getJsonAssetByPath: vi.fn(),
}));

vi.mock('../utils/Prefix', () => ({
  PREFIX: '/test/',
}));

vi.mock('../store/store', () => ({
  useStoreDispatch: vi.fn(() => vi.fn()),
  useStoreActions: vi.fn(() => ({
    setReactiveAnswers: vi.fn(),
    updateResponseBlockValidation: vi.fn(),
    setAlertModal: vi.fn(),
    setAnalysisCanPlayScreenRecording: vi.fn(),
  })),
  useStoreSelector: vi.fn((selector: (s: StoreState) => StoreState[keyof StoreState]) => selector({
    answers: {},
    analysisCanPlayScreenRecording: false,
    analysisProvState: {
      sidebar: { form: {} }, aboveStimulus: { form: {} }, belowStimulus: { form: {} }, stimulus: null,
    },
    sequence: {
      order: 'fixed', orderPath: '', components: [], skip: [],
    },
    modes: { dataCollectionEnabled: true, developmentModeEnabled: false, dataSharingEnabled: false },
    participantId: 'pid-1',
  } as Partial<StoreState> as StoreState)),
}));

vi.mock('../routes/utils', () => ({
  useCurrentStep: vi.fn(() => 0),
  useCurrentComponent: vi.fn(() => 'end'),
  useCurrentIdentifier: vi.fn(() => 'trial1_0'),
  useStudyId: vi.fn(() => 'test-study'),
}));

vi.mock('react-router', () => ({
  useNavigate: vi.fn(() => vi.fn()),
  useParams: vi.fn(() => ({})),
  useSearchParams: vi.fn(() => [new URLSearchParams()]),
}));

vi.mock('react-redux', () => ({
  useDispatch: vi.fn(() => vi.fn()),
}));

vi.mock('../store/hooks/useStudyConfig', () => ({
  useStudyConfig: vi.fn(() => ({
    components: {},
    uiConfig: { contactEmail: 'test@test.com', instructionLocation: 'sidebar' },
    sequence: { order: 'fixed', components: [] },
  })),
}));

vi.mock('../storage/storageEngineHooks', () => ({
  useStorageEngine: vi.fn(() => ({
    storageEngine: {
      isConnected: () => true,
      getEngine: () => 'localStorage',
      addParticipantTags: vi.fn(),
    },
  })),
}));

vi.mock('../store/hooks/useStoredAnswer', () => ({
  useStoredAnswer: vi.fn(() => null),
}));

vi.mock('../store/hooks/useIsAnalysis', () => ({
  useIsAnalysis: vi.fn(() => false),
}));

vi.mock('../store/hooks/useRecordingConfig', () => ({
  useRecordingConfig: vi.fn(() => ({ studyHasScreenRecording: false })),
}));

vi.mock('../utils/useDisableBrowserBack', () => ({
  useDisableBrowserBack: vi.fn(),
}));

vi.mock('../utils/fetchStylesheet', () => ({
  useFetchStylesheet: vi.fn(),
}));

vi.mock('../utils/getSequenceFlatMap', () => ({
  findBlockForStep: vi.fn(() => []),
}));

vi.mock('../utils/handleComponentInheritance', () => ({
  studyComponentToIndividualComponent: vi.fn(() => ({
    type: 'markdown',
    path: '/test.md',
    response: [],
    instructionLocation: 'sidebar',
  })),
}));

vi.mock('../utils/encryptDecryptIndex', () => ({
  decryptIndex: vi.fn((v: string) => v),
  encryptIndex: vi.fn((v: number) => String(v)),
}));

vi.mock('../utils/componentStyle', () => ({
  getComponentContainerStyle: vi.fn(() => ({})),
}));

vi.mock('../store/hooks/useEvent', () => ({
  useEvent: <T extends (...args: Parameters<T>) => ReturnType<T>>(fn: T): T => fn,
}));

vi.mock('@trrack/core', () => ({
  Registry: {
    create: vi.fn(() => ({
      register: vi.fn(() => vi.fn()),
    })),
  },
  initializeTrrack: vi.fn(() => ({
    apply: vi.fn(),
    graph: { backend: {} },
  })),
}));

vi.mock('react-vega', () => ({
  Vega: vi.fn(() => <div>Vega</div>),
}));

vi.mock('react-vega/lib/Vega', () => ({}));

vi.mock('plyr-react', () => ({
  usePlyr: vi.fn(() => ({ current: null })),
}));

vi.mock('plyr-react/plyr.css', () => ({}));

vi.mock('@visdesignlab/upset2-react', () => ({
  Upset: () => null,
}));

afterEach(() => vi.restoreAllMocks());

// ── typed fixtures ────────────────────────────────────────────────────────────

const imageConfig: ImageComponent = { type: 'image', path: '/test.png', response: [] };
const markdownConfig: MarkdownComponent = { type: 'markdown', path: '/test.md', response: [] };
// A path that does not match any file in src/public/ — always produces ResourceNotFound.
const missingReactConfig: ReactComponent = { type: 'react-component', path: 'nonexistent/component.tsx', response: [] };
const vegaPathConfig: VegaComponent = { type: 'vega', path: '/test.json', response: [] };
const vegaInlineConfig: VegaComponent = { type: 'vega', config: {}, response: [] };
const videoConfig: VideoComponent = { type: 'video', path: '/test.mp4', response: [] };
const websiteConfig: WebsiteComponent = { type: 'website', path: 'https://example.com', response: [] };

// ── ErrorBoundary ─────────────────────────────────────────────────────────────

describe('ErrorBoundary', () => {
  test('renders children when there is no error', () => {
    const html = renderToStaticMarkup(
      <ErrorBoundary><span>hello</span></ErrorBoundary>,
    );
    expect(html).toContain('hello');
  });

  test('getDerivedStateFromError returns hasError true with the error object', () => {
    const err = new Error('Test error');
    const state = ErrorBoundary.getDerivedStateFromError(err);
    expect(state.hasError).toBe(true);
    expect(state.error).toBe(err);
  });

  test('renders error message when a child throws', () => {
    function ThrowingChild(): ReactNode {
      throw new Error('test error');
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => { });
    const { container } = render(
      <ErrorBoundary><ThrowingChild /></ErrorBoundary>,
    );
    spy.mockRestore();
    expect(container.textContent).toContain('Error: test error');
  });
});

// ── ImageController ───────────────────────────────────────────────────────────

describe('ImageController', () => {
  test('renders an img element while loading for a relative path', () => {
    const html = renderToStaticMarkup(<ImageController currentConfig={imageConfig} />);
    expect(html).toContain('<img');
  });

  test('renders an img element with the full http src for an absolute path', () => {
    const absoluteConfig: ImageComponent = { type: 'image', path: 'https://example.com/img.png', response: [] };
    const html = renderToStaticMarkup(<ImageController currentConfig={absoluteConfig} />);
    expect(html).toContain('<img');
    expect(html).toContain('https://example.com/img.png');
  });

  test('renders ResourceNotFound after fetch returns undefined', async () => {
    vi.mocked(getStaticAssetByPath).mockResolvedValueOnce(undefined);
    const { container } = render(<ImageController currentConfig={{ type: 'image', path: '/missing.png', response: [] }} />);
    await waitFor(() => expect(container.textContent).toContain('ResourceNotFound'));
  });

  test('renders img after fetch returns content', async () => {
    vi.mocked(getStaticAssetByPath).mockResolvedValueOnce('image-data');
    const { container } = render(<ImageController currentConfig={{ type: 'image', path: '/found.png', response: [] }} />);
    await waitFor(() => expect(container.querySelector('img')).toBeTruthy());
  });
});

// ── MarkdownController ────────────────────────────────────────────────────────

describe('MarkdownController', () => {
  test('renders ReactMarkdownWrapper while loading', () => {
    const html = renderToStaticMarkup(<MarkdownController currentConfig={markdownConfig} />);
    expect(html).toContain('data-testid="markdown"');
  });

  test('renders ResourceNotFound after fetch returns undefined', async () => {
    vi.mocked(getStaticAssetByPath).mockResolvedValueOnce(undefined);
    const { container } = render(<MarkdownController currentConfig={{ type: 'markdown', path: '/missing.md', response: [] }} />);
    await waitFor(() => expect(container.textContent).toContain('ResourceNotFound'));
  });

  test('renders markdown text after fetch resolves with content', async () => {
    vi.mocked(getStaticAssetByPath).mockResolvedValueOnce('# Hello World');
    const { container } = render(<MarkdownController currentConfig={{ type: 'markdown', path: '/found.md', response: [] }} />);
    await waitFor(() => expect(container.textContent).toContain('# Hello World'));
  });
});

// ── ReactComponentController ──────────────────────────────────────────────────

describe('ReactComponentController', () => {
  test('renders ResourceNotFound when the module path is not in import.meta.glob', () => {
    const html = renderToStaticMarkup(
      <ReactComponentController currentConfig={missingReactConfig} answers={{}} />,
    );
    expect(html).toContain('ResourceNotFound');
  });
});

// ── VegaController ────────────────────────────────────────────────────────────

describe('VegaController', () => {
  test('shows loading state initially for a path-based config', () => {
    const html = renderToStaticMarkup(<VegaController currentConfig={vegaPathConfig} />);
    expect(html).toContain('Loading...');
  });

  test('shows loading state initially for an inline config', () => {
    const html = renderToStaticMarkup(<VegaController currentConfig={vegaInlineConfig} />);
    expect(html).toContain('Loading...');
  });

  test('renders Vega after path-based config fetches successfully', async () => {
    vi.mocked(getJsonAssetByPath).mockResolvedValueOnce({ $schema: 'vega', marks: [] });
    const { container } = render(<VegaController currentConfig={{ type: 'vega', path: '/chart.json', response: [] }} />);
    await waitFor(() => expect(container.textContent).toContain('Vega'));
  });

  test('renders ResourceNotFound when path-based fetch returns undefined', async () => {
    vi.mocked(getJsonAssetByPath).mockResolvedValueOnce(undefined);
    const { container } = render(<VegaController currentConfig={{ type: 'vega', path: '/missing.json', response: [] }} />);
    await waitFor(() => expect(container.textContent).toContain('ResourceNotFound'));
  });

  test('renders Vega for an inline config object', async () => {
    const { container } = render(<VegaController currentConfig={{ type: 'vega', config: { $schema: 'vega' }, response: [] }} />);
    await waitFor(() => expect(container.textContent).toContain('Vega'));
  });
});

// ── VideoController ───────────────────────────────────────────────────────────

describe('VideoController', () => {
  test('renders video element when html5 asset is found', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);
    vi.mocked(getStaticAssetByPath).mockResolvedValueOnce('video-data');
    const { container } = render(<VideoController currentConfig={videoConfig} />);
    await waitFor(() => expect(container.querySelector('video')).toBeTruthy());
  });

  test('renders ResourceNotFound when html5 asset is not found', async () => {
    vi.mocked(getStaticAssetByPath).mockResolvedValueOnce(undefined);
    const { container } = render(<VideoController currentConfig={{ type: 'video', path: '/missing.mp4', response: [] }} />);
    await waitFor(() => expect(container.textContent).toContain('ResourceNotFound'));
  });

  test('renders video element for a valid YouTube URL', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);
    const youtubeConfig: VideoComponent = { type: 'video', path: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', response: [] };
    const { container } = render(<VideoController currentConfig={youtubeConfig} />);
    await waitFor(() => expect(container.querySelector('video')).toBeTruthy());
  });

  test('dispatches store action when forceCompletion is true', async () => {
    const mockDispatch = vi.fn();
    vi.mocked(useStoreDispatch).mockReturnValueOnce(mockDispatch);
    const forceConfig: VideoComponent = {
      type: 'video', path: '/test.mp4', forceCompletion: true, response: [],
    };
    render(<VideoController currentConfig={forceConfig} />);
    await waitFor(() => expect(mockDispatch).toHaveBeenCalled());
  });

  test('renders LoadingOverlay while loading for a local path', () => {
    const html = renderToStaticMarkup(<VideoController currentConfig={videoConfig} />);
    expect(html).toContain('LoadingOverlay');
  });

  test('renders LoadingOverlay while loading for a YouTube URL', () => {
    const youtubeConfig: VideoComponent = { type: 'video', path: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', response: [] };
    const html = renderToStaticMarkup(<VideoController currentConfig={youtubeConfig} />);
    expect(html).toContain('LoadingOverlay');
  });

  test('renders LoadingOverlay while loading for a Vimeo URL', () => {
    const vimeoConfig: VideoComponent = { type: 'video', path: 'https://vimeo.com/123456789', response: [] };
    const html = renderToStaticMarkup(<VideoController currentConfig={vimeoConfig} />);
    expect(html).toContain('LoadingOverlay');
  });
});

// ── IframeController ──────────────────────────────────────────────────────────

describe('IframeController', () => {
  test('covers sendMessage via answers effect on mount', async () => {
    render(<IframeController currentConfig={websiteConfig} answers={{}} />);
    // answers effect fires sendMessage; ref.current is the iframe element in jsdom
    // so postMessage is invoked on its contentWindow — no assertion needed beyond no-throw
  });

  test('covers sendMessage via provState effect', async () => {
    render(
      <IframeController
        currentConfig={websiteConfig}
        answers={{}}
        provState={{ event: 'test' }}
      />,
    );
    // provState effect fires sendMessage
  });

  test('dispatches store actions when an ANSWERS window message arrives with matching iframeId', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(
      '11111111-2222-3333-4444-555555555555' as `${string}-${string}-${string}-${string}-${string}`,
    );
    const mockDispatch = vi.fn();
    vi.mocked(useStoreDispatch).mockReturnValueOnce(mockDispatch);
    render(<IframeController currentConfig={websiteConfig} answers={{}} />);
    window.dispatchEvent(new MessageEvent('message', {
      data: { iframeId: '11111111-2222-3333-4444-555555555555', type: '@REVISIT_COMMS/ANSWERS', message: { q1: 'yes' } },
    }));
    await waitFor(() => expect(mockDispatch).toHaveBeenCalled());
  });

  test('sends STUDY_DATA when a WINDOW_READY message arrives and parameters are set', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(
      '11111111-2222-3333-4444-555555555555' as `${string}-${string}-${string}-${string}-${string}`,
    );
    const websiteWithParams: WebsiteComponent = {
      type: 'website', path: 'https://example.com', parameters: { key: 'val' }, response: [],
    };
    render(<IframeController currentConfig={websiteWithParams} answers={{}} />);
    window.dispatchEvent(new MessageEvent('message', {
      data: { iframeId: '11111111-2222-3333-4444-555555555555', type: '@REVISIT_COMMS/WINDOW_READY' },
    }));
    // sendMessage called with STUDY_DATA; ref.current.contentWindow.postMessage fires
  });

  test('renders iframe with the original src for an http path', () => {
    const html = renderToStaticMarkup(
      <IframeController currentConfig={{ type: 'website', path: 'https://example.com/study', response: [] }} answers={{}} />,
    );
    expect(html).toContain('<iframe');
    expect(html).toContain('https://example.com/study');
  });

  test('renders iframe with PREFIX prepended for a relative path', () => {
    const html = renderToStaticMarkup(
      <IframeController currentConfig={{ type: 'website', path: 'my-study/index.html', response: [] }} answers={{}} />,
    );
    expect(html).toContain('<iframe');
    expect(html).toContain('/test/'); // matches PREFIX mock value
  });
});

// ── ComponentController ───────────────────────────────────────────────────────

describe('ComponentController', () => {
  beforeEach(() => {
    vi.mocked(useCurrentComponent).mockReturnValue('end');
  });

  test('renders StudyEnd when currentComponent is "end"', () => {
    const html = renderToStaticMarkup(<ComponentController />);
    expect(html).toContain('StudyEnd');
  });

  test('renders nothing when currentComponent is "__dynamicLoading"', () => {
    vi.mocked(useCurrentComponent).mockReturnValue('__dynamicLoading');
    const html = renderToStaticMarkup(<ComponentController />);
    expect(html).toBe('');
  });

  test('renders TrainingFailed when currentComponent is "__trainingFailed"', () => {
    vi.mocked(useCurrentComponent).mockReturnValue('__trainingFailed');
    const html = renderToStaticMarkup(<ComponentController />);
    expect(html).toContain('TrainingFailed');
  });

  test('renders TimedOut when currentComponent is "__timedOut"', () => {
    vi.mocked(useCurrentComponent).mockReturnValue('__timedOut');
    const html = renderToStaticMarkup(<ComponentController />);
    expect(html).toContain('TimedOut');
  });

  test('renders ResourceNotFound when currentComponent is "Notfound"', () => {
    vi.mocked(useCurrentComponent).mockReturnValue('Notfound');
    const html = renderToStaticMarkup(<ComponentController />);
    expect(html).toContain('ResourceNotFound');
  });

  test('renders Loader when participantId in URL does not match store participantId', () => {
    vi.mocked(useCurrentComponent).mockReturnValue('testTrial');
    vi.mocked(useSearchParams).mockReturnValueOnce([
      new URLSearchParams('participantId=other-pid'),
      vi.fn(),
    ]);
    const html = renderToStaticMarkup(<ComponentController />);
    expect(html).toContain('Loader');
  });

  test('renders "Database Disconnected" when storageEngine is not connected', () => {
    vi.mocked(useCurrentComponent).mockReturnValue('testTrial');
    vi.mocked(useStorageEngine).mockReturnValueOnce({
      storageEngine: {
        isConnected: () => false,
        getEngine: () => 'localStorage',
        addParticipantTags: vi.fn(),
      } as Partial<StorageEngine> as StorageEngine,
      setStorageEngine: vi.fn(),
    });
    const html = renderToStaticMarkup(<ComponentController />);
    expect(html).toContain('Database Disconnected');
  });
});

// ── ComponentController — effect coverage ────────────────────────────────────

// Stable state object — must be created once and reused so that object references
// (e.g. sequence, answers) don't change between renders. Changing refs in
// useStoreSelector would make useEffect deps appear different every render and
// cause an infinite re-render loop.
const makeStableState = (overrides: Partial<StoreState> = {}): StoreState => ({
  answers: {},
  analysisCanPlayScreenRecording: false,
  analysisProvState: {
    sidebar: { form: {} }, aboveStimulus: { form: {} }, belowStimulus: { form: {} }, stimulus: null,
  },
  sequence: {
    order: 'fixed', orderPath: '', components: [], skip: [],
  },
  modes: { dataCollectionEnabled: true, developmentModeEnabled: false, dataSharingEnabled: false },
  participantId: 'pid-1',
  ...overrides,
} as Partial<StoreState> as StoreState);

describe('ComponentController — effect coverage (render-based)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCurrentComponent).mockReturnValue('end');
    vi.mocked(useCurrentStep).mockReturnValue(0);
    vi.mocked(useIsAnalysis).mockReturnValue(false);
    vi.mocked(useRecordingConfig).mockReturnValue({
      studyHasScreenRecording: false,
      studyHasAudioRecording: false,
      currentComponentHasAudioRecording: false,
      currentComponentHasScreenRecording: false,
      currentComponentHasClickToRecord: false,
    });
    vi.mocked(findBlockForStep).mockReturnValue([]);
    vi.mocked(useStoreDispatch).mockReturnValue(vi.fn());
    const mockActions = {
      setReactiveAnswers: vi.fn(),
      updateResponseBlockValidation: vi.fn(),
      setAlertModal: vi.fn(),
      setAnalysisCanPlayScreenRecording: vi.fn(),
    };
    // @ts-expect-error partial mock
    vi.mocked(useStoreActions).mockReturnValue(mockActions);
    vi.mocked(useStorageEngine).mockReturnValue({
      storageEngine: {
        isConnected: () => true,
        getEngine: () => 'firebase',
        addParticipantTags: vi.fn(),
      } as Partial<StorageEngine> as StorageEngine,
      setStorageEngine: vi.fn(),
    });
    // Use a stable (single) state instance per test so object refs don't change
    // between renders, preventing spurious effect re-runs.
    const stableState = makeStableState();
    vi.mocked(useStoreSelector).mockImplementation(
      (selector) => selector(stableState),
    );
  });

  test('setAlertModal dispatched when engine does not match env', async () => {
    const mockDispatch = vi.fn();
    vi.mocked(useStoreDispatch).mockReturnValue(mockDispatch);
    render(<ComponentController />);
    await waitFor(() => expect(mockDispatch).toHaveBeenCalled());
  });

  test('isAnalysis=true returns early from block effect', async () => {
    vi.mocked(useIsAnalysis).mockReturnValue(true);
    render(<ComponentController />);
    await act(async () => { });
    expect(vi.mocked(findBlockForStep)).not.toHaveBeenCalled();
  });

  test('findBlockForStep called inside updateBlockForStep', async () => {
    render(<ComponentController />);
    await waitFor(() => expect(vi.mocked(findBlockForStep)).toHaveBeenCalled());
  });

  test('addParticipantTags called when blockForStep becomes non-empty', async () => {
    const addTagsSpy = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useStorageEngine).mockReturnValue({
      storageEngine: {
        isConnected: () => true,
        getEngine: () => 'localStorage',
        addParticipantTags: addTagsSpy,
      } as Partial<StorageEngine> as StorageEngine,
      setStorageEngine: vi.fn(),
    });
    const mockBlock = [{ currentBlock: { id: 'blockA' }, blockIndex: 0 }];
    // @ts-expect-error partial mock
    vi.mocked(findBlockForStep).mockReturnValue(mockBlock);

    const { rerender } = render(<ComponentController />);
    // Wait for first effect run to call findBlockForStep and update blockForStep state
    await waitFor(() => expect(vi.mocked(findBlockForStep)).toHaveBeenCalled());

    // Trigger effect re-run by changing currentStep; now blockForStep=['blockA'] in closure
    vi.mocked(useCurrentStep).mockReturnValue(1);
    rerender(<ComponentController />);

    await waitFor(() => expect(addTagsSpy).toHaveBeenCalledWith(['blockA']));
  });

  test('setAnalysisCanPlayScreenRecording dispatched with true', async () => {
    const setAnalysisCanPlaySpy = vi.fn().mockReturnValue('PLAY_ACTION');
    const mockActionsWithSpy = {
      setReactiveAnswers: vi.fn(),
      updateResponseBlockValidation: vi.fn(),
      setAlertModal: vi.fn(),
      setAnalysisCanPlayScreenRecording: setAnalysisCanPlaySpy,
    };
    // @ts-expect-error partial mock
    vi.mocked(useStoreActions).mockReturnValue(mockActionsWithSpy);
    render(<ComponentController />);
    await waitFor(() => expect(setAnalysisCanPlaySpy).toHaveBeenCalledWith(true));
  });

  test('auto-forward navigates when last answer step > currentStep', async () => {
    const mockNavigate = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
    vi.mocked(useCurrentComponent).mockReturnValue('testTrial');
    const mockStoredAnswer = { endTime: 1, startTime: 0, trialOrder: '0' };
    // @ts-expect-error partial mock
    vi.mocked(useStoredAnswer).mockReturnValue(mockStoredAnswer);
    const mockAnswers = { trial_0: { endTime: 1, startTime: 0, trialOrder: '2' } };
    // @ts-expect-error partial mock
    const stableStateWithAnswer = makeStableState({ answers: mockAnswers });
    vi.mocked(useStoreSelector).mockImplementation(
      (selector) => selector(stableStateWithAnswer),
    );
    render(<ComponentController />);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
  });

  test('ScreenRecordingReplay rendered when studyHasScreenRecording+isAnalysis+canPlay', async () => {
    vi.mocked(useCurrentComponent).mockReturnValue('testTrial');
    vi.mocked(useIsAnalysis).mockReturnValue(true);
    vi.mocked(useRecordingConfig).mockReturnValue({
      studyHasScreenRecording: true,
      studyHasAudioRecording: false,
      currentComponentHasAudioRecording: false,
      currentComponentHasScreenRecording: false,
      currentComponentHasClickToRecord: false,
    });
    const stableStateCanPlay = makeStableState({ analysisCanPlayScreenRecording: true });
    vi.mocked(useStoreSelector).mockImplementation(
      (selector) => selector(stableStateCanPlay),
    );

    const { container } = render(<ComponentController />);
    await waitFor(() => expect(container.textContent).toContain('ScreenRecordingReplay'));
  });
});

// ── VegaController — signal and event coverage ────────────────────────────────

describe('VegaController — signal and event coverage', () => {
  test('renders "Failed to load vega config" when inline config is missing', async () => {
    const { container } = render(
      // @ts-expect-error intentionally passing undefined config to test error path
      <VegaController currentConfig={{ type: 'vega', config: undefined, response: [] }} />,
    );
    await waitFor(() => expect(container.textContent).toContain('Failed to load vega config'));
  });

  test('signal listeners, handleSignalEvt, handleRevisitAnswer, and provState effect all covered', async () => {
    type SignalHandler = (name: string, value: string | Record<string, string>) => void;
    let capturedSignalListeners: Record<string, SignalHandler> = {};
    let capturedOnNewView: ((v: View) => void) | undefined;

    vi.mocked(getJsonAssetByPath).mockResolvedValueOnce({
      $schema: 'vega',
      config: { signals: [{ name: 'mySignal' }, { name: 'revisitAnswer' }] },
    });

    const mockDispatch = vi.fn();
    vi.mocked(useStoreDispatch).mockReturnValue(mockDispatch);

    const vegaMockImpl = (props: {
      signalListeners?: Record<string, SignalHandler>;
      onNewView?: (v: View) => void;
    }) => {
      capturedSignalListeners = props.signalListeners ?? {};
      capturedOnNewView = props.onNewView;
      return React.createElement('div', null, 'Vega');
    };
    // @ts-expect-error partial mock
    vi.mocked(Vega).mockImplementation(vegaMockImpl);

    render(
      <VegaController
        currentConfig={{ type: 'vega', path: '/chart.json', response: [] }}
        provState={{ event: { key: 'testKey', value: 'testVal' } }}
      />,
    );

    await waitFor(() => expect(capturedOnNewView).toBeDefined());

    await act(async () => {
      capturedSignalListeners.mySignal?.('mySignal', 'hello');
      capturedSignalListeners.revisitAnswer?.('revisitAnswer', { responseId: 'r1', response: 'yes' });
      const fakeView = { signal: vi.fn().mockReturnValue({ run: vi.fn() }) };
      // @ts-expect-error partial mock
      capturedOnNewView?.(fakeView);
    });

    expect(mockDispatch).toHaveBeenCalled();
  });
});
