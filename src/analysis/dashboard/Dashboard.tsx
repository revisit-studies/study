import { Container, Tabs } from '@mantine/core';
import { useState } from 'react';
import { SummaryBlock } from './SummaryBlock';
import { DashBoardProps } from '../types';

export function Dashboard(props: DashBoardProps) {
  const [activeTab, setActiveTab] = useState<string | null>('Prod');
  const { globalConfig } = props;
  return (
    <Container fluid>
      <Tabs value={activeTab} onTabChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="Prod">Production</Tabs.Tab>
          <Tabs.Tab value="Dev">Dev</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="Prod">
          <SummaryBlock databaseSection="/" globalConfig={globalConfig} />
        </Tabs.Panel>
        <Tabs.Panel value="Dev">
          <SummaryBlock databaseSection="/" globalConfig={globalConfig} />
        </Tabs.Panel>
      </Tabs>

    </Container>

  );
}
