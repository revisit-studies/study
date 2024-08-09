import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { StorageEngineProvider } from './storage/storageEngineHooks';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import { GlobalConfigParser } from './GlobalConfigParser';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <StorageEngineProvider>
      <MantineProvider>
        <Notifications />
        <GlobalConfigParser />
      </MantineProvider>
    </StorageEngineProvider>
  </React.StrictMode>,
);
