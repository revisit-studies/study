import { LocalStorageEngine } from './engines/LocalStorageEngine';
import { FirebaseStorageEngine } from './engines/FirebaseStorageEngine';
import { SupabaseStorageEngine } from './engines/SupabaseStorageEngine';
import { StorageEngine } from './engines/types';

export async function initializeStorageEngine() {
  let storageEngine: StorageEngine | undefined;
  let fallback = false;

  const configuredEngine = import.meta.env.VITE_STORAGE_ENGINE;
  const storageEngineName = configuredEngine === 'firebase' || configuredEngine === 'supabase' || configuredEngine === 'localStorage'
    ? configuredEngine
    : 'localStorage';

  if (storageEngineName === 'supabase') {
    try {
      const supabaseStorageEngine = new SupabaseStorageEngine();
      await supabaseStorageEngine.connect();

      if (supabaseStorageEngine.isConnected()) {
        storageEngine = supabaseStorageEngine;
      } else {
        fallback = true;
      }
    } catch {
      fallback = true;
    }
  }

  if (storageEngineName === 'firebase') {
    try {
      const firebaseStorageEngine = new FirebaseStorageEngine();
      await firebaseStorageEngine.connect();

      if (firebaseStorageEngine.isConnected()) {
        storageEngine = firebaseStorageEngine;
      } else {
        fallback = true;
      }
    } catch {
      fallback = true;
    }
  }

  if (storageEngineName === 'localStorage' || fallback) {
    const localStorageEngine = new LocalStorageEngine();
    await localStorageEngine.connect();

    storageEngine = localStorageEngine;
  }

  return storageEngine;
}
