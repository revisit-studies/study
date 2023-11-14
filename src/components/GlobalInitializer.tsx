import { useEffect } from 'react';
import { useStorageEngine } from '../store/contexts/storage';
import { GlobalConfigParser } from './GlobalConfigParser';
import { initalizeStorageEngine } from '../storage/initialize';

export function GlobalInitializer() {
  // Initialize storage engine
  const { storageEngine, setStorageEngine } = useStorageEngine();
  useEffect(() => {
    if (storageEngine !== undefined) return;

    async function fn() {
      const storageEngine = await initalizeStorageEngine();
      setStorageEngine(storageEngine);
    }
    fn();
  }, [setStorageEngine, storageEngine]);

  return (
    <GlobalConfigParser />
  );
}
