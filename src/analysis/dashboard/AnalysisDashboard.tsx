import { AppShell, Container } from '@mantine/core';
import { GlobalConfig } from '../../parser/types';
import { SummaryBlock } from './SummaryBlock';
import AppHeader from '../interface/AppHeader';

export function AnalysisDashboard({ globalConfig }: { globalConfig: GlobalConfig; }) {
  return (
    <>
      <AppHeader studyIds={globalConfig.configsList} />
      <AppShell.Main>
        <Container fluid>
          <SummaryBlock globalConfig={globalConfig} />
        </Container>
      </AppShell.Main>
    </>
  );
}
