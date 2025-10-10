import {
  Alert, AppShell, Checkbox, Container, Flex, Group, LoadingOverlay, Stack, Tabs, Text, Title,
} from '@mantine/core';
import { useNavigate, useParams } from 'react-router';
import {
  IconChartDonut2, IconTable, IconSettings,
  IconInfoCircle,
  IconChartPie,
  IconDashboard,
} from '@tabler/icons-react';
import {
  useEffect, useMemo, useState,
} from 'react';
import { useResizeObserver } from '@mantine/hooks';
import { AppHeader } from '../interface/AppHeader';
import { GlobalConfig, ParticipantData, StudyConfig } from '../../parser/types';
import { getStudyConfig } from '../../utils/fetchConfig';
import { LiveMonitorView } from './LiveMonitor/LiveMonitorView';
import { SummaryView } from './summary/SummaryView';
import { TableView } from './table/TableView';
import { StatsView } from './stats/StatsView';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { ManageAccordion } from './management/ManageAccordion';
import { useAuth } from '../../store/hooks/useAuth';
import { parseStudyConfig } from '../../parser/parser';
import { useAsync } from '../../store/hooks/useAsync';
import { StorageEngine } from '../../storage/engines/types';
import { DownloadButtons } from '../../components/downloader/DownloadButtons';
import { getSequenceFlatMap } from '../../utils/getSequenceFlatMap';
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

/**
 * Determines if the study has audio and screen recordings.
 */
function studyHasAudioScreenRecording(studyConfig: StudyConfig | undefined) {
  if (!studyConfig) return { hasAudio: false, hasScreenRecording: false };

  const hasAudio = studyConfig.uiConfig.recordAudio;
  const hasScreenRecording = studyConfig.uiConfig.recordScreen;

  const sequence = getSequenceFlatMap(studyConfig.sequence);
  const componentConfig = sequence.map((componentId) => {
    const c = studyConfig.components[componentId];

    if ('baseComponent' in c && studyConfig.baseComponents) {
      return { ...studyConfig.baseComponents[c.baseComponent], ...c };
    }
    return c;
  });

  return {
    hasAudio: hasAudio || componentConfig.some((a) => a.recordAudio),
    hasScreenRecording: hasScreenRecording || componentConfig.some((a) => a.recordScreen),
  };
}

export function StudyAnalysisTabs({ globalConfig }: { globalConfig: GlobalConfig; }) {
  const { studyId } = useParams();
  const [studyConfig, setStudyConfig] = useState<StudyConfig | undefined>(undefined);

  const [includedParticipants, setIncludedParticipants] = useState<string[]>(['completed', 'inprogress', 'rejected']);
  const [selectedParticipants, setSelectedParticipants] = useState<ParticipantData[]>([]);

  const { hasAudio, hasScreenRecording } = studyHasAudioScreenRecording(studyConfig);

  const { storageEngine } = useStorageEngine();
  const navigate = useNavigate();
  const { analysisTab } = useParams();
  const { user } = useAuth();
  const [ref, { width }] = useResizeObserver();

  // 0-1 percentage of scroll height

  const { value: expData, execute, status } = useAsync(getParticipantsData, [studyConfig, storageEngine, studyId]);

  const participantCounts = useMemo(() => {
    if (!expData) return { completed: 0, inprogress: 0, rejected: 0 };
    const expList = Object.values(expData);

    return {
      completed: expList.filter((d) => !d.rejected && d.completed).length,
      inprogress: expList.filter((d) => !d.rejected && !d.completed).length,
      rejected: expList.filter((d) => d.rejected).length,
    };
  }, [expData]);

  const selectedParticipantCounts = useMemo(() => {
    if (selectedParticipants.length === 0) return { completed: 0, inprogress: 0, rejected: 0 };

    return {
      completed: selectedParticipants.filter((d) => !d.rejected && d.completed).length,
      inprogress: selectedParticipants.filter((d) => !d.rejected && !d.completed).length,
      rejected: selectedParticipants.filter((d) => d.rejected).length,
    };
  }, [selectedParticipants]);

  const visibleParticipants = useMemo(() => {
    if (!expData) return [];
    const expList = Object.values(expData);

    const comp = includedParticipants.includes('completed') ? expList.filter((d) => !d.rejected && d.completed) : [];
    const prog = includedParticipants.includes('inprogress') ? expList.filter((d) => !d.rejected && !d.completed) : [];
    const rej = includedParticipants.includes('rejected') ? expList.filter((d) => d.rejected) : [];
    return [...comp, ...prog, ...rej].sort(sortByStartTime);
  }, [expData, includedParticipants]);

  useEffect(() => {
    setSelectedParticipants([]);
  }, [analysisTab]);

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
            <Flex direction="row" align="center">
              <Title order={5} mr="sm">{studyId}</Title>
              {studyConfig && (
                <DownloadButtons
                  visibleParticipants={selectedParticipants.length > 0 ? selectedParticipants : visibleParticipants}
                  studyId={studyId || ''}
                  gap="10px"
                  hasAudio={hasAudio}
                  hasScreenRecording={hasScreenRecording}
                />
              )}
            </Flex>
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
                  <Checkbox
                    value="completed"
                    label={selectedParticipants.length > 0
                      ? `Completed (${selectedParticipantCounts.completed} of ${participantCounts.completed})`
                      : `Completed (${participantCounts.completed})`}
                  />
                  <Checkbox
                    value="inprogress"
                    label={selectedParticipants.length > 0
                      ? `In Progress (${selectedParticipantCounts.inprogress} of ${participantCounts.inprogress})`
                      : `In Progress (${participantCounts.inprogress})`}
                  />
                  <Checkbox
                    value="rejected"
                    label={selectedParticipants.length > 0
                      ? `Rejected (${selectedParticipantCounts.rejected} of ${participantCounts.rejected})`
                      : `Rejected (${participantCounts.rejected})`}
                  />
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
                {storageEngine?.getEngine() === 'firebase' && (
                  <Tabs.Tab value="live-monitor" leftSection={<IconDashboard size={16} />}>Live Monitor</Tabs.Tab>
                )}
                <Tabs.Tab value="manage" leftSection={<IconSettings size={16} />} disabled={!user.isAdmin}>Manage</Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel style={{ overflow: 'auto' }} value="summary" pt="xs">
                {studyConfig && <SummaryView studyConfig={studyConfig} visibleParticipants={visibleParticipants} />}
              </Tabs.Panel>
              <Tabs.Panel style={{ height: `calc(100% - ${TABLE_HEADER_HEIGHT}px)` }} value="table" pt="xs">
                {studyConfig && <TableView width={width} visibleParticipants={visibleParticipants} studyConfig={studyConfig} refresh={() => execute(studyConfig, storageEngine, studyId)} selectedParticipants={selectedParticipants} onSelectionChange={setSelectedParticipants} />}
              </Tabs.Panel>
              <Tabs.Panel style={{ overflow: 'auto' }} value="stats" pt="xs">
                {studyConfig && <StatsView studyConfig={studyConfig} visibleParticipants={visibleParticipants} />}
              </Tabs.Panel>
              {storageEngine?.getEngine() === 'firebase' && (
                <Tabs.Panel style={{ overflow: 'auto' }} value="live-monitor" pt="xs">
                  {studyConfig && <LiveMonitorView studyConfig={studyConfig} storageEngine={storageEngine} studyId={studyId} includedParticipants={includedParticipants} />}
                </Tabs.Panel>
              )}
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
