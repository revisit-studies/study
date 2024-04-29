import { AppShell, Container } from '@mantine/core';
import { useParams } from 'react-router-dom';
import AppHeader from './components/interface/AppHeader';
import { GlobalConfig } from '../parser/types';
import { SummaryBlock } from './dashboard/SummaryBlock';

export function AnalysisDashboard(props: { globalConfig: GlobalConfig; }) {
  const { studyId } = useParams();
  return (
    <AppShell>
      <Container fluid>
        <SummaryBlock globalConfig={props.globalConfig} />
      </Container>
    </AppShell>
  );
}
