import { LocalStorageEngine } from './engines/LocalStorageEngine';
import { FirebaseStorageEngine } from './engines/FirebaseStorageEngine';
import { StorageEngine } from './engines/StorageEngine';

export async function initializeStorageEngine() {
  let storageEngine: StorageEngine | undefined;

  const storageEngineName: string = import.meta.env.VITE_STORAGE_ENGINE; 

  if (storageEngineName === 'firebase') {
    const firebaseStorageEngine = new FirebaseStorageEngine();
    await firebaseStorageEngine.connect();

    if (firebaseStorageEngine.isConnected()) {
      storageEngine = firebaseStorageEngine;
    }
  }

  if (storageEngineName === 'localStorage') {
    const localStorageEngine = new LocalStorageEngine();
    await localStorageEngine.connect();

    storageEngine = localStorageEngine;
  }

  if (!storageEngine) {
    throw new Error(`The requested storage engine "${storageEngineName}" could not be initialized.`);
  }

  return storageEngine;
}
