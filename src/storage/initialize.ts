import { LocalStorageEngine } from './engines/LocalStorageEngine';
import { FirebaseStorageEngine } from './engines/FirebaseStorageEngine';
import { StorageEngineConstants } from './engines/StorageEngine';

export function appendMode(str: string, mode: string) {
  return `${mode}-${str}`;
}

const MODE = import.meta.env.PROD ? 'prod' : 'dev';
const constants: StorageEngineConstants = {
  MODE: MODE,
  PID_KEY: '__pid',
  CONN_CHECK: appendMode('__conn_check', MODE),
  PARTICIPANTS: appendMode('participants', MODE),
  STUDIES: appendMode('studies', MODE),
  SESSIONS: appendMode('sessions', MODE),
  TRRACKS: appendMode('trracks', MODE),
  NODES: 'nodes',
  TRRACK: 'trrack',
  RECAPTCHAV3TOKEN: '6LdjOd0lAAAAAASvFfDZFWgtbzFSS9Y3so8rHJth',
};

export async function initalizeStorageEngine() {
  const localStorageEngine = new LocalStorageEngine(constants);
  const firebaseStorageEngine = new FirebaseStorageEngine(constants);

  await firebaseStorageEngine.connect();
  await localStorageEngine.connect();

  return firebaseStorageEngine.isConnected() ? firebaseStorageEngine : localStorageEngine;
}


