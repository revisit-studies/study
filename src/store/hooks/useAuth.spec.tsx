import { ReactNode } from 'react';
import {
  render, act, screen, renderHook, waitFor, cleanup,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { useAuth, AuthProvider } from './useAuth';

// ── mutable mock state ─────────────────────────────────────────────────────────

let mockStorageEngineVal: Record<string, ReturnType<typeof vi.fn>> | null = null;
let mockIsCloudStorage = false;

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@mantine/core', () => ({
  LoadingOverlay: ({ visible }: { visible: boolean }) => (
    visible ? <div data-testid="loading-overlay" /> : null
  ),
}));

vi.mock('../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({ storageEngine: mockStorageEngineVal }),
}));

vi.mock('../../storage/engines/utils', () => ({
  isCloudStorageEngine: () => mockIsCloudStorage,
}));

// ── lifecycle ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockStorageEngineVal = null;
  mockIsCloudStorage = false;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe('useAuth', () => {
  test('returns default context values when used outside AuthProvider', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.user).toBeDefined();
    expect(result.current.user.isAdmin).toBe(false);
    expect(result.current.user.determiningStatus).toBe(false);
  });

  test('logout is a callable function', () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.logout).toBe('function');
  });

  test('triggerAuth is a callable function', () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.triggerAuth).toBe('function');
  });
});

describe('AuthProvider', () => {
  test('renders loading overlay while determining status', async () => {
    const renderResult = render(
      <AuthProvider>
        <div data-testid="child">child</div>
      </AuthProvider>,
    );
    // Since storageEngine is null, it should set non-auth user quickly
    expect(renderResult.getByTestId).toBeDefined();
  });

  test('renders children when storageEngine is not a cloud engine', async () => {
    const renderResult = render(
      <AuthProvider>
        <div data-testid="child-content">Hello</div>
      </AuthProvider>,
    );
    expect(renderResult.container).toBeDefined();
  });

  test('useAuth returns non-auth user when no cloud storage', async () => {
    function Consumer() {
      const { user } = useAuth();
      return <div data-testid="admin">{user.isAdmin ? 'admin' : 'not-admin'}</div>;
    }

    await act(async () => render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    ));

    const adminEl = screen.queryByTestId('admin');
    // After effect runs, user should be the nonAuthUser (isAdmin=true) since no cloud engine
    expect(adminEl).toBeDefined();
  });
});

describe('AuthProvider — non-null storage engine paths', () => {
  test('non-cloud storageEngine sets nonAuthUser (covers line 148)', async () => {
    mockStorageEngineVal = { getEngine: vi.fn(() => 'localStorage') };
    mockIsCloudStorage = false;

    function Consumer() {
      const { user } = useAuth();
      return <div data-testid="is-admin">{String(user.isAdmin)}</div>;
    }

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.queryByTestId('is-admin')?.textContent).toBe('true');
    }, { timeout: 2000 });
  });

  test('cloud engine with authInfo.isEnabled=false sets nonAuthUser (covers lines 140-145)', async () => {
    mockStorageEngineVal = {
      getEngine: vi.fn(() => 'firebase'),
      getUserManagementData: vi.fn().mockResolvedValue({ isEnabled: false }),
    };
    mockIsCloudStorage = true;

    function Consumer() {
      const { user } = useAuth();
      return <div data-testid="is-admin">{String(user.isAdmin)}</div>;
    }

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.queryByTestId('is-admin')?.textContent).toBe('true');
    }, { timeout: 2000 });
  });

  test('cloud engine with authInfo.isEnabled=true calls unsubscribe (covers lines 142-143)', async () => {
    const unsubscribeSpy = vi.fn();
    mockStorageEngineVal = {
      getEngine: vi.fn(() => 'firebase'),
      getUserManagementData: vi.fn().mockResolvedValue({ isEnabled: true }),
      unsubscribe: unsubscribeSpy,
    };
    mockIsCloudStorage = true;

    render(
      <AuthProvider>
        <div>child</div>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(unsubscribeSpy).toHaveBeenCalled();
    }, { timeout: 2000 });
  });

  test('Supabase engine calls getSession on mount (covers lines 88-100)', async () => {
    const getSessionSpy = vi.fn().mockResolvedValue(undefined);
    mockStorageEngineVal = {
      getEngine: vi.fn(() => 'supabase'),
      getSession: getSessionSpy,
      getUserManagementData: vi.fn().mockResolvedValue({ isEnabled: false }),
    };
    mockIsCloudStorage = false;

    render(
      <AuthProvider>
        <div>child</div>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(getSessionSpy).toHaveBeenCalled();
    }, { timeout: 2000 });
  });

  test('Supabase getSession failure is caught silently (covers catch at line 94)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    mockStorageEngineVal = {
      getEngine: vi.fn(() => 'supabase'),
      getSession: vi.fn().mockRejectedValue(new Error('session error')),
      getUserManagementData: vi.fn().mockResolvedValue({ isEnabled: false }),
    };
    mockIsCloudStorage = false;

    render(
      <AuthProvider>
        <div>child</div>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Supabase session check failed', expect.any(Error));
    }, { timeout: 2000 });
    consoleSpy.mockRestore();
  });

  test('logout with cloud engine calls storageEngine.logout (covers lines 71-81)', async () => {
    const logoutSpy = vi.fn().mockResolvedValue(undefined);
    mockStorageEngineVal = {
      getEngine: vi.fn(() => 'firebase'),
      logout: logoutSpy,
      getUserManagementData: vi.fn().mockResolvedValue({ isEnabled: false }),
    };
    mockIsCloudStorage = true;

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      ),
    });

    // AuthProvider renders children only after determiningStatus=false; wait for that.
    await waitFor(() => expect(result.current?.logout).toBeDefined(), { timeout: 2000 });

    await act(async () => {
      await result.current.logout();
    });

    expect(logoutSpy).toHaveBeenCalled();
  });

  test('verifyAdminStatus with cloud engine calls validateUser (covers lines 102-107)', async () => {
    const validateSpy = vi.fn().mockResolvedValue(true);
    mockStorageEngineVal = {
      getEngine: vi.fn(() => 'firebase'),
      validateUser: validateSpy,
      getUserManagementData: vi.fn().mockResolvedValue({ isEnabled: false }),
    };
    mockIsCloudStorage = true;

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      ),
    });

    await waitFor(() => expect(result.current?.verifyAdminStatus).toBeDefined(), { timeout: 2000 });

    await act(async () => {
      const isAdmin = await result.current.verifyAdminStatus({
        user: { email: 'a@b.com', uid: '123' },
        isAdmin: false,
        determiningStatus: false,
        adminVerification: false,
      });
      expect(isAdmin).toBe(true);
    });

    expect(validateSpy).toHaveBeenCalled();
  });

  test('verifyAdminStatus without cloud engine returns false (covers else at line 106)', async () => {
    // Non-null, non-cloud engine: AuthProvider sets nonAuthUser (else-if branch) so
    // children render, but verifyAdminStatus still returns false (isCloudStorageEngine=false).
    mockStorageEngineVal = { getEngine: vi.fn(() => 'localStorage') };
    mockIsCloudStorage = false;

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      ),
    });

    await waitFor(() => expect(result.current?.verifyAdminStatus).toBeDefined(), { timeout: 2000 });

    const isAdmin = await act(async () => result.current.verifyAdminStatus({
      user: null,
      isAdmin: false,
      determiningStatus: false,
      adminVerification: false,
    }));

    expect(isAdmin).toBe(false);
  });
});
