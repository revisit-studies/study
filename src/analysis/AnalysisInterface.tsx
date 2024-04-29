import {
  AppShell, Container, LoadingOverlay, Tabs,
} from '@mantine/core';
import { useParams } from 'react-router-dom';
import {
  IconChartDonut2, IconPlayerPlay, IconTable,
} from '@tabler/icons-react';
import React, { useEffect, useState } from 'react';
import AppHeader from './components/interface/AppHeader';
import { GlobalConfig, ParticipantData } from '../parser/types';
import { FirebaseStorageEngine } from '../storage/engines/FirebaseStorageEngine';
import { getStudyConfig } from '../utils/fetchConfig';
import { isStudyCompleted } from './utils';
import { TableView } from './stats/TableView';
import { useStorageEngine } from '../storage/storageEngineHooks';

export function AnalysisInterface(props: { globalConfig: GlobalConfig; }) {
  const { globalConfig } = props;
  const { studyId } = useParams();
  const [expData, setExpData] = useState<ParticipantData[]>([]);
  const [completed, setCompleted] = useState<ParticipantData[]>([]);
  const [inprogress, setInprogress] = useState<ParticipantData[]>([]);
  const [loading, setLoading] = useState(false);
  const { storageEngine } = useStorageEngine();

  useEffect(() => {
    const getData = async () => {
      setLoading(true);
      // reSetSelection();
      const fetchData = async () => {
        if (studyId) {
          const cf = await getStudyConfig(studyId, globalConfig);
          if (!cf || !storageEngine) return;
          await storageEngine.connect();
          await storageEngine.initializeStudyDb(studyId, cf);
          const data = (await storageEngine.getAllParticipantsData());
          setExpData(data);
          setCompleted(data.filter((d) => isStudyCompleted(d)));

          setInprogress(data.filter((d) => !isStudyCompleted(d)));
        }
        setLoading(false);
      };
      await fetchData();
    };
    getData();
  }, [studyId]);

  return (
    <AppShell>
      <AppHeader studyIds={props.globalConfig.configsList} selectedId={studyId} />
      <Container fluid>
        <LoadingOverlay visible={loading} zIndex={1000} overlayBlur={2} />
        <Tabs mt={0} defaultValue="table">
          <Tabs.List>
            <Tabs.Tab value="table" icon={<IconTable size={14} />}>Table View</Tabs.Tab>
            <Tabs.Tab value="stats" icon={<IconChartDonut2 size={14} />}>Trial Stats</Tabs.Tab>
            <Tabs.Tab value="settings" icon={<IconPlayerPlay size={14} />}>Individual Replay</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="table" pt="xs">
            <TableView completed={completed} inprogress={inprogress} />
          </Tabs.Panel>

          <Tabs.Panel value="stats" pt="xs">
            statsboard
          </Tabs.Panel>

          <Tabs.Panel value="settings" pt="xs">
            Settings tab content
          </Tabs.Panel>
        </Tabs>

      </Container>
    </AppShell>
  );
}
