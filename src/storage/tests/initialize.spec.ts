import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { initializeStorageEngine, selectStudyStorageEngine } from '../initialize';
import { CloudStorageEngine, SequenceAssignment } from '../engines/types';

// ── hoisted mocks ─────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  const mockSupabaseConnect = vi.fn(async () => {});
  const mockSupabaseIsConnected = vi.fn().mockReturnValue(true);
  const MockSupabase = vi.fn(class MockSupabaseStorageEngine {
    connect = mockSupabaseConnect;

    isConnected = mockSupabaseIsConnected;
  });

  const mockFirebaseConnect = vi.fn(async () => {});
  const mockFirebaseIsConnected = vi.fn().mockReturnValue(true);
  const MockFirebase = vi.fn(class MockFirebaseStorageEngine {
    connect = mockFirebaseConnect;

    isConnected = mockFirebaseIsConnected;
  });

  const mockLocalConnect = vi.fn(async () => {});
  const mockLocalParticipantId = vi.fn<() => Promise<string | undefined>>(async () => undefined);
  const mockLocalAssignments = vi.fn<() => Promise<SequenceAssignment[]>>(async () => []);
  const MockLocal = vi.fn(class MockLocalStorageEngine {
    connect = mockLocalConnect;

    getEngine = () => 'localStorage';

    peekCurrentParticipantId = mockLocalParticipantId;

    getAllSequenceAssignments = mockLocalAssignments;
  });

  return {
    MockSupabase,
    mockSupabaseConnect,
    mockSupabaseIsConnected,
    MockFirebase,
    mockFirebaseConnect,
    mockFirebaseIsConnected,
    MockLocal,
    mockLocalConnect,
    mockLocalParticipantId,
    mockLocalAssignments,
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
    window.sessionStorage.clear();
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

  test('does not fall back to LocalStorageEngine in production when supabase fails to connect', async () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_STORAGE_ENGINE', 'supabase');
    mocks.mockSupabaseIsConnected.mockReturnValue(false);
    const storageEngine = await initializeStorageEngine();
    expect(storageEngine).toBeInstanceOf(mocks.MockSupabase);
    expect(mocks.MockSupabase).toHaveBeenCalledOnce();
    expect(mocks.MockLocal).not.toHaveBeenCalled();
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

  test('does not fall back to LocalStorageEngine in production when firebase fails to connect', async () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_STORAGE_ENGINE', 'firebase');
    mocks.mockFirebaseIsConnected.mockReturnValue(false);
    const storageEngine = await initializeStorageEngine();
    expect(storageEngine).toBeInstanceOf(mocks.MockFirebase);
    expect(mocks.MockFirebase).toHaveBeenCalledOnce();
    expect(mocks.MockLocal).not.toHaveBeenCalled();
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

describe('selectStudyStorageEngine', () => {
  const cloud = {
    isCloudEngine: () => true,
    getEngine: () => 'firebase',
    getStorageDisconnected: vi.fn<() => Promise<boolean>>(),
    peekCurrentParticipantId: vi.fn<() => Promise<string | undefined>>(),
    getAllSequenceAssignments: vi.fn<() => Promise<SequenceAssignment[]>>(async () => []),
  } as unknown as CloudStorageEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    vi.mocked(cloud.getStorageDisconnected).mockResolvedValue(false);
    vi.mocked(cloud.peekCurrentParticipantId).mockResolvedValue(undefined);
    mocks.mockLocalParticipantId.mockResolvedValue(undefined);
  });

  test('uses browser storage for disconnected analytics and keeps each study setting separate', async () => {
    vi.mocked(cloud.getStorageDisconnected).mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const first = await selectStudyStorageEngine(cloud, 'study-a', false);
    const second = await selectStudyStorageEngine(cloud, 'study-b', false);

    expect(first.getEngine()).toBe('localStorage');
    expect(second).toBe(cloud);
    expect(cloud.getStorageDisconnected).toHaveBeenNthCalledWith(1, 'study-a');
    expect(cloud.getStorageDisconnected).toHaveBeenNthCalledWith(2, 'study-b');
  });

  test('keeps an in-progress cloud participant on cloud after disconnect', async () => {
    vi.mocked(cloud.getStorageDisconnected).mockResolvedValue(true);
    vi.mocked(cloud.peekCurrentParticipantId).mockResolvedValue('cloud-participant');
    vi.mocked(cloud.getAllSequenceAssignments).mockResolvedValue([{
      participantId: 'cloud-participant', completed: null,
    } as SequenceAssignment]);

    expect(await selectStudyStorageEngine(cloud, 'study-a', true)).toBe(cloud);
  });

  test('preserves a cached cloud session before its assignment is persisted', async () => {
    vi.mocked(cloud.getStorageDisconnected).mockResolvedValue(true);
    vi.mocked(cloud.peekCurrentParticipantId).mockResolvedValue('cloud-participant');

    expect(await selectStudyStorageEngine(cloud, 'study-a', true)).toBe(cloud);
  });

  test('keeps an in-progress local participant on local after reconnection', async () => {
    mocks.mockLocalParticipantId.mockResolvedValue('local-participant');
    mocks.mockLocalAssignments.mockResolvedValue([{
      participantId: 'local-participant', completed: null,
    } as SequenceAssignment]);

    expect((await selectStudyStorageEngine(cloud, 'study-a', true)).getEngine()).toBe('localStorage');
  });

  test('uses the tab previous backend when both stores have an unfinished participant', async () => {
    vi.mocked(cloud.peekCurrentParticipantId).mockResolvedValue('cloud-participant');
    vi.mocked(cloud.getAllSequenceAssignments).mockResolvedValue([{
      participantId: 'cloud-participant', completed: null,
    } as SequenceAssignment]);
    mocks.mockLocalParticipantId.mockResolvedValue('local-participant');
    mocks.mockLocalAssignments.mockResolvedValue([{
      participantId: 'local-participant', completed: null,
    } as SequenceAssignment]);
    window.sessionStorage.setItem('revisit-storage-study-a', 'localStorage');

    expect((await selectStudyStorageEngine(cloud, 'study-a', true)).getEngine()).toBe('localStorage');
  });

  test('does not silently choose a backend when reading the setting fails', async () => {
    vi.mocked(cloud.getStorageDisconnected).mockRejectedValue(new Error('Cloud unavailable'));

    await expect(selectStudyStorageEngine(cloud, 'study-a', false)).rejects.toThrow('Cloud unavailable');
  });
});
