import { Container } from '@mantine/core';
import { SummaryBlock } from './SummaryBlock';
import { DashBoardProps } from '../types';

export function Dashboard(props: DashBoardProps) {
  const { globalConfig } = props;
  return (
    <Container fluid>
      <SummaryBlock databaseSection="/" globalConfig={globalConfig} />
    </Container>

  );
}
