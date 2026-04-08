import { renderToStaticMarkup } from 'react-dom/server';
import {
  describe, expect, test, vi,
} from 'vitest';
import { ReactNode } from 'react';
import { ScreenRecordingRejection } from '../ScreenRecordingRejection';

vi.mock('@mantine/core', () => ({
  Modal: ({ children }: { children: ReactNode }) => <div role="dialog">{children}</div>,
  Stack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Title: ({ children }: { children: ReactNode }) => <h3>{children}</h3>,
  Text: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));

vi.mock('@tabler/icons-react', () => ({
  IconAlertTriangle: () => <svg data-testid="alert-icon" />,
}));

describe('ScreenRecordingRejection', () => {
  test('renders the stopped title', () => {
    const html = renderToStaticMarkup(<ScreenRecordingRejection />);
    expect(html).toContain('Screen Recording Stopped');
  });

  test('renders the explanation text', () => {
    const html = renderToStaticMarkup(<ScreenRecordingRejection />);
    expect(html).toContain('Screen recording was stopped');
  });

  test('renders the close page instruction', () => {
    const html = renderToStaticMarkup(<ScreenRecordingRejection />);
    expect(html).toContain('close this page');
  });
});
