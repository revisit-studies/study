import {
  Anchor, AppShell, Badge, Box, Button, Card, Container, CopyButton, Flex, Grid, Image, Menu, Popover, SimpleGrid, Skeleton, Tabs, Text, Tooltip,
} from '@mantine/core';
import {
  IconAlertTriangle, IconBan, IconBrandFirebase, IconBrandSupabase, IconCamera, IconCheck, IconCopy, IconDatabase, IconDeviceDesktop, IconGraph, IconGraphOff, IconMicrophone, IconSchema, IconSchemaOff,
} from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useSearchParams } from 'react-router';
import {
  GlobalConfig, ParsedConfig, StudyConfig,
} from '../parser/types';
import { sanitizeStringForUrl } from '../utils/sanitizeStringForUrl';
import { PREFIX } from '../utils/Prefix';
import { ErrorLoadingConfig } from './ErrorLoadingConfig';
import { ReactMarkdownWrapper } from './ReactMarkdownWrapper';
import { ParticipantStatusBadges } from '../analysis/interface/ParticipantStatusBadges';
import { ParticipantStatusCounts } from '../storage/participantStatus';
import { useStorageEngine } from '../storage/storageEngineHooks';
import { StudyModes } from '../storage/engines/types';
import { getSequenceConditions } from '../utils/handleConditionLogic';
import { useStudyRecordings } from '../utils/useStudyRecordings';
import { useDeviceRules } from '../utils/useDeviceRules';
import { getUnmetDeviceRestrictionLines, getUnmetDeviceRestrictionTooltip } from './interface/DeviceRestrictionString';
import { getStaticAssetByPath } from '../utils/getStaticAsset';
import { AppHeader } from '../analysis/interface/AppHeader';

const DEFAULT_TAB_LABEL = 'Studies';

// Breakpoints are container queries, so the number of card columns follows the
// width of the study column rather than the window.
const STUDY_GRID_COLS = { base: 1, '600px': 2, '1000px': 3 };

/** Loads the optional landing-page introduction Markdown referenced by the global config. */
function useIntroduction(introductionPath: string | undefined) {
  const [introduction, setIntroduction] = useState<{ path: string; text: string | null } | null>(null);

  useEffect(() => {
    if (!introductionPath) return undefined;
    let isCancelled = false;
    const url = /^https?:\/\//.test(introductionPath) ? introductionPath : `${PREFIX}${introductionPath}`;
    getStaticAssetByPath(url).then((text) => {
      if (isCancelled) return;
      if (text === undefined) console.error(`Landing page introduction not found at ${introductionPath}`);
      setIntroduction({ path: introductionPath, text: text ?? null });
    }).catch((error) => {
      console.error('Failed to load landing page introduction:', error);
      if (!isCancelled) setIntroduction({ path: introductionPath, text: null });
    });
    return () => { isCancelled = true; };
  }, [introductionPath]);

  if (!introductionPath) return { enabled: false, loading: false, text: null };
  // Ignore results that belong to a previous path while the new one loads.
  const current = introduction?.path === introductionPath ? introduction : null;
  return { enabled: true, loading: current === null, text: current?.text ?? null };
}

function StudyCardSkeletons() {
  return (
    <SimpleGrid type="container" cols={STUDY_GRID_COLS} spacing="sm" verticalSpacing="sm">
      {[55, 45, 50].map((titleWidth) => (
        <Card key={titleWidth} shadow="sm" radius="md" padding="sm" withBorder>
          <Skeleton height={20} width={`${titleWidth}%`} mb="sm" />
          <Skeleton height={12} mb="xs" />
          <Skeleton height={12} mb="xs" />
          <Skeleton height={12} width="85%" mb="md" />
          <Flex justify="flex-end" gap="xs">
            <Skeleton height={28} width={80} radius="md" />
            <Skeleton height={28} width={100} radius="md" />
          </Flex>
        </Card>
      ))}
    </SimpleGrid>
  );
}

/** A clickable badge summarizing config issues that opens the full list in a popover. */
function CardIssueBadge({ issues, type }: { issues: ParsedConfig<StudyConfig>['warnings']; type: 'error' | 'warning' }) {
  const noun = type === 'error' ? 'error' : 'warning';
  const label = `${issues.length} ${noun}${issues.length === 1 ? '' : 's'}`;

  return (
    <Popover width={420} position="bottom-end" withArrow shadow="md" withinPortal>
      <Popover.Target>
        <Badge
          component="button"
          type="button"
          color={type === 'error' ? 'red' : 'yellow'}
          variant="filled"
          size="sm"
          aria-label={`Show ${label}`}
          leftSection={<IconAlertTriangle size={12} />}
          style={{ cursor: 'pointer', flexShrink: 0 }}
        >
          {label}
        </Badge>
      </Popover.Target>
      <Popover.Dropdown p="xs" mah={400} style={{ overflowY: 'auto' }}>
        <ErrorLoadingConfig issues={issues} type={type} collapsible={false} />
      </Popover.Dropdown>
    </Popover>
  );
}

function ValidStudyCard({
  configName,
  config,
  url,
  modes,
  canViewAnalytics,
}: {
  configName: string;
  config: ParsedConfig<StudyConfig>;
  url: string;
  modes: StudyModes | null;
  canViewAnalytics: boolean;
}) {
  const { storageEngine } = useStorageEngine();

  const [studyStatusAndTiming, setStudyStatusAndTiming] = useState<ParticipantStatusCounts & { minTime: Timestamp | number | null; maxTime: Timestamp | number | null } | null>(null);

  useEffect(() => {
    if (!storageEngine) return undefined;
    let isCancelled = false;
    storageEngine.getParticipantsStatusCounts(configName).then((status) => {
      if (!isCancelled) setStudyStatusAndTiming(status);
    }).catch((error) => {
      console.error('Failed to load participant counts:', error);
    });
    return () => { isCancelled = true; };
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
      if (studyStatusAndTiming && (
        studyStatusAndTiming.inProgress > 0
        || studyStatusAndTiming.completed > 0
        || studyStatusAndTiming.completedLate > 0
      )) {
        return 'Collecting Data';
      }
      return 'Ready to Collect Data';
    }
    return 'Data Collection Disabled';
  }, [modes, studyStatusAndTiming]);
  const { hasAudioRecording, hasScreenRecording, hasWebcamRecording } = useStudyRecordings(config);
  const {
    isBrowserAllowed,
    isDeviceAllowed,
    isInputAllowed,
    isDisplayAllowed,
  } = useDeviceRules(config.studyRules);
  const unmetRestrictions = useMemo(() => getUnmetDeviceRestrictionLines(config.studyRules, {
    isBrowserAllowed,
    isDeviceAllowed,
    isInputAllowed,
    isDisplayAllowed,
  }), [config.studyRules, isBrowserAllowed, isDeviceAllowed, isDisplayAllowed, isInputAllowed]);
  const restrictionsTooltip = useMemo(() => getUnmetDeviceRestrictionTooltip(config.studyRules, {
    isBrowserAllowed,
    isDeviceAllowed,
    isInputAllowed,
    isDisplayAllowed,
  }), [config.studyRules, isBrowserAllowed, isDeviceAllowed, isDisplayAllowed, isInputAllowed]);

  const conditions = useMemo(() => getSequenceConditions(config.sequence), [config.sequence]);
  const [conditionParticipantCounts, setConditionParticipantCounts] = useState<Record<string, number>>({});

  // Load participant counts into dropdown for each condition
  useEffect(() => {
    let isCancelled = false;
    async function loadConditionCounts() {
      if (!storageEngine || !canViewAnalytics) return;
      try {
        const conditionData = await storageEngine.getConditionData(configName);
        if (!isCancelled) setConditionParticipantCounts(conditionData.conditionCounts);
      } catch (error) {
        if (!isCancelled) setConditionParticipantCounts({});
        console.error('Failed to load condition counts:', error);
      }
    }

    loadConditionCounts();
    return () => { isCancelled = true; };
  }, [configName, storageEngine, canViewAnalytics]);

  const conditionOptions = useMemo(() => (
    ['default', ...conditions].map((condition) => ({
      value: condition,
      // e.g. default (10 participants)
      label: canViewAnalytics ? `${condition} (${conditionParticipantCounts[condition] || 0} participant${(conditionParticipantCounts[condition] || 0) === 1 ? '' : 's'})` : condition,
    }))
  ), [conditions, conditionParticipantCounts, canViewAnalytics]);

  // Reload to keep each study launch isolated from the previous storage session.
  const goToStudy = (condition?: string) => {
    window.location.assign(condition && condition !== 'default'
      ? `${PREFIX}${url}?condition=${encodeURIComponent(condition)}`
      : `${PREFIX}${url}`);
  };

  const showWarnings = canViewAnalytics && config.warnings.length > 0;
  const { thumbnail } = config.studyMetadata;
  const thumbnailSrc = thumbnail && (/^https?:\/\//.test(thumbnail) ? thumbnail : `${PREFIX}${thumbnail}`);

  return (
    <Card key={configName} shadow="sm" radius="md" padding="sm" h="100%" withBorder>
      {/* The gray header only exists for studies with a thumbnail, which is centered inside it. */}
      {thumbnailSrc && (
        <Card.Section h={140} pos="relative" style={{ backgroundColor: 'light-dark(var(--mantine-color-gray-2), var(--mantine-color-dark-7))' }}>
          <Image src={thumbnailSrc} alt={`Preview of ${config.studyMetadata.title}`} h="100%" w="100%" fit="contain" />
          {showWarnings && (
            <Box pos="absolute" top={8} right={8}>
              <CardIssueBadge issues={config.warnings} type="warning" />
            </Box>
          )}
        </Card.Section>
      )}
      <Flex justify="space-between" align="flex-start" gap="xs" mt={thumbnailSrc ? 'sm' : 0}>
        <Text fw="bold" lineClamp={2} title={config.studyMetadata.title}>
          {config.studyMetadata.title}
        </Text>
        <Flex gap={6} pt={4} align="center" style={{ flexShrink: 0 }}>
          {showWarnings && !thumbnailSrc && <CardIssueBadge issues={config.warnings} type="warning" />}
          <Flex gap={6} opacity={0.7}>
            {hasAudioRecording && (
            <Tooltip label="Audio recording enabled" withinPortal position="bottom">
              <IconMicrophone size={16} color="var(--mantine-color-orange-text)" />
            </Tooltip>
            )}
            {hasScreenRecording && (
            <Tooltip label="Screen recording enabled" withinPortal position="bottom">
              <IconDeviceDesktop size={16} color="var(--mantine-color-orange-text)" />
            </Tooltip>
            )}
            {hasWebcamRecording && (
            <Tooltip label="Webcam recording enabled" withinPortal position="bottom">
              <IconCamera size={16} color="orange" />
            </Tooltip>
            )}
            {modes?.developmentModeEnabled
              ? <Tooltip label="Development mode enabled" withinPortal position="bottom"><IconSchema size={16} color="var(--mantine-color-green-text)" /></Tooltip>
              : <Tooltip label="Development mode disabled" withinPortal position="bottom"><IconSchemaOff size={16} color="var(--mantine-color-red-text)" /></Tooltip>}
            {modes?.dataSharingEnabled
              ? <Tooltip label="Data sharing enabled" withinPortal position="bottom"><IconGraph size={16} color="var(--mantine-color-green-text)" /></Tooltip>
              : <Tooltip label="Data sharing disabled" withinPortal position="bottom"><IconGraphOff size={16} color="var(--mantine-color-red-text)" /></Tooltip>}
            {storageEngine?.getEngine() === 'localStorage'
              ? <Tooltip label="Local storage enabled" withinPortal position="bottom"><IconDatabase size={16} color="var(--mantine-color-green-text)" /></Tooltip>
              : storageEngine?.getEngine() === 'firebase'
                ? <Tooltip label="Firebase enabled" withinPortal position="bottom"><IconBrandFirebase size={16} color="var(--mantine-color-green-text)" /></Tooltip>
                : storageEngine?.getEngine() === 'supabase'
                  ? <Tooltip label="Supabase enabled" withinPortal position="bottom"><IconBrandSupabase size={16} color="var(--mantine-color-green-text)" /></Tooltip>
                  : <Tooltip label="Unknown storage engine enabled" withinPortal position="bottom"><IconDatabase size={16} color="var(--mantine-color-red-text)" /></Tooltip>}
            {unmetRestrictions.length > 0 && (
            <Tooltip label={restrictionsTooltip} multiline style={{ whiteSpace: 'pre-line' }} withinPortal position="bottom">
              <IconBan size={16} color="var(--mantine-color-red-text)" />
            </Tooltip>
            )}
          </Flex>
        </Flex>
      </Flex>
      {/* <Text c="dimmed" size="xs" lineClamp={1}>
        <Text span fw={500} size="xs">Authors: </Text>
        {config.studyMetadata.authors.join(', ')}
      </Text> */}
      <Text c="dimmed" size="sm" mt={4} mb={minTime && maxTime ? 0 : 'xs'} lineClamp={3} title={config.studyMetadata.description}>{config.studyMetadata.description}</Text>
      {minTime && maxTime && (
        <Text c="dimmed" size="xs" mt={2} mb="xs">
          <Text span fw={500} size="xs">Activity: </Text>
          {minTime === maxTime ? minTime : `${minTime} – ${maxTime}`}
        </Text>
      )}

      {/* Push the conditions and actions to the bottom so cards in a row align. */}
      <Box mt="auto" />

      <Flex gap={6} wrap="nowrap" mt="sm">
        {canViewAnalytics && (
          <Button
            size="xs"
            px={8}
            flex={1}
            variant="default"
            onClick={() => window.location.assign(`${PREFIX}analysis/stats/${url}`)}
          >
            Analyze & Manage
          </Button>
        )}
        {conditions.length > 0 ? (
          <Menu position="bottom" withinPortal shadow="md">
            <Menu.Target>
              <Button size="xs" px={8} flex={1}>
                Go to Study
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Choose a condition</Menu.Label>
              {conditionOptions.map(({ value, label }) => (
                <Menu.Item key={value} onClick={() => goToStudy(value)}>
                  {label}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
        ) : (
          <Button size="xs" px={8} flex={1} onClick={() => goToStudy()}>
            Go to Study
          </Button>
        )}
        <Button
          size="xs"
          px={8}
          flex={1}
          variant="default"
          component="a"
          target="_blank"
          href={`${import.meta.env.VITE_REPO_URL}${url}`}
        >
          View Source
        </Button>
      </Flex>

      {conditions.length > 0 && (
      <Flex direction="column" gap="xs" mt="sm">
        <Flex direction="row" align="center" gap={6} wrap="wrap">
          <Text size="xs" fw={500} c="dimmed">Condition links (click to copy):</Text>
          {conditions.map((condition) => {
            const conditionUrl = new URL(`${PREFIX}${url}`, window.location.origin);
            conditionUrl.searchParams.set('condition', condition);
            const conditionUrlString = conditionUrl.toString();

            return (
              <CopyButton key={condition} value={conditionUrlString}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? 'Copied!' : 'Copy URL'}>
                    <Badge
                      size="xs"
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
      </Flex>
      )}
      <Card.Section
        mt="sm"
        px="sm"
        py={6}
        // Neutral on purpose: status is conveyed by text so it doesn't compete with the colored icons.
        style={{
          borderTop: '1px solid var(--mantine-color-default-border)',
          backgroundColor: 'light-dark(var(--mantine-color-gray-1), var(--mantine-color-dark-5))',
        }}
      >
        <Flex gap="xs" wrap="wrap" align="center" justify="space-between">
          <Text size="xs" fw={600} c="dimmed">{currentMode}</Text>
          {canViewAnalytics && studyStatusAndTiming && (
          <ParticipantStatusBadges
            completed={studyStatusAndTiming.completed}
            inProgress={studyStatusAndTiming.inProgress}
            rejected={studyStatusAndTiming.rejected}
            timedOut={studyStatusAndTiming.timedOut}
            completedLate={studyStatusAndTiming.completedLate}
            // Turning auto-timeout off does not clear earlier timeouts, and those
            // participants are not counted in any other badge.
            showTimeoutStatuses={
              modes?.autoTimeoutMinutes !== undefined
              || studyStatusAndTiming.timedOut > 0
              || studyStatusAndTiming.completedLate > 0
            }
          />
          )}
        </Flex>
      </Card.Section>
    </Card>
  );
}

function StudyCard({
  configName,
  config,
  url,
  modes,
}: {
  configName: string;
  config: ParsedConfig<StudyConfig>;
  url: string;
  modes: StudyModes | null;
}) {
  const canViewAnalytics = !!modes?.dataSharingEnabled;

  if (config.errors.length > 0) {
    return (
      <Card key={configName} shadow="sm" radius="md" padding="sm" h="100%" withBorder>
        <Flex justify="space-between" align="flex-start" gap="xs">
          <Text size="md" fw="bold">{configName}</Text>
          {canViewAnalytics && (
            <Flex gap={6} wrap="wrap" justify="flex-end">
              <CardIssueBadge issues={config.errors} type="error" />
              {config.warnings.length > 0 && <CardIssueBadge issues={config.warnings} type="warning" />}
            </Flex>
          )}
        </Flex>
        <Text size="sm" mt="xs" c="red" fw={500}>
          This study can&apos;t be used right now.
        </Text>
        <Text size="sm" c="dimmed">
          Its config has errors that stop it from loading, so it can&apos;t be started or analyzed until they are fixed.
          {canViewAnalytics ? ' Select the error badge for details.' : ''}
        </Text>
      </Card>
    );
  }

  return <ValidStudyCard configName={configName} config={config} url={url} modes={modes} canViewAnalytics={canViewAnalytics} />;
}

function StudyCards({
  configNames,
  studyConfigs,
  modesByConfig,
}: {
  configNames: string[];
  studyConfigs: Record<string, ParsedConfig<StudyConfig> | null>;
  modesByConfig: Record<string, StudyModes | null>;
}) {
  return (
    <SimpleGrid type="container" cols={STUDY_GRID_COLS} spacing="sm" verticalSpacing="sm" mt="sm">
      {configNames.map((configName) => {
        const config = studyConfigs[configName];
        if (!config) {
          return null;
        }
        const url = sanitizeStringForUrl(configName);
        return <StudyCard key={configName} configName={configName} config={config} url={url} modes={modesByConfig[configName] ?? null} />;
      })}
    </SimpleGrid>
  );
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
  const [modesByConfig, setModesByConfig] = useState<Record<string, StudyModes | null>>({});
  const [modeLoadErrors, setModeLoadErrors] = useState<string[]>([]);
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
      const modesMap: Record<string, StudyModes | null> = {};
      const failedConfigNames: string[] = [];
      await Promise.all(
        configsList.map(async (configName) => {
          if (storageEngine) {
            try {
              const [modes, hidden] = await Promise.all([
                storageEngine.getAccessModes(configName),
                storageEngine.getStudyHiddenFromLandingPage(configName),
              ]);
              visibility[configName] = !hidden;
              modesMap[configName] = modes;
            } catch (error) {
              failedConfigNames.push(configName);
              console.error(`Error loading settings for study ${configName}:`, error);
            }
          } else {
            modesMap[configName] = null;
          }
        }),
      );
      if (!isCancelled) {
        setStudyVisibility(visibility);
        setModesByConfig(modesMap);
        setModeLoadErrors(failedConfigNames);
        setIsLoadingVisibility(false);
      }
    }
    getVisibilitiesAndModes();

    return () => {
      isCancelled = true;
    };
  }, [configsList, storageEngine]);

  const isLoadingStudyConfigs = useMemo(
    () => configsList.some((configName) => !(configName in studyConfigs)),
    [configsList, studyConfigs],
  );
  const isLoadingStudies = isLoadingVisibility || isLoadingStudyConfigs;
  const configsFiltered = useMemo(() => configsList.filter((configName) => studyVisibility[configName]), [configsList, studyVisibility]);

  const tabs = useMemo(() => {
    const configuredTabs = globalConfig.tabs ?? [];
    const tabDefinitions = configuredTabs.some(({ label }) => label === DEFAULT_TAB_LABEL)
      ? configuredTabs
      : [...configuredTabs, { label: DEFAULT_TAB_LABEL }];

    return tabDefinitions.map((definition) => ({
      ...definition,
      configNames: configsFiltered.filter((configName) => (
        (globalConfig.configs[configName].tab ?? DEFAULT_TAB_LABEL) === definition.label
      )),
    })).filter(({ configNames }) => configNames.length > 0).map((definition) => ({
      ...definition,
      // Mantine derives ARIA IDs from tab values, which must not contain whitespace.
      value: encodeURIComponent(definition.label),
    }));
  }, [configsFiltered, globalConfig.configs, globalConfig.tabs]);

  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const tab = tabs.find(({ label }) => label === requestedTab) ?? tabs[0];

  const introduction = useIntroduction(globalConfig.introductionPath);

  const studies = (
    <>
      {isLoadingStudies && (
        <>
          <Text c="dimmed" ta="center" mt="sm" mb="md">Loading studies...</Text>
          <StudyCardSkeletons />
        </>
      )}

      {!isLoadingStudies && (
        <>
          {modeLoadErrors.length > 0 && (
            <Text c="red" role="alert" mb="md">
              Unable to load study visibility for:
              {' '}
              {modeLoadErrors.join(', ')}
              . Check the storage connection and try again.
            </Text>
          )}
          {tabs.map(({
            label, value, description, configNames,
          }) => (
            <Tabs.Panel key={label} value={value}>
              {description && (
                <Box c="dimmed">
                  <ReactMarkdownWrapper text={description} />
                </Box>
              )}
              <StudyCards configNames={configNames} studyConfigs={studyConfigs} modesByConfig={modesByConfig} />
            </Tabs.Panel>
          ))}

          {configsFiltered.length === 0 && modeLoadErrors.length === 0 && (
            <Text c="dimmed" ta="center" mt="xl">
              No studies found. Studies can be added in your
              {' '}
              <Text span ff="monospace">global.json</Text>
              .
              <br />
              Please refer to the
              {' '}
              <Anchor href="https://revisit.dev/docs/getting-started/your-first-study/" target="_blank">
                getting started guide
              </Anchor>
              {' '}
              for more details.
            </Text>
          )}
        </>
      )}
    </>
  );

  // The tab list lives in the app header while its panels live in the page, so a
  // single Tabs root wraps both to share the selected tab.
  const header = (
    <AppHeader
      studyIds={configsList}
      studyConfigs={studyConfigs}
      navigation={!isLoadingStudies && tabs.length > 0 && (
        <Tabs.List style={{ flexWrap: 'nowrap' }}>
          {tabs.map(({ label, value }) => <Tabs.Tab key={label} value={value} style={{ whiteSpace: 'nowrap' }}>{label}</Tabs.Tab>)}
        </Tabs.List>
      )}
    />
  );

  const main = introduction.enabled ? (
    <AppShell.Main>
      <Container size="xl" px={0}>
        <Grid gap="xl">
          <Grid.Col span={{ base: 12, sm: 5, lg: 4 }}>
            <Box component="section" aria-label="Introduction" pos={{ sm: 'sticky' }} top={{ sm: 86 }}>
              {introduction.loading && (
                <>
                  <Skeleton height={28} width="60%" mb="md" />
                  <Skeleton height={14} mb="xs" />
                  <Skeleton height={14} mb="xs" />
                  <Skeleton height={14} width="80%" />
                </>
              )}
              {!introduction.loading && introduction.text !== null && (
                <ReactMarkdownWrapper text={introduction.text} />
              )}
              {!introduction.loading && introduction.text === null && (
                <Text c="dimmed" role="alert">
                  Unable to load the introduction from
                  {' '}
                  <Text span ff="monospace">{globalConfig.introductionPath}</Text>
                  .
                </Text>
              )}
            </Box>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 7, lg: 8 }}>
            {studies}
          </Grid.Col>
        </Grid>
      </Container>
    </AppShell.Main>
  ) : (
    <AppShell.Main>
      <Container size="lg" px={0}>
        {studies}
      </Container>
    </AppShell.Main>
  );

  return (
    <Tabs
      variant="pills"
      value={tab?.value ?? null}
      onChange={(value) => {
        if (value === null) return;
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('tab', decodeURIComponent(value));
        setSearchParams(nextParams);
      }}
    >
      {header}
      {main}
    </Tabs>
  );
}
