import { expect, test } from 'vitest';
import { LocalStorageEngine } from '../engines/LocalStorageEngine';
import type { StorageObject, StorageObjectType } from '../engines/types';

class RestorationStorage extends LocalStorageEngine {
  stored: unknown = null;

  failure?: Error;

  protected async _getFromStorage<T extends StorageObjectType>() {
    if (this.failure) throw this.failure;
    return this.stored as StorageObject<T> | null;
  }
}

test('strict restoration distinguishes absent history from malformed saved content', async () => {
  const storage = new RestorationStorage(true);
  expect(await storage.getProvenance('trial', 'participant', true)).toBeNull();
  storage.stored = {};
  expect(await storage.getProvenance('trial', 'participant', true)).toBeNull();
  storage.stored = new Blob(['not json']);
  await expect(storage.getProvenance('trial', 'participant', true)).rejects.toThrow();
  expect(await storage.getProvenance('trial', 'participant')).toBeNull();
  storage.stored = [];
  await expect(storage.getProvenance('trial', 'participant', true)).rejects.toThrow('invalid');
  storage.stored = { unexpected: 'content' };
  await expect(storage.getProvenance('trial', 'participant', true)).rejects.toThrow('invalid');
});

test('restoration does not turn a read failure into a new trial', async () => {
  const storage = new RestorationStorage(true);
  storage.failure = new Error('Disconnected');
  await expect(storage.getProvenance('trial', 'participant', true)).rejects.toThrow('Disconnected');
});
