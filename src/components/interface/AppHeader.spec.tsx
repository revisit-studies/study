import { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  beforeEach, describe, expect, test, vi,
} from 'vitest';
import { AppHeader } from './AppHeader';

let mockedRecordingContext = {
  isScreenRecording: false,
  isAudioRecording: false,
  setIsMuted: vi.fn(),
  isMuted: false,
  clickToRecord: false,
  isSpeakingWhileMuted: false,
  showMutedWarning: false,
  audioRecordingError: null as string | null,
  currentComponentHasAudioRecording: false,
  audioStatus: 'idle' as 'idle' | 'pending' | 'recording' | 'denied',
};

const mockedStudyConfig = {
  studyMetadata: { title: 'Test Study' },
  uiConfig: {
    logoPath: 'logo.png',
    withProgressBar: false,
    showTitle: true,
  },
  components: {},
  studyRules: undefined,
};

vi.mock('@mantine/core', () => ({
  ActionIcon: ({ children, ...props }: { children: ReactNode }) => <button type="button" {...props}>{children}</button>,
  AppShell: { Header: ({ children }: { children: ReactNode }) => <div>{children}</div> },
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Button: ({ children, ...props }: { children: ReactNode }) => <button type="button" {...props}>{children}</button>,
  Flex: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Grid: Object.assign(
    ({ children }: { children: ReactNode }) => <div>{children}</div>,
    { Col: ({ children }: { children: ReactNode }) => <div>{children}</div> },
  ),
  Group: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Image: ({ alt }: { alt: string }) => <img alt={alt} />,
  Menu: Object.assign(
    ({ children }: { children: ReactNode }) => <div>{children}</div>,
    {
      Target: ({ children }: { children: ReactNode }) => <div>{children}</div>,
      Dropdown: ({ children }: { children: ReactNode }) => <div>{children}</div>,
      Item: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    },
  ),
  Progress: () => <div>progress</div>,
  Space: () => <div />,
  Title: ({ children }: { children: ReactNode }) => <h1>{children}</h1>,
  Tooltip: ({ children, label }: { children: ReactNode; label?: ReactNode }) => (
    <div>
      {children}
      {label ? <span>{label}</span> : null}
    </div>
  ),
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock('@tabler/icons-react', () => ({
  IconChartHistogram: () => <span>chart</span>,
  IconDotsVertical: () => <span>dots</span>,
  IconMail: () => <span>mail</span>,
  IconMicrophone: () => <span>mic</span>,
  IconMicrophoneOff: () => <span>mic-off</span>,
  IconSchema: () => <span>schema</span>,
  IconUserPlus: () => <span>user-plus</span>,
}));

vi.mock('react-router', () => ({
  useHref: () => '/test-study',
  useParams: () => ({}),
}));

vi.mock('../../routes/utils', () => ({
  useCurrentComponent: () => 'componentA',
  useCurrentStep: () => 0,
  useStudyId: () => 'test-study',
}));

vi.mock('../../store/store', () => ({
  useStoreDispatch: () => vi.fn(),
  useStoreSelector: (selector: (state: {
    config: typeof mockedStudyConfig;
    answers: Record<string, never>;
    storageEngineFailedToConnect: boolean;
  }) => unknown) => selector({
    config: mockedStudyConfig,
    answers: {},
    storageEngineFailedToConnect: false,
  }),
  useStoreActions: () => ({
    toggleShowHelpText: vi.fn(),
    toggleStudyBrowser: vi.fn(),
    incrementHelpCounter: vi.fn(),
    setAlertModal: vi.fn(),
  }),
  useFlatSequence: () => [],
}));

vi.mock('../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({
    storageEngine: {
      updateProgressData: vi.fn().mockResolvedValue(undefined),
    },
  }),
}));

vi.mock('../../utils/handleComponentInheritance', () => ({
  studyComponentToIndividualComponent: () => ({}),
}));

vi.mock('../../store/hooks/useRecording', () => ({
  useRecordingContext: () => mockedRecordingContext,
}));

vi.mock('../../utils/notifications', () => ({
  hideNotification: vi.fn(),
  showNotification: vi.fn(() => 'notification-id'),
}));

vi.mock('../../utils/recordingWarnings', () => ({
  getMutedInstruction: () => 'Muted warning',
}));

vi.mock('../../utils/useDeviceRules', () => ({
  useDeviceRules: () => ({
    isBrowserAllowed: true,
    isDeviceAllowed: true,
    isInputAllowed: true,
    isDisplayAllowed: true,
  }),
}));

vi.mock('./RecordingAudioWaveform', () => ({
  RecordingAudioWaveform: () => <div>waveform</div>,
}));

describe('AppHeader', () => {
  beforeEach(() => {
    mockedRecordingContext = {
      isScreenRecording: false,
      isAudioRecording: false,
      setIsMuted: vi.fn(),
      isMuted: false,
      clickToRecord: false,
      isSpeakingWhileMuted: false,
      showMutedWarning: false,
      audioRecordingError: null,
      currentComponentHasAudioRecording: false,
      audioStatus: 'idle',
    };
  });

  test('shows disabled mic state when audio permission is denied before recording starts', () => {
    mockedRecordingContext = {
      ...mockedRecordingContext,
      currentComponentHasAudioRecording: true,
      audioRecordingError: 'Microphone permission denied or not supported.',
      audioStatus: 'denied',
    };

    const html = renderToStaticMarkup(<AppHeader developmentModeEnabled={false} dataCollectionEnabled />);

    expect(html).toContain('Microphone error');
    expect(html).toContain('Microphone permission denied or not supported.');
    expect(html).toContain('mic-off');
  });

  test('shows pending mic state before audio permission is granted', () => {
    mockedRecordingContext = {
      ...mockedRecordingContext,
      currentComponentHasAudioRecording: true,
      audioStatus: 'pending',
    };

    const html = renderToStaticMarkup(<AppHeader developmentModeEnabled={false} dataCollectionEnabled />);

    expect(html).toContain('Microphone pending');
    expect(html).toContain('Microphone not enabled yet');
    expect(html).toContain('mic-off');
  });
});
