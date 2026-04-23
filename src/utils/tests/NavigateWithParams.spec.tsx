import { renderToStaticMarkup } from 'react-dom/server';
import {
  describe, expect, test, vi,
} from 'vitest';
import { NavigateWithParams } from '../NavigateWithParams';

vi.mock('react-router', () => ({
  useSearchParams: vi.fn(() => [new URLSearchParams({ step: '2', participantId: 'pid-1' })]),
  Navigate: ({ to }: { to: { pathname: string; search: string } }) => (
    <div data-pathname={to.pathname} data-search={to.search} />
  ),
}));

describe('NavigateWithParams', () => {
  test('passes the target pathname to Navigate', () => {
    const html = renderToStaticMarkup(<NavigateWithParams to="/dashboard" />);
    expect(html).toContain('/dashboard');
  });

  test('forwards current search params to the Navigate destination', () => {
    const html = renderToStaticMarkup(<NavigateWithParams to="/next" />);
    expect(html).toContain('step=2');
    expect(html).toContain('participantId=pid-1');
  });
});
