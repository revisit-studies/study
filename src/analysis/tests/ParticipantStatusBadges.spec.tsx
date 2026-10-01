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
  IconClockOff: () => null,
  IconProgress: () => null,
  IconX: () => null,
}));

describe('ParticipantStatusBadges', () => {
  const noCounts = {
    completed: 0, inProgress: 0, rejected: 0, timedOut: 0, completedLate: 0,
  };

  test('displays the completed count', () => {
    const html = renderToStaticMarkup(<ParticipantStatusBadges {...noCounts} completed={10} />);
    expect(html).toContain('10');
  });

  test('displays the inProgress count', () => {
    const html = renderToStaticMarkup(<ParticipantStatusBadges {...noCounts} inProgress={5} />);
    expect(html).toContain('5');
  });

  test('displays the rejected count', () => {
    const html = renderToStaticMarkup(<ParticipantStatusBadges {...noCounts} rejected={2} />);
    expect(html).toContain('2');
  });

  test('displays the timedOut count', () => {
    const html = renderToStaticMarkup(<ParticipantStatusBadges {...noCounts} timedOut={6} />);
    expect(html).toContain('6');
  });

  test('displays the completedLate count', () => {
    const html = renderToStaticMarkup(<ParticipantStatusBadges {...noCounts} completedLate={9} />);
    expect(html).toContain('9');
  });

  test('displays all counts at once', () => {
    const html = renderToStaticMarkup(
      <ParticipantStatusBadges completed={4} inProgress={7} rejected={1} timedOut={3} completedLate={8} />,
    );
    ['4', '7', '1', '3', '8'].forEach((count) => expect(html).toContain(count));
  });
});
