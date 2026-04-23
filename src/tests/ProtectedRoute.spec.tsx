import {
  render, act, cleanup, screen,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { ProtectedRoute } from '../ProtectedRoute';

let mockUser: { isAdmin: boolean; determiningStatus: boolean };
const mockVerifyAdminStatus = vi.fn();
const mockLogout = vi.fn();
let mockStorageEngine: { getEngine: ReturnType<typeof vi.fn> } | undefined;

vi.mock('../store/hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
    verifyAdminStatus: mockVerifyAdminStatus,
    logout: mockLogout,
  }),
}));

vi.mock('../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({ storageEngine: mockStorageEngine }),
}));

let mockParams: Record<string, string> = {};

vi.mock('react-router', () => ({
  Navigate: ({ to }: { to: string }) => <div data-testid={`navigate-to-${to.slice(1)}`} />,
  useParams: () => mockParams,
}));

vi.mock('@mantine/core', () => ({
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
});
