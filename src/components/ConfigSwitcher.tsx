import {
  Anchor, AppShell, Badge, Button, Card, Container, CopyButton, Divider, Flex, Image, MultiSelect, Skeleton, rem, Tabs, Text, Tooltip,
} from '@mantine/core';
import {
  IconBrandFirebase, IconBrandSupabase, IconChartHistogram, IconCheck, IconCopy, IconDatabase, IconExternalLink, IconGraph, IconGraphOff, IconListCheck, IconSchema, IconSchemaOff,
} from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useNavigate, useSearchParams } from 'react-router';
import {
  GlobalConfig, ParsedConfig, StudyConfig,
} from '../parser/types';
import { sanitizeStringForUrl } from '../utils/sanitizeStringForUrl';
import { PREFIX } from '../utils/Prefix';
import { ErrorLoadingConfig } from './ErrorLoadingConfig';
import { ParticipantStatusBadges } from '../analysis/interface/ParticipantStatusBadges';
import { useStorageEngine } from '../storage/storageEngineHooks';
import { REVISIT_MODE } from '../storage/engines/types';
import { useAuth } from '../store/hooks/useAuth';
import { isCloudStorageEngine } from '../storage/engines/utils';
import { getSequenceConditions } from '../utils/handleConditionLogic';

function StudyCard({
  configName,
  config,
  url,
  modes,
}: {
  configName: string;
  config: ParsedConfig<StudyConfig>;
  url: string;
  modes: Record<REVISIT_MODE, boolean> | null;
}) {
  const { storageEngine } = useStorageEngine();

  const [studyStatusAndTiming, setStudyStatusAndTiming] = useState<{ completed: number; rejected: number; inProgress: number; minTime: Timestamp | number | null; maxTime: Timestamp | number | null } | null>(null);

  useEffect(() => {
    if (!storageEngine) return;
    storageEngine.getParticipantsStatusCounts(configName).then((status) => {
      setStudyStatusAndTiming(status);
    });
  }, [configName, storageEngine]);

  const { minTime, maxTime } = useMemo(() => {
    if (!studyStatusAndTiming) return { minTime: null, maxTime: null };
    if (!studyStatusAndTiming.minTime || !studyStatusAndTiming.maxTime) return { minTime: null, maxTime: null };

    const min = typeof studyStatusAndTiming.minTime === 'number' ? new Date(studyStatusAndTiming.minTime) : studyStatusAndTiming.minTime.toDate();
    const max = typeof studyStatusAndTiming.maxTime === 'number' ? new Date(studyStatusAndTiming.maxTime) : studyStatusAndTiming.maxTime.toDate();

    return {
      minTime: min.toLocaleDateString('en-US', {
        weekday: 'short', year: 'numeric', month: 'long', day: 'numeric',
      }),
      maxTime: max.toLocaleDateString('en-US', {
        weekday: 'short', year: 'numeric', month: 'long', day: 'numeric',
      }),
    };
  }, [studyStatusAndTiming]);

  const currentMode = useMemo(() => {
    if (!modes) return 'Unknown';

    if (modes.dataCollectionEnabled) {
      if (studyStatusAndTiming && (studyStatusAndTiming.inProgress > 0 || studyStatusAndTiming.completed > 0)) {
        return 'Collecting Data';
      }
      return 'Ready to Collect Data';
    }
    return 'Data Collection Disabled';
  }, [modes, studyStatusAndTiming]);

  const conditions = useMemo(() => getSequenceConditions(config.sequence), [config.sequence]);
  const [selectedConditions, setSelectedConditions] = useState<string[]>(['default']);
  const [conditionParticipantCounts, setConditionParticipantCounts] = useState<Record<string, number>>({});

  // Load participant counts into dropdown for each condition
  useEffect(() => {
    async function loadConditionCounts() {
      if (!storageEngine) return;
      try {
        const conditionData = await storageEngine.getConditionData(configName);
        setConditionParticipantCounts(conditionData.conditionCounts);
      } catch (error) {
        setConditionParticipantCounts({});
        console.error('Failed to load condition counts:', error);
      }
    }

    loadConditionCounts();
  }, [configName, storageEngine]);

  const conditionOptions = useMemo(() => (
    ['default', ...conditions].map((condition) => ({
      value: condition,
      // e.g. default (10 participants)
      label: `${condition} (${conditionParticipantCounts[condition] || 0} participant${(conditionParticipantCounts[condition] || 0) === 1 ? '' : 's'})`,
    }))
  ), [conditions, conditionParticipantCounts]);

  const selectedStudyConditions = useMemo(
    () => selectedConditions.filter((condition) => condition !== 'default'),
    [selectedConditions],
  );

  const studyUrl = useMemo(
    () => (selectedStudyConditions.length > 0
      ? `${PREFIX}${url}?condition=${selectedStudyConditions.join(',')}`
      : `${PREFIX}${url}`),
    [selectedStudyConditions, url],
  );

  return (
    <Card key={configName} shadow="sm" radius="md" my="sm" withBorder>
      {config.errors.length > 0
        ? (
          <>
            <Text size="md" fw="bold">{configName}</Text>
            <ErrorLoadingConfig issues={config.errors} type="error" />
            {config.warnings.length > 0 && (
              <ErrorLoadingConfig issues={config.warnings} type="warning" />
            )}
          </>
        )
        : (
          <>
            <Flex direction="row" justify="space-between">
              <Text fw="bold">
                {config.studyMetadata.title}
              </Text>
            </Flex>
            <Text c="dimmed">
              <Text span fw={500}>Authors: </Text>
              {config.studyMetadata.authors.join(', ')}
            </Text>
            <Text c="dimmed">{config.studyMetadata.description}</Text>
            <Text c="dimmed" ta="right" style={{ paddingRight: 5 }}>
              <Anchor
                target="_blank"
                onClick={(e) => e.stopPropagation()}
                href={`${import.meta.env.VITE_REPO_URL}${url}`}
              >
                View source:
                {' '}
                {url}
                <IconExternalLink style={{
                  width: rem(18), height: rem(18), marginLeft: rem(2), marginBottom: rem(-3),
                }}
                />
              </Anchor>
            </Text>

            {config.warnings.length > 0 && (
              <ErrorLoadingConfig issues={config.warnings} type="warning" />
            )}

            <Divider my="md" />

            <Flex direction="row" gap="sm">
              <Text fw="bold" size="sm" opacity={0.7}>
                Study Status:
                {' '}
                {currentMode}
              </Text>
              {studyStatusAndTiming
                && <ParticipantStatusBadges completed={studyStatusAndTiming.completed} inProgress={studyStatusAndTiming.inProgress} rejected={studyStatusAndTiming.rejected} />}
              <Flex ml="auto" gap="sm" opacity={0.7}>
                {modes?.developmentModeEnabled
                  ? <Tooltip label="Development mode enabled" withinPortal><IconSchema size={16} color="green" /></Tooltip>
                  : <Tooltip label="Development mode disabled" withinPortal><IconSchemaOff size={16} color="red" /></Tooltip>}
                {modes?.dataSharingEnabled
                  ? <Tooltip label="Data sharing enabled" withinPortal><IconGraph size={16} color="green" /></Tooltip>
                  : <Tooltip label="Data sharing disabled" withinPortal><IconGraphOff size={16} color="red" /></Tooltip>}
                {storageEngine?.getEngine() === 'localStorage'
                  ? <Tooltip label="Local storage enabled" withinPortal position="bottom"><IconDatabase size={16} color="green" /></Tooltip>
                  : storageEngine?.getEngine() === 'firebase'
                    ? <Tooltip label="Firebase enabled" withinPortal position="bottom"><IconBrandFirebase size={16} color="green" /></Tooltip>
                    : storageEngine?.getEngine() === 'supabase'
                      ? <Tooltip label="Supabase enabled" withinPortal position="bottom"><IconBrandSupabase size={16} color="green" /></Tooltip>
                      : <Tooltip label="Unknown storage engine enabled" withinPortal position="bottom"><IconDatabase size={16} color="red" /></Tooltip>}
              </Flex>
            </Flex>

            {minTime && maxTime
              && (
                <Text c="dimmed" mt={4}>
                  Activity:
                  {' '}
                  {minTime}
                  {' '}
                  –
                  {' '}
                  {maxTime}
                </Text>
              )}

            {conditions.length > 0 && (
              <Flex direction="row" align="center" gap="xs" mt="sm" wrap="wrap">
                {conditions.map((condition) => {
                  const conditionUrl = new URL(`${PREFIX}${url}`, window.location.origin);
                  conditionUrl.searchParams.set('condition', condition);
                  const conditionUrlString = conditionUrl.toString();

                  return (
                    <CopyButton key={condition} value={conditionUrlString}>
                      {({ copied, copy }) => (
                        <Tooltip label={copied ? 'Copied!' : 'Copy URL'}>
                          <Badge
                            size="sm"
                            variant="light"
                            rightSection={
                              copied ? <IconCheck size={12} /> : <IconCopy size={12} />
                            }
                            onClick={copy}
                            style={{ cursor: 'pointer' }}
                          >
                            {condition}
                          </Badge>
                        </Tooltip>
                      )}
                    </CopyButton>
                  );
                })}
              </Flex>
            )}

            <Flex direction="row" align="end" gap="sm" mt="md" wrap="wrap">
              {conditions.length > 0 && (
                <MultiSelect
                  value={selectedConditions}
                  data={conditionOptions}
                  w={260}
                  onChange={(value) => {
                    if (value.length === 0) {
                      setSelectedConditions(['default']);
                      return;
                    }

                    if (value.includes('default') && value.length > 1) {
                      setSelectedConditions(value.filter((condition) => condition !== 'default'));
                      return;
                    }

                    setSelectedConditions(value);
                  }}
                />
              )}
              <Button
                leftSection={<IconChartHistogram />}
                style={{ marginLeft: 'auto' }}
                variant="default"
                component="a"
                href={`${PREFIX}analysis/stats/${url}`}
              >
                Analyze & Manage Study
              </Button>
              <Button
                leftSection={<IconListCheck />}
                component="a"
                href={studyUrl}
              >
                Go to Study
              </Button>
            </Flex>
          </>
        )}
    </Card>
  );
}

function StudyCards({
  configNames,
  studyConfigs,
  modesByConfig,
}: {
  configNames: string[];
  studyConfigs: Record<string, ParsedConfig<StudyConfig> | null>;
  modesByConfig: Record<string, Record<REVISIT_MODE, boolean> | null>;
}) {
  return configNames.map((configName) => {
    const config = studyConfigs[configName];
    if (!config) {
      return null;
    }
    const url = sanitizeStringForUrl(configName);
    return <StudyCard key={configName} configName={configName} config={config} url={url} modes={modesByConfig[configName] ?? null} />;
  });
}

export function ConfigSwitcher({
  globalConfig,
  studyConfigs,
}: {
  globalConfig: GlobalConfig;
  studyConfigs: Record<string, ParsedConfig<StudyConfig> | null>;
}) {
  const { storageEngine } = useStorageEngine();
  const { configsList } = globalConfig;

  const [studyVisibility, setStudyVisibility] = useState<Record<string, boolean>>({});
  const [modesByConfig, setModesByConfig] = useState<Record<string, Record<REVISIT_MODE, boolean> | null>>({});
  const [isLoadingVisibility, setIsLoadingVisibility] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    async function getVisibilitiesAndModes() {
      if (storageEngine === undefined) {
        setIsLoadingVisibility(true);
        return;
      }

      setIsLoadingVisibility(true);
      const visibility: Record<string, boolean> = {};
      const modesMap: Record<string, Record<REVISIT_MODE, boolean> | null> = {};
      await Promise.all(
        configsList.map(async (configName) => {
          if (storageEngine) {
            const modes = await storageEngine.getModes(configName);
            if (isCloudStorageEngine(storageEngine)) {
              visibility[configName] = modes.dataSharingEnabled;
            }
            modesMap[configName] = modes;
          } else {
            modesMap[configName] = null;
          }
        }),
      );
      if (!isCancelled) {
        setStudyVisibility(visibility);
        setModesByConfig(modesMap);
        setIsLoadingVisibility(false);
      }
    }
    getVisibilitiesAndModes();

    return () => {
      isCancelled = true;
    };
  }, [configsList, storageEngine]);

  const { user } = useAuth();
  const isLoadingStudyConfigs = useMemo(
    () => configsList.some((configName) => !(configName in studyConfigs)),
    [configsList, studyConfigs],
  );
  const isLoadingStudies = isLoadingVisibility || isLoadingStudyConfigs;
  const configsFiltered = useMemo(() => configsList.filter((configName) => studyVisibility[configName] || user.isAdmin), [configsList, studyVisibility, user]);

  const demos = useMemo(() => configsFiltered.filter((configName) => configName.startsWith('demo-')), [configsFiltered]);
  const tutorials = useMemo(() => configsFiltered.filter((configName) => configName.startsWith('tutorial')), [configsFiltered]);
  const examples = useMemo(() => configsFiltered.filter((configName) => configName.startsWith('example-')), [configsFiltered]);
  const tests = useMemo(() => configsFiltered.filter((configName) => configName.startsWith('test-')), [configsFiltered]);
  const libraries = useMemo(() => configsFiltered.filter((configName) => configName.startsWith('library-')), [configsFiltered]);
  const others = useMemo(() => configsFiltered.filter((configName) => !configName.startsWith('demo-') && !configName.startsWith('tutorial') && !configName.startsWith('example-') && !configName.startsWith('test-') && !configName.startsWith('library-')), [configsFiltered]);

  const [searchParams] = useSearchParams();
  const firstTab = useMemo(() => {
    if (others.length > 0) return 'Others';
    if (demos.length > 0) return 'Demos';
    if (examples.length > 0) return 'Examples';
    if (tutorials.length > 0) return 'Tutorials';
    if (tests.length > 0) return 'Tests';
    if (libraries.length > 0) return 'Libraries';
    return 'Demos';
  }, [others, demos, examples, tutorials, tests, libraries]);
  const tab = useMemo(() => searchParams.get('tab') || firstTab, [firstTab, searchParams]);
  const navigate = useNavigate();

  return (
    <AppShell.Main>
      <Container size="sm" px={0}>
        <Image
          maw={150}
          mx="auto"
          mb="xl"
          radius="md"
          src={`${PREFIX}revisitAssets/revisitLogoSquare.svg`}
          alt="reVISit"
        />
        {isLoadingStudies && (
          <>
            <Tabs variant="outline" value={null} mb="md">
              <Tabs.List>
                <Tabs.Tab value="demos" disabled>Demo Studies</Tabs.Tab>
                <Tabs.Tab value="examples" disabled>Example Studies</Tabs.Tab>
                <Tabs.Tab value="tutorials" disabled>Tutorials</Tabs.Tab>
                <Tabs.Tab value="tests" disabled>Tests</Tabs.Tab>
                <Tabs.Tab value="libraries" disabled>Libraries</Tabs.Tab>
              </Tabs.List>
            </Tabs>
            <Text c="dimmed" ta="center" mt="sm" mb="md">Loading studies...</Text>
            <Card shadow="sm" radius="md" my="sm" withBorder p="lg">
              <Skeleton height={28} width="55%" mb="md" />
              <Skeleton height={16} mb="sm" />
              <Skeleton height={16} mb="sm" />
              <Skeleton height={16} width="90%" mb="xl" />
              <Flex justify="space-between" align="center">
                <Skeleton height={36} width={190} radius="md" />
                <Skeleton height={36} width={140} radius="md" />
              </Flex>
            </Card>
            <Card shadow="sm" radius="md" my="sm" withBorder p="lg">
              <Skeleton height={28} width="45%" mb="md" />
              <Skeleton height={16} mb="sm" />
              <Skeleton height={16} mb="sm" />
              <Skeleton height={16} width="85%" mb="xl" />
              <Flex justify="space-between" align="center">
                <Skeleton height={36} width={190} radius="md" />
                <Skeleton height={36} width={140} radius="md" />
              </Flex>
            </Card>
            <Card shadow="sm" radius="md" my="sm" withBorder p="lg">
              <Skeleton height={28} width="50%" mb="md" />
              <Skeleton height={16} mb="sm" />
              <Skeleton height={16} mb="sm" />
              <Skeleton height={16} width="88%" mb="xl" />
              <Flex justify="space-between" align="center">
                <Skeleton height={36} width={190} radius="md" />
                <Skeleton height={36} width={140} radius="md" />
              </Flex>
            </Card>
          </>
        )}

        {!isLoadingStudies && (
          <>
            <Tabs variant="outline" defaultValue={firstTab} value={tab} onChange={(value) => navigate(`/?tab=${value}`)}>
              <Tabs.List>
                {others.length > 0 && (
                  <Tabs.Tab value="Others">Your Studies</Tabs.Tab>
                )}
                {demos.length > 0 && (
                  <Tabs.Tab value="Demos">Demo Studies</Tabs.Tab>
                )}
                {examples.length > 0 && (
                  <Tabs.Tab value="Examples">Example Studies</Tabs.Tab>
                )}
                {tutorials.length > 0 && (
                  <Tabs.Tab value="Tutorials">Tutorials</Tabs.Tab>
                )}
                {tests.length > 0 && (
                  <Tabs.Tab value="Tests">Tests</Tabs.Tab>
                )}
                {libraries.length > 0 && (
                  <Tabs.Tab value="Libraries">Libraries</Tabs.Tab>
                )}
              </Tabs.List>

              {others.length > 0 && (
                <Tabs.Panel value="Others">
                  <StudyCards configNames={others} studyConfigs={studyConfigs} modesByConfig={modesByConfig} />
                </Tabs.Panel>
              )}

              {demos.length > 0 && (
                <Tabs.Panel value="Demos">
                  <Text c="dimmed" mt="sm">These studies show off individual features of the reVISit platform.</Text>
                  <StudyCards configNames={demos} studyConfigs={studyConfigs} modesByConfig={modesByConfig} />
                </Tabs.Panel>
              )}

              {examples.length > 0 && (
                <Tabs.Panel value="Examples">
                  <Text c="dimmed" mt="sm">These are full studies that demonstrate the capabilities of the reVISit platform.</Text>
                  <StudyCards configNames={examples} studyConfigs={studyConfigs} modesByConfig={modesByConfig} />
                </Tabs.Panel>
              )}

              {tutorials.length > 0 && (
                <Tabs.Panel value="Tutorials">
                  <Text c="dimmed" mt="sm">These studies are designed to help you learn how to use the reVISit platform.</Text>
                  <StudyCards configNames={tutorials} studyConfigs={studyConfigs} modesByConfig={modesByConfig} />
                </Tabs.Panel>
              )}

              {tests.length > 0 && (
                <Tabs.Panel value="Tests">
                  <Text c="dimmed" mt="sm">These studies exist for testing purposes.</Text>
                  <StudyCards configNames={tests} studyConfigs={studyConfigs} modesByConfig={modesByConfig} />
                </Tabs.Panel>
              )}

              {libraries.length > 0 && (
                <Tabs.Panel value="Libraries">
                  <Text c="dimmed" mt="sm">Here you can see an example of every library that we publish.</Text>
                  <StudyCards configNames={libraries} studyConfigs={studyConfigs} modesByConfig={modesByConfig} />
                </Tabs.Panel>
              )}
            </Tabs>

            {configsFiltered.length === 0 && (
              <Text c="dimmed" ta="center" mt="xl">
                No studies found. Studies can be added in your
                {' '}
                <Text span ff="monospace">global.json</Text>
                .
              </Text>
            )}
          </>
        )}
      </Container>
    </AppShell.Main>
  );
}
