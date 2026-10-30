import { expect, test } from 'vitest';
import { LocalStorageEngine } from '../engines/LocalStorageEngine';
import type { StorageObject, StorageObjectType } from '../engines/types';
import { createGlobalStoreSubmission, GLOBAL_STORE_TASK } from '../../store/globalStoreProvenance';
import { makeStoredAnswer } from '../../tests/utils';

class RestorationStorage extends LocalStorageEngine {
  stored: unknown = null;

  failure?: Error;

  freshStored?: unknown;

  protected async _getFromStorage<T extends StorageObjectType>(_prefix?: string, _type?: T, _studyId?: string, _strict?: boolean, fresh = false) {
    if (this.failure) throw this.failure;
    return (fresh && this.freshStored !== undefined ? this.freshStored : this.stored) as StorageObject<T> | null;
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

test.each([{ task: GLOBAL_STORE_TASK, location: 'globalStore' }, { task: 'trial', location: 'stimulus' }] as const)('admin reads fetch fresh mutable $task provenance without initializing a participant', async ({ task, location }) => {
  const storage = new RestorationStorage(true);
  const answer = makeStoredAnswer({ identifier: 'trial_0', trialOrder: '0' });
  const first = createGlobalStoreSubmission(undefined, { budget: 100 }, answer, { budget: 70 }, [], {});
  const second = createGlobalStoreSubmission(first.graph, { budget: 100 }, answer, { budget: 90 }, [], {});
  storage.stored = { [location]: first.graph };
  storage.freshStored = { [location]: second.graph };
  expect((await storage.getProvenance(task, 'participant'))?.[location]?.current).toBe(second.graph.current);
});

test('restoration does not turn a read failure into a new trial', async () => {
  const storage = new RestorationStorage(true);
  storage.failure = new Error('Disconnected');
  await expect(storage.getProvenance('trial', 'participant', true)).rejects.toThrow('Disconnected');
});
