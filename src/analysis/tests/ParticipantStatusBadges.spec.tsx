import { renderToStaticMarkup } from 'react-dom/server';
import {
  describe, expect, test, vi,
} from 'vitest';
import { ReactNode } from 'react';
import { ParticipantStatusBadges } from '../interface/ParticipantStatusBadges';

vi.mock('@mantine/core', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => children,
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Flex: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@tabler/icons-react', () => ({
  IconCheck: () => null,
  IconProgress: () => null,
  IconX: () => null,
}));

describe('ParticipantStatusBadges', () => {
  test('displays the completed count', () => {
    const html = renderToStaticMarkup(<ParticipantStatusBadges completed={10} inProgress={3} rejected={1} />);
    expect(html).toContain('10');
  });

  test('displays the inProgress count', () => {
    const html = renderToStaticMarkup(<ParticipantStatusBadges completed={0} inProgress={5} rejected={0} />);
    expect(html).toContain('5');
  });

  test('displays the rejected count', () => {
    const html = renderToStaticMarkup(<ParticipantStatusBadges completed={0} inProgress={0} rejected={2} />);
    expect(html).toContain('2');
  });

  test('displays all three counts at once', () => {
    const html = renderToStaticMarkup(<ParticipantStatusBadges completed={4} inProgress={7} rejected={1} />);
    expect(html).toContain('4');
    expect(html).toContain('7');
    expect(html).toContain('1');
  });
});
