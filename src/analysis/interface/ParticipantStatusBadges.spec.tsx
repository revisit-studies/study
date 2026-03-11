import { MantineProvider } from '@mantine/core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ParticipantStatusBadges } from './ParticipantStatusBadges';

describe('ParticipantStatusBadges', () => {
  it('renders completed/in progress/rejected counts', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <ParticipantStatusBadges completed={4} inProgress={2} rejected={1} />
      </MantineProvider>,
    );

    expect(html).toContain('4');
    expect(html).toContain('2');
    expect(html).toContain('1');
    expect(html).toContain('tabler-icon-check');
    expect(html).toContain('tabler-icon-progress');
    expect(html).toContain('tabler-icon-x');
  });
});
