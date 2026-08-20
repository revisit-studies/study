import {
  afterEach, describe, expect, test, vi,
} from 'vitest';
import { getNewParticipant } from '../nextParticipant';
import { makeStorageEngine } from '../../tests/utils';

const locationMock = { href: '' };

afterEach(() => {
  locationMock.href = '';
  vi.restoreAllMocks();
});

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
    const engine = makeStorageEngine({ clearCurrentParticipantId: clearFn });
    getNewParticipant(engine, '/study/my-study');
    expect(clearFn).toHaveBeenCalledOnce();
  });

  test('sets window.location.href to studyHref after clearCurrentParticipantId resolves', async () => {
    vi.stubGlobal('location', locationMock);
    const engine = makeStorageEngine({ clearCurrentParticipantId: vi.fn(() => Promise.resolve()) });
    getNewParticipant(engine, '/study/redirect-target');
    await Promise.resolve();
    expect(locationMock.href).toBe('/study/redirect-target');
  });

  test('logs the error when clearCurrentParticipantId rejects', async () => {
    vi.stubGlobal('location', locationMock);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => { });
    const engine = makeStorageEngine({ clearCurrentParticipantId: vi.fn(() => Promise.reject(new Error('clear failed'))) });
    getNewParticipant(engine, '/study/my-study');
    await new Promise((resolve) => { setTimeout(resolve, 0); });
    expect(consoleError).toHaveBeenCalledWith(expect.any(Error));
    expect(locationMock.href).toBe('');
  });
});
