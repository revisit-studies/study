import { forwardRef, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  render, act, cleanup,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { AppHeader } from '../AppHeader';
import { getNewParticipant } from '../../../utils/nextParticipant';

// ── mutable state ─────────────────────────────────────────────────────────────

let mockStorageEngineFailedToConnect = false;
let mockedCurrentComponent = 'componentA';
let mockIsAnalysis = false;
let mockedComponentConfig: {
  withProgressBar: boolean;
  showTitle: boolean;
  type: 'markdown' | 'questionnaire';
  path?: string;
  allowDownload?: boolean;
} = {
  withProgressBar: false,
  showTitle: true,
  type: 'questionnaire',
};

let mockedRecordingContext = {
  isScreenRecording: false,
  isAudioRecording: false,
  setIsMuted: vi.fn(),
  isMuted: false,
  clickToRecord: false,
  isSpeakingWhileMuted: false,
  showMutedWarning: false,
  screenRecordingError: null as string | null,
  audioRecordingError: null as string | null,
  currentComponentHasAudioRecording: false,
  audioStatus: 'idle' as 'idle' | 'pending' | 'recording' | 'denied',
};

// ── mocks ─────────────────────────────────────────────────────────────────────

const mockStudyConfig = {
  studyRules: undefined,
  studyMetadata: { title: 'Test Study' },
  uiConfig: {
    logoPath: 'logo.png',
    withProgressBar: false,
    showTitle: true,
    contactEmail: 'test@test.com',
  },
  components: {},
  sequences: {},
};

vi.mock('@mantine/core', () => ({
  ActionIcon: ({
    children, component, href, download, onClick, 'aria-label': ariaLabel,
  }: {
    children: ReactNode;
    component?: string;
    href?: string;
    download?: boolean;
    onClick?: () => void;
    'aria-label'?: string;
  }) => {
    if (component === 'a') {
      return <a href={href} download={download} aria-label={ariaLabel}>{children}</a>;
    }
    return <button type="button" onClick={onClick} aria-label={ariaLabel}>{children}</button>;
  },
  AppShell: Object.assign(
    ({ children }: { children: ReactNode }) => <div>{children}</div>,
    { Header: ({ children }: { children: ReactNode }) => <header>{children}</header> },
  ),
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Button: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>{children}</button>
  ),
  Flex: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Grid: Object.assign(
    ({ children }: { children: ReactNode }) => <div>{children}</div>,
    { Col: ({ children }: { children: ReactNode }) => <div>{children}</div> },
  ),
  Group: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Image: ({ src, alt }: { src?: string; alt?: string }) => <img src={src} alt={alt} />,
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
      Divider: () => <hr />,
    },
  ),
  Progress: ({ value }: { value: number }) => <div data-testid="progress" data-value={value} />,
  Space: () => <span />,
  Title: forwardRef<HTMLHeadingElement, { children: ReactNode }>(function Title({ children }, ref) { // eslint-disable-line prefer-arrow-callback
    return <h1 ref={ref}>{children}</h1>;
  }),
  Tooltip: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));

vi.mock('@tabler/icons-react', () => ({
  IconChartHistogram: () => null,
  IconDownload: () => null,
  IconDotsVertical: () => null,
  IconMail: () => null,
  IconMicrophone: () => null,
  IconMicrophoneOff: () => null,
  IconSchema: () => null,
  IconUserPlus: () => null,
}));

vi.mock('react-router', () => ({
  useHref: () => '/test-study',
  useParams: () => ({ funcIndex: undefined }),
}));

vi.mock('../../../routes/utils', () => ({
  useCurrentComponent: () => mockedCurrentComponent,
  useCurrentStep: () => 0,
  useStudyId: () => 'test-study',
}));

vi.mock('../../../store/store', () => ({
  useStoreSelector: (selector: (s: Record<string, unknown>) => unknown) => selector({
    config: mockStudyConfig,
    answers: {},
    storageEngineFailedToConnect: mockStorageEngineFailedToConnect,
    modes: { developmentModeEnabled: false },
    showStudyBrowser: false,
  }),
  useStoreDispatch: () => vi.fn(),
  useStoreActions: () => ({
    toggleShowHelpText: vi.fn(),
    toggleStudyBrowser: vi.fn(),
    incrementHelpCounter: vi.fn(),
    setAlertModal: vi.fn(),
  }),
  useFlatSequence: () => [],
}));

vi.mock('../../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({ storageEngine: { getEngine: () => 'localStorage', updateProgressData: vi.fn() } }),
}));

vi.mock('../../../storage/engines/utils', () => ({
  calculateProgressData: vi.fn(() => ({ completedSteps: 0, totalSteps: 1 })),
}));

vi.mock('../../../utils/Prefix', () => ({ PREFIX: '/' }));
vi.mock('../../../utils/nextParticipant', () => ({ getNewParticipant: vi.fn() }));

vi.mock('../RecordingAudioWaveform', () => ({
  RecordingAudioWaveform: () => <div data-testid="waveform" />,
}));

vi.mock('../../../utils/handleComponentInheritance', () => ({
  studyComponentToIndividualComponent: vi.fn(() => mockedComponentConfig),
}));

vi.mock('../../../store/hooks/useRecording', () => ({
  useRecordingContext: () => mockedRecordingContext,
}));

vi.mock('../../../store/hooks/useIsAnalysis', () => ({
  useIsAnalysis: () => mockIsAnalysis,
}));

vi.mock('../../../utils/useDeviceRules', () => ({
  useDeviceRules: () => ({
    isBrowserAllowed: true,
    isDeviceAllowed: true,
    isInputAllowed: true,
    isDisplayAllowed: true,
  }),
}));

vi.mock('../../../utils/notifications', () => ({
  hideNotification: vi.fn(),
  showNotification: vi.fn(() => 'notification-id'),
}));

vi.mock('../../../utils/recordingWarnings', () => ({
  getMutedInstruction: () => 'Muted warning',
}));

// ── tests ─────────────────────────────────────────────────────────────────────

describe('AppHeader interactive', () => {
  beforeEach(() => { mockStorageEngineFailedToConnect = false; });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test('covers storageEngineFailedToConnect effect: setTimeout setup and callback', async () => {
    mockStorageEngineFailedToConnect = true;
    vi.useFakeTimers();
    await act(async () => { render(<AppHeader developmentModeEnabled={false} dataCollectionEnabled />); });
    await act(async () => { vi.advanceTimersByTime(5000); });
  });

  test('covers cleanup of storageEngineFailedToConnect effect on unmount', async () => {
    mockStorageEngineFailedToConnect = true;
    vi.useFakeTimers();
    const { unmount } = await act(async () => render(
      <AppHeader developmentModeEnabled={false} dataCollectionEnabled />,
    ));
    unmount();
  });
});

describe('AppHeader', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    mockStorageEngineFailedToConnect = false;
    mockIsAnalysis = false;
    mockedCurrentComponent = 'componentA';
    mockedComponentConfig = {
      withProgressBar: false,
      showTitle: true,
      type: 'questionnaire',
    };
    mockedRecordingContext = {
      isScreenRecording: false,
      isAudioRecording: false,
      setIsMuted: vi.fn(),
      isMuted: false,
      clickToRecord: false,
      isSpeakingWhileMuted: false,
      showMutedWarning: false,
      screenRecordingError: null,
      audioRecordingError: null,
      currentComponentHasAudioRecording: false,
      audioStatus: 'idle',
    };
  });

  test('renders progress bar in normal mode', () => {
    const html = renderToStaticMarkup(
      <AppHeader developmentModeEnabled={false} dataCollectionEnabled />,
    );
    expect(html.length).toBeGreaterThan(0);
    // No "Demo Mode" badge when data collection is enabled
    expect(html).not.toContain('Demo Mode');
  });

  test('shows study browser and analyze links in development mode', () => {
    const html = renderToStaticMarkup(
      <AppHeader developmentModeEnabled dataCollectionEnabled />,
    );
    expect(html).toContain('Study Browser');
    expect(html).toContain('Analyze');
    expect(html).toContain('Next Participant');
  });

  test('disables Next Participant in analysis replay mode', () => {
    mockIsAnalysis = true;
    const { getByRole } = render(
      <AppHeader developmentModeEnabled dataCollectionEnabled />,
    );

    const nextParticipant = getByRole('button', { name: 'Next Participant' });
    expect((nextParticipant as HTMLButtonElement).disabled).toBe(true);
    nextParticipant.click();
    expect(vi.mocked(getNewParticipant)).not.toHaveBeenCalled();
  });

  test('renders header content when data collection is disabled', () => {
    const html = renderToStaticMarkup(
      <AppHeader developmentModeEnabled={false} dataCollectionEnabled={false} />,
    );
    expect(html).toContain('Demo Mode');
    // Dev mode controls should not appear
    expect(html).not.toContain('Study Browser');
  });

  test.each([undefined, true])('shows the Markdown download when allowDownload is %s', (allowDownload) => {
    mockedComponentConfig = {
      withProgressBar: false,
      showTitle: true,
      type: 'markdown',
      path: 'test-study/assets/stimulus.md',
      allowDownload,
    };

    const { container } = render(
      <AppHeader developmentModeEnabled={false} dataCollectionEnabled />,
    );

    const downloadLink = container.querySelector('a[aria-label="Download stimulus"]');
    expect(downloadLink).not.toBeNull();
    expect(downloadLink?.getAttribute('href')).toBe('/test-study/assets/stimulus.md');
    expect(downloadLink?.hasAttribute('download')).toBe(true);
  });

  test('hides the Markdown download when allowDownload is false', () => {
    mockedComponentConfig = {
      withProgressBar: false,
      showTitle: true,
      type: 'markdown',
      path: 'test-study/assets/stimulus.md',
      allowDownload: false,
    };

    const { container } = render(
      <AppHeader developmentModeEnabled={false} dataCollectionEnabled />,
    );

    expect(container.querySelector('a[aria-label="Download stimulus"]')).toBeNull();
  });

  // --- Audio/recording state tests from original file ---

  test('shows disabled mic state when audio permission is denied before recording starts', () => {
    mockedRecordingContext = {
      ...mockedRecordingContext,
      clickToRecord: true,
      currentComponentHasAudioRecording: true,
      audioRecordingError: 'Microphone permission denied',
      audioStatus: 'denied',
    };

    const html = renderToStaticMarkup(<AppHeader developmentModeEnabled={false} dataCollectionEnabled />);

    // The error text is rendered directly in a <p> element
    expect(html).toContain('Microphone permission denied');
  });

  test('shows pending mic state before audio permission is granted', () => {
    mockedRecordingContext = {
      ...mockedRecordingContext,
      clickToRecord: true,
      currentComponentHasAudioRecording: true,
      audioStatus: 'pending',
    };

    const html = renderToStaticMarkup(<AppHeader developmentModeEnabled={false} dataCollectionEnabled />);

    // Pending state renders an ActionIcon (button) with aria-label; tooltip labels don't render in static markup
    expect(html).toContain('<button');
  });

  test('hides stale mic error outside audio and permission pages', () => {
    mockedRecordingContext = {
      ...mockedRecordingContext,
      audioRecordingError: 'Microphone permission denied',
      audioStatus: 'denied',
    };

    const html = renderToStaticMarkup(<AppHeader developmentModeEnabled={false} dataCollectionEnabled />);

    expect(html).not.toContain('Microphone error');
    expect(html).not.toContain('Microphone permission denied');
  });

  test('shows mic error on the screen recording permission page', () => {
    mockedCurrentComponent = '$screen-recording.components.screenRecordingPermission';
    mockedRecordingContext = {
      ...mockedRecordingContext,
      audioRecordingError: 'Microphone permission denied',
      audioStatus: 'denied',
    };

    const html = renderToStaticMarkup(<AppHeader developmentModeEnabled={false} dataCollectionEnabled />);

    expect(html).toContain('Microphone permission denied');
  });

  test('shows screen recording error in the header', () => {
    mockedRecordingContext = {
      ...mockedRecordingContext,
      screenRecordingError: 'Recording permission denied',
    };

    const html = renderToStaticMarkup(<AppHeader developmentModeEnabled={false} dataCollectionEnabled />);

    expect(html).toContain('Recording permission denied');
  });

  test('shows default Firebase warning badge on direct study pages', () => {
    vi.stubEnv('VITE_STORAGE_ENGINE', 'firebase');
    vi.stubEnv('VITE_FIREBASE_CONFIG', JSON.stringify({ projectId: 'revisit-utah' }));
    vi.stubGlobal('window', { location: { hostname: 'study.example.com' } });

    const html = renderToStaticMarkup(<AppHeader developmentModeEnabled={false} dataCollectionEnabled />);

    expect(html).toContain('Default Firebase');
  });

  test('shows default Supabase warning badge on direct study pages', () => {
    vi.stubEnv('VITE_STORAGE_ENGINE', 'supabase');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://supabase.revisit.dev');
    vi.stubGlobal('window', { location: { hostname: 'study.example.com' } });

    const html = renderToStaticMarkup(<AppHeader developmentModeEnabled={false} dataCollectionEnabled />);

    expect(html).toContain('Default Supabase');
  });
});
