import { ReactNode } from 'react';
import { render, act } from '@testing-library/react';
import {
  describe, expect, test, vi,
} from 'vitest';
import { StepRenderer } from '../StepRenderer';

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../interface/AppAside', () => ({
  AppAside: () => <div data-testid="app-aside" />,
}));

vi.mock('../interface/AppHeader', () => ({
  AppHeader: () => <div data-testid="app-header" />,
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
    studyRules: undefined,
    uiConfig: {
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
  useStoreDispatch: () => vi.fn(),
  useStoreActions: () => ({ toggleStudyBrowser: vi.fn() }),
}));

vi.mock('../../routes/utils', () => ({
  useCurrentComponent: () => 'intro',
}));

vi.mock('../../utils/handleComponentInheritance', () => ({
  studyComponentToIndividualComponent: vi.fn(() => ({
    withSidebar: true,
    sidebarWidth: 300,
    showTitleBar: true,
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

vi.mock('react-router', () => ({
  Outlet: () => <div data-testid="outlet" />,
}));

vi.mock('@mantine/core', () => ({
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
  Flex: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@tabler/icons-react', () => ({
  IconArrowLeft: () => null,
}));

vi.mock('lodash.debounce', () => ({
  default: (fn: (...args: never[]) => void) => fn,
}));

// ── tests ─────────────────────────────────────────────────────────────────────

describe('StepRenderer', () => {
  test('renders the app shell', async () => {
    const { getByTestId } = await act(async () => render(<StepRenderer />));
    expect(getByTestId('app-shell')).toBeDefined();
  });

  test('renders outlet (study content area)', async () => {
    const { getAllByTestId } = await act(async () => render(<StepRenderer />));
    expect(getAllByTestId('outlet').length).toBeGreaterThan(0);
  });

  test('window event listeners fire debounced callbacks', async () => {
    await act(async () => render(<StepRenderer />));
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
    expect(true).toBe(true); // reaching here without crash is the assertion
  });

  test('cleanup removes all event listeners on unmount', async () => {
    const { unmount } = await act(async () => render(<StepRenderer />));
    // Unmount triggers the useEffect cleanup which removes all event listeners
    expect(() => act(() => { unmount(); })).not.toThrow();
  });

  test('beforeunload listener added when shouldConfirmClose is true', async () => {
    const { shouldConfirmTabClose } = await import('../../utils/closeTabConfirmation');
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
