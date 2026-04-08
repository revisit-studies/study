import { renderToStaticMarkup } from 'react-dom/server';
import {
  render, act, cleanup, screen, fireEvent,
} from '@testing-library/react';
import { ReactNode } from 'react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { ConfigVersionWarningModal } from '../ConfigVersionWarningModal';

let mockedIsStalledConfig = false;
let mockedIsAnalysis = false;

vi.mock('@mantine/core', () => ({
  Affix: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Alert: ({ title, children }: { title: string; children: ReactNode }) => (
    <div>
      <h2>{title}</h2>
      {children}
    </div>
  ),
  Button: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => <button type="button" onClick={onClick}>{children}</button>,
  Group: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));

vi.mock('../../../store/store', () => ({
  useStoreSelector: (
    selector: (state: { isStalledConfig: boolean; modes: { developmentModeEnabled: boolean } }) => boolean,
  ) => selector({ isStalledConfig: mockedIsStalledConfig, modes: { developmentModeEnabled: true } }),
}));

vi.mock('../../../store/hooks/useIsAnalysis', () => ({
  useIsAnalysis: () => mockedIsAnalysis,
}));

vi.mock('../../../store/hooks/useStudyConfig', () => ({
  useStudyConfig: () => ({ uiConfig: { contactEmail: 'admin@example.com' } }),
}));

vi.mock('../../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({ storageEngine: undefined }),
}));

vi.mock('../../../routes/utils', () => ({
  useStudyId: () => 'test-study',
}));

vi.mock('../../../utils/nextParticipant', () => ({
  getNewParticipant: vi.fn(),
}));

vi.mock('react-router', () => ({
  useHref: () => '/test-study',
}));

describe('ConfigVersionWarningModal', () => {
  test('does not show warning when stalled config is false', () => {
    mockedIsStalledConfig = false;
    mockedIsAnalysis = false;

    const html = renderToStaticMarkup(<ConfigVersionWarningModal />);
    expect(html).not.toContain('Study Configuration Has Changed');
  });

  test('shows warning when stalled config is detected in participant mode', () => {
    mockedIsStalledConfig = true;
    mockedIsAnalysis = false;

    const html = renderToStaticMarkup(<ConfigVersionWarningModal />);
    expect(html).toContain('Study Configuration Has Changed');
  });

  test('does not show warning during analysis replay', () => {
    mockedIsStalledConfig = true;
    mockedIsAnalysis = true;

    const html = renderToStaticMarkup(<ConfigVersionWarningModal />);
    expect(html).not.toContain('Study Configuration Has Changed');
  });
});

describe('ConfigVersionWarningModal — interactive / effect branches', () => {
  beforeEach(() => {
    mockedIsStalledConfig = false;
    mockedIsAnalysis = false;
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  test('modal auto-dismisses after 10 seconds', async () => {
    mockedIsStalledConfig = true;
    await act(async () => { render(<ConfigVersionWarningModal />); });
    expect(screen.getByText('Study Configuration Has Changed')).toBeDefined();

    await act(async () => { vi.advanceTimersByTime(10001); });
    expect(screen.queryByText('Study Configuration Has Changed')).toBeNull();
  });

  test('"Next Participant" button calls getNewParticipant', async () => {
    const { getNewParticipant } = await import('../../../utils/nextParticipant');
    mockedIsStalledConfig = true;

    await act(async () => { render(<ConfigVersionWarningModal />); });

    await act(async () => {
      fireEvent.click(screen.getByText('Next Participant'));
    });

    expect(vi.mocked(getNewParticipant)).toHaveBeenCalled();
  });

  test('modal is hidden when studyConfig is stalled but analysis mode is active', async () => {
    mockedIsStalledConfig = true;
    mockedIsAnalysis = true;

    await act(async () => { render(<ConfigVersionWarningModal />); });
    expect(screen.queryByText('Study Configuration Has Changed')).toBeNull();
  });
});
