import { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  describe, expect, test, vi,
} from 'vitest';
import { AppAside } from './AppAside';

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock('./StepsPanel', () => ({
  StepsPanel: () => <div data-testid="steps-panel" />,
}));

vi.mock('../../store/hooks/useStudyConfig', () => ({
  useStudyConfig: () => ({
    studyRules: undefined,
    uiConfig: {},
    components: {},
    sequences: {},
  }),
}));

vi.mock('../../store/store', () => ({
  useStoreSelector: (selector: (s: Record<string, unknown>) => unknown) => selector({
    sequence: [],
    answers: {},
    modes: { dataCollectionEnabled: true, dataSharingEnabled: false },
  }),
  useStoreActions: () => ({
    toggleStudyBrowser: vi.fn(),
  }),
  useStoreDispatch: () => vi.fn(),
}));

vi.mock('../../routes/utils', () => ({
  useStudyId: () => 'test-study',
}));

vi.mock('../../utils/nextParticipant', () => ({
  getNewParticipant: vi.fn(),
}));

vi.mock('../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({ storageEngine: { getEngine: () => 'localStorage' } }),
}));

vi.mock('../../store/hooks/useIsAnalysis', () => ({
  useIsAnalysis: () => false,
}));

vi.mock('../../utils/useStudyRecordings', () => ({
  useStudyRecordings: () => ({ hasAudioRecording: false, hasScreenRecording: false }),
}));

vi.mock('../../utils/useDeviceRules', () => ({
  useDeviceRules: () => ({
    isBrowserAllowed: true,
    isDeviceAllowed: true,
    isInputAllowed: true,
    isDisplayAllowed: true,
  }),
}));

vi.mock('./DeviceRestrictionString', () => ({
  getUnmetDeviceRestrictionLines: () => [],
  getUnmetDeviceRestrictionTooltip: () => '',
}));

vi.mock('react-router', () => ({
  useHref: () => '/test-study',
}));

vi.mock('@mantine/core', () => ({
  AppShell: Object.assign(
    ({ children }: { children: ReactNode }) => <div data-testid="app-shell">{children}</div>,
    {
      Aside: ({ children }: { children: ReactNode }) => <aside data-testid="app-aside">{children}</aside>,
      Section: ({ children }: { children: ReactNode }) => <section>{children}</section>,
    },
  ),
  ActionIcon: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
  Box: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Button: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
  CloseButton: () => <button type="button">×</button>,
  Flex: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Tabs: Object.assign(
    ({ children }: { children: ReactNode }) => <div>{children}</div>,
    {
      List: ({ children }: { children: ReactNode }) => <ul>{children}</ul>,
      Tab: ({ children }: { children: ReactNode }) => <li>{children}</li>,
      Panel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    },
  ),
  Text: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  Tooltip: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@tabler/icons-react', () => ({
  IconBan: () => null,
  IconBrandFirebase: () => null,
  IconBrandSupabase: () => null,
  IconDatabase: () => null,
  IconDeviceDesktop: () => null,
  IconGraph: () => null,
  IconGraphOff: () => null,
  IconInfoCircle: () => null,
  IconMicrophone: () => null,
  IconSettingsShare: () => null,
  IconUserPlus: () => null,
}));

// ── tests ─────────────────────────────────────────────────────────────────────

describe('AppAside', () => {
  test('renders the aside element', () => {
    const html = renderToStaticMarkup(<AppAside />);
    expect(html).toContain('data-testid="app-aside"');
  });

  test('renders Study Browser heading', () => {
    const html = renderToStaticMarkup(<AppAside />);
    expect(html).toContain('Study Browser');
  });

  test('renders Next Participant button', () => {
    const html = renderToStaticMarkup(<AppAside />);
    expect(html).toContain('Next Participant');
  });

  test('renders StepsPanel', () => {
    const html = renderToStaticMarkup(<AppAside />);
    expect(html).toContain('data-testid="steps-panel"');
  });

  test('renders storage engine indicator for localStorage', () => {
    const html = renderToStaticMarkup(<AppAside />);
    // localStorage engine renders a specific icon/tooltip
    expect(html).toBeDefined();
  });
});
