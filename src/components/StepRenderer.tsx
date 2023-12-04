import { AppShell } from '@mantine/core';
import { Outlet } from 'react-router-dom';
import AppAside from './interface/AppAside';
import AppHeader from './interface/AppHeader';
import AppNavBar from './interface/AppNavBar';
import HelpModal from './interface/HelpModal';

export function StepRenderer() {
  return (
    <AppShell
      navbar={<AppNavBar />}
      aside={<AppAside />}
      header={<AppHeader />}
    >
      <HelpModal />
      <Outlet />
    </AppShell>
  );
}