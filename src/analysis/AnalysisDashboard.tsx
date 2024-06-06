import { Container } from '@mantine/core';
import { GlobalConfig } from '../parser/types';
import { SummaryBlock } from './dashboard/SummaryBlock';
import AppHeader from './components/interface/AppHeader';

export function AnalysisDashboard({ globalConfig }: { globalConfig: GlobalConfig; }) {
  return (
    <>
      <AppHeader studyIds={globalConfig.configsList} />
      <Container fluid>
        <SummaryBlock globalConfig={globalConfig} />
      </Container>
    </>
  );
}
