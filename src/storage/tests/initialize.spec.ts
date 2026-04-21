import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { initializeStorageEngine } from '../initialize';

// ── hoisted mocks ─────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  const mockSupabaseConnect = vi.fn(async () => {});
  const mockSupabaseIsConnected = vi.fn().mockReturnValue(true);
  const MockSupabase = vi.fn().mockImplementation(() => ({
    connect: mockSupabaseConnect,
    isConnected: mockSupabaseIsConnected,
  }));

  const mockFirebaseConnect = vi.fn(async () => {});
  const mockFirebaseIsConnected = vi.fn().mockReturnValue(true);
  const MockFirebase = vi.fn().mockImplementation(() => ({
    connect: mockFirebaseConnect,
    isConnected: mockFirebaseIsConnected,
  }));

  const mockLocalConnect = vi.fn(async () => {});
  const MockLocal = vi.fn().mockImplementation(() => ({
    connect: mockLocalConnect,
  }));

  return {
    MockSupabase,
    mockSupabaseConnect,
    mockSupabaseIsConnected,
    MockFirebase,
    mockFirebaseConnect,
    mockFirebaseIsConnected,
    MockLocal,
    mockLocalConnect,
  };
});

vi.mock('../engines/SupabaseStorageEngine', () => ({
  SupabaseStorageEngine: mocks.MockSupabase,
}));

vi.mock('../engines/FirebaseStorageEngine', () => ({
  FirebaseStorageEngine: mocks.MockFirebase,
}));

vi.mock('../engines/LocalStorageEngine', () => ({
  LocalStorageEngine: mocks.MockLocal,
}));

// ── tests ─────────────────────────────────────────────────────────────────────

describe('initializeStorageEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockSupabaseIsConnected.mockReturnValue(true);
    mocks.mockFirebaseIsConnected.mockReturnValue(true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('creates SupabaseStorageEngine and connects when env is supabase', async () => {
    vi.stubEnv('VITE_STORAGE_ENGINE', 'supabase');
    await initializeStorageEngine();
    expect(mocks.MockSupabase).toHaveBeenCalledOnce();
    expect(mocks.mockSupabaseConnect).toHaveBeenCalledOnce();
    expect(mocks.MockFirebase).not.toHaveBeenCalled();
    expect(mocks.MockLocal).not.toHaveBeenCalled();
  });

  test('falls back to LocalStorageEngine when supabase fails to connect', async () => {
    vi.stubEnv('VITE_STORAGE_ENGINE', 'supabase');
    mocks.mockSupabaseIsConnected.mockReturnValue(false);
    await initializeStorageEngine();
    expect(mocks.MockSupabase).toHaveBeenCalledOnce();
    expect(mocks.MockLocal).toHaveBeenCalledOnce();
  });

  test('creates FirebaseStorageEngine and connects when env is firebase', async () => {
    vi.stubEnv('VITE_STORAGE_ENGINE', 'firebase');
    await initializeStorageEngine();
    expect(mocks.MockFirebase).toHaveBeenCalledOnce();
    expect(mocks.mockFirebaseConnect).toHaveBeenCalledOnce();
    expect(mocks.MockSupabase).not.toHaveBeenCalled();
    expect(mocks.MockLocal).not.toHaveBeenCalled();
  });

  test('falls back to LocalStorageEngine when firebase fails to connect', async () => {
    vi.stubEnv('VITE_STORAGE_ENGINE', 'firebase');
    mocks.mockFirebaseIsConnected.mockReturnValue(false);
    await initializeStorageEngine();
    expect(mocks.MockFirebase).toHaveBeenCalledOnce();
    expect(mocks.MockLocal).toHaveBeenCalledOnce();
  });

  test('creates LocalStorageEngine when env is localStorage', async () => {
    vi.stubEnv('VITE_STORAGE_ENGINE', 'localStorage');
    await initializeStorageEngine();
    expect(mocks.MockLocal).toHaveBeenCalledOnce();
    expect(mocks.mockLocalConnect).toHaveBeenCalledOnce();
    expect(mocks.MockSupabase).not.toHaveBeenCalled();
    expect(mocks.MockFirebase).not.toHaveBeenCalled();
  });
});
