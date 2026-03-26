import { LocalStorageEngine } from './engines/LocalStorageEngine';
import { FirebaseStorageEngine } from './engines/FirebaseStorageEngine';
import { SupabaseStorageEngine } from './engines/SupabaseStorageEngine';
import { StorageEngine } from './engines/types';

export async function initializeStorageEngine() {
  let storageEngine: StorageEngine | undefined;
  let fallback = false;

  const storageEngineName: string = import.meta.env.VITE_STORAGE_ENGINE;

  if (storageEngineName === 'supabase') {
    const supabaseStorageEngine = new SupabaseStorageEngine();
    await supabaseStorageEngine.connect();

    if (supabaseStorageEngine.isConnected()) {
      storageEngine = supabaseStorageEngine;
    } else {
      fallback = true;
    }
  }

  if (storageEngineName === 'firebase') {
    const firebaseStorageEngine = new FirebaseStorageEngine();
    await firebaseStorageEngine.connect();

    if (firebaseStorageEngine.isConnected()) {
      storageEngine = firebaseStorageEngine;
    } else {
      fallback = true;
    }
  }

  if (storageEngineName === 'localStorage' || fallback) {
    const localStorageEngine = new LocalStorageEngine();
    await localStorageEngine.connect();

    storageEngine = localStorageEngine;
  }

  return storageEngine!;
}
