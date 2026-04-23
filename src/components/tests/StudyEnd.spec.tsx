import { ReactNode } from 'react';
import {
  render, act, cleanup, screen, waitFor,
} from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { StudyEnd } from '../StudyEnd';

// ── mutable state ─────────────────────────────────────────────────────────────

function createDeferred<T>() {
  let resolve!: (value: T) => void;

  return {
    promise: new Promise<T>((res) => {
      resolve = res;
    }),
    resolve,
  };
}

let mockIsAnalysis = false;
let mockStudyConfig: {
  studyMetadata: { title: string };
  uiConfig: {
    studyEndMsg: string | undefined;
    autoDownloadStudy: boolean;
    autoDownloadTime: number | undefined;
    studyEndAutoRedirectURL: string | undefined;
    studyEndAutoRedirectDelay: number | undefined;
    urlParticipantIdParam: string | undefined;
  };
} = {
  studyMetadata: { title: 'Test Study' },
  uiConfig: {
    studyEndMsg: undefined,
    autoDownloadStudy: false,
    autoDownloadTime: undefined,
    studyEndAutoRedirectURL: undefined,
    studyEndAutoRedirectDelay: undefined,
    urlParticipantIdParam: undefined,
  },
};
let mockStorageEngine: Record<string, ReturnType<typeof vi.fn>> | undefined;
let mockDataCollectionEnabled = false;
const mockFinalizeLoopHandlers: { onComplete?: () => void; onUnexpectedError?: (error: unknown) => void } = {};

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../store/hooks/useStudyConfig', () => ({
  useStudyConfig: () => mockStudyConfig,
}));

vi.mock('../../store/hooks/useIsAnalysis', () => ({
  useIsAnalysis: () => mockIsAnalysis,
}));

vi.mock('../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({ storageEngine: mockStorageEngine }),
}));

vi.mock('../../store/store', () => ({
  useStoreDispatch: () => vi.fn(),
  useStoreActions: () => ({ setParticipantCompleted: vi.fn(), setIsSubmittingFinal: vi.fn() }),
  useStoreSelector: (selector: (state: { modes: { dataCollectionEnabled: boolean } }) => unknown) => selector({ modes: { dataCollectionEnabled: mockDataCollectionEnabled } }),
}));

vi.mock('../StudyEnd.utils', () => ({
  DEFAULT_STUDY_END_FINALIZE_STATE: {
    error: null,
    failedAttemptCount: 0,
    isRetryingAutomatically: false,
    manualRetryRequired: false,
    retryAllowed: true,
    retryDelayMs: null,
  },
  createStudyEndFinalizeLoop: ({ onComplete, onUnexpectedError }: { onComplete: () => void; onUnexpectedError: (error: unknown) => void }) => {
    mockFinalizeLoopHandlers.onComplete = onComplete;
    mockFinalizeLoopHandlers.onUnexpectedError = onUnexpectedError;
    return {
      start: async () => {
        if (!mockStorageEngine) return;
        try {
          const result = await mockStorageEngine.finalizeParticipant?.();
          if (result?.status === 'complete') {
            onComplete();
          }
        } catch (error) {
          onUnexpectedError(error);
        }
      },
      cancel: vi.fn(),
      retryNow: vi.fn(),
    };
  },
}));

vi.mock('../../routes/utils', () => ({
  useStudyId: () => 'test-study',
}));

vi.mock('../../utils/useDisableBrowserBack', () => ({
  useDisableBrowserBack: vi.fn(),
}));

vi.mock('../downloader/DownloadTidy', () => ({
  download: vi.fn(),
}));

vi.mock('../ReactMarkdownWrapper', () => ({
  ReactMarkdownWrapper: ({ text }: { text: string }) => (
    <div data-testid="markdown">{text}</div>
  ),
}));

vi.mock('@mantine/core', () => ({
  Center: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Flex: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Loader: () => <div data-testid="loader" />,
  Space: () => <div />,
  Text: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));

// ── tests ─────────────────────────────────────────────────────────────────────

describe('StudyEnd', () => {
  beforeEach(() => {
    mockIsAnalysis = false;
    mockStudyConfig = {
      studyMetadata: { title: 'Test Study' },
      uiConfig: {
        studyEndMsg: undefined,
        autoDownloadStudy: false,
        autoDownloadTime: undefined,
        studyEndAutoRedirectURL: undefined,
        studyEndAutoRedirectDelay: undefined,
        urlParticipantIdParam: undefined,
      },
    };
    mockDataCollectionEnabled = false;
    mockStorageEngine = {
      finalizeParticipant: vi.fn().mockResolvedValue({ status: 'complete' }),
      getModes: vi.fn().mockResolvedValue({ dataCollectionEnabled: false }),
      getCurrentParticipantId: vi.fn().mockResolvedValue('p1'),
      getParticipantData: vi.fn().mockResolvedValue(null),
      getCurrentParticipantDataSnapshot: vi.fn().mockReturnValue(null),
    };
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test('shows "Thank you" message by default (data collection disabled)', () => {
    const html = renderToStaticMarkup(<StudyEnd />);
    expect(html).toContain('Thank you for completing the study');
  });

  test('shows custom studyEndMsg when configured', () => {
    mockStudyConfig = {
      ...mockStudyConfig,
      uiConfig: {
        ...mockStudyConfig.uiConfig,
        studyEndMsg: 'Custom end message',
      },
    };
    const html = renderToStaticMarkup(<StudyEnd />);
    expect(html).toContain('Custom end message');
  });

  test('shows loader when data collection is enabled and not yet complete', async () => {
    const finalizeParticipant = createDeferred<{ status: 'complete' | 'retry' | 'error' }>();
    mockDataCollectionEnabled = true;
    mockStorageEngine = {
      finalizeParticipant: vi.fn().mockImplementation(() => finalizeParticipant.promise),
      getModes: vi.fn().mockResolvedValue({ dataCollectionEnabled: true }),
      getCurrentParticipantId: vi.fn().mockResolvedValue('p1'),
      getParticipantData: vi.fn().mockResolvedValue(null),
      getCurrentParticipantDataSnapshot: vi.fn().mockReturnValue(null),
    };

    await act(async () => {
      render(<StudyEnd />);
    });

    expect(screen.getByText('Please wait while your answers are uploaded.')).toBeDefined();
    expect(screen.getByTestId('loader')).toBeDefined();
  });

  test('shows "Thank you" after completion in analysis mode', async () => {
    mockIsAnalysis = true;

    await act(async () => {
      render(<StudyEnd />);
    });

    expect(screen.getByText('Thank you for completing the study. You may close this window now.')).toBeDefined();
    expect(screen.queryByTestId('loader')).toBeNull();
  });

  test('renders markdown wrapper for custom studyEndMsg', async () => {
    mockIsAnalysis = true;
    mockStudyConfig = {
      ...mockStudyConfig,
      uiConfig: {
        ...mockStudyConfig.uiConfig,
        studyEndMsg: '# Study Complete',
      },
    };

    await act(async () => {
      render(<StudyEnd />);
    });

    expect(screen.getByTestId('markdown').textContent).toBe('# Study Complete');
  });

  test('sets completed when finalizeParticipant resolves complete', async () => {
    mockStorageEngine = {
      finalizeParticipant: vi.fn().mockResolvedValue({ status: 'complete' }),
      getModes: vi.fn().mockResolvedValue({ dataCollectionEnabled: false }),
      getCurrentParticipantId: vi.fn().mockResolvedValue('p1'),
      getParticipantData: vi.fn().mockResolvedValue(null),
      getCurrentParticipantDataSnapshot: vi.fn().mockReturnValue(null),
    };
    await act(async () => { render(<StudyEnd />); });
    // finalizeParticipant returns complete -> completed set to true -> loader disappears
    expect(screen.queryByTestId('loader')).toBeNull();
  });

  test('handles finalizeParticipant error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    mockStorageEngine = {
      finalizeParticipant: vi.fn().mockRejectedValue(new Error('network error')),
      getModes: vi.fn().mockResolvedValue({ dataCollectionEnabled: false }),
      getCurrentParticipantId: vi.fn().mockResolvedValue('p1'),
      getParticipantData: vi.fn().mockResolvedValue(null),
      getCurrentParticipantDataSnapshot: vi.fn().mockReturnValue(null),
    };
    await act(async () => { render(<StudyEnd />); });
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('error'),
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });

  test('does not crash when storageEngine is undefined and data collection is disabled', async () => {
    mockStorageEngine = undefined;
    await act(async () => { render(<StudyEnd />); });
    expect(screen.getByText('Thank you for completing the study. You may close this window now.')).toBeDefined();
  });

  test('autoDownload fires when completed and delayCounter <= 0', async () => {
    const downloadMock = await import('../downloader/DownloadTidy');
    const downloadSpy = vi.mocked(downloadMock.download);
    mockIsAnalysis = true; // analysis mode sets completed=true immediately
    mockStudyConfig = {
      ...mockStudyConfig,
      uiConfig: {
        ...mockStudyConfig.uiConfig,
        autoDownloadStudy: true,
        autoDownloadTime: undefined, // → autoDownloadDelay = -1, delayCounter = -1 ≤ 0
      },
    };
    mockStorageEngine = {
      finalizeParticipant: vi.fn().mockResolvedValue({ status: 'complete' }),
      getModes: vi.fn().mockResolvedValue({ dataCollectionEnabled: false }),
      getCurrentParticipantId: vi.fn().mockResolvedValue('p1'),
      getParticipantData: vi.fn().mockResolvedValue({ participantId: 'p1' }),
      getCurrentParticipantDataSnapshot: vi.fn().mockReturnValue(null),
    };
    await act(async () => { render(<StudyEnd />); });
    await waitFor(() => { expect(downloadSpy).toHaveBeenCalled(); });
  });

  test('replaces {PARTICIPANT_ID} in studyEndMsg when urlParticipantIdParam is set', async () => {
    mockIsAnalysis = true;
    mockStudyConfig = {
      ...mockStudyConfig,
      uiConfig: {
        ...mockStudyConfig.uiConfig,
        studyEndMsg: 'Hello {PARTICIPANT_ID}!',
        urlParticipantIdParam: 'pid',
      },
    };
    mockStorageEngine = {
      finalizeParticipant: vi.fn().mockResolvedValue({ status: 'complete' }),
      getModes: vi.fn().mockResolvedValue({ dataCollectionEnabled: false }),
      getCurrentParticipantId: vi.fn().mockResolvedValue('p42'),
      getParticipantData: vi.fn().mockResolvedValue(null),
      getCurrentParticipantDataSnapshot: vi.fn().mockReturnValue(null),
    };
    await act(async () => { render(<StudyEnd />); });
    await waitFor(() => {
      expect(screen.getByTestId('markdown').textContent).toBe('Hello p42!');
    });
  });

  test('sets up redirect timeout when studyEndAutoRedirectURL configured', async () => {
    vi.useFakeTimers();
    // jsdom's window.location.replace is non-configurable; replace the whole location object
    const replaceSpy = vi.fn();
    const origLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        replace: replaceSpy, assign: vi.fn(), href: '', pathname: '/', search: '',
      },
    });
    mockIsAnalysis = false;
    mockStorageEngine = {
      finalizeParticipant: vi.fn().mockResolvedValue({ status: 'complete' }),
      getModes: vi.fn().mockResolvedValue({ dataCollectionEnabled: false }),
      getCurrentParticipantId: vi.fn().mockResolvedValue('p1'),
      getParticipantData: vi.fn().mockResolvedValue(null),
      getCurrentParticipantDataSnapshot: vi.fn().mockReturnValue(null),
    };
    mockStudyConfig = {
      ...mockStudyConfig,
      uiConfig: {
        ...mockStudyConfig.uiConfig,
        studyEndAutoRedirectURL: 'https://example.com',
        studyEndAutoRedirectDelay: 500,
      },
    };
    const { unmount } = await act(async () => render(<StudyEnd />));
    await act(async () => { await Promise.resolve(); });
    await act(async () => { vi.advanceTimersByTime(600); });
    expect(replaceSpy).toHaveBeenCalledWith('https://example.com');
    unmount(); // exercises clearTimeout cleanup
    Object.defineProperty(window, 'location', { configurable: true, value: origLocation });
    vi.useRealTimers();
  });
});
