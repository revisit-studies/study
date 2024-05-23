import {
  AppShell, Container, Flex, LoadingOverlay, Space, Tabs, Text, Title,
  Tooltip,
} from '@mantine/core';
import { useNavigate, useParams } from 'react-router-dom';
import {
  IconChartDonut2, IconCheck, IconPlayerPlay, IconProgress, IconTable,
  IconX,
} from '@tabler/icons-react';
import React, {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import AppHeader from './interface/AppHeader';
import { GlobalConfig, ParticipantData, StudyConfig } from '../parser/types';
import { getStudyConfig } from '../utils/fetchConfig';
import { TableView } from './table/TableView';
import { useStorageEngine } from '../storage/storageEngineHooks';
import { StatsBoard } from './stats/StatsBoard';

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

  const [completed, inProgress, rejected] = useMemo(() => {
    const comp = expData.filter((d) => !d.rejected && d.completed);
    const prog = expData.filter((d) => !d.rejected && !d.completed);
    const rej = expData.filter((d) => d.rejected);
    return [comp, prog, rej];
  }, [expData]);

  return (
    <AppShell>
      <AppHeader studyIds={props.globalConfig.configsList} />
      <Container fluid>
        <LoadingOverlay visible={loading} />

        <Flex direction="row">
          <Title order={5}>{studyId}</Title>
          <Text fz="sm" ml={4}>
            (
            <Tooltip label="Completed"><IconCheck size={16} color="teal" style={{ marginBottom: -3 }} /></Tooltip>
            :
            {' '}
            {completed.length}
            {' '}
            |
            {' '}
            <Tooltip label="In Progress"><IconProgress size={16} color="orange" style={{ marginBottom: -3 }} /></Tooltip>
            :
            {' '}
            {inProgress.length}
            {' '}
            |
            {' '}
            <Tooltip label="Rejected"><IconX size={16} color="red" style={{ marginBottom: -3 }} /></Tooltip>
            :
            {' '}
            {rejected.length}
            )
          </Text>
        </Flex>
        <Space h="xs" />

        <Tabs variant="outline" value={tab} onTabChange={(value) => navigate(`./../${value}`)} style={{ height: '100%' }}>
          <Tabs.List>
            <Tabs.Tab value="table" icon={<IconTable size={16} />}>Table View</Tabs.Tab>
            <Tabs.Tab value="stats" icon={<IconChartDonut2 size={16} />}>Trial Stats</Tabs.Tab>
            <Tabs.Tab value="participant" icon={<IconPlayerPlay size={16} />} disabled>Individual Replay</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="table" pt="xs" style={{ height: 'calc(100% - 38px - 10px)', width: '100%', overflow: 'scroll' }}>
            {studyConfig && <TableView completed={completed} inProgress={inProgress} rejected={rejected} studyConfig={studyConfig} refresh={getData} />}
          </Tabs.Panel>

          <Tabs.Panel value="stats" pt="xs">
            {studyConfig && <StatsBoard studyConfig={studyConfig} completed={completed} inprogress={inProgress} rejected={rejected} />}
          </Tabs.Panel>

          <Tabs.Panel value="participant" pt="xs">
            Participant content
          </Tabs.Panel>
        </Tabs>
      </Container>
    </AppShell>
  );
}
