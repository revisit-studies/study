import { MantineProvider } from '@mantine/core';
import { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  describe, expect, it, vi,
} from 'vitest';
import { ScreenRecordingRejection } from './ScreenRecordingRejection';

vi.mock('@mantine/core', async () => {
  const actual = await vi.importActual<typeof import('@mantine/core')>('@mantine/core');
  return {
    ...actual,
    Modal: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  };
});

describe('ScreenRecordingRejection', () => {
  it('renders full-screen rejection message', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <ScreenRecordingRejection />
      </MantineProvider>,
    );
    expect(html).toContain('Screen Recording Stopped');
    expect(html).toContain('you will not be able to continue');
  });
});
