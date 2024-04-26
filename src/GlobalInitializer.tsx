import { useEffect } from 'react';
import { useStorageEngine } from './storage/storageEngineHooks';
import { GlobalConfigParser } from './GlobalConfigParser';
import { initializeStorageEngine } from './storage/initialize';

export function GlobalInitializer() {
  // Initialize storage engine
  const { storageEngine, setStorageEngine } = useStorageEngine();
  useEffect(() => {
    if (storageEngine !== undefined) return;

    async function fn() {
      const _storageEngine = await initializeStorageEngine();
      setStorageEngine(_storageEngine);
    }
    fn();
  }, [setStorageEngine, storageEngine]);

  return (
    <GlobalConfigParser />
  );
}
