import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { BrowserRouter } from 'react-router-dom';
import { StorageEngineProvider } from './storage/storageEngineHooks';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import { GlobalConfigParser } from './GlobalConfigParser';
import { PREFIX } from './utils/Prefix';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <StorageEngineProvider>
      <MantineProvider>
        <BrowserRouter basename={PREFIX}>
          <GlobalConfigParser />
        </BrowserRouter>
      </MantineProvider>
    </StorageEngineProvider>
  </React.StrictMode>,
);
