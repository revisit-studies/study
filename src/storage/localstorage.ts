import localforage from 'localforage';
import { Nullable } from '../parser/types';
import { PID_KEY } from './constants';

export async function getLocalStorageManager(_pid?: string) {
  // Create local storage manager
  const store = localforage.createInstance({
    name: 'REVISIT',
  });

  // initiate pid with null, before setting it
  let pid: Nullable<string> = null;

  // if pid is provided use that and save it locally
  if (_pid) {
    pid = _pid;
  } else {
    // Try to load from localStorage
    const saved = await store.getItem<string>(PID_KEY);

    // assign to pid if exists else create new
    pid = saved || crypto.randomUUID();
  }

  // Assign whatever pid is to local storage
  await store.setItem(PID_KEY, pid);

  return {
    pid,
    store,
  };
}
