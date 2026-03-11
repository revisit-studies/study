import { renderToStaticMarkup } from 'react-dom/server';
import {
  describe, expect, it, vi,
} from 'vitest';
import { useIsAnalysis } from './useIsAnalysis';

let query = '';

vi.mock('react-router', () => ({
  useSearchParams: () => [new URLSearchParams(query)],
}));

function Probe() {
  const isAnalysis = useIsAnalysis();
  return <div>{String(isAnalysis)}</div>;
}

describe('useIsAnalysis', () => {
  it('returns true when participantId exists in query string', () => {
    query = 'participantId=p1';
    const html = renderToStaticMarkup(<Probe />);
    expect(html).toContain('true');
  });

  it('returns false when participantId does not exist', () => {
    query = 'foo=bar';
    const html = renderToStaticMarkup(<Probe />);
    expect(html).toContain('false');
  });
});
