import { AppShell, Container } from '@mantine/core';

import { useParams } from 'react-router-dom';
import AppHeader from './components/interface/AppHeader';
import AppNav from './components/interface/AppNav';
import { GlobalConfig } from '../parser/types';
import { SummaryBlock } from './dashboard/SummaryBlock';
import { StatsBoard } from './stats/StatsBoard.';

export function AnalysisInterface(props: { globalConfig: GlobalConfig; }) {
  const { page } = useParams();

  return (
    <AppShell>
      <AppHeader studyIds={props.globalConfig.configsList} />
      <AppNav />
      {page === 'dashboard' && (
        <Container fluid>
          <SummaryBlock globalConfig={props.globalConfig} />
        </Container>
      )}
      {page === 'stats'
            && (
            <Container fluid>
              <StatsBoard globalConfig={props.globalConfig} />
            </Container>
            )}

    </AppShell>
  );
}
