import {
  AppShell, Container, LoadingOverlay, Tabs,
} from '@mantine/core';
import { useNavigate, useParams } from 'react-router-dom';
import {
  IconChartDonut2, IconPlayerPlay, IconTable, IconSettings,
} from '@tabler/icons-react';
import React, {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import AppHeader from './components/interface/AppHeader';
import { GlobalConfig, ParticipantData, StudyConfig } from '../parser/types';
import { getStudyConfig } from '../utils/fetchConfig';
import { TableView } from './stats/TableView';
import { useStorageEngine } from '../storage/storageEngineHooks';
import { DataManagementBoard } from './management/DataManagementBoard';
import { FirebaseStorageEngine } from '../storage/engines/FirebaseStorageEngine';

export function AnalysisInterface(props: { globalConfig: GlobalConfig; }) {
  const { globalConfig } = props;
  const { studyId } = useParams();
  const [expData, setExpData] = useState<ParticipantData[]>([]);
  const [studyConfig, setStudyConfig] = useState<StudyConfig | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const { storageEngine } = useStorageEngine();
  const navigate = useNavigate();
  const { tab } = useParams();

  const getData = useCallback(async () => {
    setLoading(true);
    if (studyId) {
      const cf = await getStudyConfig(studyId, globalConfig);
      if (!cf || !storageEngine) return;
      await storageEngine.initializeStudyDb(studyId, cf);
      const data = (await storageEngine.getAllParticipantsData());
      setExpData(data);
      setStudyConfig(cf);
      setLoading(false);
    }
  }, [globalConfig, storageEngine, studyId]);

  useEffect(() => {
    getData();
  }, [globalConfig, storageEngine, studyId, getData]);

  const [completed, inProgress] = useMemo(() => {
    const comp = expData.filter((d) => d.completed);
    const prog = expData.filter((d) => !d.completed);
    return [comp, prog];
  }, [expData]);

  const showManage = import.meta.env.VITE_REVISIT_MODE !== 'public' && storageEngine instanceof FirebaseStorageEngine;

  return (
    <>
      <AppHeader studyIds={props.globalConfig.configsList} />
      <AppShell.Main>
        <Container fluid style={{ height: '100%' }}>
          <LoadingOverlay visible={loading} />
          <Tabs variant="outline" value={tab} onChange={(value) => navigate(`./../${value}`)} style={{ height: '100%' }}>
            <Tabs.List>
              <Tabs.Tab value="table" leftSection={<IconTable size={16} />}>Table View</Tabs.Tab>
              <Tabs.Tab value="stats" leftSection={<IconChartDonut2 size={16} />}>Trial Stats</Tabs.Tab>
              <Tabs.Tab value="replay" leftSection={<IconPlayerPlay size={16} />}>Individual Replay</Tabs.Tab>
              <Tabs.Tab value="manage" leftSection={<IconSettings size={16} />} disabled={!showManage}>Manage</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="table" pt="xs" style={{ height: 'calc(100% - 38px - 10px)', width: '100%', overflow: 'scroll' }}>
              {studyConfig && <TableView completed={completed} inProgress={inProgress} studyConfig={studyConfig} refresh={getData} />}
            </Tabs.Panel>

            <Tabs.Panel value="stats" pt="xs">
              statsboard
            </Tabs.Panel>
            <Tabs.Panel value="replay" pt="xs">
              Replay Tab Content
            </Tabs.Panel>
            <Tabs.Panel value="manage" pt="xs">
              {studyId && showManage && <DataManagementBoard studyId={studyId} refresh={getData} />}
            </Tabs.Panel>
          </Tabs>
        </Container>
      </AppShell.Main>
    </>
  );
}
