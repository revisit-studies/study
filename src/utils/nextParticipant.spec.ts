import {
  describe, expect, it, vi,
} from 'vitest';
import { getNewParticipant } from './nextParticipant';

describe('getNewParticipant', () => {
  it('redirects to study href when clearing participant succeeds', async () => {
    Object.defineProperty(globalThis, 'window', {
      value: { location: { href: 'http://before' } },
      configurable: true,
    });

    const storageEngine = {
      clearCurrentParticipantId: vi.fn(async () => {}),
    };

    getNewParticipant(storageEngine as never, '/study-a');
    await Promise.resolve();

    expect(storageEngine.clearCurrentParticipantId).toHaveBeenCalled();
    expect(window.location.href).toBe('/study-a');
  });

  it('logs errors when clearing participant fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const storageEngine = {
      clearCurrentParticipantId: vi.fn(async () => {
        throw new Error('failed');
      }),
    };

    getNewParticipant(storageEngine as never, '/study-a');
    await new Promise((resolve) => { setTimeout(resolve, 0); });

    expect(consoleError).toHaveBeenCalled();
  });
});
