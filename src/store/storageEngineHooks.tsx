import React, { ReactNode, createContext, useContext } from 'react';

import { StorageEngine } from '../storage/engines/StorageEngine';

interface StorageContextValue {
  storageEngine: StorageEngine | undefined;
  setStorageEngine: (engine: StorageEngine) => void;
}

const StorageEngineContext = createContext<StorageContextValue>({
  storageEngine: undefined,
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  setStorageEngine: () => {},
});

export const useStorageEngine = () => useContext(StorageEngineContext);

export const StorageEngineProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [storageEngine, setStorageEngine] = React.useState<StorageEngine | undefined>(undefined);

  const value = React.useMemo(() => {
    return {
      storageEngine,
      setStorageEngine,
    };
  }, [storageEngine]);

  return <StorageEngineContext.Provider value={value}>{children}</StorageEngineContext.Provider>;
};
