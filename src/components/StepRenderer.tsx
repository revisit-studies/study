import { AppShell } from '@mantine/core';
import { Outlet } from 'react-router-dom';
import AppAside from './interface/AppAside';
import AppHeader from './interface/AppHeader';
import AppNavBar from './interface/AppNavBar';
import HelpModal from './interface/HelpModal';
import { AlertModal } from './interface/AlertModal';
import { useEffect, useRef } from 'react';
import debounce from 'lodash.debounce';

// timestamp, event type, event data
type EventType = [number, 'mousemove', number[]]

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
    <AppShell
      navbar={<AppNavBar />}
      aside={<AppAside />}
      header={<AppHeader />}
    >
      <HelpModal />
      <AlertModal/>
      <Outlet context={[windowEvents]}/>
    </AppShell>
  );
}