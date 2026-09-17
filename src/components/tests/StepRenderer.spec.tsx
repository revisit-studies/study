import { forwardRef, ReactNode } from 'react';
import {
  render, act, cleanup, waitFor,
} from '@testing-library/react';
import {
  describe, expect, test, vi,
  beforeEach, afterEach,
} from 'vitest';
import { StepRenderer } from '../StepRenderer';
import { shouldConfirmTabClose } from '../../utils/closeTabConfirmation';
import { LocalStorageEngine } from '../../storage/engines/LocalStorageEngine';
import { StorageObject, StorageObjectType } from '../../storage/engines/types';
import { ParticipantData } from '../../storage/types';
import { StoredAnswer } from '../../store/types';

// ── mocks ─────────────────────────────────────────────────────────────────────

const mockDispatch = vi.fn();
const mockSetAlertModal = vi.fn((payload) => ({ type: 'setAlertModal', payload }));
const mockSubscribeToParticipantDataWriteErrors = vi.fn();
const pdfExportMocks = vi.hoisted(() => ({
  buildFilename: vi.fn((_componentName: string) => 'intro_2026-08-20T14-37-09.pdf'),
  getUnsupportedReason: vi.fn((_element: HTMLElement): string | undefined => undefined),
  hideNotification: vi.fn((_notificationId: string) => {}),
  saveElement: vi.fn((_element: HTMLElement, _filename: string): Promise<void> => Promise.resolve()),
  showNotification: vi.fn((_notification: unknown) => 'notification-id'),
  waitForNextPaint: vi.fn((): Promise<void> => Promise.resolve()),
}));
let mockShowTitleBar = true;
let mockStorageEngine: Pick<LocalStorageEngine, 'subscribeToParticipantDataWriteErrors'> = {
  subscribeToParticipantDataWriteErrors: mockSubscribeToParticipantDataWriteErrors,
};

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
      disabled={isExportingPdf}
      onClick={() => { onExportPdf?.(); }}
    >
      Export PDF
    </button>
  ),
}));

vi.mock('../interface/AppNavBar', () => ({
  AppNavBar: () => <div data-testid="app-navbar" />,
}));

vi.mock('../interface/HelpModal', () => ({
  HelpModal: () => null,
}));

vi.mock('../interface/AlertModal', () => ({
  AlertModal: () => null,
}));

vi.mock('../interface/ConfigVersionWarningModal', () => ({
  ConfigVersionWarningModal: () => null,
}));

vi.mock('../interface/AnalysisFooter', () => ({
  AnalysisFooter: () => null,
}));

vi.mock('../interface/ScreenRecordingRejection', () => ({
  ScreenRecordingRejection: () => null,
}));

vi.mock('../interface/DeviceWarning', () => ({
  DeviceWarning: () => null,
}));

vi.mock('../../store/hooks/useStudyConfig', () => ({
  useStudyConfig: () => ({
    studyMetadata: { title: 'Test Study' },
    studyRules: undefined,
    uiConfig: {
      logoPath: 'logo.svg',
      withSidebar: true,
      sidebarWidth: 300,
      showTitleBar: true,
      windowEventDebounceTime: 100,
    },
    components: {},
    sequences: {},
  }),
}));

vi.mock('../../store/hooks/useIsAnalysis', () => ({
  useIsAnalysis: () => false,
}));

vi.mock('../../store/hooks/useWindowEvents', () => ({
  WindowEventsContext: { Provider: ({ children }: { children: ReactNode }) => <span>{children}</span> },
}));

vi.mock('../../store/hooks/useRecording', () => ({
  useRecording: () => ({ isRejected: false }),
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
  useStoreSelector: (selector: (s: Record<string, unknown>) => unknown) => selector({
    showStudyBrowser: false,
    modes: { developmentModeEnabled: false, dataCollectionEnabled: true },
    completed: false,
    analysisHasScreenRecording: false,
    analysisCanPlayScreenRecording: false,
  }),
  useStoreDispatch: () => mockDispatch,
  useStoreActions: () => ({
    toggleStudyBrowser: vi.fn(),
    setAlertModal: mockSetAlertModal,
  }),
}));

vi.mock('../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({
    storageEngine: mockStorageEngine,
  }),
}));

vi.mock('../../routes/utils', () => ({
  useCurrentComponent: () => 'intro',
}));

vi.mock('../../utils/handleComponentInheritance', () => ({
  studyComponentToIndividualComponent: vi.fn(() => ({
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
}));

vi.mock('@mantine/core', () => ({
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
  Button: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
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
  default: (fn: (...args: unknown[]) => unknown) => fn,
}));

// ── tests ─────────────────────────────────────────────────────────────────────

describe('StepRenderer', () => {
  beforeEach(() => {
    mockDispatch.mockClear();
    mockSetAlertModal.mockClear();
    mockSubscribeToParticipantDataWriteErrors.mockReset();
    pdfExportMocks.buildFilename.mockClear();
    pdfExportMocks.getUnsupportedReason.mockReset().mockReturnValue(undefined);
    pdfExportMocks.hideNotification.mockClear();
    pdfExportMocks.saveElement.mockReset().mockResolvedValue(undefined);
    pdfExportMocks.showNotification.mockClear();
    pdfExportMocks.waitForNextPaint.mockReset().mockResolvedValue(undefined);
    mockShowTitleBar = true;
    mockStorageEngine = {
      subscribeToParticipantDataWriteErrors: mockSubscribeToParticipantDataWriteErrors,
    };
    vi.mocked(shouldConfirmTabClose).mockReturnValue(false);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
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
