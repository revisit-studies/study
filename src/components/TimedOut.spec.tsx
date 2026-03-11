import { MantineProvider } from '@mantine/core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TimedOut } from './TimedOut';

describe('TimedOut', () => {
  it('renders timeout message', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <TimedOut />
      </MantineProvider>,
    );
    expect(html).toContain('you are no longer eligible to participate in the study');
  });
});
