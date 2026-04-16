import { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  beforeEach, describe, expect, test, vi,
} from 'vitest';
import { Login, signIn } from './Login';
import { makeStorageEngine } from './tests/utils';

// ── mutable state ─────────────────────────────────────────────────────────────

let mockUser = { isAdmin: false, determiningStatus: false, adminVerification: false };
let mockEngine = 'localStorage';
let mockIsCloud = false;

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock('./store/hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock('./storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({
    storageEngine: {
      getEngine: () => mockEngine,
      login: vi.fn().mockResolvedValue({ email: 'test@test.com', uid: '1' }),
    },
  }),
}));

vi.mock('./storage/engines/utils/storageEngineHelpers', () => ({
  isCloudStorageEngine: () => mockIsCloud,
}));

vi.mock('./utils/Prefix', () => ({
  PREFIX: '/',
}));

vi.mock('./utils/notifications', () => ({
  showNotification: vi.fn(),
}));

vi.mock('react-router', () => ({
  Navigate: ({ to }: { to: string }) => <div data-testid={`navigate-${to.replace('/', '')}`} />,
}));

vi.mock('@mantine/core', () => ({
  Button: ({ children, onClick, leftSection }: { children: ReactNode; onClick?: () => void; leftSection?: ReactNode }) => (
    <button type="button" onClick={onClick}>
      {leftSection}
      {children}
    </button>
  ),
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Container: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Flex: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Image: ({ src, alt }: { src?: string; alt?: string }) => <img src={src} alt={alt} />,
  LoadingOverlay: ({ visible }: { visible: boolean }) => (
    visible ? <div data-testid="loading" /> : null
  ),
  Text: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));

vi.mock('@tabler/icons-react', () => ({
  IconBrandGoogleFilled: () => <span>google-icon</span>,
  IconBrandSupabase: () => <span>supabase-icon</span>,
}));

// ── tests ─────────────────────────────────────────────────────────────────────

describe('Login', () => {
  beforeEach(() => {
    mockUser = { isAdmin: false, determiningStatus: false, adminVerification: false };
    mockEngine = 'localStorage';
    mockIsCloud = false;
  });

  test('redirects to "/" when user is already admin', () => {
    mockUser = { isAdmin: true, determiningStatus: false, adminVerification: false };
    const html = renderToStaticMarkup(<Login />);
    expect(html).toContain('data-testid="navigate-"');
  });

  test('shows Supabase sign-in button when engine is supabase', () => {
    mockEngine = 'supabase';
    const html = renderToStaticMarkup(<Login />);
    expect(html).toContain('Sign In With');
    expect(html).toContain('Supabase');
    expect(html).toContain('supabase-icon');
  });

  test('shows Google sign-in button when engine is not supabase', () => {
    mockEngine = 'firebase';
    const html = renderToStaticMarkup(<Login />);
    expect(html).toContain('Sign In With');
    expect(html).toContain('Google');
    expect(html).toContain('google-icon');
  });

  test('does not show loading overlay initially', () => {
    const html = renderToStaticMarkup(<Login />);
    expect(html).not.toContain('data-testid="loading"');
  });
});

describe('signIn', () => {
  const mockSetLoading = vi.fn();

  beforeEach(() => {
    mockIsCloud = true;
    vi.clearAllMocks();
  });

  test('returns null when storageEngine is undefined', async () => {
    const result = await signIn(undefined, mockSetLoading);
    expect(result).toBeNull();
    expect(mockSetLoading).not.toHaveBeenCalled();
  });

  test('returns null when storageEngine is not a cloud engine', async () => {
    mockIsCloud = false;
    const login = vi.fn();
    const engine = makeStorageEngine();
    Object.assign(engine, { login });
    const result = await signIn(engine, mockSetLoading);
    expect(result).toBeNull();
    expect(login).not.toHaveBeenCalled();
  });

  test('calls storageEngine.login and returns user when cloud engine', async () => {
    const mockUser2 = { email: 'test@test.com', uid: '123' };
    const login = vi.fn().mockResolvedValue(mockUser2);
    const engine = makeStorageEngine();
    Object.assign(engine, { login });
    const result = await signIn(engine, mockSetLoading);
    expect(login).toHaveBeenCalled();
    expect(result).toEqual(mockUser2);
    expect(mockSetLoading).toHaveBeenCalledWith(true);
    expect(mockSetLoading).toHaveBeenCalledWith(false);
  });

  test('calls showNotification and returns undefined when login throws', async () => {
    const { showNotification } = await import('./utils/notifications');
    const engine = makeStorageEngine();
    Object.assign(engine, { login: vi.fn().mockRejectedValue(new Error('Auth failed')) });
    const result = await signIn(engine, mockSetLoading);
    expect(result).toBeNull();
    expect(showNotification).toHaveBeenCalledWith(expect.objectContaining({ title: 'Error' }));
    expect(mockSetLoading).toHaveBeenCalledWith(false);
  });
});
