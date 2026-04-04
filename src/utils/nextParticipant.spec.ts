import {
  afterEach, describe, expect, test, vi,
} from 'vitest';
import type { StorageEngine } from '../storage/engines/types';
import { getNewParticipant } from './nextParticipant';

const locationMock = { href: '' };

afterEach(() => {
  locationMock.href = '';
  vi.restoreAllMocks();
});

function makeEngine(clearFn: () => Promise<void> = () => Promise.resolve()): StorageEngine {
  return { clearCurrentParticipantId: clearFn } as Partial<StorageEngine> as StorageEngine;
}

describe('getNewParticipant', () => {
  test('does nothing when storageEngine is undefined', async () => {
    vi.stubGlobal('location', locationMock);
    getNewParticipant(undefined, '/study/my-study');
    await Promise.resolve();
    expect(locationMock.href).toBe('');
  });

  test('calls clearCurrentParticipantId on the engine', async () => {
    vi.stubGlobal('location', locationMock);
    const clearFn = vi.fn(() => Promise.resolve());
    const engine = makeEngine(clearFn);
    getNewParticipant(engine, '/study/my-study');
    expect(clearFn).toHaveBeenCalledOnce();
  });

  test('sets window.location.href to studyHref after clearCurrentParticipantId resolves', async () => {
    vi.stubGlobal('location', locationMock);
    const engine = makeEngine();
    getNewParticipant(engine, '/study/redirect-target');
    await Promise.resolve();
    expect(locationMock.href).toBe('/study/redirect-target');
  });

  test('logs the error when clearCurrentParticipantId rejects', async () => {
    vi.stubGlobal('location', locationMock);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const engine = makeEngine(() => Promise.reject(new Error('clear failed')));
    getNewParticipant(engine, '/study/my-study');
    await new Promise((resolve) => { setTimeout(resolve, 0); });
    expect(consoleError).toHaveBeenCalledWith(expect.any(Error));
    expect(locationMock.href).toBe('');
  });
});
