import {
  Alert, AppShell, Checkbox, Container, Flex, Group, LoadingOverlay, Stack, Tabs, Text, Title,
} from '@mantine/core';
import { useNavigate, useParams } from 'react-router';
import {
  IconChartDonut2, IconTable, IconSettings,
  IconInfoCircle,
  IconChartPie,
} from '@tabler/icons-react';
import {
  useEffect, useMemo, useState,
} from 'react';
import { useResizeObserver } from '@mantine/hooks';
import { AppHeader } from '../interface/AppHeader';
import { GlobalConfig, ParticipantData, StudyConfig } from '../../parser/types';
import { getStudyConfig } from '../../utils/fetchConfig';
import { SummaryView } from './summary/SummaryView';
import { TableView } from './table/TableView';
import { StatsView } from './stats/StatsView';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { ManageAccordion } from './management/ManageAccordion';
import { useAuth } from '../../store/hooks/useAuth';
import { parseStudyConfig } from '../../parser/parser';
import { useAsync } from '../../store/hooks/useAsync';
import { StorageEngine } from '../../storage/engines/types';
import 'mantine-react-table/styles.css';

const TABLE_HEADER_HEIGHT = 37; // Height of the tabs header

function sortByStartTime(a: ParticipantData, b: ParticipantData) {
  const aStartTimes = Object.values(a.answers).map((answer) => answer.startTime).filter((startTime) => startTime !== undefined).sort();
  const bStartTimes = Object.values(b.answers).map((answer) => answer.startTime).filter((startTime) => startTime !== undefined).sort();
  if (aStartTimes.length === 0 || bStartTimes.length === 0) {
    if (aStartTimes.length > 0) {
      return -1;
    }
    if (bStartTimes.length > 0) {
      return 1;
    }
    return b.participantIndex - a.participantIndex;
  }
  return bStartTimes[0] - aStartTimes[0];
}

function getParticipantsData(studyConfig: StudyConfig | undefined, storageEngine: StorageEngine | undefined, studyId: string | undefined) : Promise<Record<number, ParticipantData>> {
  if (!studyConfig || !storageEngine || !studyId) return Promise.resolve([]);

  storageEngine?.initializeStudyDb(studyId);

  return storageEngine.getAllParticipantsData(studyId);
}

export function StudyAnalysisTabs({ globalConfig }: { globalConfig: GlobalConfig; }) {
  const { studyId } = useParams();
  const [studyConfig, setStudyConfig] = useState<StudyConfig | undefined>(undefined);

  const [includedParticipants, setIncludedParticipants] = useState<string[]>(['completed', 'inprogress', 'rejected']);

  const { storageEngine } = useStorageEngine();
  const navigate = useNavigate();
  const { analysisTab } = useParams();
  const { user } = useAuth();
  const [ref, { width }] = useResizeObserver();

  // 0-1 percentage of scroll height

  const { value: expData, execute, status } = useAsync(getParticipantsData, [studyConfig, storageEngine, studyId]);

  const visibleParticipants = useMemo(() => {
    if (!expData) return [];
    const expList = Object.values(expData);

    const comp = includedParticipants.includes('completed') ? expList.filter((d) => !d.rejected && d.completed) : [];
    const prog = includedParticipants.includes('inprogress') ? expList.filter((d) => !d.rejected && !d.completed) : [];
    const rej = includedParticipants.includes('rejected') ? expList.filter((d) => d.rejected) : [];
    return [...comp, ...prog, ...rej].sort(sortByStartTime);
  }, [expData, includedParticipants]);

  useEffect(() => {
    if (!studyId) return () => { };
    if (studyId === '__revisit-widget') {
      const messageListener = async (event: MessageEvent) => {
        if (event.data.type === 'revisitWidget/CONFIG' && storageEngine) {
          const cf = await parseStudyConfig(event.data.payload);
          setStudyConfig(cf);
        }
      };

      window.addEventListener('message', messageListener);
      window.parent.postMessage({ type: 'revisitWidget/READY' }, '*');
      return () => {
        window.removeEventListener('message', messageListener);
      };
    }
    getStudyConfig(studyId, globalConfig).then((cf) => {
      if (cf) {
        setStudyConfig(cf);
      }
    });

    return () => { };
  }, [studyId, globalConfig, storageEngine]);

  return (
    <>
      <AppHeader studyIds={globalConfig.configsList} />

      <AppShell.Main style={{ height: '100dvh' }}>

        <Stack ref={ref} style={{ height: '100%', maxHeight: '100dvh', overflow: 'hidden' }} justify="space-between">

          <Flex direction="row" align="center" justify="space-between">
            <Title order={5} mr="sm">{studyId}</Title>

            <Flex direction="row" align="center">
              <Text mt={-2} size="sm">Participants: </Text>
              <Checkbox.Group
                value={includedParticipants}
                onChange={(e) => setIncludedParticipants(e)}
                mb="xs"
                mt={8}
                ml="xs"
              >
                <Group>
                  <Checkbox value="completed" label="Completed" />
                  <Checkbox value="inprogress" label="In Progress" />
                  <Checkbox value="rejected" label="Rejected" />
                </Group>
              </Checkbox.Group>
            </Flex>
          </Flex>
          <LoadingOverlay visible={status === 'pending'} />

          {status === 'success' ? (
            <Tabs
              style={{
                flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
              }}
              keepMounted={false}
              variant="outline"
              value={analysisTab}
              onChange={(value) => navigate(`/analysis/stats/${studyId}/${value}`)}
            >
              <Tabs.List>
                <Tabs.Tab value="summary" leftSection={<IconChartPie size={16} />}>Study Summary</Tabs.Tab>
                <Tabs.Tab value="table" leftSection={<IconTable size={16} />}>Participant View</Tabs.Tab>
                <Tabs.Tab value="stats" leftSection={<IconChartDonut2 size={16} />}>Trial Stats</Tabs.Tab>
                <Tabs.Tab value="manage" leftSection={<IconSettings size={16} />} disabled={!user.isAdmin}>Manage</Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel style={{ overflow: 'auto' }} value="summary" pt="xs">
                {studyConfig && <SummaryView studyConfig={studyConfig} visibleParticipants={visibleParticipants} />}
              </Tabs.Panel>
              <Tabs.Panel style={{ height: `calc(100% - ${TABLE_HEADER_HEIGHT}px)` }} value="table" pt="xs">
                {studyConfig && <TableView width={width} visibleParticipants={visibleParticipants} studyConfig={studyConfig} refresh={() => execute(studyConfig, storageEngine, studyId)} />}
              </Tabs.Panel>
              <Tabs.Panel value="stats" pt="xs">
                {studyConfig && <StatsView studyConfig={studyConfig} visibleParticipants={visibleParticipants} />}
              </Tabs.Panel>
              <Tabs.Panel value="manage" pt="xs">
                {studyId && user.isAdmin ? <ManageAccordion studyId={studyId} refresh={() => execute(studyConfig, storageEngine, studyId)} /> : <Container mt={20}><Alert title="Unauthorized Access" variant="light" color="red" icon={<IconInfoCircle />}>You are not authorized to manage the data for this study.</Alert></Container>}
              </Tabs.Panel>
            </Tabs>
          ) : null }
        </Stack>
      </AppShell.Main>
    </>
  );
}
