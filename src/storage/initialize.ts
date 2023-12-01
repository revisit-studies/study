import { LocalStorageEngine } from './engines/LocalStorageEngine';
import { FirebaseStorageEngine } from './engines/FirebaseStorageEngine';

export async function initalizeStorageEngine() {
  const localStorageEngine = new LocalStorageEngine();
  const firebaseStorageEngine = new FirebaseStorageEngine();

  await firebaseStorageEngine.connect();
  await localStorageEngine.connect();

  return firebaseStorageEngine.isConnected() ? firebaseStorageEngine : localStorageEngine;
}
