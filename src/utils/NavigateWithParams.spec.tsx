import { renderToStaticMarkup } from 'react-dom/server';
import {
  describe, expect, it, vi,
} from 'vitest';
import { NavigateWithParams } from './NavigateWithParams';

vi.mock('react-router', () => ({
  useSearchParams: () => [new URLSearchParams('a=1&b=2')],
  Navigate: ({ to }: { to: { pathname: string; search: string } }) => (
    <div>{`${to.pathname}?${to.search}`}</div>
  ),
}));

describe('NavigateWithParams', () => {
  it('builds a navigate target that preserves search params', () => {
    const html = renderToStaticMarkup(<NavigateWithParams to="/next" replace />);
    expect(html).toContain('/next?a=1&amp;b=2');
  });
});
