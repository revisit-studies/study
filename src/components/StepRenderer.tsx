import { AppShell } from '@mantine/core';
import { Outlet } from 'react-router-dom';
import AppAside from './interface/AppAside';
import AppHeader from './interface/AppHeader';
import AppNavBar from './interface/AppNavBar';
import HelpModal from './interface/HelpModal';
import { AlertModal } from './interface/AlertModal';
import { createContext, useContext, useEffect, useRef } from 'react';
import debounce from 'lodash.debounce';
import { EventType } from '../store/types';

// Create a context
const WindowEventsContext = createContext<React.Ref<EventType[]>>(null);

export function useWindowEvents(): React.Ref<EventType[]> {
  const context = useContext(WindowEventsContext);
  if (!context) {
    throw new Error('useWindowEvents must be used within a WindowEventsProvider');
  }
  return context;
}

export function StepRenderer() {
  const windowEvents = useRef<EventType[]>([]);

  // Attach event listeners
  useEffect(() => {
    const mouseMoveListener = debounce(
      (e: MouseEvent) => {
        windowEvents.current.push([Date.now(), 'mousemove', [e.clientX, e.clientY]]);
      },
      100,
      {maxWait: 100}
    );
    window.addEventListener('mousemove', mouseMoveListener);
    return () => window.removeEventListener('mousemove', mouseMoveListener);
  }, []);

  return (
    <WindowEventsContext.Provider value={windowEvents}>
      <AppShell
        navbar={<AppNavBar />}
        aside={<AppAside />}
        header={<AppHeader />}
      >
        <HelpModal />
        <AlertModal />
        <Outlet />
      </AppShell>
    </WindowEventsContext.Provider>
  );
}
