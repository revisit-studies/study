import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { StorageEngineProvider } from './storage/storageEngineHooks';
import { GlobalInitializer } from './GlobalInitializer';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <StorageEngineProvider>
      <MantineProvider>

        <GlobalInitializer />
      </MantineProvider>

    </StorageEngineProvider>
  </React.StrictMode>,
);
