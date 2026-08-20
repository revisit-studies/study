import { renderToStaticMarkup } from 'react-dom/server';
import {
  beforeEach, describe, expect, test, vi,
} from 'vitest';
import { ReactNode } from 'react';
import { AppHeader } from '../interface/AppHeader';

let mockPathname = '/analysis/stats/my-study';

vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
  useParams: vi.fn(() => ({ studyId: 'my-study' })),
  useLocation: () => ({ pathname: mockPathname }),
}));

vi.mock('../../utils/Prefix', () => ({ PREFIX: '/' }));

vi.mock('@mantine/core', () => {
  function Div({ children }: { children?: ReactNode }) {
    return <div>{children}</div>;
  }
  const GridWithCol = Object.assign(Div, { Col: Div });
  const AppShellWithHeader = Object.assign(Div, {
    Header: ({ children }: { children?: ReactNode }) => <header>{children}</header>,
  });
  return {
    AppShell: AppShellWithHeader,
    Grid: GridWithCol,
    Flex: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) => <div onClick={onClick}>{children}</div>,
    Image: ({ alt }: { alt?: string }) => <img alt={alt} />,
    Space: () => null,
    Title: ({ children }: { children?: ReactNode }) => <h1>{children}</h1>,
    Select: ({ value }: { value?: string }) => <select><option>{value}</option></select>,
    Button: ({ children }: { children?: ReactNode }) => <button type="button">{children}</button>,
  };
});

vi.mock('@tabler/icons-react', () => ({
  IconListCheck: () => null,
  IconSettings: () => <svg />,
}));

beforeEach(() => {
  mockPathname = '/analysis/stats/my-study';
});

describe('AppHeader', () => {
  test('shows analytics platform title when in analysis route', () => {
    const html = renderToStaticMarkup(<AppHeader studyIds={['my-study']} />);
    expect(html).toContain('ReVISit Analytics Platform');
  });

  test('shows studies title when not in analysis route', () => {
    mockPathname = '/';
    const html = renderToStaticMarkup(<AppHeader studyIds={['my-study']} />);
    expect(html).toContain('ReVISit Studies');
  });

  test('renders the logo image', () => {
    const html = renderToStaticMarkup(<AppHeader studyIds={['my-study']} />);
    expect(html).toContain('Revisit Logo');
  });

  test('renders Go to Study button in analysis route', () => {
    const html = renderToStaticMarkup(<AppHeader studyIds={['my-study']} selectedStudyId="my-study" />);
    expect(html).toContain('Go to Study');
  });
});
