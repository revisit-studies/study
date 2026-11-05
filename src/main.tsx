import React from 'react';
import ReactDOM from 'react-dom/client';
import { Notifications } from '@mantine/notifications';
import { StorageEngineProvider } from './storage/storageEngineHooks';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import { GlobalConfigParser } from './GlobalConfigParser';
import { ApplicationErrorBoundary } from './components/ApplicationErrorBoundary';
import { AppThemeProvider } from './components/AppThemeProvider';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppThemeProvider>
      <ApplicationErrorBoundary>
        <Notifications />
        <StorageEngineProvider>
          <GlobalConfigParser />
        </StorageEngineProvider>
      </ApplicationErrorBoundary>
    </AppThemeProvider>
  </React.StrictMode>,
);
