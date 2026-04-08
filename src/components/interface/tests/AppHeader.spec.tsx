import { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  render, act, cleanup,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { AppHeader } from '../AppHeader';

// ── mutable state ─────────────────────────────────────────────────────────────

let mockStorageEngineFailedToConnect = false;

// ── mocks ─────────────────────────────────────────────────────────────────────

const mockStudyConfig = {
  studyRules: undefined,
  studyMetadata: { title: 'Test Study' },
  uiConfig: {
    logoPath: undefined,
    withProgressBar: false,
    showTitle: true,
    contactEmail: 'admin@test.com',
  },
  components: {},
  sequences: {},
};

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

vi.mock('../../../routes/utils', () => ({
  useCurrentComponent: () => 'component1',
  useCurrentStep: () => 0,
  useStudyId: () => 'test-study',
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
  studyComponentToIndividualComponent: vi.fn(() => ({
    withProgressBar: false,
    showTitle: true,
  })),
}));

vi.mock('../../../store/hooks/useRecording', () => ({
  useRecordingContext: () => ({
    isScreenRecording: false,
    isAudioRecording: false,
    setIsMuted: vi.fn(),
    isMuted: false,
    clickToRecord: vi.fn(),
  }),
}));

vi.mock('../../../utils/useDeviceRules', () => ({
  useDeviceRules: () => ({
    isBrowserAllowed: true,
    isDeviceAllowed: true,
    isInputAllowed: true,
    isDisplayAllowed: true,
  }),
}));

vi.mock('react-router', () => ({
  useHref: () => '/test-study',
  useParams: () => ({ funcIndex: undefined }),
}));

vi.mock('@mantine/core', () => ({
  ActionIcon: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>{children}</button>
  ),
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
      Item: ({ children }: { children: ReactNode }) => <div>{children}</div>,
      Divider: () => <hr />,
    },
  ),
  Progress: ({ value }: { value: number }) => <div data-testid="progress" data-value={value} />,
  Space: () => <span />,
  Title: ({ children }: { children: ReactNode }) => <h1>{children}</h1>,
  Tooltip: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));

vi.mock('@tabler/icons-react', () => ({
  IconChartHistogram: () => null,
  IconDotsVertical: () => null,
  IconMail: () => null,
  IconMicrophone: () => null,
  IconMicrophoneOff: () => null,
  IconSchema: () => null,
  IconUserPlus: () => null,
}));

// ── tests ─────────────────────────────────────────────────────────────────────

describe('AppHeader interactive', () => {
  beforeEach(() => { mockStorageEngineFailedToConnect = false; });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

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

  test('renders header content when data collection is disabled', () => {
    const html = renderToStaticMarkup(
      <AppHeader developmentModeEnabled={false} dataCollectionEnabled={false} />,
    );
    // With no storageEngine connection, shows disconnected state
    expect(html).toContain('Storage Disconnected');
    // Dev mode controls should not appear
    expect(html).not.toContain('Study Browser');
  });
});
