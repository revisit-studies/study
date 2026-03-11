import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';

import { initializeStorageEngine } from './initialize';

let firebaseConnected = true;
let supabaseConnected = true;

const localConnect = vi.fn(async () => {});
const firebaseConnect = vi.fn(async () => {});
const supabaseConnect = vi.fn(async () => {});

vi.mock('./engines/LocalStorageEngine', () => ({
  LocalStorageEngine: class {
    connect = localConnect;

    isConnected() { return true; }

    getEngine() { return 'localStorage'; }
  },
}));

vi.mock('./engines/FirebaseStorageEngine', () => ({
  FirebaseStorageEngine: class {
    connect = firebaseConnect;

    isConnected() { return firebaseConnected; }

    getEngine() { return 'firebase'; }
  },
}));

vi.mock('./engines/SupabaseStorageEngine', () => ({
  SupabaseStorageEngine: class {
    connect = supabaseConnect;

    isConnected() { return supabaseConnected; }

    getEngine() { return 'supabase'; }
  },
}));

describe('initializeStorageEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firebaseConnected = true;
    supabaseConnected = true;
  });

  it('returns firebase engine when configured and connected', async () => {
    vi.stubEnv('VITE_STORAGE_ENGINE', 'firebase');

    const engine = await initializeStorageEngine();

    expect(firebaseConnect).toHaveBeenCalled();
    expect(engine.getEngine()).toBe('firebase');
  });

  it('falls back to localStorage when firebase is not connected', async () => {
    vi.stubEnv('VITE_STORAGE_ENGINE', 'firebase');
    firebaseConnected = false;

    const engine = await initializeStorageEngine();

    expect(localConnect).toHaveBeenCalled();
    expect(engine.getEngine()).toBe('localStorage');
  });

  it('returns supabase engine when configured and connected', async () => {
    vi.stubEnv('VITE_STORAGE_ENGINE', 'supabase');

    const engine = await initializeStorageEngine();

    expect(supabaseConnect).toHaveBeenCalled();
    expect(engine.getEngine()).toBe('supabase');
  });
});
