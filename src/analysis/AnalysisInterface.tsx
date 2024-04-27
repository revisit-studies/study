import { AppShell, Container } from '@mantine/core';

import { useParams } from 'react-router-dom';
import AppHeader from './components/interface/AppHeader';
import AppNav from './components/interface/AppNav';
import { GlobalConfig } from '../parser/types';
import { SummaryBlock } from './dashboard/SummaryBlock';
import { GlobalSettings } from './dashboard/GlobalSettings';

export function AnalysisInterface(props: { globalConfig: GlobalConfig; }) {
  const { page } = useParams();

  return (
    <AppShell>
      <AppHeader />
      <AppNav />
      <Container fluid>
        {page === 'dashboard' && (
          <SummaryBlock globalConfig={props.globalConfig} />
        )}
        {page === 'settings' && (
          <GlobalSettings />
        )}
      </Container>
    </AppShell>
  );
}
