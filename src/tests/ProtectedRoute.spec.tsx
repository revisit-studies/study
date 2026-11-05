import {
  render, act, cleanup, screen, fireEvent,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { ProtectedRoute } from '../ProtectedRoute';

let mockUser: { isAdmin: boolean; determiningStatus: boolean };
const mockVerifyAdminStatus = vi.fn();
const mockLogout = vi.fn();
const mockTriggerAuth = vi.fn();
let mockSupabaseAuthStatus = 'loading';
let mockStorageEngine: { getEngine: ReturnType<typeof vi.fn> } | undefined;
let mockConfiguredStorageEngine: { getEngine: ReturnType<typeof vi.fn> } | undefined;

vi.mock('../store/hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
    verifyAdminStatus: mockVerifyAdminStatus,
    logout: mockLogout,
    triggerAuth: mockTriggerAuth,
    supabaseAuthStatus: mockSupabaseAuthStatus,
  }),
}));

vi.mock('../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({ storageEngine: mockStorageEngine, configuredStorageEngine: mockConfiguredStorageEngine }),
}));

let mockParams: Record<string, string> = {};

vi.mock('react-router', () => ({
  Navigate: ({ to }: { to: string }) => <div data-testid={`navigate-to-${to.slice(1)}`} />,
  useParams: () => mockParams,
}));

vi.mock('@mantine/core', () => ({
  Alert: ({ children }: { children: React.ReactNode }) => <div role="alert">{children}</div>,
  Button: ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => <button type="button" onClick={onClick}>{children}</button>,
  LoadingOverlay: ({ visible }: { visible: boolean }) => (
    visible ? <div data-testid="loading-overlay" /> : null
  ),
}));

describe('ProtectedRoute', () => {
  beforeEach(() => {
    mockUser = { isAdmin: false, determiningStatus: false };
    mockVerifyAdminStatus.mockResolvedValue(true);
    mockLogout.mockReset();
    mockStorageEngine = { getEngine: vi.fn().mockReturnValue('localStorage') };
    mockConfiguredStorageEngine = undefined;
    mockSupabaseAuthStatus = 'loading';
    mockParams = {};
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test('shows loading overlay when user.determiningStatus is true', () => {
    mockUser = { isAdmin: false, determiningStatus: true };
    render(<ProtectedRoute><div>child</div></ProtectedRoute>);
    expect(screen.getByTestId('loading-overlay')).toBeDefined();
  });

  test('shows loading overlay when storageEngine is undefined', () => {
    mockStorageEngine = undefined;
    render(<ProtectedRoute><div>child</div></ProtectedRoute>);
    expect(screen.getByTestId('loading-overlay')).toBeDefined();
  });

  test('redirects to /login when user is not admin', async () => {
    mockUser = { isAdmin: false, determiningStatus: false };
    mockVerifyAdminStatus.mockResolvedValue(false);
    await act(async () => {
      render(<ProtectedRoute><div data-testid="child-content">child</div></ProtectedRoute>);
    });
    expect(screen.getByTestId('navigate-to-login')).toBeDefined();
  });

  test('renders children when user is admin', async () => {
    mockUser = { isAdmin: true, determiningStatus: false };
    mockVerifyAdminStatus.mockResolvedValue(true);
    await act(async () => {
      render(<ProtectedRoute><div data-testid="child-content">child</div></ProtectedRoute>);
    });
    expect(screen.getByTestId('child-content')).toBeDefined();
  });

  test('calls logout when verifyAdminStatus throws', async () => {
    mockUser = { isAdmin: true, determiningStatus: false };
    mockVerifyAdminStatus.mockRejectedValue(new Error('Network error'));

    await act(async () => {
      render(<ProtectedRoute><div>child</div></ProtectedRoute>);
    });

    expect(mockLogout).toHaveBeenCalled();
  });

  test('calls paramCallback with param value when paramToCheck matches', async () => {
    mockParams = { studyId: 'test-study' };
    mockUser = { isAdmin: true, determiningStatus: false };
    const mockParamCallback = vi.fn().mockResolvedValue(true);

    await act(async () => {
      render(
        <ProtectedRoute paramToCheck="studyId" paramCallback={mockParamCallback}>
          <div data-testid="child-content">child</div>
        </ProtectedRoute>,
      );
    });

    expect(mockParamCallback).toHaveBeenCalledWith('test-study');
  });

  test('does not render private analysis before sharing status resolves', async () => {
    mockStorageEngine = { getEngine: vi.fn().mockReturnValue('supabase') };
    mockSupabaseAuthStatus = 'disabled';
    mockParams = { studyId: 'test-study', analysisTab: 'stats' };
    const callback = vi.fn().mockReturnValue(new Promise(() => {}));
    render(<ProtectedRoute paramToCheck="studyId" paramCallback={callback}><div>private data</div></ProtectedRoute>);
    expect(screen.queryByText('private data')).toBeNull();
    expect(screen.getByTestId('loading-overlay')).toBeDefined();
  });

  test('renders shared analysis without waiting for authentication', async () => {
    mockStorageEngine = { getEngine: vi.fn().mockReturnValue('supabase') };
    mockParams = { studyId: 'test-study', analysisTab: 'stats' };
    const callback = vi.fn().mockResolvedValue(false);
    await act(async () => render(<ProtectedRoute paramToCheck="studyId" paramCallback={callback}><div>shared data</div></ProtectedRoute>));
    expect(screen.getByText('shared data')).toBeDefined();
  });

  test('missing auth redirects direct Manage access to setup', async () => {
    mockStorageEngine = { getEngine: vi.fn().mockReturnValue('supabase') };
    mockSupabaseAuthStatus = 'unconfigured';
    mockParams = { studyId: 'test-study', analysisTab: 'manage' };
    await act(async () => render(<ProtectedRoute paramToCheck="studyId" paramCallback={vi.fn()}><div>manage data</div></ProtectedRoute>));
    expect(screen.queryByText('manage data')).toBeNull();
    expect(screen.getByTestId('navigate-to-settings')).toBeDefined();
  });

  test('local-mode Datastore route remains protected by configured Supabase authentication', async () => {
    mockConfiguredStorageEngine = { getEngine: vi.fn().mockReturnValue('supabase') };
    mockSupabaseAuthStatus = 'unconfigured';
    mockParams = { studyId: 'test-study', analysisTab: 'storage' };
    const callback = vi.fn().mockResolvedValue(false);
    await act(async () => render(<ProtectedRoute paramToCheck="studyId" paramCallback={callback}><div>datastore</div></ProtectedRoute>));
    expect(callback).not.toHaveBeenCalled();
    expect(screen.queryByText('datastore')).toBeNull();
    expect(screen.getByTestId('navigate-to-settings')).toBeDefined();
  });

  test('setup remains available when authentication is unconfigured', async () => {
    mockStorageEngine = { getEngine: vi.fn().mockReturnValue('supabase') };
    mockSupabaseAuthStatus = 'unconfigured';
    await act(async () => render(<ProtectedRoute allowSupabaseSetup><div>settings</div></ProtectedRoute>));
    expect(screen.getByText('settings')).toBeDefined();
  });

  test('failed auth read blocks settings and offers retry', async () => {
    mockStorageEngine = { getEngine: vi.fn().mockReturnValue('supabase') };
    mockSupabaseAuthStatus = 'error';
    await act(async () => render(<ProtectedRoute allowSupabaseSetup><div>settings</div></ProtectedRoute>));
    expect(screen.queryByText('settings')).toBeNull();
    fireEvent.click(screen.getByText('Retry'));
    expect(mockTriggerAuth).toHaveBeenCalled();
  });

  test('admin verification failure denies protected content and offers retry', async () => {
    mockStorageEngine = { getEngine: vi.fn().mockReturnValue('supabase') };
    mockSupabaseAuthStatus = 'enabled';
    mockUser = { isAdmin: true, determiningStatus: false };
    mockVerifyAdminStatus.mockRejectedValue(new Error('read failed'));
    await act(async () => render(<ProtectedRoute><div>settings</div></ProtectedRoute>));
    expect(screen.queryByText('settings')).toBeNull();
    fireEvent.click(screen.getByText('Retry'));
    expect(mockTriggerAuth).toHaveBeenCalled();
  });

  test('signs out a Supabase admin whose access was revoked before redirecting', async () => {
    mockStorageEngine = { getEngine: vi.fn().mockReturnValue('supabase') };
    mockSupabaseAuthStatus = 'enabled';
    mockUser = { isAdmin: true, determiningStatus: false };
    mockVerifyAdminStatus.mockResolvedValue(false);
    await act(async () => render(<ProtectedRoute><div>private settings</div></ProtectedRoute>));
    expect(mockLogout).toHaveBeenCalledOnce();
    expect(screen.queryByText('private settings')).toBeNull();
    expect(screen.getByTestId('navigate-to-login')).toBeDefined();
  });
});
