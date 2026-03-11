import { renderToStaticMarkup } from 'react-dom/server';
import { MantineProvider } from '@mantine/core';
import {
  describe, expect, it, vi,
} from 'vitest';
import { ResourceNotFound } from './ResourceNotFound';

const mockedPathname = '/missing-path';

vi.mock('react-router', () => ({
  useLocation: () => ({ pathname: mockedPathname }),
}));

describe('ResourceNotFound', () => {
  it('renders location pathname when explicit path prop is not provided', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <ResourceNotFound />
      </MantineProvider>,
    );

    expect(html).toContain('/missing-path');
    expect(html).toContain('not found');
  });

  it('renders provided path and contact mailto when email is provided', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <ResourceNotFound path="/custom-path" email="admin@example.com" />
      </MantineProvider>,
    );

    expect(html).toContain('/custom-path');
    expect(html).toContain('mailto:admin@example.com');
    expect(html).toContain('admin@example.com');
  });
});
