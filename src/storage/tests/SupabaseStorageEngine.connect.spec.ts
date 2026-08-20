import {
  beforeEach, describe, expect, test, vi,
} from 'vitest';
import { SupabaseStorageEngine } from '../engines/SupabaseStorageEngine';

const mocks = vi.hoisted(() => {
  const limit = vi.fn();
  const select = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ select }));

  return {
    from,
    limit,
    select,
  };
});

vi.mock('@supabase/supabase-js', () => ({
  AuthError: class AuthError extends Error {},
  createClient: () => ({
    from: mocks.from,
  }),
}));

describe('SupabaseStorageEngine.connect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.limit.mockResolvedValue({ error: null });
  });

  test('reports connected only after a successful backend readiness query', async () => {
    const storageEngine = new SupabaseStorageEngine(true);

    await storageEngine.connect();

    expect(mocks.from).toHaveBeenCalledWith('revisit');
    expect(mocks.select).toHaveBeenCalledWith('studyId');
    expect(mocks.limit).toHaveBeenCalledWith(1);
    expect(storageEngine.isConnected()).toBe(true);
  });

  test('reports disconnected and rejects when the backend readiness query fails', async () => {
    mocks.limit.mockResolvedValue({ error: { message: 'network unavailable' } });
    const storageEngine = new SupabaseStorageEngine(true);

    await expect(storageEngine.connect()).rejects.toThrow('Failed to connect to Supabase');

    expect(storageEngine.isConnected()).toBe(false);
  });
});
