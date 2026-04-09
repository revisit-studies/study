import { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  render, act, cleanup, screen, fireEvent,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { GlobalSettings } from './GlobalSettings';

// ── mutable state ─────────────────────────────────────────────────────────────

let mockIsCloud = true;
let mockGetUserManagementData = vi.fn().mockResolvedValue(null);
let mockStorageEngine: Record<string, ReturnType<typeof vi.fn>> | null = null;

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../store/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { user: { email: 'test@test.com' } },
    triggerAuth: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock('../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({ storageEngine: mockStorageEngine }),
}));

vi.mock('../../storage/engines/utils', () => ({
  isCloudStorageEngine: () => mockIsCloud,
}));

vi.mock('../../Login', () => ({
  signIn: vi.fn(),
}));

vi.mock('../../storage/engines/SupabaseStorageEngine', () => ({
  SupabaseStorageEngine: class { },
}));

vi.mock('@mantine/form', () => ({
  useForm: () => ({
    values: { email: '' },
    getInputProps: () => ({}),
    onSubmit: (fn: () => void) => fn,
    setValues: vi.fn(),
  }),
  isEmail: () => () => null,
}));

vi.mock('@mantine/core', () => ({
  ActionIcon: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>{children}</button>
  ),
  Box: ({ children, component, onSubmit }: { children: ReactNode; component?: string; onSubmit?: React.FormEventHandler }) => (
    component === 'form' ? <form onSubmit={onSubmit}>{children}</form> : <div>{children}</div>
  ),
  Button: ({
    children, onClick, type,
  }: { children: ReactNode; onClick?: () => void; type?: 'button' | 'submit' | 'reset' }) => (
    <button type={type === 'submit' ? 'submit' : 'button'} onClick={onClick}>{children}</button>
  ),
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Container: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Flex: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  LoadingOverlay: ({ visible }: { visible: boolean }) => (
    visible ? <div data-testid="loading-overlay" /> : null
  ),
  Modal: ({ opened, children, title }: { opened: boolean; children: ReactNode; title?: ReactNode }) => (
    opened ? (
      <div role="dialog">
        {title}
        {children}
      </div>
    ) : null
  ),
  Text: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  TextInput: ({ label }: { label?: ReactNode }) => <input aria-label={label?.toString() ?? ''} />,
  Title: ({ children }: { children: ReactNode }) => <h3>{children}</h3>,
  Tooltip: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@tabler/icons-react', () => ({
  IconAt: () => null,
  IconTrashX: () => null,
  IconUserPlus: ({ onClick }: { onClick?: () => void }) => <button type="button" data-testid="icon-user-plus" onClick={onClick} />,
}));

// ── tests ─────────────────────────────────────────────────────────────────────

describe('GlobalSettings', () => {
  beforeEach(() => {
    mockIsCloud = true;
    mockGetUserManagementData = vi.fn().mockResolvedValue(null);
    mockStorageEngine = {
      getUserManagementData: mockGetUserManagementData,
      getEngine: vi.fn().mockReturnValue('supabase'),
    };
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test('shows "disabled" state initially (no effects in static render)', () => {
    const html = renderToStaticMarkup(<GlobalSettings />);
    expect(html).toContain('Authentication is currently disabled');
    expect(html).toContain('Enable Authentication');
  });

  test('does not show loading overlay initially', () => {
    const html = renderToStaticMarkup(<GlobalSettings />);
    expect(html).not.toContain('data-testid="loading-overlay"');
  });

  test('shows "enabled" state after effect resolves with isEnabled:true', async () => {
    mockGetUserManagementData.mockImplementation(async (key: string) => {
      if (key === 'authentication') return { isEnabled: true };
      if (key === 'adminUsers') return { adminUsersList: [{ email: 'test@test.com', uid: '1' }] };
      return null;
    });

    await act(async () => {
      render(<GlobalSettings />);
    });

    expect(screen.getByText('Authentication is enabled.')).toBeDefined();
    expect(screen.queryByText('Authentication is currently disabled.')).toBeNull();
  });

  test('shows "disabled" state after effect resolves with isEnabled:false', async () => {
    mockGetUserManagementData.mockImplementation(async (key: string) => {
      if (key === 'authentication') return { isEnabled: false };
      return null;
    });

    await act(async () => {
      render(<GlobalSettings />);
    });

    expect(screen.getByText('Authentication is currently disabled.')).toBeDefined();
  });

  test('shows "disabled" state when storageEngine is not a cloud engine', async () => {
    mockIsCloud = false;

    await act(async () => {
      render(<GlobalSettings />);
    });

    expect(screen.getByText('Authentication is currently disabled.')).toBeDefined();
    expect(mockGetUserManagementData).not.toHaveBeenCalled();
  });

  test('opens enable-auth confirm modal via supabase session on button click', async () => {
    mockStorageEngine = {
      getUserManagementData: mockGetUserManagementData,
      getEngine: vi.fn().mockReturnValue('supabase'),
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { email: 'test@test.com', id: '123' } } },
      }),
    };
    mockGetUserManagementData.mockImplementation(async (key: string) => {
      if (key === 'authentication') return { isEnabled: false };
      return null;
    });

    await act(async () => {
      render(<GlobalSettings />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Enable Authentication'));
    });

    expect(screen.getByText('Enable Authentication?')).toBeDefined();
  });

  test('shows trash button and opens remove modal for non-current admin user', async () => {
    mockGetUserManagementData.mockImplementation(async (key: string) => {
      if (key === 'authentication') return { isEnabled: true };
      if (key === 'adminUsers') {
        return { adminUsersList: [{ email: 'other@test.com', uid: '2' }] };
      }
      return null;
    });

    await act(async () => {
      render(<GlobalSettings />);
    });

    expect(screen.getByText('other@test.com')).toBeDefined();

    await act(async () => {
      const buttons = screen.getAllByRole('button');
      const trashButton = buttons.find((b) => !b.textContent && b.getAttribute('type') === 'button' && !b.getAttribute('data-testid'));
      if (trashButton) fireEvent.click(trashButton);
    });

    // Remove modal should be open (has "Are you sure" text)
    const dialogs = screen.queryAllByRole('dialog');
    expect(dialogs.length).toBeGreaterThan(0);
  });

  test('confirmRemoveUser calls removeAdminUser and refreshes list', async () => {
    const mockRemoveAdminUser = vi.fn().mockResolvedValue(undefined);
    mockStorageEngine = {
      getUserManagementData: mockGetUserManagementData,
      getEngine: vi.fn().mockReturnValue('supabase'),
      removeAdminUser: mockRemoveAdminUser,
    };
    mockGetUserManagementData.mockImplementation(async (key: string) => {
      if (key === 'authentication') return { isEnabled: true };
      if (key === 'adminUsers') {
        return { adminUsersList: [{ email: 'other@test.com', uid: '2' }] };
      }
      return null;
    });

    await act(async () => {
      render(<GlobalSettings />);
    });

    // Open remove modal
    await act(async () => {
      const buttons = screen.getAllByRole('button');
      const trashButton = buttons.find((b) => !b.textContent && b.getAttribute('type') === 'button' && !b.getAttribute('data-testid'));
      if (trashButton) fireEvent.click(trashButton);
    });

    // Click "Yes, I'm sure."
    await act(async () => {
      fireEvent.click(screen.getByText(/yes.*sure/i));
    });

    expect(mockRemoveAdminUser).toHaveBeenCalledWith('other@test.com');
  });

  test('handleAddUser calls addAdminUser and refreshes list', async () => {
    const mockAddAdminUser = vi.fn().mockResolvedValue(undefined);
    mockStorageEngine = {
      getUserManagementData: mockGetUserManagementData,
      getEngine: vi.fn().mockReturnValue('supabase'),
      addAdminUser: mockAddAdminUser,
    };
    mockGetUserManagementData.mockImplementation(async (key: string) => {
      if (key === 'authentication') return { isEnabled: true };
      if (key === 'adminUsers') return { adminUsersList: [{ email: 'test@test.com', uid: '1' }] };
      return null;
    });

    await act(async () => {
      render(<GlobalSettings />);
    });

    // Open the add-user modal
    await act(async () => {
      fireEvent.click(screen.getByTestId('icon-user-plus'));
    });

    // Modal is open — click Save to submit the form
    await act(async () => {
      fireEvent.click(screen.getByText('Save'));
    });

    expect(mockAddAdminUser).toHaveBeenCalled();
  });

  test('Log out button is present when auth is enabled', async () => {
    mockGetUserManagementData.mockImplementation(async (key: string) => {
      if (key === 'authentication') return { isEnabled: true };
      if (key === 'adminUsers') {
        return { adminUsersList: [{ email: 'test@test.com', uid: '1' }] };
      }
      return null;
    });

    await act(async () => {
      render(<GlobalSettings />);
    });

    expect(screen.getByRole('button', { name: 'Log out' })).toBeDefined();
  });
});
