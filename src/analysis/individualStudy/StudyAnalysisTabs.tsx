import {
  Alert,
  AppShell, Container, Flex, LoadingOverlay, Space, Tabs, Title,
  Tooltip,
} from '@mantine/core';
import { useNavigate, useParams } from 'react-router-dom';
import {
  IconChartDonut2, IconPlayerPlay, IconTable, IconSettings,
  IconInfoCircle,
} from '@tabler/icons-react';
import React, {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import AppHeader from '../interface/AppHeader';
import { GlobalConfig, ParticipantData, StudyConfig } from '../../parser/types';
import { getStudyConfig } from '../../utils/fetchConfig';
import { TableView } from './table/TableView';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import ManageAccordion from './management/ManageAccordion';
import { useAuth } from '../../store/hooks/useAuth';
import { ParticipantStatusBadges } from '../interface/ParticipantStatusBadges';
import { StatsView } from './stats/StatsView';

export function StudyAnalysisTabs({ globalConfig }: { globalConfig: GlobalConfig; }) {
  const { studyId } = useParams();
  const [expData, setExpData] = useState<ParticipantData[]>([]);
  const [studyConfig, setStudyConfig] = useState<StudyConfig | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const { storageEngine } = useStorageEngine();
  const navigate = useNavigate();
  const { tab } = useParams();
  const { user } = useAuth();

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
    <>
      <AppHeader studyIds={globalConfig.configsList} />

      <AppShell.Main>
        <Container fluid style={{ height: '100%' }}>
          <LoadingOverlay visible={loading} />

          <Flex direction="row" align="center">
            <Title order={5}>{studyId}</Title>
            <ParticipantStatusBadges completed={completed.length} inProgress={inProgress.length} rejected={rejected.length} />
          </Flex>

          <Space h="xs" />

          <Tabs variant="outline" value={tab} onChange={(value) => navigate(`/analysis/stats/${studyId}/${value}`)} style={{ height: '100%' }}>
            <Tabs.List>
              <Tabs.Tab value="table" leftSection={<IconTable size={16} />}>Table View</Tabs.Tab>
              <Tabs.Tab value="stats" leftSection={<IconChartDonut2 size={16} />}>Trial Stats</Tabs.Tab>
              <Tooltip label="Coming soon" position="bottom">
                <Tabs.Tab value="replay" leftSection={<IconPlayerPlay size={16} />} disabled>Participant Replay</Tabs.Tab>
              </Tooltip>
              <Tabs.Tab value="manage" leftSection={<IconSettings size={16} />} disabled={!user.isAdmin}>Manage</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="table" pt="xs">
              {studyConfig && <TableView completed={completed} inProgress={inProgress} rejected={rejected} studyConfig={studyConfig} refresh={getData} />}
            </Tabs.Panel>

            <Tabs.Panel value="stats" pt="xs">
              {studyConfig && <StatsView studyConfig={studyConfig} completed={completed} inprogress={inProgress} rejected={rejected} />}
            </Tabs.Panel>
            <Tabs.Panel value="replay" pt="xs">
              Replay Tab Content
            </Tabs.Panel>
            <Tabs.Panel value="manage" pt="xs">
              {studyId && user.isAdmin ? <ManageAccordion studyId={studyId} refresh={getData} /> : <Container mt={20}><Alert title="Unauthorized Access" variant="light" color="red" icon={<IconInfoCircle />}>You are not authorized to manage the data for this study.</Alert></Container>}
            </Tabs.Panel>
          </Tabs>
        </Container>
      </AppShell.Main>
    </>
  );
}
