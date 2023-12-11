import { AppShell } from '@mantine/core';
import { Outlet } from 'react-router-dom';
import AppAside from './interface/AppAside';
import AppHeader from './interface/AppHeader';
import AppNavBar from './interface/AppNavBar';
import HelpModal from './interface/HelpModal';
import { AlertModal } from './interface/AlertModal';

export function StepRenderer() {
  return (
    <AppShell
      navbar={<AppNavBar />}
      aside={<AppAside />}
      header={<AppHeader />}
    >
      <HelpModal />
      <AlertModal/>
      <Outlet />
    </AppShell>
  );
}