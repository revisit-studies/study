import {
  Alert, AppShell, Center, Checkbox, Container, Flex, Group, LoadingOverlay, Stack, Tabs, Text, Title, MultiSelect,
} from '@mantine/core';
import { useNavigate, useParams } from 'react-router';
import {
  IconChartDonut2, IconTable, IconSettings,
  IconInfoCircle,
  IconChartPie,
  IconTags,
  IconDashboard,
  IconFileCode,
} from '@tabler/icons-react';
import {
  useCallback, useEffect, useMemo, useState,
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
import { ManageView } from './management/ManageView';
import { useAuth } from '../../store/hooks/useAuth';
import { parseStudyConfig } from '../../parser/parser';
import { useAsync } from '../../store/hooks/useAsync';
import { StorageEngine } from '../../storage/engines/types';
import { DownloadButtons } from '../../components/downloader/DownloadButtons';
import { useStudyRecordings } from '../../utils/useStudyRecordings';
import { parseConditionParam } from '../../utils/handleConditionLogic';
import 'mantine-react-table/styles.css';
import { ThinkAloudAnalysis } from './thinkAloud/ThinkAloudAnalysis';
import { FirebaseStorageEngine } from '../../storage/engines/FirebaseStorageEngine';
import { ConfigView } from './config/ConfigView';

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

async function getParticipantsData(studyConfig: StudyConfig | undefined, storageEngine: StorageEngine | undefined, studyId: string | undefined): Promise<Record<number, ParticipantData>> {
  if (studyId && storageEngine) {
    await storageEngine.initializeStudyDb(studyId);
  }

  if (!studyConfig || !storageEngine || !studyId) return [];

  return await storageEngine.getAllParticipantsData(studyId);
}

export function StudyAnalysisTabs({ globalConfig }: { globalConfig: GlobalConfig; }) {
  const { studyId } = useParams();
  const [studyConfig, setStudyConfig] = useState<StudyConfig | undefined>(undefined);

  const [includedParticipants, setIncludedParticipants] = useState<string[]>(['completed', 'inprogress', 'rejected']);

  const [selectedStages, setSelectedStages] = useState<string[]>(['ALL']);
  const [availableStages, setAvailableStages] = useState<{ value: string; label: string }[]>([{ value: 'ALL', label: 'ALL' }]);
  const [stageColors, setStageColors] = useState<Record<string, string>>({});
  const [selectedParticipants, setSelectedParticipants] = useState<ParticipantData[]>([]);
  const [selectedConfigs, setSelectedConfigs] = useState<string[]>(['ALL']);
  const [availableConfigs, setAvailableConfigs] = useState<{ value: string; label: string }[]>([{ value: 'ALL', label: 'ALL' }]);
  const [selectedConditions, setSelectedConditions] = useState<string[]>(['ALL']);
  const [availableConditions, setAvailableConditions] = useState<{ value: string; label: string }[]>([]);

  const { hasAudioRecording, hasScreenRecording } = useStudyRecordings(studyConfig);

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

    // Apply config filter before counting
    const configFiltered = selectedConfigs.includes('ALL') || selectedConfigs.length === 0
      ? expList
      : expList.filter((d) => selectedConfigs.includes(d.participantConfigHash || ''));

    // Apply stage filter before counting
    const stageFiltered = selectedStages.includes('ALL')
      ? configFiltered
      : configFiltered.filter((d) => selectedStages.includes(d.stage || ''));

    // Apply condition filter before counting
    const conditionFiltered = selectedConditions.includes('ALL')
      ? stageFiltered
      : stageFiltered.filter((d) => {
        const conds = parseConditionParam(d.conditions ?? d.searchParams?.condition);
        const normalizedConds = conds.length > 0 ? conds : ['default'];
        return normalizedConds.some((c) => selectedConditions.includes(c));
      });

    return {
      completed: conditionFiltered.filter((d) => !d.rejected && d.completed).length,
      inprogress: conditionFiltered.filter((d) => !d.rejected && !d.completed).length,
      rejected: conditionFiltered.filter((d) => d.rejected).length,
    };
  }, [expData, selectedStages, selectedConfigs, selectedConditions]);

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

    const statusFiltered = [...comp, ...prog, ...rej];

    // Apply config filter - if "ALL" is selected, show all participants
    const configFiltered = selectedConfigs.includes('ALL')
      ? statusFiltered
      : statusFiltered.filter((d) => selectedConfigs.includes(d.participantConfigHash || ''));

    // Apply stage filter - if "ALL" is selected, show all participants
    const stageFiltered = selectedStages.includes('ALL')
      ? configFiltered
      : configFiltered.filter((d) => selectedStages.includes(d.stage || ''));

    // Apply condition filter - if "ALL" is selected, show all participants
    const conditionFiltered = selectedConditions.includes('ALL')
      ? stageFiltered
      : stageFiltered.filter((d) => {
        const conds = parseConditionParam(d.conditions ?? d.searchParams?.condition);
        const normalizedConds = conds.length > 0 ? conds : ['default'];
        return normalizedConds.some((c) => selectedConditions.includes(c));
      });

    return conditionFiltered.sort(sortByStartTime);
  }, [expData, includedParticipants, selectedStages, selectedConfigs, selectedConditions]);

  // Load available stages
  const loadStages = useCallback(async () => {
    if (!studyId || !storageEngine) return;

    try {
      const stageData = await storageEngine.getStageData(studyId);
      const stageOptions = stageData.allStages.map((stage) => ({
        value: stage.stageName,
        label: stage.stageName,
      }));
      setAvailableStages([{ value: 'ALL', label: 'ALL' }, ...stageOptions]);
      // Create a map of stage names to colors
      const colors: Record<string, string> = {};
      stageData.allStages.forEach((stage) => {
        colors[stage.stageName] = stage.color;
      });
      setStageColors(colors);
    } catch (error) {
      console.error('Failed to load stages:', error);
      setAvailableStages([{ value: 'ALL', label: 'ALL' }]);
      setStageColors({});
    }
  }, [studyId, storageEngine]);

  // Load available configs
  const loadConfigs = useCallback(async () => {
    if (!studyId || !storageEngine) return;

    try {
      const participantData = expData ? Object.values(expData) : [];
      const participantConfig = [...new Set(
        participantData.map((participant) => participant.participantConfigHash),
      )];

      const fetchedConfigs = await storageEngine.getAllConfigsFromHash(participantConfig, studyId);

      const configOptions = Object.entries(fetchedConfigs)
        .map(([hash, config]) => ({
          value: hash,
          label: `${config.studyMetadata.version} - ${hash.slice(0, 6)}`,
        }));
      setAvailableConfigs([{ value: 'ALL', label: 'ALL' }, ...configOptions]);
    } catch (error) {
      console.error('Failed to load configs:', error);
      setAvailableConfigs([{ value: 'ALL', label: 'ALL' }]);
    }
  }, [studyId, storageEngine, expData]);

  const allConditions = useMemo(() => {
    if (!expData) return [];
    const conditionSet = new Set<string>();
    Object.values(expData).forEach((participant) => {
      const parsedConditions = parseConditionParam(participant.conditions ?? participant.searchParams?.condition);
      const normalizedConditions = parsedConditions.length > 0 ? parsedConditions : ['default'];
      normalizedConditions.forEach((condition) => conditionSet.add(condition));
    });
    return Array.from(conditionSet).sort();
  }, [expData]);

  // Load configs and clear selection when dependencies change
  useEffect(() => {
    loadConfigs();
    setSelectedParticipants([]);
  }, [loadConfigs]);

  // Load stages and clear selection when dependencies change or tab switches
  useEffect(() => {
    loadStages();
    setSelectedParticipants([]);
  }, [loadStages, analysisTab]);

  // Load condition options from already-loaded participant data and clear selection when they change
  useEffect(() => {
    if (allConditions.length === 0) {
      setAvailableConditions([]);
      setSelectedConditions(['ALL']);
      setSelectedParticipants([]);
      return;
    }

    const conditionOptions = allConditions.map((condition) => ({
      value: condition,
      label: condition,
    }));
    setAvailableConditions([{ value: 'ALL', label: 'ALL' }, ...conditionOptions]);
    setSelectedConditions((previousSelection) => {
      const validSelections = new Set(['ALL', ...allConditions]);
      const nextSelection = previousSelection.filter((value) => validSelections.has(value));
      return nextSelection.length > 0 ? nextSelection : ['ALL'];
    });
    setSelectedParticipants([]);
  }, [allConditions]);

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

  if (!studyId) {
    return (
      <>
        <AppHeader studyIds={globalConfig.configsList} />
        <AppShell.Main style={{ height: '100dvh' }}>
          <Center style={{ height: '100%' }}>
            <Text>Select a study from the header menu to view analysis data.</Text>
          </Center>
        </AppShell.Main>
      </>
    );
  }

  return (
    <>
      <AppHeader studyIds={globalConfig.configsList} />
      <AppShell.Main style={{ height: '100dvh' }}>
        <Stack ref={ref} style={{ height: '100%', maxHeight: '100dvh', overflow: 'hidden' }} justify="space-between">
          <Flex direction="row" align="center" justify="space-between" p="sm" gap="md">
            <Flex direction="row" align="center" gap="md">
              <Title order={5}>{studyId}</Title>
              {studyConfig && (
                <DownloadButtons
                  visibleParticipants={selectedParticipants.length > 0 ? selectedParticipants : visibleParticipants}
                  studyId={studyId || ''}
                  gap="10px"
                  hasAudio={hasAudioRecording}
                  hasScreenRecording={hasScreenRecording}
                />
              )}
            </Flex>
            <Flex direction="row" align="center" gap="md">
              <Flex direction="row" align="center" gap="xs">
                <Text size="sm" fw={500}>Stage:</Text>
                <MultiSelect
                  data={availableStages}
                  value={selectedStages}
                  onChange={(values) => {
                    if (values.includes('ALL') && !selectedStages.includes('ALL')) {
                      setSelectedStages(['ALL']);
                    } else if (values.includes('ALL') && selectedStages.includes('ALL')) {
                      setSelectedStages(values.filter((v) => v !== 'ALL'));
                    } else if (values.length === 0) {
                      setSelectedStages(['ALL']);
                    } else {
                      setSelectedStages(values);
                    }
                  }}
                  w={180}
                  size="sm"
                  clearable={false}
                  maxValues={5}
                  styles={{
                    input: {
                      minHeight: '36px',
                    },
                  }}
                />
              </Flex>

              <Flex direction="row" align="center" gap="xs">
                <Text size="sm" fw={500}>Config:</Text>
                <MultiSelect
                  data={availableConfigs}
                  value={selectedConfigs}
                  onChange={(values) => {
                    if (values.includes('ALL') && !selectedConfigs.includes('ALL')) {
                      setSelectedConfigs(['ALL']);
                    } else if (values.includes('ALL') && selectedConfigs.includes('ALL')) {
                      setSelectedConfigs(values.filter((v) => v !== 'ALL'));
                    } else if (values.length === 0) {
                      setSelectedConfigs(['ALL']);
                    } else {
                      setSelectedConfigs(values);
                    }
                  }}
                  w={180}
                  size="sm"
                  clearable={false}
                  maxValues={5}
                  styles={{
                    input: {
                      minHeight: '36px',
                    },
                  }}
                />
              </Flex>

              {availableConditions.length > 0 && (
                <Flex direction="row" align="center" gap="xs">
                  <Text size="sm" fw={500}>Condition:</Text>
                  <MultiSelect
                    data={availableConditions}
                    value={selectedConditions}
                    onChange={(values) => {
                      if (values.includes('ALL') && !selectedConditions.includes('ALL')) {
                        setSelectedConditions(['ALL']);
                      } else if (values.includes('ALL') && selectedConditions.includes('ALL')) {
                        setSelectedConditions(values.filter((v) => v !== 'ALL'));
                      } else if (values.length === 0) {
                        setSelectedConditions(['ALL']);
                      } else {
                        setSelectedConditions(values);
                      }
                    }}
                    w={180}
                    size="sm"
                    clearable={false}
                    maxValues={5}
                    styles={{
                      input: {
                        minHeight: '36px',
                      },
                    }}
                  />
                </Flex>
              )}

              <Flex direction="row" align="center" gap="xs">
                <Text size="sm" fw={500}>Participants:</Text>
                <Checkbox.Group
                  value={includedParticipants}
                  onChange={(e) => setIncludedParticipants(e)}
                >
                  <Group gap="xs">
                    <Checkbox
                      value="completed"
                      label={selectedParticipants.length > 0
                        ? `Completed (${selectedParticipantCounts.completed} of ${participantCounts.completed})`
                        : `Completed (${participantCounts.completed})`}
                      size="sm"
                    />
                    <Checkbox
                      value="inprogress"
                      label={selectedParticipants.length > 0
                        ? `In Progress (${selectedParticipantCounts.inprogress} of ${participantCounts.inprogress})`
                        : `In Progress (${participantCounts.inprogress})`}
                      size="sm"
                    />
                    <Checkbox
                      value="rejected"
                      label={selectedParticipants.length > 0
                        ? `Rejected (${selectedParticipantCounts.rejected} of ${participantCounts.rejected})`
                        : `Rejected (${participantCounts.rejected})`}
                      size="sm"
                    />
                  </Group>
                </Checkbox.Group>
              </Flex>
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
                <Tabs.Tab value="tagging" leftSection={<IconTags size={16} />}>Coding</Tabs.Tab>
                {storageEngine?.getEngine() === 'firebase' && (
                  <Tabs.Tab value="live-monitor" leftSection={<IconDashboard size={16} />}>Live Monitor</Tabs.Tab>
                )}
                <Tabs.Tab value="config" leftSection={<IconFileCode size={16} />}>Config</Tabs.Tab>
                <Tabs.Tab value="manage" leftSection={<IconSettings size={16} />} disabled={!user.isAdmin}>Manage</Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel style={{ overflow: 'auto' }} value="summary" pt="xs">
                {studyConfig && <SummaryView studyConfig={studyConfig} visibleParticipants={visibleParticipants} />}
              </Tabs.Panel>
              <Tabs.Panel style={{ height: `calc(100% - ${TABLE_HEADER_HEIGHT}px)` }} value="table" pt="xs">
                {studyConfig && <TableView width={width} stageColors={stageColors} visibleParticipants={visibleParticipants} studyConfig={studyConfig} refresh={() => execute(studyConfig, storageEngine, studyId)} selectedParticipants={selectedParticipants} onSelectionChange={setSelectedParticipants} />}
              </Tabs.Panel>
              <Tabs.Panel style={{ overflow: 'auto' }} value="stats" pt="xs">
                {studyConfig && <StatsView studyConfig={studyConfig} visibleParticipants={visibleParticipants} />}
              </Tabs.Panel>
              <Tabs.Panel value="tagging" pt="xs">
                {studyConfig && storageEngine?.getEngine() === 'firebase' ? <ThinkAloudAnalysis visibleParticipants={visibleParticipants} storageEngine={storageEngine as FirebaseStorageEngine} /> : <Center>Think aloud coding is only available when using Firebase.</Center>}
              </Tabs.Panel>
              {storageEngine?.getEngine() === 'firebase' && (
                <Tabs.Panel style={{ overflow: 'auto' }} value="live-monitor" pt="xs">
                  {studyConfig && <LiveMonitorView studyConfig={studyConfig} storageEngine={storageEngine} studyId={studyId} includedParticipants={includedParticipants} selectedStages={selectedStages} />}
                </Tabs.Panel>
              )}
              <Tabs.Panel style={{ overflow: 'auto' }} value="config" pt="xs">
                {studyConfig && <ConfigView visibleParticipants={visibleParticipants} />}
              </Tabs.Panel>
              <Tabs.Panel style={{ overflow: 'auto' }} value="manage" pt="xs">
                {studyId && user.isAdmin ? <ManageView studyId={studyId} refresh={() => execute(studyConfig, storageEngine, studyId)} /> : <Container mt={20}><Alert title="Unauthorized Access" variant="light" color="red" icon={<IconInfoCircle />}>You are not authorized to manage the data for this study.</Alert></Container>}
              </Tabs.Panel>
            </Tabs>
          ) : null}
        </Stack>
      </AppShell.Main>
    </>
  );
}
