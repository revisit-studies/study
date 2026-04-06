import { ReactNode } from 'react';
import {
  render, act, cleanup, screen, waitFor,
} from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { StudyEnd } from './StudyEnd';

// ── mutable state ─────────────────────────────────────────────────────────────

let mockIsAnalysis = false;
let mockStudyConfig = {
  studyMetadata: { title: 'Test Study' },
  uiConfig: {
    studyEndMsg: undefined as string | undefined,
    autoDownloadStudy: false,
    autoDownloadTime: undefined as number | undefined,
    studyEndAutoRedirectURL: undefined as string | undefined,
    studyEndAutoRedirectDelay: undefined as number | undefined,
    urlParticipantIdParam: undefined as string | undefined,
  },
};
let mockStorageEngine: Record<string, ReturnType<typeof vi.fn>> | undefined;

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../store/hooks/useStudyConfig', () => ({
  useStudyConfig: () => mockStudyConfig,
}));

vi.mock('../store/hooks/useIsAnalysis', () => ({
  useIsAnalysis: () => mockIsAnalysis,
}));

vi.mock('../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({ storageEngine: mockStorageEngine }),
}));

vi.mock('../store/store', () => ({
  useStoreDispatch: () => vi.fn(),
  useStoreActions: () => ({ setParticipantCompleted: vi.fn() }),
}));

vi.mock('../routes/utils', () => ({
  useStudyId: () => 'test-study',
}));

vi.mock('../utils/useDisableBrowserBack', () => ({
  useDisableBrowserBack: vi.fn(),
}));

vi.mock('./downloader/DownloadTidy', () => ({
  download: vi.fn(),
}));

vi.mock('./ReactMarkdownWrapper', () => ({
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
    mockStorageEngine = {
      verifyCompletion: vi.fn().mockResolvedValue(true),
      getModes: vi.fn().mockResolvedValue({ dataCollectionEnabled: false }),
      getCurrentParticipantId: vi.fn().mockResolvedValue('p1'),
      getParticipantData: vi.fn().mockResolvedValue(null),
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
    mockStorageEngine = {
      verifyCompletion: vi.fn().mockResolvedValue(false),
      getModes: vi.fn().mockResolvedValue({ dataCollectionEnabled: true }),
      getCurrentParticipantId: vi.fn().mockResolvedValue('p1'),
      getParticipantData: vi.fn().mockResolvedValue(null),
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

  test('sets completed when verifyCompletion resolves true (covers lines 53-56)', async () => {
    mockStorageEngine = {
      verifyCompletion: vi.fn().mockResolvedValue(true),
      getModes: vi.fn().mockResolvedValue({ dataCollectionEnabled: false }),
      getCurrentParticipantId: vi.fn().mockResolvedValue('p1'),
      getParticipantData: vi.fn().mockResolvedValue(null),
    };
    await act(async () => { render(<StudyEnd />); });
    // verifyCompletion returns true → completed set to true → loader disappears
    expect(screen.queryByTestId('loader')).toBeNull();
  });

  test('handles verifyCompletion error gracefully (covers lines 58-59)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockStorageEngine = {
      verifyCompletion: vi.fn().mockRejectedValue(new Error('network error')),
      getModes: vi.fn().mockResolvedValue({ dataCollectionEnabled: false }),
      getCurrentParticipantId: vi.fn().mockResolvedValue('p1'),
      getParticipantData: vi.fn().mockResolvedValue(null),
    };
    await act(async () => { render(<StudyEnd />); });
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('error'),
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });

  test('no-engine branch: setTimeout fires when storageEngine is null (covers lines 44-48)', async () => {
    vi.useFakeTimers();
    mockStorageEngine = undefined;
    await act(async () => { render(<StudyEnd />); });
    // Advance timers so the setTimeout(verifyLoop, 2000) fires once
    await act(async () => { vi.advanceTimersByTime(2100); });
    vi.useRealTimers();
    // No crash is the assertion
    expect(screen.getByText('Thank you for completing the study. You may close this window now.')).toBeDefined();
  });

  test('autoDownload fires when completed and delayCounter <= 0 (covers lines 119, 124-131)', async () => {
    const downloadMock = await import('./downloader/DownloadTidy');
    const downloadSpy = vi.mocked(downloadMock.download);
    mockIsAnalysis = true; // skip verifyLoop, sets completed=true immediately
    mockStudyConfig = {
      ...mockStudyConfig,
      uiConfig: {
        ...mockStudyConfig.uiConfig,
        autoDownloadStudy: true,
        autoDownloadTime: undefined, // → autoDownloadDelay = -1, delayCounter = -1 ≤ 0
      },
    };
    mockStorageEngine = {
      verifyCompletion: vi.fn().mockResolvedValue(false),
      getModes: vi.fn().mockResolvedValue({ dataCollectionEnabled: false }),
      getCurrentParticipantId: vi.fn().mockResolvedValue('p1'),
      getParticipantData: vi.fn().mockResolvedValue({ participantId: 'p1' }),
    };
    await act(async () => { render(<StudyEnd />); });
    await waitFor(() => { expect(downloadSpy).toHaveBeenCalled(); });
  });

  test('replaces {PARTICIPANT_ID} in studyEndMsg when urlParticipantIdParam is set (covers lines 154-155)', async () => {
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
      verifyCompletion: vi.fn().mockResolvedValue(false),
      getModes: vi.fn().mockResolvedValue({ dataCollectionEnabled: false }),
      getCurrentParticipantId: vi.fn().mockResolvedValue('p42'),
      getParticipantData: vi.fn().mockResolvedValue(null),
    };
    await act(async () => { render(<StudyEnd />); });
    await waitFor(() => {
      expect(screen.getByTestId('markdown').textContent).toBe('Hello p42!');
    });
  });

  test('sets up redirect timeout when studyEndAutoRedirectURL configured (covers lines 165-171)', async () => {
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
      verifyCompletion: vi.fn().mockResolvedValue(true),
      getModes: vi.fn().mockResolvedValue({ dataCollectionEnabled: false }),
      getCurrentParticipantId: vi.fn().mockResolvedValue('p1'),
      getParticipantData: vi.fn().mockResolvedValue(null),
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
    unmount(); // exercises clearTimeout cleanup (lines 169-171)
    Object.defineProperty(window, 'location', { configurable: true, value: origLocation });
    vi.useRealTimers();
  });
});
