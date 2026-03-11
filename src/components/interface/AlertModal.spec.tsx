import { MantineProvider } from '@mantine/core';
import { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  describe, expect, it, vi,
} from 'vitest';
import { AlertModal } from './AlertModal';

vi.mock('@mantine/core', async () => {
  const actual = await vi.importActual<typeof import('@mantine/core')>('@mantine/core');
  return {
    ...actual,
    Modal: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  };
});

vi.mock('../../store/store', () => {
  const state = {
    alertModal: {
      show: true,
      title: 'Failed to connect to the storage engine',
      message: 'Connection failed.',
    },
    config: { uiConfig: { contactEmail: 'support@example.com' } },
    studyId: 'study-a',
    participantId: 'p1',
    metadata: {
      userAgent: 'ua',
      resolution: { width: 100, height: 100 },
      ip: '127.0.0.1',
      language: 'en-US',
    },
  };

  return {
    useStoreSelector: (selector: (s: typeof state) => unknown) => selector(state),
    useStoreDispatch: () => vi.fn(),
    useStoreActions: () => ({ setAlertModal: (payload: unknown) => payload }),
  };
});

describe('AlertModal', () => {
  it('renders storage engine diagnostic guidance', () => {
    Object.defineProperty(globalThis, 'window', {
      value: {
        location: { href: 'http://localhost/study' },
        isSecureContext: false,
      },
      configurable: true,
    });

    const html = renderToStaticMarkup(
      <MantineProvider>
        <AlertModal />
      </MantineProvider>,
    );
    expect(html).toContain('Failed to connect to the storage engine');
    expect(html).toContain('support@example.com');
    expect(html).toContain('Continue Study');
  });
});
