import { Container, Tabs } from '@mantine/core';
import { useState } from 'react';
import { SummaryBlock } from './SummaryBlock';
import { GlobalConfig } from '../../parser/types';

type dashBoardProps = {
    globalConfig: GlobalConfig;
}

export function Dashboard(props: dashBoardProps) {
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
          <SummaryBlock databaseSection="/" studyId="html-demo" globalConfig={globalConfig} />
        </Tabs.Panel>
        <Tabs.Panel value="Dev">
          <SummaryBlock databaseSection="/" studyId="html-demo" globalConfig={globalConfig} />
        </Tabs.Panel>
      </Tabs>

    </Container>

  );
}
