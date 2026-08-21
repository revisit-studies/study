import {
  ReactNode, createContext, useContext, useMemo, useState,
} from 'react';

import { StorageEngine } from './engines/types';

interface StorageContextValue {
  storageEngine: StorageEngine | undefined;
  setStorageEngine: (engine: StorageEngine) => void;
}

const StorageEngineContext = createContext<StorageContextValue>({
  storageEngine: undefined,
  setStorageEngine: () => {},
});

export const useStorageEngine = () => useContext(StorageEngineContext);

export function StorageEngineProvider({ children }: { children: ReactNode}) {
  const [storageEngine, setStorageEngine] = useState<StorageEngine | undefined>(undefined);

  const value = useMemo(() => ({
    storageEngine,
    setStorageEngine,
  }), [storageEngine]);

  return <StorageEngineContext.Provider value={value}>{children}</StorageEngineContext.Provider>;
}
