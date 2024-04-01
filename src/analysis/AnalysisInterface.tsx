import { AppShell, Container } from '@mantine/core';

import { useLocation } from 'react-router-dom';
import AppHeader from './components/interface/AppHeader';
import AppNav from './components/interface/AppNav';
import { GlobalConfig } from '../parser/types';
import { SummaryBlock } from './dashboard/SummaryBlock';

export function AnalysisInterface(props: { globalConfig: GlobalConfig; }) {
  const location = useLocation();
  const page = location.pathname.split('/')[2];

  return (
    <AppShell>
      <AppHeader />
      <AppNav />
      {page === 'dashboard' && (
        <Container fluid>
          <SummaryBlock globalConfig={props.globalConfig} />
        </Container>
      )}
    </AppShell>
  );
}
