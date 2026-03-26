import { LocalStorageEngine } from './engines/LocalStorageEngine';
import { FirebaseStorageEngine } from './engines/FirebaseStorageEngine';
import { SupabaseStorageEngine } from './engines/SupabaseStorageEngine';
import { StorageEngine } from './engines/types';

export async function initializeStorageEngine() {
  let storageEngine: StorageEngine | undefined;
  let fallback = false;

  const storageEngineName: string = import.meta.env.VITE_STORAGE_ENGINE;
  console.warn('[ReVISit][StorageInit] initializeStorageEngine called', {
    requestedEngine: storageEngineName,
    hasRequestedEngine: Boolean(storageEngineName),
  });

  if (storageEngineName === 'supabase') {
    console.warn('[ReVISit][StorageInit] Attempting Supabase engine');
    const supabaseStorageEngine = new SupabaseStorageEngine();
    await supabaseStorageEngine.connect();

    if (supabaseStorageEngine.isConnected()) {
      console.warn('[ReVISit][StorageInit] Supabase engine connected');
      storageEngine = supabaseStorageEngine;
    } else {
      console.warn('[ReVISit][StorageInit] Supabase engine failed to connect, enabling fallback');
      fallback = true;
    }
  }

  if (storageEngineName === 'firebase') {
    console.warn('[ReVISit][StorageInit] Attempting Firebase engine');
    const firebaseStorageEngine = new FirebaseStorageEngine();
    await firebaseStorageEngine.connect();

    if (firebaseStorageEngine.isConnected()) {
      console.warn('[ReVISit][StorageInit] Firebase engine connected');
      storageEngine = firebaseStorageEngine;
    } else {
      console.warn('[ReVISit][StorageInit] Firebase engine failed to connect, enabling fallback');
      fallback = true;
    }
  }

  if (storageEngineName === 'localStorage' || fallback) {
    console.warn('[ReVISit][StorageInit] Falling back to localStorage engine', {
      requestedEngine: storageEngineName,
      fallback,
    });
    const localStorageEngine = new LocalStorageEngine();
    await localStorageEngine.connect();

    storageEngine = localStorageEngine;
  }

  console.warn('[ReVISit][StorageInit] initializeStorageEngine returning', {
    resolvedEngine: storageEngine?.getEngine?.(),
    fallback,
  });

  return storageEngine!;
}
