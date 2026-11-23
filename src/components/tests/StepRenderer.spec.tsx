import { forwardRef, ReactNode } from 'react';
import {
  render, act, cleanup, waitFor, fireEvent,
} from '@testing-library/react';
import {
  describe, expect, test, vi,
  beforeEach, afterEach,
} from 'vitest';
import { StepRenderer } from '../StepRenderer';
import { KeyMapper } from '../response/KeyMapper';
import { shouldConfirmTabClose } from '../../utils/closeTabConfirmation';
import { LocalStorageEngine } from '../../storage/engines/LocalStorageEngine';
import { StorageObject, StorageObjectType } from '../../storage/engines/types';
import { ParticipantData } from '../../storage/types';
import { StoredAnswer } from '../../store/types';
import type { UseGamepadOptions } from '../../store/hooks/useGamepad';
import type { WindowEventsRef } from '../../store/hooks/useWindowEvents';

vi.mock('../../store/hooks/useTrialProvenance', () => ({ TrialProvenanceBoundary: ({ children }: { children: ReactNode }) => children }));

// ── mocks ─────────────────────────────────────────────────────────────────────

const mockDispatch = vi.fn();
const gamepadMocks = vi.hoisted(() => ({
  options: undefined as UseGamepadOptions | undefined,
  events: undefined as WindowEventsRef | undefined,
  capture: false,
  requireEntireScreen: false,
  captureActive: false,
  screenRecordingActive: undefined as boolean | undefined,
  recordingStartTime: undefined as number | undefined,
  recordingStopTime: undefined as number | undefined,
  chunkKeys: [] as string[],
  stopRecording: vi.fn(async () => {}),
  startRecording: vi.fn(),
  startCapture: vi.fn(),
  rotateAssetIdentifier: vi.fn(() => 'task_0__screen_retry'),
  assetSegments: ['task_0__screen_visit'] as string[],
  chunkUpdateListener: undefined as ((trialName: string, chunkKeys: string[]) => void) | undefined,
  answersOverride: undefined as Record<string, unknown> | undefined,
  hasActiveVerifiedScreenCapture: vi.fn(),
  getRecordingChunkKeys: vi.fn(),
  getScreenRecordingStartTime: vi.fn(),
  getRecordingStopTime: vi.fn(),
  rotateTrialAssetIdentifier: vi.fn(),
  saveTrialAnswerAction: vi.fn((payload: unknown) => ({ type: 'saveTrialAnswer', payload })),
  realReduxStore: undefined as { getState: () => unknown } | undefined,
  simulateRecorderEffect: false,
  lastRecordingAsset: undefined as string | undefined,
  interrupted: false,
  analysis: false,
  globalStoreEnabled: false,
  componentRecordScreen: undefined as boolean | undefined,
  componentRecordAudio: undefined as boolean | undefined,
  componentRecordWebcam: undefined as boolean | undefined,
}));
const mockSetAlertModal = vi.fn((payload) => ({ type: 'setAlertModal', payload }));
const mockSubscribeToParticipantDataWriteErrors = vi.fn();
const mockSaveInterruptedAnswers = vi.fn().mockResolvedValue(undefined);
const mockFlushPendingParticipantData = vi.fn().mockResolvedValue(undefined);
const mockFlushPendingAssetUploads = vi.fn().mockResolvedValue(undefined);
let mockParticipantFinalizationBarrier: (() => Promise<void>) | undefined;
const mockRegisterParticipantFinalizationBarrier = vi.fn((barrier: () => Promise<void>) => {
  mockParticipantFinalizationBarrier = barrier;
  return () => { mockParticipantFinalizationBarrier = undefined; };
});
const mockAnswers = vi.hoisted(() => ({
  task_0: {
    identifier: 'task_0',
    componentName: 'task',
    answer: { response: 'draft' },
    trialOrder: '1',
    incorrectAnswers: {},
    startTime: 100,
    endTime: -1,
    windowEvents: [],
    timedOut: false,
    helpButtonClickedCount: 0,
    parameters: {},
    correctAnswer: [],
    optionOrders: {},
    questionOrders: {},
  },
}));
let mockCurrentComponent = 'intro';
let mockCurrentIdentifier: string | undefined;
const pdfExportMocks = vi.hoisted(() => ({
  buildFilename: vi.fn((_componentName: string) => 'intro_2026-08-20T14-37-09.pdf'),
  getUnsupportedReason: vi.fn((_element: HTMLElement): string | undefined => undefined),
  hideNotification: vi.fn((_notificationId: string) => {}),
  saveElement: vi.fn((_element: HTMLElement, _filename: string): Promise<void> => Promise.resolve()),
  showNotification: vi.fn((_notification: unknown) => 'notification-id'),
  waitForNextPaint: vi.fn((): Promise<void> => Promise.resolve()),
}));
let mockShowTitleBar = true;
let mockShowStudyBrowser = false;
let mockDevelopmentModeEnabled = false;
let mockStorageEngine: Pick<LocalStorageEngine, 'subscribeToParticipantDataWriteErrors' | 'saveAnswers' | 'flushPendingParticipantData' | 'flushPendingAssetUploads' | 'registerParticipantFinalizationBarrier'> = {
  subscribeToParticipantDataWriteErrors: mockSubscribeToParticipantDataWriteErrors,
  saveAnswers: mockSaveInterruptedAnswers,
  flushPendingParticipantData: mockFlushPendingParticipantData,
  flushPendingAssetUploads: mockFlushPendingAssetUploads,
  registerParticipantFinalizationBarrier: mockRegisterParticipantFinalizationBarrier,
};

function setScreenExtended(isExtended: boolean) {
  Object.defineProperty(window.screen, 'isExtended', { configurable: true, value: isExtended });
}

class FailingQueuedWriteStorageEngine extends LocalStorageEngine {
  private failNextParticipantDataWrite = false;

  constructor() {
    super(true);
    this.participantDataWriteDelayMs = 0;
  }

  initializeParticipantForTest(participantData: ParticipantData) {
    this.currentParticipantId = participantData.participantId;
    this.participantData = participantData;
  }

  failNextWrite() {
    this.failNextParticipantDataWrite = true;
  }

  protected override async _pushToStorage<T extends StorageObjectType>(
    prefix: string,
    type: T,
    objectToUpload: StorageObject<T>,
  ) {
    if (
      type === 'participantData'
      && prefix.startsWith('participants/')
      && this.failNextParticipantDataWrite
    ) {
      this.failNextParticipantDataWrite = false;
      throw new Error('Queued participant upload failed');
    }

    return super._pushToStorage(prefix, type, objectToUpload);
  }
}

vi.mock('../interface/AppAside', () => ({
  AppAside: () => <div data-testid="app-aside" />,
}));

vi.mock('../interface/GlobalStoreHistory', () => ({ GlobalStoreHistory: () => null }));

vi.mock('../interface/AppHeader', () => ({
  AppHeader: ({
    isExportingPdf,
    onExportPdf,
  }: {
    isExportingPdf?: boolean;
    onExportPdf?: () => Promise<void> | void;
  }) => (
    <button
      type="button"
      data-testid="app-header"
      disabled={isExportingPdf}
      onClick={() => { onExportPdf?.(); }}
    >
      Export PDF
    </button>
  ),
}));

vi.mock('../interface/AppNavBar', () => ({
  AppNavBar: ({ inert }: { inert?: boolean }) => <div data-testid="app-navbar" inert={inert} />,
}));

vi.mock('../interface/HelpModal', () => ({
  HelpModal: () => null,
}));

vi.mock('../interface/AlertModal', () => ({
  AlertModal: () => null,
  STORAGE_RETRY_SUCCESS_EVENT: 'revisit-storage-retry-success',
}));

vi.mock('../interface/ConfigVersionWarningModal', () => ({
  ConfigVersionWarningModal: () => null,
}));

vi.mock('../interface/AnalysisFooter', () => ({
  AnalysisFooter: () => null,
}));

vi.mock('../interface/ScreenRecordingRejection', () => ({
  ScreenRecordingRejection: ({ saving }: { saving: boolean }) => (
    <div data-testid="recording-rejection">{saving ? 'saving' : 'safe-to-close'}</div>
  ),
}));

vi.mock('../interface/DeviceWarning', () => ({
  DeviceWarning: () => null,
}));

vi.mock('../../store/hooks/useStudyConfig', () => ({
  useStudyConfig: () => ({
    studyMetadata: { title: 'Test Study' },
    studyRules: undefined,
    globalVariables: gamepadMocks.globalStoreEnabled ? { budget: { initialValue: 100 } } : undefined,
    uiConfig: {
      logoPath: 'logo.svg',
      withSidebar: true,
      sidebarWidth: 300,
      showTitleBar: true,
      windowEventDebounceTime: 100,
      recordScreen: true,
      recordAudio: false,
      recordWebcam: false,
      requireEntireScreen: gamepadMocks.requireEntireScreen,
    },
    components: {},
    sequences: {},
  }),
}));

vi.mock('../../store/hooks/useIsAnalysis', () => ({
  useIsAnalysis: () => gamepadMocks.analysis,
}));

vi.mock('../../store/hooks/useWindowEvents', () => ({
  WindowEventsContext: {
    Provider: ({ children, value }: { children: ReactNode; value: WindowEventsRef }) => {
      gamepadMocks.events = value;
      return <span>{children}</span>;
    },
  },
}));

vi.mock('../../store/hooks/useGamepad', () => ({
  useGamepad: (options: UseGamepadOptions) => { gamepadMocks.options = options; return { device: null, connected: false }; },
}));

vi.mock('../../store/hooks/useRecording', () => ({
  useRecording: () => {
    const currentAsset = gamepadMocks.assetSegments.at(-1);
    if (gamepadMocks.simulateRecorderEffect && gamepadMocks.captureActive && currentAsset
      && currentAsset !== gamepadMocks.lastRecordingAsset) {
      gamepadMocks.lastRecordingAsset = currentAsset;
      gamepadMocks.startRecording(currentAsset);
    }
    return {
      isRejected: gamepadMocks.interrupted,
      isScreenCapturing: gamepadMocks.captureActive,
      isMediaCapturing: gamepadMocks.captureActive,
      isScreenRecording: gamepadMocks.screenRecordingActive ?? gamepadMocks.captureActive,
      stopScreenRecording: gamepadMocks.stopRecording,
      startScreenRecording: gamepadMocks.startRecording,
      startScreenCapture: gamepadMocks.startCapture,
      screenCaptureVerificationError: null,
      screenRecordingError: null,
      hasActiveVerifiedScreenCapture: gamepadMocks.hasActiveVerifiedScreenCapture,
      getRecordingChunkKeys: gamepadMocks.getRecordingChunkKeys,
      subscribeToRecordingChunkUpdates: (listener: (trialName: string, chunkKeys: string[]) => void) => {
        gamepadMocks.chunkUpdateListener = listener;
        return () => { gamepadMocks.chunkUpdateListener = undefined; };
      },
      getScreenRecordingStartTime: gamepadMocks.getScreenRecordingStartTime,
      getRecordingStopTime: gamepadMocks.getRecordingStopTime,
    };
  },
  RecordingContext: { Provider: ({ children }: { children: ReactNode }) => <span>{children}</span> },
}));

vi.mock('../../store/hooks/useReplay', () => ({
  useReplay: () => ({
    seekTime: 0,
    setSeekTime: vi.fn(),
    duration: 0,
    speed: 1,
    isPlaying: false,
    setIsPlaying: vi.fn(),
    updateReplayRef: vi.fn(),
    setSpeed: vi.fn(),
    forceEmitTimeUpdate: vi.fn(),
    setDuration: vi.fn(),
    hasEnded: false,
    replayEvent: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
  }),
  ReplayContext: { Provider: ({ children }: { children: ReactNode }) => <span>{children}</span> },
}));

vi.mock('../../store/store', () => ({
  useStoreSelector: (selector: (s: Record<string, unknown>) => unknown) => selector(gamepadMocks.realReduxStore
    ? gamepadMocks.realReduxStore.getState() as Record<string, unknown>
    : {
      showStudyBrowser: mockShowStudyBrowser,
      modes: { developmentModeEnabled: mockDevelopmentModeEnabled, dataCollectionEnabled: true },
      completed: false,
      analysisHasScreenRecording: false,
      analysisCanPlayScreenRecording: false,
      answers: gamepadMocks.answersOverride ?? mockAnswers,
    }),
  useStoreDispatch: () => mockDispatch,
  useStoreActions: () => ({
    toggleStudyBrowser: vi.fn(),
    setAlertModal: mockSetAlertModal,
    saveTrialAnswer: gamepadMocks.saveTrialAnswerAction,
  }),
}));

vi.mock('../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({
    storageEngine: mockStorageEngine,
  }),
}));

vi.mock('../../routes/utils', () => ({
  useCurrentComponent: () => mockCurrentComponent,
  useCurrentIdentifier: () => mockCurrentIdentifier ?? (mockCurrentComponent === 'task' ? 'task_0' : mockCurrentComponent),
}));

vi.mock('../../store/hooks/useTrialAssetIdentifier', () => ({
  useTrialAssetSegments: () => gamepadMocks.assetSegments,
  useRotateTrialAssetIdentifier: () => gamepadMocks.rotateTrialAssetIdentifier,
}));

vi.mock('../../utils/handleComponentInheritance', () => ({
  studyComponentToIndividualComponent: vi.fn(() => ({
    recordScreen: gamepadMocks.componentRecordScreen,
    recordAudio: gamepadMocks.componentRecordAudio,
    recordWebcam: gamepadMocks.componentRecordWebcam,
    captureGamepad: gamepadMocks.capture,
    withSidebar: true,
    sidebarWidth: 300,
    showTitleBar: mockShowTitleBar,
    windowEventDebounceTime: 100,
  })),
}));

vi.mock('../../utils/fetchStylesheet', () => ({
  useFetchStylesheet: vi.fn(),
}));

vi.mock('../../utils/closeTabConfirmation', () => ({
  handleBeforeUnload: vi.fn(),
  shouldConfirmTabClose: vi.fn(() => false),
}));

vi.mock('../../utils/pdfExport', () => ({
  buildPdfFilename: (componentName: string) => pdfExportMocks.buildFilename(componentName),
  getPdfExportUnsupportedReason: (element: HTMLElement) => pdfExportMocks.getUnsupportedReason(element),
  saveElementAsPdf: (element: HTMLElement, filename: string) => pdfExportMocks.saveElement(element, filename),
  waitForNextPaint: () => pdfExportMocks.waitForNextPaint(),
}));

vi.mock('../../utils/notifications', () => ({
  hideNotification: (notificationId: string) => pdfExportMocks.hideNotification(notificationId),
  showNotification: (notification: unknown) => pdfExportMocks.showNotification(notification),
}));

vi.mock('react-router', () => ({
  Outlet: () => <div data-testid="outlet" />,
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

vi.mock('@mantine/core', () => ({
  useComputedColorScheme: () => 'light',
  ActionIcon: ({
    'aria-label': ariaLabel, children,
  }: { 'aria-label'?: string; children: ReactNode }) => (
    <button type="button" aria-label={ariaLabel}>{children}</button>
  ),
  AppShell: Object.assign(
    ({ children }: { children: ReactNode }) => <div data-testid="app-shell">{children}</div>,
    {
      Header: ({ children }: { children: ReactNode }) => <header>{children}</header>,
      Navbar: ({ children }: { children: ReactNode }) => <nav>{children}</nav>,
      Aside: ({ children }: { children: ReactNode }) => <aside>{children}</aside>,
      Main: ({ children }: { children: ReactNode }) => <main>{children}</main>,
      Footer: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
    },
  ),
  Button: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => <button type="button" onClick={onClick}>{children}</button>,
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Flex: forwardRef<HTMLDivElement, { children: ReactNode }>(function Flex({ children }, ref) { // eslint-disable-line prefer-arrow-callback
    return <div ref={ref} data-pdf-export-root>{children}</div>;
  }),
  Menu: Object.assign(
    ({ children }: { children: ReactNode }) => <div>{children}</div>,
    {
      Target: ({ children }: { children: ReactNode }) => <div>{children}</div>,
      Dropdown: ({ children }: { children: ReactNode }) => <div>{children}</div>,
      Item: ({
        children, disabled, onClick,
      }: { children: ReactNode; disabled?: boolean; onClick?: () => void }) => (
        <button type="button" disabled={disabled} onClick={onClick}>{children}</button>
      ),
    },
  ),
}));

vi.mock('@tabler/icons-react', () => ({
  IconArrowLeft: () => null,
  IconDotsVertical: () => null,
  IconFileTypePdf: () => null,
}));

vi.mock('lodash.debounce', () => ({
  default: (fn: (...args: unknown[]) => unknown) => Object.assign(fn, {
    flush: () => undefined,
    cancel: () => undefined,
  }),
}));

// ── tests ─────────────────────────────────────────────────────────────────────

describe('StepRenderer', () => {
  beforeEach(() => {
    gamepadMocks.capture = false;
    gamepadMocks.requireEntireScreen = false;
    gamepadMocks.captureActive = false;
    gamepadMocks.screenRecordingActive = undefined;
    gamepadMocks.assetSegments = ['task_0__screen_visit'];
    gamepadMocks.chunkUpdateListener = undefined;
    gamepadMocks.answersOverride = undefined;
    gamepadMocks.hasActiveVerifiedScreenCapture.mockImplementation(() => gamepadMocks.captureActive);
    gamepadMocks.getRecordingChunkKeys.mockImplementation(() => gamepadMocks.chunkKeys);
    gamepadMocks.getScreenRecordingStartTime.mockImplementation(() => gamepadMocks.recordingStartTime);
    gamepadMocks.getRecordingStopTime.mockImplementation(() => gamepadMocks.recordingStopTime);
    gamepadMocks.rotateTrialAssetIdentifier.mockImplementation(() => {
      const key = gamepadMocks.rotateAssetIdentifier();
      gamepadMocks.assetSegments = [...gamepadMocks.assetSegments, key];
      return key;
    });
    gamepadMocks.saveTrialAnswerAction.mockImplementation((payload: unknown) => ({ type: 'saveTrialAnswer', payload }));
    gamepadMocks.simulateRecorderEffect = false;
    gamepadMocks.lastRecordingAsset = undefined;
    gamepadMocks.recordingStartTime = undefined;
    gamepadMocks.chunkKeys = [];
    gamepadMocks.stopRecording.mockClear();
    gamepadMocks.startRecording.mockReset();
    gamepadMocks.rotateAssetIdentifier.mockReset().mockReturnValue('task_0__screen_retry');
    gamepadMocks.interrupted = false;
    gamepadMocks.analysis = false;
    gamepadMocks.globalStoreEnabled = false;
    gamepadMocks.componentRecordScreen = undefined;
    gamepadMocks.componentRecordAudio = undefined;
    gamepadMocks.componentRecordWebcam = undefined;
    gamepadMocks.options = undefined;
    gamepadMocks.events = undefined;
    mockDispatch.mockReset();
    gamepadMocks.realReduxStore = undefined;
    mockSetAlertModal.mockClear();
    mockSubscribeToParticipantDataWriteErrors.mockReset();
    pdfExportMocks.buildFilename.mockClear();
    pdfExportMocks.getUnsupportedReason.mockReset().mockReturnValue(undefined);
    pdfExportMocks.hideNotification.mockClear();
    pdfExportMocks.saveElement.mockReset().mockResolvedValue(undefined);
    pdfExportMocks.showNotification.mockClear();
    pdfExportMocks.waitForNextPaint.mockReset().mockResolvedValue(undefined);
    mockShowTitleBar = true;
    mockCurrentComponent = 'intro';
    mockCurrentIdentifier = undefined;
    mockShowStudyBrowser = false;
    mockDevelopmentModeEnabled = false;
    mockAnswers.task_0 = {
      identifier: 'task_0',
      componentName: 'task',
      answer: { response: 'draft' },
      trialOrder: '1',
      incorrectAnswers: {},
      startTime: 100,
      endTime: -1,
      windowEvents: [],
      timedOut: false,
      helpButtonClickedCount: 0,
      parameters: {},
      correctAnswer: [],
      optionOrders: {},
      questionOrders: {},
    };
    mockStorageEngine = {
      subscribeToParticipantDataWriteErrors: mockSubscribeToParticipantDataWriteErrors,
      saveAnswers: mockSaveInterruptedAnswers,
      flushPendingParticipantData: mockFlushPendingParticipantData,
      flushPendingAssetUploads: mockFlushPendingAssetUploads,
      registerParticipantFinalizationBarrier: mockRegisterParticipantFinalizationBarrier,
    };
    mockSaveInterruptedAnswers.mockReset().mockResolvedValue(undefined);
    mockFlushPendingParticipantData.mockReset().mockResolvedValue(undefined);
    mockFlushPendingAssetUploads.mockReset().mockResolvedValue(undefined);
    mockRegisterParticipantFinalizationBarrier.mockClear();
    mockParticipantFinalizationBarrier = undefined;
    gamepadMocks.startRecording.mockReset();
    gamepadMocks.startCapture.mockReset();
    gamepadMocks.rotateAssetIdentifier.mockReset().mockReturnValue('task_0__screen_retry');
    vi.mocked(shouldConfirmTabClose).mockReturnValue(false);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(window.screen, 'isExtended');
    Reflect.deleteProperty(window, 'getScreenDetails');
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test('keeps the main content free of form-only gutters', async () => {
    const { container } = await act(async () => render(<StepRenderer />));
    const content = container.querySelector<HTMLElement>('.study-content');

    expect(content?.style.padding).toBe('');
    expect(content?.querySelector('[data-testid="outlet"]')).not.toBeNull();
  });

  test('gates the participant task and its sidebar, but leaves analysis and permission setup available', async () => {
    gamepadMocks.requireEntireScreen = true;
    mockCurrentComponent = 'task';
    const view = await act(async () => render(<StepRenderer />));
    expect(view.queryByTestId('outlet')).toBeNull();
    expect(view.queryByTestId('app-navbar')).toBeNull();

    gamepadMocks.analysis = true;
    await act(async () => view.rerender(<StepRenderer />));
    expect(view.queryByTestId('outlet')).not.toBeNull();

    gamepadMocks.analysis = false;
    mockCurrentComponent = '$screen-recording.components.screenRecordingPermission';
    await act(async () => view.rerender(<StepRenderer />));
    expect(view.queryByTestId('outlet')).not.toBeNull();
  });

  test('does not gate the reserved end step after capture stops', async () => {
    gamepadMocks.requireEntireScreen = true;
    mockCurrentComponent = 'end';
    const view = await act(async () => render(<StepRenderer />));
    expect(view.queryByTestId('outlet')).not.toBeNull();
  });

  test('shows participants a nonblocking warning when multiple displays are detected', async () => {
    gamepadMocks.requireEntireScreen = true;
    mockCurrentComponent = 'task';
    setScreenExtended(true);
    const getScreenDetails = vi.fn();
    Object.defineProperty(window, 'getScreenDetails', { configurable: true, value: getScreenDetails });
    const view = await act(async () => render(<StepRenderer />));
    await waitFor(() => expect(view.getByText(/Multiple displays detected/)).toBeDefined());
    expect(view.getByText('This recorded task is locked until you share an entire monitor.')).toBeDefined();
    expect(getScreenDetails).not.toHaveBeenCalled();
    view.unmount();
    Reflect.deleteProperty(window.screen, 'isExtended');
  });

  test('captures display status for consecutive instances of the same component', async () => {
    gamepadMocks.requireEntireScreen = true;
    mockCurrentComponent = 'task';
    mockCurrentIdentifier = 'task_0';
    const view = await act(async () => render(<StepRenderer />));
    await waitFor(() => expect(gamepadMocks.events?.current.filter((event) => event[1] === 'displaystatus')).toHaveLength(1));

    mockCurrentIdentifier = 'task_1';
    await act(async () => view.rerender(<StepRenderer />));
    await waitFor(() => expect(gamepadMocks.events?.current.filter((event) => event[1] === 'displaystatus')).toHaveLength(2));
  });

  test('records unknown display status when the browser does not expose display detection', async () => {
    gamepadMocks.requireEntireScreen = true;
    mockCurrentComponent = 'task';
    mockCurrentIdentifier = 'task_0';
    const view = await act(async () => render(<StepRenderer />));

    expect(gamepadMocks.events?.current.filter((event) => event[1] === 'displaystatus')).toEqual([
      [expect.any(Number), 'displaystatus', 'unknown'],
    ]);
    view.unmount();
  });

  test.each(['audio', 'webcam'] as const)('offers monitor sharing on a reloaded %s-only task', async (modality) => {
    gamepadMocks.requireEntireScreen = true;
    gamepadMocks.componentRecordScreen = false;
    gamepadMocks.componentRecordAudio = modality === 'audio';
    gamepadMocks.componentRecordWebcam = modality === 'webcam';
    mockCurrentComponent = 'task';

    const view = await act(async () => render(<StepRenderer />));
    expect(view.queryByTestId('outlet')).toBeNull();
    fireEvent.click(view.getByRole('button', { name: 'Share entire monitor' }));
    expect(gamepadMocks.startCapture).toHaveBeenCalledOnce();
    view.unmount();
  });

  test.each(['audio', 'webcam'] as const)('records activity and display status for %s-only tasks without a screen recorder', async (modality) => {
    gamepadMocks.requireEntireScreen = true;
    gamepadMocks.captureActive = true;
    gamepadMocks.screenRecordingActive = false;
    gamepadMocks.componentRecordScreen = false;
    gamepadMocks.componentRecordAudio = modality === 'audio';
    gamepadMocks.componentRecordWebcam = modality === 'webcam';
    mockCurrentComponent = 'task';
    setScreenExtended(true);

    const view = await act(async () => render(<StepRenderer />));
    window.dispatchEvent(new Event('blur'));

    expect(gamepadMocks.events?.current).toContainEqual([expect.any(Number), 'studyactivity', 'focus-lost']);
    expect(gamepadMocks.events?.current).toContainEqual([expect.any(Number), 'displaystatus', 'multiple']);
    view.unmount();
  });

  test('drains a chunk manifest save before participant finalization', async () => {
    gamepadMocks.requireEntireScreen = true;
    gamepadMocks.captureActive = true;
    mockCurrentComponent = 'task';
    mockCurrentIdentifier = 'task_0';
    mockAnswers.task_0 = {
      ...mockAnswers.task_0,
      assetIdentifier: 'task_0__screen_visit',
      recordingSegments: ['task_0__screen_visit'],
    } as typeof mockAnswers.task_0;
    const view = await act(async () => render(<StepRenderer />));
    expect(mockParticipantFinalizationBarrier).toBeTypeOf('function');
    mockSaveInterruptedAnswers.mockClear();

    let finishRecorderStop!: () => void;
    gamepadMocks.stopRecording.mockImplementationOnce(() => new Promise<void>((resolve) => {
      finishRecorderStop = resolve;
    }));
    let resolveManifestSave!: () => void;
    mockSaveInterruptedAnswers.mockImplementationOnce(() => new Promise<void>((resolve) => {
      resolveManifestSave = resolve;
    }));
    mockFlushPendingAssetUploads.mockImplementationOnce(async () => {
      gamepadMocks.chunkKeys = ['task_0__screen_visit__chunk_0'];
      gamepadMocks.chunkUpdateListener?.('task_0__screen_visit', gamepadMocks.chunkKeys);
    });

    let barrierComplete = false;
    const finalization = mockParticipantFinalizationBarrier!().then(() => { barrierComplete = true; });
    await waitFor(() => expect(gamepadMocks.stopRecording).toHaveBeenCalledOnce());
    expect(mockFlushPendingAssetUploads).not.toHaveBeenCalled();
    expect(barrierComplete).toBe(false);

    await act(async () => { finishRecorderStop(); });
    await waitFor(() => expect(mockFlushPendingAssetUploads).toHaveBeenCalledOnce());
    await waitFor(() => expect(mockSaveInterruptedAnswers).toHaveBeenCalledOnce());
    expect(barrierComplete).toBe(false);
    expect(mockFlushPendingParticipantData).not.toHaveBeenCalled();

    await act(async () => { resolveManifestSave(); });
    await finalization;
    expect(barrierComplete).toBe(true);
    expect(mockFlushPendingParticipantData).toHaveBeenCalledOnce();
    view.unmount();
  });

  test('lets storage report failed media uploads as a structured finalization result', async () => {
    gamepadMocks.requireEntireScreen = true;
    gamepadMocks.captureActive = true;
    mockCurrentComponent = 'task';
    mockCurrentIdentifier = 'task_0';
    const view = await act(async () => render(<StepRenderer />));
    await waitFor(() => expect(mockParticipantFinalizationBarrier).toBeTypeOf('function'));
    mockFlushPendingAssetUploads.mockRejectedValueOnce(new Error('screen chunk upload failed'));

    await expect(mockParticipantFinalizationBarrier!()).resolves.toBeUndefined();

    expect(mockFlushPendingParticipantData).toHaveBeenCalledOnce();
    view.unmount();
  });

  test('checkpoints the current segment and observations on pagehide', async () => {
    gamepadMocks.requireEntireScreen = true;
    gamepadMocks.captureActive = true;
    gamepadMocks.recordingStartTime = 120;
    mockCurrentComponent = 'task';
    const view = await act(async () => render(<StepRenderer />));
    gamepadMocks.events?.current.push([150, 'studyactivity', 'pointer-left']);

    await act(async () => { fireEvent(window, new Event('pagehide')); });
    expect(mockSaveInterruptedAnswers).toHaveBeenCalledWith(expect.objectContaining({
      task_0: expect.objectContaining({
        assetIdentifier: 'task_0__screen_visit',
        recordingSegments: ['task_0__screen_visit'],
        recordingSegmentRanges: [expect.objectContaining({ assetIdentifier: 'task_0__screen_visit' })],
        windowEvents: expect.arrayContaining([[150, 'studyactivity', 'pointer-left']]),
      }),
    }));
    view.unmount();
  });

  test('interruption of an accepted global-store revisit preserves its response asset and records the fresh segment', async () => {
    gamepadMocks.requireEntireScreen = true;
    gamepadMocks.globalStoreEnabled = true;
    gamepadMocks.interrupted = true;
    mockAnswers.task_0 = {
      ...mockAnswers.task_0,
      assetIdentifier: 'accepted-recording',
      answer: { response: 'accepted' },
      startTime: 100,
      endTime: 400,
      recordingSegments: ['accepted-recording'],
    } as typeof mockAnswers.task_0;
    mockCurrentComponent = 'task';
    mockCurrentIdentifier = 'task_0';

    const view = await act(async () => render(<StepRenderer />));

    await waitFor(() => expect(mockSaveInterruptedAnswers).toHaveBeenCalledWith(expect.objectContaining({
      task_0: expect.objectContaining({
        assetIdentifier: 'accepted-recording',
        answer: { response: 'accepted' },
        endTime: 400,
        recordingSegments: expect.arrayContaining(['accepted-recording', 'task_0__screen_visit']),
        recordingSegmentTimes: expect.objectContaining({ task_0__screen_visit: expect.any(Object) }),
      }),
    })));
    view.unmount();
  });

  test('waits for stopped recording uploads before saving interruption chunks and persists later retry updates', async () => {
    gamepadMocks.requireEntireScreen = true;
    gamepadMocks.interrupted = true;
    mockCurrentComponent = 'task';
    mockCurrentIdentifier = 'task_0';
    let finishRecorderStop!: () => void;
    gamepadMocks.stopRecording.mockImplementationOnce(() => new Promise<void>((resolve) => {
      finishRecorderStop = resolve;
    }));
    const view = await act(async () => render(<StepRenderer />));
    await waitFor(() => expect(gamepadMocks.stopRecording).toHaveBeenCalledOnce());
    expect(mockSaveInterruptedAnswers).not.toHaveBeenCalled();

    gamepadMocks.chunkKeys = ['task_0__screen_visit__chunk_0'];
    await act(async () => { finishRecorderStop(); });
    await waitFor(() => expect(mockSaveInterruptedAnswers).toHaveBeenCalledWith(expect.objectContaining({
      task_0: expect.objectContaining({
        recordingChunkKeys: { task_0__screen_visit: ['task_0__screen_visit__chunk_0'] },
      }),
    })));

    const laterEvent: [number, 'displaystatus', string] = [250, 'displaystatus', 'single'];
    mockAnswers.task_0 = {
      ...mockAnswers.task_0,
      answer: { response: 'accepted after reshare' },
      startTime: 200,
      endTime: 260,
      recordingSegments: ['task_0__screen_visit', 'accepted-segment'],
      recordingSegmentRanges: [
        { assetIdentifier: 'task_0__screen_visit', startTime: 120, endTime: 180 },
        { assetIdentifier: 'accepted-segment', startTime: 200, endTime: 260 },
      ],
      windowEvents: [laterEvent],
    } as unknown as typeof mockAnswers.task_0;
    gamepadMocks.chunkKeys = ['task_0__screen_visit__chunk_0', 'task_0__screen_visit__chunk_1'];
    await act(async () => { gamepadMocks.chunkUpdateListener?.('task_0__screen_visit', gamepadMocks.chunkKeys); });
    await waitFor(() => expect(mockSaveInterruptedAnswers).toHaveBeenLastCalledWith(expect.objectContaining({
      task_0: expect.objectContaining({
        answer: { response: 'accepted after reshare' },
        endTime: 260,
        recordingSegments: expect.arrayContaining(['accepted-segment', 'task_0__screen_visit']),
        recordingSegmentRanges: expect.arrayContaining([
          expect.objectContaining({ assetIdentifier: 'accepted-segment' }),
          expect.objectContaining({ assetIdentifier: 'task_0__screen_visit' }),
        ]),
        windowEvents: expect.arrayContaining([laterEvent]),
        recordingChunkKeys: { task_0__screen_visit: gamepadMocks.chunkKeys },
      }),
    })));
    view.unmount();
  });

  test('persists chunk uploads that finish after a completed answer was saved', async () => {
    gamepadMocks.requireEntireScreen = true;
    gamepadMocks.captureActive = true;
    mockCurrentComponent = 'task';
    mockCurrentIdentifier = 'task_0';
    mockAnswers.task_0 = {
      ...mockAnswers.task_0,
      assetIdentifier: 'task_0__screen_visit',
      answer: { response: 'completed' },
      endTime: 250,
      recordingSegments: ['task_0__screen_visit'],
      recordingChunkKeys: {},
    } as typeof mockAnswers.task_0;
    const view = await act(async () => render(<StepRenderer />));
    await waitFor(() => expect(gamepadMocks.chunkUpdateListener).toBeTypeOf('function'));
    await waitFor(() => expect(mockSaveInterruptedAnswers).toHaveBeenCalled());
    mockSaveInterruptedAnswers.mockClear();

    gamepadMocks.chunkKeys = ['task_0__screen_visit__chunk_0'];
    await act(async () => { gamepadMocks.chunkUpdateListener?.('task_0__screen_visit', gamepadMocks.chunkKeys); });

    await waitFor(() => expect(mockSaveInterruptedAnswers).toHaveBeenCalledWith(expect.objectContaining({
      task_0: expect.objectContaining({
        answer: { response: 'completed' },
        endTime: 250,
        recordingChunkKeys: { task_0__screen_visit: ['task_0__screen_visit__chunk_0'] },
      }),
    })));
    view.unmount();
  });

  test('keeps destination trial events out of a delayed outgoing interruption save', async () => {
    gamepadMocks.requireEntireScreen = true;
    gamepadMocks.interrupted = true;
    mockCurrentComponent = 'task';
    mockCurrentIdentifier = 'task_0';
    let finishRecorderStop!: () => void;
    gamepadMocks.stopRecording.mockImplementationOnce(() => new Promise<void>((resolve) => {
      finishRecorderStop = resolve;
    }));
    Reflect.set(mockAnswers, 'task_1', {
      ...mockAnswers.task_0,
      identifier: 'task_1',
      trialOrder: '2',
    });
    const view = await act(async () => render(<StepRenderer />));
    await waitFor(() => expect(gamepadMocks.stopRecording).toHaveBeenCalledOnce());

    mockCurrentIdentifier = 'task_1';
    gamepadMocks.assetSegments = ['task_1__screen_visit'];
    gamepadMocks.interrupted = false;
    await act(async () => view.rerender(<StepRenderer />));
    const destinationEvent: [number, 'studyactivity', 'visible'] = [300, 'studyactivity', 'visible'];
    gamepadMocks.events?.current.push(destinationEvent);
    await act(async () => { finishRecorderStop(); });

    await waitFor(() => expect(mockSaveInterruptedAnswers).toHaveBeenCalledWith(expect.objectContaining({
      task_0: expect.objectContaining({
        windowEvents: expect.not.arrayContaining([destinationEvent]),
      }),
    })));
    expect(gamepadMocks.events?.current).toContain(destinationEvent);
    view.unmount();
    Reflect.deleteProperty(mockAnswers, 'task_1');
  });

  test.each(['audio', 'webcam'] as const)('finalizes a fresh dynamic %s-only visit before Previous', async (modality) => {
    gamepadMocks.requireEntireScreen = true;
    gamepadMocks.componentRecordScreen = false;
    gamepadMocks.componentRecordAudio = modality === 'audio';
    gamepadMocks.componentRecordWebcam = modality === 'webcam';
    gamepadMocks.recordingStartTime = 120;
    mockCurrentComponent = 'task';
    mockCurrentIdentifier = 'dynamic_0_task_0';
    Reflect.set(mockAnswers, mockCurrentIdentifier, {
      ...mockAnswers.task_0,
      identifier: mockCurrentIdentifier,
      trialOrder: '0_0',
      answer: {},
      endTime: -1,
    });
    const view = await act(async () => render(<StepRenderer />));
    await waitFor(() => expect(gamepadMocks.events?.finalizeVisit).toBeTypeOf('function'));

    let saved = false;
    await act(async () => { saved = await gamepadMocks.events?.finalizeVisit?.() ?? false; });

    expect(saved).toBe(true);
    expect(mockSaveInterruptedAnswers).toHaveBeenLastCalledWith(expect.objectContaining({
      [mockCurrentIdentifier]: expect.objectContaining({
        recordingSegments: expect.arrayContaining(['task_0__screen_visit']),
        recordingSegmentRanges: [],
        recordingEndTime: expect.any(Number),
      }),
    }));
    view.unmount();
    Reflect.deleteProperty(mockAnswers, mockCurrentIdentifier);
  });

  test.each(['audio', 'webcam'] as const)('saves an interrupted whole-screen %s-only visit before allowing close', async (modality) => {
    gamepadMocks.requireEntireScreen = true;
    gamepadMocks.componentRecordScreen = false;
    gamepadMocks.componentRecordAudio = modality === 'audio';
    gamepadMocks.componentRecordWebcam = modality === 'webcam';
    gamepadMocks.recordingStartTime = 120;
    mockCurrentComponent = 'task';
    const interruptedIdentifier = `task_${modality}`;
    mockCurrentIdentifier = interruptedIdentifier;
    Reflect.set(mockAnswers, interruptedIdentifier, {
      ...mockAnswers.task_0,
      identifier: mockCurrentIdentifier,
      answer: {},
      endTime: -1,
    });

    const view = await act(async () => render(<StepRenderer />));
    gamepadMocks.interrupted = true;
    await act(async () => view.rerender(<StepRenderer />));

    await waitFor(() => expect(view.getByTestId('recording-rejection').textContent).toBe('safe-to-close'));
    expect(mockFlushPendingAssetUploads).toHaveBeenCalledOnce();
    expect(mockFlushPendingParticipantData).toHaveBeenCalledOnce();
    expect(mockSaveInterruptedAnswers).toHaveBeenLastCalledWith(expect.objectContaining({
      [interruptedIdentifier]: expect.objectContaining({
        endTime: -1,
        windowEvents: expect.arrayContaining([[expect.any(Number), 'captureinterrupted', 'screen']]),
      }),
    }));
    view.unmount();
    Reflect.deleteProperty(mockAnswers, interruptedIdentifier);
  });

  test('finalizes the outgoing recording, range, chunks, and events before previous navigation', async () => {
    gamepadMocks.requireEntireScreen = true;
    gamepadMocks.captureActive = true;
    gamepadMocks.recordingStartTime = 120;
    gamepadMocks.stopRecording.mockImplementationOnce(async () => { gamepadMocks.recordingStopTime = 180; });
    gamepadMocks.chunkKeys = ['task_0__screen_visit__chunk_3'];
    mockCurrentComponent = 'task';
    mockCurrentIdentifier = 'task_0';
    const view = await act(async () => render(<StepRenderer />));
    gamepadMocks.events?.current.push([150, 'studyactivity', 'pointer-left']);

    let saved = false;
    await act(async () => { saved = await gamepadMocks.events?.finalizeVisit?.() ?? false; });

    expect(saved).toBe(true);
    expect(gamepadMocks.stopRecording).toHaveBeenCalledOnce();
    expect(mockSaveInterruptedAnswers).toHaveBeenLastCalledWith(expect.objectContaining({
      task_0: expect.objectContaining({
        recordingChunkKeys: { task_0__screen_visit: ['task_0__screen_visit__chunk_3'] },
        recordingSegmentRanges: [expect.objectContaining({
          assetIdentifier: 'task_0__screen_visit', startTime: 120, endTime: 180,
        })],
        windowEvents: expect.arrayContaining([[150, 'studyactivity', 'pointer-left']]),
      }),
    }));
    expect(gamepadMocks.events?.submissionFinalizing).toBe(false);
    view.unmount();
  });

  test('does not complete Previous finalization while media uploads are unavailable', async () => {
    gamepadMocks.requireEntireScreen = true;
    gamepadMocks.captureActive = true;
    mockCurrentComponent = 'task';
    mockCurrentIdentifier = 'task_0';
    const view = await act(async () => render(<StepRenderer />));
    await waitFor(() => expect(mockSaveInterruptedAnswers).toHaveBeenCalled());
    mockFlushPendingAssetUploads.mockRejectedValueOnce(new Error('media upload failed'));

    let saved = true;
    await act(async () => { saved = await gamepadMocks.events?.finalizeVisit?.() ?? true; });

    expect(saved).toBe(false);
    expect(mockFlushPendingAssetUploads).toHaveBeenCalledOnce();
    expect(mockSetAlertModal).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('could not be fully saved'),
      title: 'Failed to Save Response',
    }));
    expect(gamepadMocks.events?.submissionFinalizing).toBe(false);
    view.unmount();
  });

  test('disables task and sidebar interaction while Previous finalization is pending', async () => {
    gamepadMocks.requireEntireScreen = true;
    gamepadMocks.captureActive = true;
    mockCurrentComponent = 'task';
    mockCurrentIdentifier = 'task_0';
    let finishStopping!: () => void;
    gamepadMocks.stopRecording.mockImplementationOnce(() => new Promise<void>((resolve) => {
      finishStopping = resolve;
    }));
    const view = await act(async () => render(<StepRenderer />));
    await waitFor(() => expect(gamepadMocks.events?.finalizeVisit).toBeTypeOf('function'));

    let finalizePromise!: Promise<boolean>;
    act(() => { finalizePromise = gamepadMocks.events!.finalizeVisit!(); });
    await waitFor(() => {
      expect(view.getByTestId('app-navbar').hasAttribute('inert')).toBe(true);
      expect(view.getByTestId('outlet').parentElement?.hasAttribute('inert')).toBe(true);
    });

    await act(async () => {
      finishStopping();
      await finalizePromise;
    });

    expect(view.getByTestId('app-navbar').hasAttribute('inert')).toBe(false);
    expect(view.getByTestId('outlet').parentElement?.hasAttribute('inert')).toBe(false);
    view.unmount();
  });

  test('restarts recording on a fresh segment when previous finalization fails', async () => {
    gamepadMocks.requireEntireScreen = true;
    gamepadMocks.captureActive = true;
    gamepadMocks.recordingStartTime = 120;
    mockCurrentComponent = 'task';
    mockCurrentIdentifier = 'task_0';
    const view = await act(async () => render(<StepRenderer />));
    await waitFor(() => expect(mockSaveInterruptedAnswers).toHaveBeenCalled());
    mockSaveInterruptedAnswers.mockRejectedValueOnce(new Error('checkpoint failed'));
    gamepadMocks.simulateRecorderEffect = true;
    gamepadMocks.lastRecordingAsset = 'task_0__screen_visit';
    gamepadMocks.events?.current.push([150, 'studyactivity', 'pointer-left']);

    let saved = true;
    await act(async () => { saved = await gamepadMocks.events?.finalizeVisit?.() ?? true; });

    expect(saved).toBe(false);
    expect(gamepadMocks.rotateAssetIdentifier).toHaveBeenCalledOnce();
    await waitFor(() => expect(gamepadMocks.startRecording).toHaveBeenCalledExactlyOnceWith('task_0__screen_retry'));
    await waitFor(() => expect(mockSaveInterruptedAnswers).toHaveBeenLastCalledWith(expect.objectContaining({
      task_0: expect.objectContaining({
        recordingSegments: expect.arrayContaining(['task_0__screen_retry']),
        windowEvents: expect.arrayContaining([[150, 'studyactivity', 'pointer-left']]),
      }),
    })));
    view.unmount();
  });

  test('restarts recording when the post-checkpoint Previous archive save fails', async () => {
    gamepadMocks.requireEntireScreen = true;
    gamepadMocks.captureActive = true;
    gamepadMocks.recordingStartTime = 120;
    gamepadMocks.simulateRecorderEffect = true;
    gamepadMocks.lastRecordingAsset = 'task_0__screen_visit';
    mockCurrentComponent = 'task';
    mockCurrentIdentifier = 'task_0';
    const view = await act(async () => render(<StepRenderer />));
    await waitFor(() => expect(mockSaveInterruptedAnswers).toHaveBeenCalled());
    const failArchiveSave = vi.fn(async () => { throw new Error('archive save failed'); });

    let saved = true;
    await act(async () => { saved = await gamepadMocks.events?.finalizeVisit?.(failArchiveSave) ?? true; });

    expect(saved).toBe(false);
    expect(failArchiveSave).toHaveBeenCalledOnce();
    expect(gamepadMocks.rotateAssetIdentifier).toHaveBeenCalledOnce();
    await waitFor(() => expect(gamepadMocks.startRecording).toHaveBeenCalledExactlyOnceWith('task_0__screen_retry'));
    view.unmount();
  });

  test('checkpoints a global-store revisit without replacing its accepted answer', async () => {
    gamepadMocks.requireEntireScreen = true;
    gamepadMocks.globalStoreEnabled = true;
    gamepadMocks.captureActive = true;
    gamepadMocks.recordingStartTime = 120;
    mockAnswers.task_0 = {
      ...mockAnswers.task_0,
      assetIdentifier: 'accepted-recording',
      answer: { response: 'accepted' },
      endTime: 400,
      recordingSegments: ['accepted-recording'],
      recordingSegmentTimes: {
        task_0__screen_visit: { startTime: 90, endTime: 150 },
      },
    } as typeof mockAnswers.task_0;
    mockCurrentComponent = 'task';
    mockCurrentIdentifier = 'task_0';
    const view = await act(async () => render(<StepRenderer />));
    gamepadMocks.events?.current.push([250, 'studyactivity', 'focus-lost']);

    await act(async () => { fireEvent(window, new Event('pagehide')); });
    expect(mockSaveInterruptedAnswers).toHaveBeenCalledWith(expect.objectContaining({
      task_0: expect.objectContaining({
        assetIdentifier: 'accepted-recording',
        answer: { response: 'accepted' },
        endTime: 400,
        recordingSegments: expect.arrayContaining(['accepted-recording', 'task_0__screen_visit']),
        recordingSegmentTimes: expect.objectContaining({
          task_0__screen_visit: expect.objectContaining({ startTime: 120 }),
        }),
        recordingSegmentRanges: expect.arrayContaining([expect.objectContaining({ assetIdentifier: 'task_0__screen_visit' })]),
        windowEvents: expect.arrayContaining([[250, 'studyactivity', 'focus-lost']]),
      }),
    }));
    view.unmount();
  });

  test('checkpoints accepted non-global revisits without changing their accepted response', async () => {
    gamepadMocks.requireEntireScreen = true;
    gamepadMocks.captureActive = true;
    gamepadMocks.recordingStartTime = 120;
    mockAnswers.task_0 = {
      ...mockAnswers.task_0,
      assetIdentifier: 'accepted-recording',
      answer: { response: 'accepted' },
      endTime: 400,
      recordingSegments: ['accepted-recording'],
      recordingSegmentTimes: {
        task_0__screen_visit: { startTime: 90, endTime: 150 },
      },
    } as typeof mockAnswers.task_0;
    mockCurrentComponent = 'task';
    mockCurrentIdentifier = 'task_0';
    const view = await act(async () => render(<StepRenderer />));
    gamepadMocks.events?.current.push([250, 'studyactivity', 'focus-lost']);

    await act(async () => { fireEvent(window, new Event('pagehide')); });
    expect(mockSaveInterruptedAnswers).toHaveBeenCalledWith(expect.objectContaining({
      task_0: expect.objectContaining({
        assetIdentifier: 'task_0__screen_visit',
        answer: { response: 'accepted' },
        endTime: 400,
        recordingSegments: expect.arrayContaining(['accepted-recording', 'task_0__screen_visit']),
        recordingSegmentTimes: expect.objectContaining({
          task_0__screen_visit: expect.objectContaining({ startTime: 120 }),
        }),
        recordingSegmentRanges: expect.arrayContaining([expect.objectContaining({ assetIdentifier: 'task_0__screen_visit' })]),
        windowEvents: expect.arrayContaining([[250, 'studyactivity', 'focus-lost']]),
      }),
    }));
    view.unmount();
  });

  test('late checkpoints do not dispatch stale answers or remove the next task events', async () => {
    let resolveCheckpoint!: () => void;
    mockSaveInterruptedAnswers.mockImplementationOnce(() => new Promise<void>((resolve) => { resolveCheckpoint = resolve; }));
    gamepadMocks.requireEntireScreen = true;
    gamepadMocks.captureActive = true;
    mockCurrentComponent = 'task';
    mockCurrentIdentifier = 'task_0';
    const view = await act(async () => render(<StepRenderer />));
    await waitFor(() => expect(resolveCheckpoint).toBeTypeOf('function'));

    mockCurrentIdentifier = 'task_1';
    await act(async () => view.rerender(<StepRenderer />));
    const nextTaskEvent: [number, 'studyactivity', 'focus-lost'] = [500, 'studyactivity', 'focus-lost'];
    gamepadMocks.events?.current.push(nextTaskEvent);
    await act(async () => { resolveCheckpoint(); await Promise.resolve(); });

    expect(gamepadMocks.events?.current).toContainEqual(nextTaskEvent);
    expect(mockDispatch).not.toHaveBeenCalledWith(expect.objectContaining({
      type: 'saveTrialAnswer',
      payload: expect.objectContaining({ identifier: 'task_0' }),
    }));
    view.unmount();
  });

  test('a late checkpoint preserves newer interruption ranges and chunks', async () => {
    let resolveCheckpoint!: () => void;
    mockSaveInterruptedAnswers.mockImplementationOnce(() => new Promise<void>((resolve) => { resolveCheckpoint = resolve; }));
    gamepadMocks.requireEntireScreen = true;
    gamepadMocks.captureActive = true;
    mockCurrentComponent = 'task';
    mockCurrentIdentifier = 'task_0';
    const view = await act(async () => render(<StepRenderer />));
    await waitFor(() => expect(resolveCheckpoint).toBeTypeOf('function'));

    const newerRecordingEndTime = Date.now() + 1000;
    mockAnswers.task_0 = {
      ...mockAnswers.task_0,
      recordingEndTime: newerRecordingEndTime,
      recordingSegmentRanges: [{ assetIdentifier: 'task_0__screen_visit', startTime: 120, endTime: newerRecordingEndTime }],
      recordingChunkKeys: { task_0__screen_visit: ['chunk-0', 'chunk-1'] },
      windowEvents: [[newerRecordingEndTime, 'captureinterrupted', 'screen']],
    } as unknown as typeof mockAnswers.task_0;
    await act(async () => view.rerender(<StepRenderer />));
    await act(async () => { resolveCheckpoint(); await Promise.resolve(); });

    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'saveTrialAnswer',
      payload: expect.objectContaining({
        recordingEndTime: newerRecordingEndTime,
        recordingSegmentRanges: [expect.objectContaining({ endTime: newerRecordingEndTime })],
        recordingChunkKeys: { task_0__screen_visit: ['chunk-0', 'chunk-1'] },
        windowEvents: expect.arrayContaining([[newerRecordingEndTime, 'captureinterrupted', 'screen']]),
      }),
    }));
    view.unmount();
  });

  test('persists interrupted whole-screen observations without completing the task', async () => {
    gamepadMocks.requireEntireScreen = true;
    gamepadMocks.recordingStartTime = 120;
    gamepadMocks.recordingStopTime = 180;
    mockCurrentComponent = 'task';
    mockAnswers.task_0 = {
      ...mockAnswers.task_0,
      recordingSegmentRanges: [{ assetIdentifier: 'task_0__screen_visit', startTime: 120, endTime: 150 }],
      recordingSegmentTimes: { task_0__screen_visit: { startTime: 120, endTime: 150 } },
    } as typeof mockAnswers.task_0;
    const view = await act(async () => render(<StepRenderer />));
    gamepadMocks.events?.current.push([150, 'studyactivity', 'pointer-left']);
    gamepadMocks.interrupted = true;
    await act(async () => view.rerender(<StepRenderer />));

    expect(mockSaveInterruptedAnswers).toHaveBeenCalledWith(expect.objectContaining({
      task_0: expect.objectContaining({
        endTime: -1,
        answer: {},
        assetIdentifier: 'task_0__screen_visit',
        recordingSegments: ['task_0__screen_visit'],
        recordingSegmentRanges: [expect.objectContaining({ startTime: 120, endTime: 180 })],
        recordingSegmentTimes: { task_0__screen_visit: { startTime: 120, endTime: 180 } },
        windowEvents: expect.arrayContaining([[150, 'studyactivity', 'pointer-left']]),
      }),
    }));
  });

  test('keeps the interruption page in a saving state until the answer write is flushed', async () => {
    let resolveStop!: () => void;
    let resolveFlush!: () => void;
    gamepadMocks.requireEntireScreen = true;
    mockCurrentComponent = 'task';
    mockCurrentIdentifier = 'task_0';
    gamepadMocks.stopRecording.mockImplementationOnce(() => new Promise<void>((resolve) => { resolveStop = resolve; }));
    mockFlushPendingParticipantData.mockImplementationOnce(() => new Promise<void>((resolve) => { resolveFlush = resolve; }));

    const view = await act(async () => render(<StepRenderer />));
    gamepadMocks.interrupted = true;
    await act(async () => view.rerender(<StepRenderer />));

    expect(view.getByTestId('recording-rejection').textContent).toBe('saving');
    expect(mockFlushPendingParticipantData).not.toHaveBeenCalled();

    await act(async () => { resolveStop(); await Promise.resolve(); });
    await waitFor(() => expect(mockFlushPendingParticipantData).toHaveBeenCalledTimes(1));
    expect(view.getByTestId('recording-rejection').textContent).toBe('saving');

    await act(async () => { resolveFlush(); await Promise.resolve(); });
    await waitFor(() => expect(view.getByTestId('recording-rejection').textContent).toBe('safe-to-close'));
    view.unmount();
  });

  test('does not allow close after a failed media upload until retry confirms media durability', async () => {
    gamepadMocks.requireEntireScreen = true;
    mockCurrentComponent = 'task';
    mockCurrentIdentifier = 'task_0';
    mockFlushPendingAssetUploads.mockRejectedValueOnce(new Error('recording upload failed'));

    const view = await act(async () => render(<StepRenderer />));
    gamepadMocks.interrupted = true;
    await act(async () => view.rerender(<StepRenderer />));
    await waitFor(() => expect(mockFlushPendingAssetUploads).toHaveBeenCalledTimes(1));

    expect(view.getByTestId('recording-rejection').textContent).toBe('saving');
    expect(mockSaveInterruptedAnswers).not.toHaveBeenCalled();

    await act(async () => {
      window.dispatchEvent(new Event('revisit-storage-retry-success'));
      await Promise.resolve();
    });
    await waitFor(() => expect(view.getByTestId('recording-rejection').textContent).toBe('safe-to-close'));
    expect(mockFlushPendingAssetUploads).toHaveBeenCalledTimes(2);
    view.unmount();
  });

  test('finishes interruption after a failed participant write is retried', async () => {
    gamepadMocks.requireEntireScreen = true;
    mockCurrentComponent = 'task';
    mockCurrentIdentifier = 'task_0';
    mockFlushPendingParticipantData.mockRejectedValueOnce(new Error('participant write failed'));

    const view = await act(async () => render(<StepRenderer />));
    gamepadMocks.interrupted = true;
    await act(async () => view.rerender(<StepRenderer />));
    await waitFor(() => expect(mockFlushPendingParticipantData).toHaveBeenCalledTimes(1));
    expect(view.getByTestId('recording-rejection').textContent).toBe('saving');

    await act(async () => {
      window.dispatchEvent(new Event('revisit-storage-retry-success'));
      await Promise.resolve();
    });
    await waitFor(() => expect(view.getByTestId('recording-rejection').textContent).toBe('safe-to-close'));
    expect(mockFlushPendingParticipantData).toHaveBeenCalledTimes(2);
    view.unmount();
  });

  test('preserves the normal stopped message when full-screen recording is not required', async () => {
    mockCurrentComponent = 'task';
    gamepadMocks.interrupted = true;
    const view = await act(async () => render(<StepRenderer />));

    expect(view.getByTestId('recording-rejection').textContent).toBe('safe-to-close');
    expect(mockFlushPendingAssetUploads).not.toHaveBeenCalled();
    view.unmount();
  });

  test('keeps the observation checkpoint timer stable and reads the latest answer', async () => {
    gamepadMocks.requireEntireScreen = true;
    gamepadMocks.captureActive = true;
    mockCurrentComponent = 'task';
    mockCurrentIdentifier = 'task_0';
    const setIntervalSpy = vi.spyOn(window, 'setInterval');
    const view = await act(async () => render(<StepRenderer />));
    const checkpointInterval = setIntervalSpy.mock.calls.find(([, delay]) => delay === 4000);
    const checkpointIntervalCount = setIntervalSpy.mock.calls.filter(([, delay]) => delay === 4000).length;
    expect(checkpointInterval).toBeDefined();

    gamepadMocks.answersOverride = {
      ...mockAnswers,
      task_0: { ...mockAnswers.task_0, answer: { response: 'latest' } },
    };
    await act(async () => view.rerender(<StepRenderer />));

    expect(setIntervalSpy.mock.calls.filter(([, delay]) => delay === 4000)).toHaveLength(checkpointIntervalCount);
    const runCheckpoint = checkpointInterval?.[0] as () => void;
    await act(async () => { runCheckpoint(); await Promise.resolve(); });
    await waitFor(() => expect(mockSaveInterruptedAnswers).toHaveBeenLastCalledWith(expect.objectContaining({
      task_0: expect.objectContaining({ answer: { response: 'latest' } }),
    })));
    view.unmount();
  });

  test('preserves an accepted response when a global-store revisit is interrupted', async () => {
    gamepadMocks.requireEntireScreen = true;
    gamepadMocks.globalStoreEnabled = true;
    gamepadMocks.interrupted = true;
    mockCurrentComponent = 'task';
    mockCurrentIdentifier = 'task_0';
    mockAnswers.task_0 = {
      ...mockAnswers.task_0,
      answer: { response: 'accepted' },
      startTime: 100,
      endTime: 200,
    } as typeof mockAnswers.task_0;
    const view = await act(async () => render(<StepRenderer />));

    await waitFor(() => expect(mockSaveInterruptedAnswers).toHaveBeenCalledWith(expect.objectContaining({
      task_0: expect.objectContaining({
        answer: { response: 'accepted' },
        startTime: 100,
        endTime: 200,
        recordingEndTime: expect.any(Number),
      }),
    })));
    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'saveTrialAnswer',
      payload: expect.objectContaining({ answer: { response: 'accepted' }, endTime: 200 }),
    }));
    view.unmount();
  });

  test('records pointer exits and returns for the Analyst without notifying the participant', async () => {
    gamepadMocks.requireEntireScreen = true;
    const { unmount } = await act(async () => render(<StepRenderer />));

    act(() => fireEvent.pointerOut(window, { relatedTarget: null }));
    expect(gamepadMocks.events?.current).toContainEqual([
      expect.any(Number), 'studyactivity', 'pointer-left',
    ]);
    expect(pdfExportMocks.showNotification).not.toHaveBeenCalledWith(expect.objectContaining({
      title: 'Pointer left study page',
    }));

    act(() => fireEvent.pointerOver(window, { relatedTarget: null }));
    expect(gamepadMocks.events?.current).toContainEqual([
      expect.any(Number), 'studyactivity', 'pointer-entered',
    ]);
    unmount();
  });

  test('captures a quick stick flick and flushes its resting position before saving', async () => {
    gamepadMocks.capture = true;
    const { unmount } = await act(async () => render(<StepRenderer />));
    expect(gamepadMocks.options?.enabled).toBe(true);
    vi.useFakeTimers();

    act(() => {
      gamepadMocks.options?.onAxes?.([0], 1000);
      gamepadMocks.options?.onAxes?.([1], 1020);
      gamepadMocks.options?.onAxes?.([0], 1040);
    });
    expect(gamepadMocks.events?.current.filter((event) => event[1] === 'gamepadaxis')).toHaveLength(2);
    act(() => vi.advanceTimersByTime(100));

    act(() => {
      gamepadMocks.options?.onAxes?.([1], 1200);
      gamepadMocks.options?.onAxes?.([0], 1220);
      gamepadMocks.events?.flushPending?.();
    });

    expect(gamepadMocks.events?.current.filter((event) => event[1] === 'gamepadaxis')).toEqual([
      [1000, 'gamepadaxis', [0]],
      [1020, 'gamepadaxis', [1]],
      [1040, 'gamepadaxis', [0]],
      [1200, 'gamepadaxis', [1]],
      [1220, 'gamepadaxis', [0]],
    ]);
    unmount();
  });

  test('shows the blocking storage modal when a queued participant data write fails', async () => {
    let onParticipantDataWriteError: ((error: Error) => void) | undefined;
    const unsubscribe = vi.fn();
    mockSubscribeToParticipantDataWriteErrors.mockImplementation((callback) => {
      onParticipantDataWriteError = callback;
      return unsubscribe;
    });

    const { unmount } = await act(async () => render(<StepRenderer />));
    act(() => {
      onParticipantDataWriteError?.(new Error('write failed'));
    });

    expect(mockSetAlertModal).toHaveBeenCalledWith({
      show: true,
      message: 'Your response could not be saved because the connection to the server was interrupted. Please check your internet connection, then click Retry. You can continue once your response is fully saved.',
      title: 'Failed to Save Response',
    });
    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'setAlertModal' }));

    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  test('connects a real delayed write failure to the blocking storage modal', async () => {
    const storageEngine = new FailingQueuedWriteStorageEngine();
    await storageEngine.connect();
    await storageEngine.initializeStudyDb('listener-integration-study');
    storageEngine.initializeParticipantForTest({
      participantId: 'participant-1',
      participantConfigHash: 'config-hash',
      sequence: {} as ParticipantData['sequence'],
      participantIndex: 1,
      answers: {},
      searchParams: {},
      metadata: {
        userAgent: 'test-agent',
        resolution: { width: 1920, height: 1080 },
        language: 'en-US',
        ip: '',
      },
      rejected: false,
      participantTags: [],
      stage: 'DEFAULT',
    });
    mockStorageEngine = storageEngine;
    await act(async () => render(<StepRenderer />));
    const answer = {
      identifier: 'intro_0',
      answer: { response: 'saved locally' },
    } as unknown as StoredAnswer;

    storageEngine.failNextWrite();
    await storageEngine.saveAnswers({ intro_0: answer });
    await expect(storageEngine.flushPendingParticipantData()).rejects.toThrow('Queued participant upload failed');

    expect(mockSetAlertModal).toHaveBeenCalledWith(expect.objectContaining({
      show: true,
      title: 'Failed to Save Response',
    }));
    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'setAlertModal' }));
  });

  test('renders the app shell', async () => {
    const { getByTestId } = await act(async () => render(<StepRenderer />));
    expect(getByTestId('app-shell')).toBeDefined();
  });

  test('places the header and main content before the study browser in reading order', async () => {
    mockShowStudyBrowser = true;
    mockDevelopmentModeEnabled = true;
    const { container } = await act(async () => render(<StepRenderer />));
    const header = container.querySelector('[data-testid="app-header"]');
    const aside = container.querySelector('[data-testid="app-aside"]');
    const main = container.querySelector('main');
    const orderedElements = Array.from(container.querySelectorAll('*'));

    expect(header).not.toBeNull();
    expect(aside).not.toBeNull();
    expect(main).not.toBeNull();
    expect(orderedElements.indexOf(header!)).toBeLessThan(orderedElements.indexOf(main!));
    expect(orderedElements.indexOf(main!)).toBeLessThan(orderedElements.indexOf(aside!));
  });

  test('renders outlet (study content area)', async () => {
    const { getAllByTestId } = await act(async () => render(<StepRenderer />));
    expect(getAllByTestId('outlet').length).toBeGreaterThan(0);
  });

  test('exports the current study content', async () => {
    const { getByRole } = await act(async () => render(<StepRenderer />));

    getByRole('button', { name: 'Export PDF' }).click();

    await waitFor(() => expect(pdfExportMocks.saveElement).toHaveBeenCalledTimes(1));
    expect(pdfExportMocks.buildFilename).toHaveBeenCalledWith('intro');
    const [exportRoot, filename] = pdfExportMocks.saveElement.mock.calls[0] as [HTMLElement, string];
    expect(exportRoot.hasAttribute('data-pdf-export-root')).toBe(true);
    expect(exportRoot.querySelector('[data-pdf-export-header]')?.textContent).toContain('Test Study');
    expect(exportRoot.querySelector('[data-pdf-export-header]')?.textContent).toContain('intro');
    expect(filename).toBe('intro_2026-08-20T14-37-09.pdf');
    expect(pdfExportMocks.hideNotification).toHaveBeenCalledWith('notification-id');
    expect(pdfExportMocks.showNotification).toHaveBeenCalledWith(expect.objectContaining({ title: 'PDF exported' }));
  });

  test('waits for the preparing notification to paint before generating the PDF', async () => {
    let finishPaint: (() => void) | undefined;
    pdfExportMocks.waitForNextPaint.mockImplementationOnce(() => new Promise((resolve) => {
      finishPaint = resolve;
    }));
    const { getByRole } = await act(async () => render(<StepRenderer />));

    getByRole('button', { name: 'Export PDF' }).click();

    await waitFor(() => expect(pdfExportMocks.waitForNextPaint).toHaveBeenCalledTimes(1));
    expect(pdfExportMocks.showNotification).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Preparing PDF',
      animated: false,
      autoClose: false,
    }));
    expect(pdfExportMocks.saveElement).not.toHaveBeenCalled();

    await act(async () => finishPaint?.());
    await waitFor(() => expect(pdfExportMocks.saveElement).toHaveBeenCalledTimes(1));
  });

  test('prevents study-page interaction while the PDF snapshot is in progress', async () => {
    let finishExport: (() => void) | undefined;
    pdfExportMocks.saveElement.mockImplementationOnce(() => new Promise((resolve) => {
      finishExport = resolve;
    }));
    const { getByRole, container } = await act(async () => render(<StepRenderer />));
    const exportRoot = container.querySelector<HTMLElement>('[data-pdf-export-root]');

    getByRole('button', { name: 'Export PDF' }).click();

    await waitFor(() => expect(pdfExportMocks.saveElement).toHaveBeenCalledTimes(1));
    expect(exportRoot?.inert).toBe(true);
    expect(exportRoot?.getAttribute('aria-busy')).toBe('true');

    await act(async () => finishExport?.());
    await waitFor(() => expect(exportRoot?.getAttribute('aria-busy')).toBeNull());
    expect(exportRoot?.inert).toBe(false);
  });

  test('offers PDF export when the title bar is hidden', async () => {
    mockShowTitleBar = false;
    const { getByRole, queryByRole } = await act(async () => render(<StepRenderer />));

    expect(getByRole('button', { name: 'Study actions' })).toBeDefined();
    expect(queryByRole('button', { name: 'Export PDF' })).toBeNull();
    getByRole('button', { name: 'Export page as PDF' }).click();

    await waitFor(() => expect(pdfExportMocks.saveElement).toHaveBeenCalledTimes(1));
  });

  test('reports that pages containing external websites cannot be exported', async () => {
    pdfExportMocks.getUnsupportedReason.mockReturnValue(
      'Pages containing external websites cannot currently be exported to PDF.',
    );
    const { getByRole } = await act(async () => render(<StepRenderer />));

    getByRole('button', { name: 'Export PDF' }).click();

    expect(pdfExportMocks.saveElement).not.toHaveBeenCalled();
    expect(pdfExportMocks.showNotification).toHaveBeenCalledWith({
      title: 'PDF export unavailable',
      message: 'Pages containing external websites cannot currently be exported to PDF.',
      color: 'red',
    });
  });

  test('reports a PDF generation failure and allows retrying', async () => {
    pdfExportMocks.saveElement
      .mockRejectedValueOnce(new Error('canvas failed'))
      .mockResolvedValueOnce(undefined);
    const { getByRole } = await act(async () => render(<StepRenderer />));
    const exportButton = getByRole('button', { name: 'Export PDF' });

    exportButton.click();
    await waitFor(() => expect(pdfExportMocks.showNotification).toHaveBeenCalledWith(expect.objectContaining({
      title: 'PDF export failed',
      color: 'red',
    })));
    await waitFor(() => expect((exportButton as HTMLButtonElement).disabled).toBe(false));
    exportButton.click();

    await waitFor(() => expect(pdfExportMocks.saveElement).toHaveBeenCalledTimes(2));
  });

  test('window event listeners fire debounced callbacks', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    await act(async () => render(<StepRenderer />));

    // Verify that event listeners were registered for tracked events
    const registeredEvents = addSpy.mock.calls.map(([event]) => event);
    expect(registeredEvents).toContain('focus');
    expect(registeredEvents).toContain('mousemove');
    expect(registeredEvents).toContain('scroll');

    // Fire each tracked window/document event so the debounce callbacks (which
    // now call through immediately thanks to the lodash.debounce mock) are covered.
    window.dispatchEvent(new Event('focus', { bubbles: true }));
    window.dispatchEvent(new InputEvent('input', { data: 'x' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'a' }));
    window.dispatchEvent(new MouseEvent('mousedown', { clientX: 1, clientY: 2 }));
    window.dispatchEvent(new MouseEvent('mouseup', { clientX: 1, clientY: 2 }));
    window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 3, clientY: 4 }));
    window.dispatchEvent(new Event('scroll'));
    document.dispatchEvent(new Event('visibilitychange'));

    addSpy.mockRestore();
  });

  test('cleanup removes all event listeners on unmount', async () => {
    const { unmount } = await act(async () => render(<StepRenderer />));
    // Unmount triggers the useEffect cleanup which removes all event listeners
    expect(() => act(() => { unmount(); })).not.toThrow();
  });

  test('records mapped arrows from focused response cards and removes the recorder on unmount', async () => {
    const onSelect = vi.fn();
    const { getByRole, unmount } = await act(async () => render(
      <>
        <StepRenderer />
        <KeyMapper options={[{ label: 'Down', value: 'down', key: 'ArrowDown' }]} onSelect={onSelect} />
        <button type="button" role="radio" aria-checked="false">Left</button>
      </>,
    ));
    const card = getByRole('radio', { name: 'Left' });
    card.focus();
    fireEvent.keyDown(card, { key: 'ArrowDown' });

    expect(onSelect).toHaveBeenCalledExactlyOnceWith('down', 'keyboard');
    const events = gamepadMocks.events!.current;
    expect(events.filter((event) => event[1] === 'keydown')).toEqual([
      [expect.any(Number), 'keydown', 'ArrowDown'],
    ]);

    unmount();
    fireEvent.keyDown(document.body, { key: 'ArrowDown' });
    expect(events.filter((event) => event[1] === 'keydown')).toHaveLength(1);
  });

  test('beforeunload listener added when shouldConfirmClose is true', async () => {
    vi.mocked(shouldConfirmTabClose).mockReturnValue(true);
    const addEventSpy = vi.spyOn(window, 'addEventListener');
    const { unmount } = await act(async () => render(<StepRenderer />));
    expect(addEventSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    // Unmount triggers cleanup: removeEventListener
    act(() => { unmount(); });
    addEventSpy.mockRestore();
    vi.mocked(shouldConfirmTabClose).mockReturnValue(false);
  });
});
