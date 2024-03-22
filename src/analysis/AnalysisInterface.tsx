import { AppShell } from '@mantine/core';

import { useLocation } from 'react-router-dom';
import AppHeader from './components/basics/AppHeader';
import AppNav from './components/basics/AppNav';
import { GlobalConfig } from '../parser/types';
import { Dashboard } from './dashboard/Dashboard';

export interface AnalysisInterfaceProps {
    globalConfig: GlobalConfig
}

export function AnalysisInterface(props: AnalysisInterfaceProps) {
  const location = useLocation();

  const page = location.pathname.split('/')[2];
  // console.log(page, 'page');

  return (
    <AppShell>
      <AppHeader />
      <AppNav />
      {page === 'dashboard' && <Dashboard globalConfig={props.globalConfig} />}
    </AppShell>
  );
}
