import {
  ReactNode, createContext, useCallback, useContext, useMemo, useState,
} from 'react';

import { StorageEngine } from './engines/types';

interface StorageContextValue {
  storageEngine: StorageEngine | undefined;
  configuredStorageEngine?: StorageEngine;
  setStorageEngine: (engine: StorageEngine, configured?: StorageEngine) => void;
}

const StorageEngineContext = createContext<StorageContextValue>({
  storageEngine: undefined,
  configuredStorageEngine: undefined,
  setStorageEngine: () => {},
});

export const useStorageEngine = () => useContext(StorageEngineContext);

export function StorageEngineProvider({ children }: { children: ReactNode}) {
  const [engines, setEngines] = useState<{ configured: StorageEngine; active: StorageEngine } | undefined>(undefined);
  const setStorageEngine = useCallback((engine: StorageEngine, configured?: StorageEngine) => {
    setEngines({ configured: configured ?? engine, active: engine });
  }, []);

  const value = useMemo(() => ({
    storageEngine: engines?.active,
    configuredStorageEngine: engines?.configured,
    setStorageEngine,
  }), [engines, setStorageEngine]);

  return <StorageEngineContext.Provider value={value}>{children}</StorageEngineContext.Provider>;
}
