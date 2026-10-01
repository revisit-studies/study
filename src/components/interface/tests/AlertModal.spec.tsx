import { ReactNode } from 'react';
import {
  act, cleanup, fireEvent, render, screen, waitFor,
} from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { AlertModal } from '../AlertModal';

// ── mutable state ─────────────────────────────────────────────────────────────

let mockAlertModal = { show: false, title: '', message: '' };
let mockSetAlertModal = vi.fn();
let mockStoreDispatch = vi.fn();
let mockRetryFailedWrites = vi.fn();
const originalClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../../store/store', () => ({
  useStoreSelector: (selector: (s: Record<string, unknown>) => unknown) => selector({
    alertModal: mockAlertModal,
    config: { uiConfig: { contactEmail: 'test@test.com' } },
    studyId: 'test-study',
    participantId: 'p1',
    metadata: {
      userAgent: 'test-agent',
      resolution: { width: 1920, height: 1080 },
      ip: '127.0.0.1',
      language: 'en',
    },
  }),
  useStoreActions: () => ({ setAlertModal: mockSetAlertModal }),
  useStoreDispatch: () => mockStoreDispatch,
}));

vi.mock('../../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({
    storageEngine: {
      retryFailedWrites: mockRetryFailedWrites,
    },
  }),
}));

vi.mock('@mantine/core', () => ({
  ActionIcon: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>{children}</button>
  ),
  Alert: ({
    children, title, icon,
  }: { children: ReactNode; title?: ReactNode; icon?: ReactNode }) => (
    <div role="alert">
      {icon}
      <div>{title}</div>
      {children}
    </div>
  ),
  Anchor: ({ children, href }: { children: ReactNode; href?: string }) => (
    <a href={href}>{children}</a>
  ),
  Box: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Button: ({
    children, component, href, loading, onClick, rel, target,
  }: {
    children: ReactNode;
    component?: string;
    href?: string;
    loading?: boolean;
    onClick?: () => void;
    rel?: string;
    target?: string;
  }) => (component === 'a'
    ? <a href={href} rel={rel} target={target}>{children}</a>
    : <button type="button" disabled={loading} onClick={onClick}>{children}</button>),
  Code: ({ children }: { children: ReactNode }) => <pre>{children}</pre>,
  Group: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Modal: ({ opened, children }: { opened: boolean; children: ReactNode }) => (
    opened ? <div role="dialog">{children}</div> : null
  ),
  Text: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));

vi.mock('@tabler/icons-react', () => ({
  IconAlertCircle: () => null,
  IconCheck: () => <span>check</span>,
  IconCopy: () => <span>copy</span>,
  IconExternalLink: () => <span>external</span>,
}));

// ── tests ─────────────────────────────────────────────────────────────────────

describe('AlertModal', () => {
  beforeEach(() => {
    mockAlertModal = { show: false, title: '', message: '' };
    mockSetAlertModal = vi.fn((payload) => payload);
    mockStoreDispatch = vi.fn();
    mockRetryFailedWrites = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    if (originalClipboardDescriptor) {
      Object.defineProperty(navigator, 'clipboard', originalClipboardDescriptor);
    } else {
      Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  test('renders nothing when alertModal.show is false', () => {
    const html = renderToStaticMarkup(<AlertModal />);
    expect(html).toBe('');
  });

  test('renders modal content when alertModal.show is true', () => {
    mockAlertModal = { show: true, title: 'Error', message: 'Something went wrong' };
    const html = renderToStaticMarkup(<AlertModal />);
    expect(html).toContain('Something went wrong');
    expect(html).toContain('Error');
  });

  test('shows email anchor and diagnostics for storage engine alert', () => {
    mockAlertModal = {
      show: true,
      title: 'Failed to connect to the storage engine',
      message: 'Connection refused',
    };
    const html = renderToStaticMarkup(<AlertModal />);
    expect(html).toContain('mailto:test@test.com');
    expect(html).toContain('Study ID: test-study');
    expect(html).toContain('Participant ID: p1');
    expect(html).toContain('Reconnect');
  });

  test('treats mid-study save failure alert as a blocking storage alert', () => {
    mockAlertModal = {
      show: true,
      title: 'Failed to Save Response',
      message: 'Your response could not be saved',
    };
    const html = renderToStaticMarkup(<AlertModal />);
    expect(html).toContain('Retry');
    expect(html).not.toContain('Continue Study');
    expect(html).toContain('Study ID: test-study');
  });

  test('does not show diagnostics for regular (non-storage) alert', () => {
    mockAlertModal = { show: true, title: 'Generic Error', message: 'Test' };
    const html = renderToStaticMarkup(<AlertModal />);
    expect(html).not.toContain('Study ID:');
    expect(html).not.toContain('mailto:');
  });

  test('renders Continue Study button when modal is open', () => {
    mockAlertModal = { show: true, title: 'Error', message: 'msg' };
    const html = renderToStaticMarkup(<AlertModal />);
    expect(html).toContain('Continue Study');
  });

  test('renders Firebase index errors with open and copy actions', async () => {
    const indexUrl = 'https://console.firebase.google.com/v1/r/project/example/firestore/indexes?create_composite=abc123';
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('isSecureContext', true);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    mockAlertModal = {
      show: true,
      title: 'Problem loading the study',
      message: `The query requires an index. You can create it here: ${indexUrl}`,
    };

    render(<AlertModal />);

    expect(screen.getByRole('link', { name: /Open Firebase index setup/ }).getAttribute('href')).toBe(indexUrl);
    expect(screen.getByText(indexUrl)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /Copy setup URL/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(indexUrl));
    expect(screen.getByRole('button', { name: /Copied/ })).toBeDefined();
  });

  test('reconnect reloads the page without closing storage engine alert', () => {
    const reloadSpy = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        href: 'https://example.com/study',
        reload: reloadSpy,
      },
    });
    mockAlertModal = {
      show: true,
      title: 'Failed to connect to the storage engine',
      message: 'Connection refused',
    };

    try {
      render(<AlertModal />);
      fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }));

      expect(reloadSpy).toHaveBeenCalledTimes(1);
      expect(mockSetAlertModal).not.toHaveBeenCalled();
      expect(mockStoreDispatch).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      });
    }
  });

  test('retry keeps the save failure modal open until all failed writes are saved', async () => {
    let resolveRetry: (() => void) | undefined;
    mockRetryFailedWrites.mockImplementation(() => new Promise<void>((resolve) => {
      resolveRetry = resolve;
    }));
    mockAlertModal = {
      show: true,
      title: 'Failed to Save Response',
      message: 'Your response could not be saved',
    };

    render(<AlertModal />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(mockRetryFailedWrites).toHaveBeenCalledTimes(1);
    expect(mockStoreDispatch).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Retry' })).toHaveProperty('disabled', true);

    await act(async () => resolveRetry?.());

    await waitFor(() => expect(mockStoreDispatch).toHaveBeenCalledWith(expect.objectContaining({
      show: false,
      title: '',
    })));
  });

  test('retry failure leaves the save failure modal open for another attempt', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockRetryFailedWrites.mockRejectedValue(new Error('still offline'));
    mockAlertModal = {
      show: true,
      title: 'Failed to Save Response',
      message: 'Your response could not be saved',
    };

    render(<AlertModal />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(mockRetryFailedWrites).toHaveBeenCalledTimes(1));
    expect(mockStoreDispatch).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Retry' })).toHaveProperty('disabled', false));
  });
});
