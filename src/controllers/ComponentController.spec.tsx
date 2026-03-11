import { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';
import { IframeController } from './IframeController';
import { ImageController } from './ImageController';
import { MarkdownController } from './MarkdownController';
import { VegaController } from './VegaController';
import { VideoController } from './VideoController';
import { ComponentController } from './ComponentController';

let mockCurrentComponent = 'component-a';
let mockCurrentStep = 1;
let mockCurrentIdentifier = 'component-a_1';
const mockStudyId = 'study-a';
let mockParticipantIdParam = 'p1';

const mockStoreDispatch = vi.fn();
const mockUseDispatch = vi.fn();
const mockUseStudyConfig = vi.fn(() => ({
  components: {
    'component-a': {
      type: 'markdown', path: 'doc.md', response: [], instruction: '',
    },
    'component-b': {
      type: 'website', path: 'site/index.html', response: [], instruction: '',
    },
  },
  uiConfig: { contactEmail: 'admin@example.com', instructionLocation: 'sidebar' },
}));

let mockStorageEngine: {
  getEngine: () => string;
  isConnected: () => boolean;
} | undefined = {
  getEngine: () => 'firebase',
  isConnected: () => true,
};

let mockState = {
  answers: {},
  analysisCanPlayScreenRecording: false,
  analysisProvState: { stimulus: {} },
  sequence: [],
  modes: { developmentModeEnabled: false },
  participantId: 'p1',
};

vi.mock('@mantine/core', () => ({
  Box: ({ children, id, className }: { children?: ReactNode; id?: string; className?: string }) => <div id={id} className={className}>{children}</div>,
  Center: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Loader: () => <div>loader</div>,
  LoadingOverlay: () => <div>loading-overlay</div>,
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Title: ({ children }: { children: ReactNode }) => <h4>{children}</h4>,
  Image: ({ src }: { src: string }) => <img src={src} alt="img" />,
}));

vi.mock('@tabler/icons-react', () => ({
  IconPlugConnectedX: () => <div>plug-x</div>,
}));

vi.mock('react-redux', () => ({
  useDispatch: () => mockUseDispatch,
}));
vi.mock('react-vega', () => ({
  Vega: () => <div>vega</div>,
}));
vi.mock('@trrack/core', () => ({
  initializeTrrack: vi.fn(() => ({
    currentChange: () => 'root',
    apply: vi.fn(),
    graph: {
      backend: {},
    },
  })),
  Registry: {
    create: vi.fn(() => ({
      register: vi.fn((_name: string, _reducer: unknown) => vi.fn((payload: unknown) => payload)),
    })),
  },
}));
vi.mock('plyr-react', () => ({
  default: () => <div>plyr</div>,
}));

vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ funcIndex: undefined }),
  useSearchParams: () => [new URLSearchParams(`participantId=${mockParticipantIdParam}`)],
}));

vi.mock('../routes/utils', () => ({
  useCurrentComponent: () => mockCurrentComponent,
  useCurrentIdentifier: () => mockCurrentIdentifier,
  useCurrentStep: () => mockCurrentStep,
  useStudyId: () => mockStudyId,
}));

vi.mock('../store/store', () => ({
  useStoreDispatch: () => mockStoreDispatch,
  useStoreSelector: (selector: (s: typeof mockState) => unknown) => selector(mockState),
  useStoreActions: () => ({
    setAlertModal: (payload: unknown) => payload,
    setAnalysisCanPlayScreenRecording: (payload: unknown) => payload,
    updateResponseBlockValidation: (payload: unknown) => payload,
    setReactiveAnswers: (payload: unknown) => payload,
  }),
}));

vi.mock('../store/hooks/useStudyConfig', () => ({
  useStudyConfig: () => mockUseStudyConfig(),
}));

vi.mock('../store/hooks/useStoredAnswer', () => ({
  useStoredAnswer: () => ({ endTime: 0 }),
}));

vi.mock('../store/hooks/useIsAnalysis', () => ({
  useIsAnalysis: () => false,
}));

vi.mock('../store/hooks/useEvent', () => ({
  useEvent: (fn: (...args: unknown[]) => unknown) => fn,
}));

vi.mock('../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({ storageEngine: mockStorageEngine }),
}));

vi.mock('../utils/componentStyle', () => ({
  getComponentContainerStyle: () => ({}),
}));

vi.mock('../utils/getStaticAsset', () => ({
  getStaticAssetByPath: vi.fn(),
  getJsonAssetByPath: vi.fn(),
}));

vi.mock('../utils/handleComponentInheritance', () => ({
  studyComponentToIndividualComponent: (component: unknown) => component,
}));

vi.mock('../utils/getSequenceFlatMap', () => ({
  findBlockForStep: () => [],
}));

vi.mock('../utils/fetchStylesheet', () => ({
  useFetchStylesheet: vi.fn(),
}));

vi.mock('../utils/useDisableBrowserBack', () => ({
  useDisableBrowserBack: vi.fn(),
}));

vi.mock('../utils/encryptDecryptIndex', () => ({
  decryptIndex: (v: string) => v,
  encryptIndex: (v: number) => `${v}`,
}));

vi.mock('../store/hooks/useRecordingConfig', () => ({
  useRecordingConfig: () => ({ studyHasScreenRecording: false }),
}));

vi.mock('../components/response/ResponseBlock', () => ({
  ResponseBlock: () => <div>response-block</div>,
}));

vi.mock('../components/ReactMarkdownWrapper', () => ({
  ReactMarkdownWrapper: () => <div>markdown-wrapper</div>,
}));

vi.mock('../components/StudyEnd', () => ({
  StudyEnd: () => <div>study-end</div>,
}));

vi.mock('../components/TrainingFailed', () => ({
  TrainingFailed: () => <div>training-failed</div>,
}));

vi.mock('../components/TimedOut', () => ({
  TimedOut: () => <div>timed-out</div>,
}));

vi.mock('../components/screenRecording/ScreenRecordingReplay', () => ({
  ScreenRecordingReplay: () => <div>screen-recording-replay</div>,
}));

vi.mock('../ResourceNotFound', () => ({
  ResourceNotFound: ({ path }: { path?: string }) => <div>{`resource-not-found:${path || ''}`}</div>,
}));
vi.mock('./ReactComponentController', () => ({
  ReactComponentController: () => <div>react-component-controller</div>,
}));

describe('controllers in one spec', () => {
  beforeEach(() => {
    mockCurrentComponent = 'component-a';
    mockCurrentStep = 1;
    mockCurrentIdentifier = 'component-a_1';
    mockParticipantIdParam = 'p1';
    mockStorageEngine = {
      getEngine: () => 'firebase',
      isConnected: () => true,
    };
    mockState = {
      answers: {},
      analysisCanPlayScreenRecording: false,
      analysisProvState: { stimulus: {} },
      sequence: [],
      modes: { developmentModeEnabled: false },
      participantId: 'p1',
    };
    mockStoreDispatch.mockReset();
    mockUseDispatch.mockReset();
    mockUseStudyConfig.mockReturnValue({
      components: {
        'component-a': {
          type: 'markdown', path: 'doc.md', response: [], instruction: '',
        },
        'component-b': {
          type: 'website', path: 'site/index.html', response: [], instruction: '',
        },
      },
      uiConfig: { contactEmail: 'admin@example.com', instructionLocation: 'sidebar' },
    });
  });

  it('ErrorBoundary static and fallback behavior', () => {
    const derived = ErrorBoundary.getDerivedStateFromError(new Error('boom'));
    expect(derived).toEqual({ hasError: true, error: new Error('boom') });

    const instance = new ErrorBoundary({ children: <div>ok</div> } as never);
    instance.state = { hasError: true, error: new Error('boom') };
    const html = renderToStaticMarkup(instance.render() as never);
    expect(html).toContain('Error: boom');
  });

  it('IframeController renders iframe with trial id for local path', () => {
    const html = renderToStaticMarkup(
      <IframeController currentConfig={{ path: 'site/index.html' } as never} provState={{}} answers={{} as never} />,
    );
    expect(html).toContain('<iframe');
    expect(html).toContain('site/index.html');
    expect(html).toContain('trialid=component-a');
  });

  it('ImageController initially renders image', () => {
    const html = renderToStaticMarkup(<ImageController currentConfig={{ path: 'assets/image.png' } as never} />);
    expect(html).toContain('<img');
  });

  it('MarkdownController initially renders markdown wrapper', () => {
    const html = renderToStaticMarkup(<MarkdownController currentConfig={{ path: 'assets/doc.md' } as never} />);
    expect(html).toContain('markdown-wrapper');
  });

  it('VegaController shows loading on first render', () => {
    const html = renderToStaticMarkup(<VegaController currentConfig={{ path: 'assets/chart.json' } as never} />);
    expect(html).toContain('Loading');
  });

  it('VideoController shows loading overlay on first render', () => {
    const html = renderToStaticMarkup(<VideoController currentConfig={{ path: 'assets/video.mp4' } as never} />);
    expect(html).toContain('loading-overlay');
  });

  it('ComponentController handles special components and disconnected state', () => {
    mockCurrentComponent = 'end';
    expect(renderToStaticMarkup(<ComponentController />)).toContain('study-end');

    mockCurrentComponent = '__trainingFailed';
    expect(renderToStaticMarkup(<ComponentController />)).toContain('training-failed');

    mockCurrentComponent = '__timedOut';
    expect(renderToStaticMarkup(<ComponentController />)).toContain('timed-out');

    mockCurrentComponent = 'Notfound';
    expect(renderToStaticMarkup(<ComponentController />)).toContain('resource-not-found');

    mockCurrentComponent = 'component-a';
    mockStorageEngine = {
      getEngine: () => 'firebase',
      isConnected: () => false,
    };
    expect(renderToStaticMarkup(<ComponentController />)).toContain('Database Disconnected');
  });

  it('ComponentController renders matching stimulus controller and response blocks', () => {
    mockCurrentComponent = 'component-a';
    mockStorageEngine = {
      getEngine: () => 'firebase',
      isConnected: () => true,
    };
    const html = renderToStaticMarkup(<ComponentController />);
    expect(html).toContain('markdown-wrapper');
    expect(html).toContain('response-block');
  });

  it('ComponentController routes react-component type to ReactComponentController', () => {
    mockCurrentComponent = 'component-b';
    mockUseStudyConfig.mockReturnValue({
      components: {
        'component-a': {
          type: 'markdown', path: 'doc.md', response: [], instruction: '',
        },
        'component-b': {
          type: 'react-component', path: 'widget.tsx', response: [], instruction: '',
        },
      },
      uiConfig: { contactEmail: 'admin@example.com', instructionLocation: 'sidebar' },
    });

    const html = renderToStaticMarkup(<ComponentController />);
    expect(html).toContain('react-component-controller');
  });
});
