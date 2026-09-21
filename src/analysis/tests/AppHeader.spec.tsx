import { renderToStaticMarkup } from 'react-dom/server';
import {
  beforeEach, describe, expect, test, vi,
} from 'vitest';
import { ReactNode } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { AppHeader } from '../interface/AppHeader';

let mockPathname = '/analysis/stats/my-study';
let mockColorMode = 'light';
const mockToggleColorMode = vi.fn();

vi.mock('../../components/AppThemeProvider', () => ({
  useAppColorMode: () => ({ colorMode: mockColorMode, toggleColorMode: mockToggleColorMode }),
}));

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
    ActionIcon: ({ children, onClick, 'aria-label': label }: { children: ReactNode; onClick: () => void; 'aria-label': string }) => (
      <button type="button" aria-label={label} onClick={onClick}>{children}</button>
    ),
    Tooltip: Div,
  };
});

vi.mock('@tabler/icons-react', () => ({
  IconListCheck: () => null,
  IconSettings: () => <svg />,
  IconMoon: () => null,
  IconSun: () => null,
}));

beforeEach(() => {
  mockPathname = '/analysis/stats/my-study';
  mockColorMode = 'light';
  mockToggleColorMode.mockClear();
  cleanup();
});

describe('AppHeader', () => {
  test.each(['/', '/analysis/stats', '/analysis/stats/my-study/summary'])('offers a theme toggle on %s', (pathname) => {
    mockPathname = pathname;
    const { getByRole } = render(<AppHeader studyIds={[]} />);
    fireEvent.click(getByRole('button', { name: 'Switch to dark mode' }));
    expect(mockToggleColorMode).toHaveBeenCalledOnce();
  });

  test('labels the toggle with the destination mode', () => {
    mockColorMode = 'dark';
    const { getByRole } = render(<AppHeader studyIds={[]} />);
    expect(getByRole('button', { name: 'Switch to light mode' })).toBeDefined();
  });

  test.each(['/settings', '/login', '/demo-style', '/demo-analysis'])('does not offer a toggle on %s', (pathname) => {
    mockPathname = pathname;
    const { queryByRole } = render(<AppHeader studyIds={[]} />);
    expect(queryByRole('button', { name: /Switch to .* mode/ })).toBeNull();
  });

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

  test('does not crash when a loaded config has no schema', () => {
    const html = renderToStaticMarkup(
      <AppHeader studyIds={['my-study']} studyConfigs={{ 'my-study': {} }} />,
    );
    expect(html).toContain('ReVISit Analytics Platform');
  });
});
