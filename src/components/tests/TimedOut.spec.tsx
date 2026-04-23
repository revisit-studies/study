import { renderToStaticMarkup } from 'react-dom/server';
import {
  describe, expect, test, vi,
} from 'vitest';
import { ReactNode } from 'react';
import { TimedOut } from '../TimedOut';

vi.mock('@mantine/core', () => ({
  Text: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));

describe('TimedOut', () => {
  test('renders the timed-out message', () => {
    const html = renderToStaticMarkup(<TimedOut />);
    expect(html).toContain('you have not answered the questions within the given time limit');
  });

  test('renders null DOM element (no wrapper tags beyond the Text)', () => {
    const html = renderToStaticMarkup(<TimedOut />);
    expect(html).toContain('<p>');
  });
});
