import React from 'react';
import ReactDOM from 'react-dom/client';
import { StorageEngineProvider } from './storage/storageEngineHooks';
import { GlobalInitializer } from './GlobalInitializer';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <StorageEngineProvider>
      <GlobalInitializer />
    </StorageEngineProvider>
  </React.StrictMode>,
);
