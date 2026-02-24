import { renderToStaticMarkup } from 'react-dom/server';
import { ReactNode } from 'react';
import {
  describe, expect, test, vi,
} from 'vitest';
import { ConfigVersionWarningModal } from './ConfigVersionWarningModal';

let mockedIsStalledConfig = false;
let mockedIsAnalysis = false;

vi.mock('@mantine/core', () => ({
  Modal: ({ opened, children }: { opened: boolean; children: ReactNode }) => (opened ? <div>{children}</div> : null),
  Alert: ({ title, children }: { title: string; children: ReactNode }) => (
    <div>
      <h2>{title}</h2>
      {children}
    </div>
  ),
  Button: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
  Group: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));

vi.mock('../../store/store', () => ({
  useStoreSelector: (selector: (state: { isStalledConfig: boolean }) => boolean) => selector({ isStalledConfig: mockedIsStalledConfig }),
}));

vi.mock('../../store/hooks/useIsAnalysis', () => ({
  useIsAnalysis: () => mockedIsAnalysis,
}));

vi.mock('../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({ storageEngine: undefined }),
}));

vi.mock('../../routes/utils', () => ({
  useStudyId: () => 'test-study',
}));

vi.mock('../../utils/nextParticipant', () => ({
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
