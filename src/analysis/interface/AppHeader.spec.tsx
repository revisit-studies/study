import { MantineProvider } from '@mantine/core';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReactNode } from 'react';
import {
  describe, expect, it, vi,
} from 'vitest';
import { AppHeader } from './AppHeader';

let mockedPathname = '/analysis/stats/study-a';
const mockedStudyId = 'study-a';

vi.mock('@mantine/core', async () => {
  const actual = await vi.importActual<typeof import('@mantine/core')>('@mantine/core');
  type AppShellWithHeader = {
    ({ children }: { children: ReactNode }): ReactNode;
    Header: ({ children }: { children: ReactNode }) => ReactNode;
  };
  function MockAppShell({ children }: { children: ReactNode }) {
    return <div>{children}</div>;
  }
  function MockAppShellHeader({ children }: { children: ReactNode }) {
    return <div>{children}</div>;
  }
  const mockAppShellWithHeader = MockAppShell as AppShellWithHeader;
  mockAppShellWithHeader.Header = MockAppShellHeader;
  return {
    ...actual,
    AppShell: mockAppShellWithHeader,
  };
});

vi.mock('react-router', () => ({
  useLocation: () => ({ pathname: mockedPathname }),
  useNavigate: () => vi.fn(),
  useParams: () => ({ studyId: mockedStudyId }),
}));

describe('Analysis AppHeader', () => {
  it('renders analytics title and analysis controls on analysis routes', () => {
    mockedPathname = '/analysis/stats/study-a';
    const html = renderToStaticMarkup(
      <MantineProvider>
        <AppHeader studyIds={['study-a', 'study-b']} />
      </MantineProvider>,
    );

    expect(html).toContain('ReVISit Analytics Platform');
    expect(html).toContain('Go to Study');
    expect(html).toContain('Select Study');
  });

  it('renders studies title on non-analysis routes', () => {
    mockedPathname = '/';
    const html = renderToStaticMarkup(
      <MantineProvider>
        <AppHeader studyIds={['study-a']} />
      </MantineProvider>,
    );

    expect(html).toContain('ReVISit Studies');
  });
});
