import { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  beforeEach, describe, expect, test, vi,
} from 'vitest';
import { ResourceNotFound } from './ResourceNotFound';

let mockPathname = '/some/path';

vi.mock('react-router', () => ({
  useLocation: () => ({ pathname: mockPathname }),
}));

vi.mock('@mantine/core', () => ({
  Container: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Title: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  Text: ({ children, span }: { children: ReactNode; span?: boolean }) => (
    span ? <span>{children}</span> : <p>{children}</p>
  ),
  List: Object.assign(
    ({ children }: { children: ReactNode }) => <ul>{children}</ul>,
    { Item: ({ children }: { children: ReactNode }) => <li>{children}</li> },
  ),
  Space: () => <div />,
  Anchor: ({ children, href }: { children: ReactNode; href?: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('ResourceNotFound', () => {
  beforeEach(() => {
    mockPathname = '/some/path';
  });

  test('renders 404', () => {
    const html = renderToStaticMarkup(<ResourceNotFound />);
    expect(html).toContain('404');
  });

  test('shows path prop when provided', () => {
    const html = renderToStaticMarkup(<ResourceNotFound path="/custom/path" />);
    expect(html).toContain('/custom/path');
  });

  test('falls back to location.pathname when path prop not provided', () => {
    mockPathname = '/study/my-study';
    const html = renderToStaticMarkup(<ResourceNotFound />);
    expect(html).toContain('/study/my-study');
  });

  test('renders email anchor when email provided', () => {
    const html = renderToStaticMarkup(<ResourceNotFound email="test@test.com" />);
    expect(html).toContain('href="mailto:test@test.com"');
    expect(html).toContain('test@test.com');
  });

  test('does not render email anchor when no email provided', () => {
    const html = renderToStaticMarkup(<ResourceNotFound />);
    expect(html).not.toContain('mailto:');
  });
});
