import {
  Anchor, AppShell, Badge, Box, Button, Card, Container, CopyButton, Flex, Grid, Image, Menu, Popover, SimpleGrid, Skeleton, TableOfContents, Text, Title, Tooltip,
} from '@mantine/core';
import {
  IconAlertTriangle, IconBan, IconBrandFirebase, IconBrandGithub, IconBrandSupabase, IconCamera, IconCheck, IconCopy, IconDatabase, IconDeviceDesktop, IconGraph, IconGraphOff, IconMicrophone, IconSchema, IconSchemaOff,
} from '@tabler/icons-react';
import {
  MouseEvent as ReactMouseEvent, useEffect, useMemo, useState,
} from 'react';
import { Timestamp } from 'firebase/firestore';
import { useLocation, useSearchParams } from 'react-router';
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
import {
  getConfigConditionKeys, isStageParticipantLimitEnabled, StageData, StudyModes,
} from '../storage/engines/types';
import { ParticipantLimitSummary, summarizeParticipantLimits } from '../utils/participantLimits';
import { getSequenceConditions } from '../utils/handleConditionLogic';
import { useStudyRecordings } from '../utils/useStudyRecordings';
import { useDeviceRules } from '../utils/useDeviceRules';
import { getUnmetDeviceRestrictionLines, getUnmetDeviceRestrictionTooltip } from './interface/DeviceRestrictionString';
import { getStaticAssetByPath } from '../utils/getStaticAsset';
import { AppHeader } from '../analysis/interface/AppHeader';
import classes from './ConfigSwitcher.module.css';

const DEFAULT_TAB_LABEL = 'Studies';
const STUDY_FULL_STATUS = 'Reached Participant Limit, Study Full';

/** Access modes as read for the landing page, including the study's stage data when it has any. */
type LandingStudyModes = StudyModes & { stage?: StageData };

// Breakpoints are container queries, so the number of card columns follows the
// width of the study column rather than the window.
const STUDY_GRID_COLS = { base: 1, '640px': 2, '1200px': 3 };

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
  modes: LandingStudyModes | null;
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

  // Participant limits belong to the current stage; only read assignments when one is enforced.
  // `currentStage` is a name-and-color snapshot, so resolve the full stage from `allStages` the way admission does.
  const stageData = modes?.stage;
  const currentStage = useMemo(() => (stageData
    ? stageData.allStages.find((stage) => stage.stageName === stageData.currentStage.stageName) ?? stageData.currentStage
    : undefined), [stageData]);
  const limitEnabled = !!currentStage && isStageParticipantLimitEnabled(currentStage);
  const [participantLimits, setParticipantLimits] = useState<ParticipantLimitSummary | null>(null);
  useEffect(() => {
    if (!storageEngine || !limitEnabled) {
      setParticipantLimits(null);
      return undefined;
    }
    let isCancelled = false;
    const conditionKeys = config.betweenSubjects?.length ? getConfigConditionKeys(config) : [];
    storageEngine.getAllSequenceAssignments(configName).then((assignments) => {
      if (!isCancelled) setParticipantLimits(summarizeParticipantLimits(currentStage, assignments, conditionKeys));
    }).catch((error) => {
      console.error('Failed to load participant limits:', error);
    });
    return () => { isCancelled = true; };
  }, [config, configName, currentStage, limitEnabled, storageEngine]);

  const currentMode = useMemo(() => {
    if (!modes) return 'Unknown';

    if (modes.dataCollectionEnabled) {
      if (participantLimits?.full) return STUDY_FULL_STATUS;
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
  }, [modes, participantLimits, studyStatusAndTiming]);
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
  const isFull = currentMode === STUDY_FULL_STATUS;
  // Card-level alerts shown in the top-right corner.
  const alertBadges = (isFull || showWarnings) && (
    <Flex gap={6} wrap="wrap" justify="flex-end">
      {isFull && (
        <Tooltip label="This study reached its participant limit, so no new participants can join." withinPortal multiline w={240}>
          <Badge color="orange" variant="filled" size="sm" leftSection={<IconAlertTriangle size={12} />}>
            Study full
          </Badge>
        </Tooltip>
      )}
      {showWarnings && <CardIssueBadge issues={config.warnings} type="warning" />}
    </Flex>
  );
  const { thumbnail } = config.studyMetadata;
  const thumbnailSrc = thumbnail && (/^https?:\/\//.test(thumbnail) ? thumbnail : `${PREFIX}${thumbnail}`);

  return (
    <Card key={configName} shadow="sm" radius="md" padding="sm" h="100%" withBorder>
      {/* The gray header only exists for studies with a thumbnail, which is centered inside it. */}
      {thumbnailSrc && (
        <Card.Section h={140} pos="relative" style={{ backgroundColor: 'light-dark(var(--mantine-color-gray-2), var(--mantine-color-dark-7))' }}>
          <Image src={thumbnailSrc} alt={`Preview of ${config.studyMetadata.title}`} h="100%" w="100%" fit="contain" />
          {alertBadges && (
            <Box pos="absolute" top={8} right={8}>
              {alertBadges}
            </Box>
          )}
        </Card.Section>
      )}
      <Flex justify="space-between" align="flex-start" gap="xs" mt={thumbnailSrc ? 'sm' : 0}>
        <Text fw="bold" lineClamp={2} title={config.studyMetadata.title}>
          {config.studyMetadata.title}
          <Tooltip label="View source on GitHub" withinPortal>
            <Anchor
              href={`${import.meta.env.VITE_REPO_URL}${url}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View source on GitHub"
              c="dimmed"
              ml={6}
              style={{ verticalAlign: 'middle', display: 'inline-flex' }}
            >
              <IconBrandGithub size={16} />
            </Anchor>
          </Tooltip>
        </Text>
        <Flex gap={6} pt={4} align="center" style={{ flexShrink: 0 }}>
          {!thumbnailSrc && alertBadges}
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
      <Text size="sm" component="div" mt={4} mb="xs">
        <ReactMarkdownWrapper text={config.studyMetadata.description} inline linkTarget="_blank" />
      </Text>

      {participantLimits && (
        <Box mb="xs">
          <Text size="xs" fw={500}>
            {`Participant limit: ${participantLimits.maxParticipants}`}
            {canViewAnalytics && (
              <Text span size="xs" c="dimmed">{` · ${participantLimits.enrolled} enrolled (${participantLimits.completed} completed)`}</Text>
            )}
          </Text>
          {participantLimits.conditions.map((condition) => (
            <Text key={condition.key} size="xs" c="dimmed">
              {`Condition ${condition.label}: `}
              {condition.enabled ? `limit ${condition.target}` : 'disabled'}
              {canViewAnalytics && condition.enabled ? ` · ${condition.enrolled} enrolled (${condition.completed} completed)` : ''}
            </Text>
          ))}
        </Box>
      )}

      {/* Push the conditions and actions to the bottom so cards in a row align. */}
      <Box mt="auto" />

      {conditions.length > 0 && (
      <Flex direction="column" gap={4} mt="sm">
        <Text size="xs" fw={500} c="dimmed">Condition links (click to copy):</Text>
        <Flex direction="row" align="center" gap={6} wrap="wrap">
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
      </Flex>
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
          {isFull ? (
            <Flex align="center" gap={4}>
              <IconAlertTriangle size={12} color="var(--mantine-color-orange-text)" />
              <Text size="xs" fw={600} c="orange">{currentMode}</Text>
            </Flex>
          ) : (
            <Text size="xs" fw={600} c="dimmed">{currentMode}</Text>
          )}
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
  modes: LandingStudyModes | null;
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
  modesByConfig: Record<string, LandingStudyModes | null>;
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

export const OTHER_GROUP_LABEL = 'Other';

type TabGroup = NonNullable<NonNullable<GlobalConfig['tabs']>[number]['groups']>[number];

/**
 * Splits a tab's studies into its configured groups (in group order, keeping configsList order within a group).
 * Ungrouped studies collect in a trailing "Other" group, and empty groups are dropped.
 */
export function groupConfigNames(groups: TabGroup[], configNames: string[], configs: GlobalConfig['configs']) {
  const known = new Set(groups.map(({ label }) => label));
  const sections = groups.map((group) => ({
    ...group,
    configNames: configNames.filter((configName) => configs[configName].group === group.label),
  }));
  const ungrouped = configNames.filter((configName) => !known.has(configs[configName].group ?? ''));
  return [...sections, { label: OTHER_GROUP_LABEL, configNames: ungrouped }]
    .filter((section) => section.configNames.length > 0);
}

const NAV_SCROLL_MARGIN = 86;
/** Readable, URL-safe anchor text, e.g. `Example Studies` -> `example-studies`. */
export function slugify(text: string) {
  return text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';
}
/** Anchor ids double as the URL hash, so navigating persists across refreshes and shared links. */
export const tabHeadingId = (label: string) => slugify(label);
const groupHeadingId = (tabLabel: string, label: string) => `${slugify(tabLabel)}--${slugify(label)}`;

/** One linear list of every tab and, indented beneath it, its groups. Tracks and scrolls to their headings. */
function LandingNav({ navKey }: { navKey: string }) {
  return (
    <Box component="nav" aria-label="Study navigation">
      <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb="xs">Contents</Text>
      <TableOfContents
        // Re-read the headings whenever the set of tabs or groups changes.
        key={navKey}
        variant="light"
        size="sm"
        radius="sm"
        // Indentation is applied per depth below, alongside the other hierarchy cues.
        depthOffset={0}
        scrollSpyOptions={{
          selector: '[data-landing-nav]',
          getDepth: (element) => Number(element.getAttribute('data-landing-nav')),
          offset: 100,
        }}
        getControlProps={({ data, active }) => {
          const isTab = data.depth === 1;
          // Mantine types controls as buttons; rendering them as links gives each entry a real, shareable anchor.
          const linkProps = { component: 'a', href: `#${data.id}` } as Record<string, string>;
          return {
            ...linkProps,
            onClick: (event: ReactMouseEvent) => {
              // Keep modified clicks (new tab/window) native; otherwise scroll smoothly and record the anchor.
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
              event.preventDefault();
              data.getNode().scrollIntoView({ behavior: 'smooth', block: 'start' });
              window.history.replaceState(window.history.state, '', `#${data.id}`);
            },
            children: data.value,
            'data-nav-depth': data.depth,
            style: isTab
              ? { fontWeight: 700, marginTop: 'var(--mantine-spacing-sm)' }
              : {
                // Groups hang off their tab: smaller, indented, and joined by a guide line.
                fontSize: 'var(--mantine-font-size-xs)',
                marginLeft: 'var(--mantine-spacing-sm)',
                borderRadius: 0,
                borderLeft: `2px solid ${active ? 'var(--mantine-primary-color-filled)' : 'var(--mantine-color-default-border)'}`,
                color: active ? undefined : 'var(--mantine-color-dimmed)',
              },
          };
        }}
      />
    </Box>
  );
}

function GroupSections({
  tabLabel,
  sections,
  studyConfigs,
  modesByConfig,
}: {
  tabLabel: string;
  sections: ReturnType<typeof groupConfigNames>;
  studyConfigs: Record<string, ParsedConfig<StudyConfig> | null>;
  modesByConfig: Record<string, LandingStudyModes | null>;
}) {
  return sections.map(({ label, description, configNames }, index) => (
    <Box component="section" key={label} aria-labelledby={groupHeadingId(tabLabel, label)} mt={index === 0 ? 'md' : 40}>
      <Title order={4} id={groupHeadingId(tabLabel, label)} data-landing-nav="2" style={{ scrollMarginTop: NAV_SCROLL_MARGIN }}>
        {label}
      </Title>
      {description && (
        <Box c="dimmed" mt={4}>
          <ReactMarkdownWrapper text={description} />
        </Box>
      )}
      <StudyCards configNames={configNames} studyConfigs={studyConfigs} modesByConfig={modesByConfig} />
    </Box>
  ));
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
  const [modesByConfig, setModesByConfig] = useState<Record<string, LandingStudyModes | null>>({});
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
      const modesMap: Record<string, LandingStudyModes | null> = {};
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
      sections: definition.groups?.length
        ? groupConfigNames(definition.groups, definition.configNames, globalConfig.configs)
        : null,
    }));
  }, [configsFiltered, globalConfig.configs, globalConfig.tabs]);

  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  // Restore the section in the URL hash once studies render; links that used to select a tab
  // (`?tab=`) scroll to that tab's section instead.
  const { hash } = useLocation();
  useEffect(() => {
    if (isLoadingStudies) return;
    const anchor = hash ? decodeURIComponent(hash.slice(1)) : requestedTab && tabHeadingId(requestedTab);
    if (anchor) document.getElementById(anchor)?.scrollIntoView({ block: 'start' });
  }, [hash, isLoadingStudies, requestedTab]);

  const navEntries = tabs.flatMap(({ label, sections }) => [label, ...(sections ?? []).map((section) => `${label}/${section.label}`)]);

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
          <Flex gap="lg" align="flex-start">
            <Box style={{ flex: 1, minWidth: 0 }}>
              {tabs.map(({
                label, description, sections, configNames,
              }, index) => (
                <Box component="section" key={label} aria-labelledby={tabHeadingId(label)} mt={index === 0 ? 0 : 72}>
                  <Title order={3} id={tabHeadingId(label)} data-landing-nav="1" style={{ scrollMarginTop: NAV_SCROLL_MARGIN }}>
                    {label}
                  </Title>
                  {description && (
                    <Box c="dimmed" mt={4}>
                      <ReactMarkdownWrapper text={description} />
                    </Box>
                  )}
                  {sections ? (
                    <GroupSections tabLabel={label} sections={sections} studyConfigs={studyConfigs} modesByConfig={modesByConfig} />
                  ) : (
                    <StudyCards configNames={configNames} studyConfigs={studyConfigs} modesByConfig={modesByConfig} />
                  )}
                </Box>
              ))}
            </Box>
            {navEntries.length > 1 && (
              <Box w={190} visibleFrom="md" pos="sticky" top={NAV_SCROLL_MARGIN} mah="calc(100vh - 102px)" style={{ flexShrink: 0, overflowY: 'auto' }}>
                <LandingNav navKey={navEntries.join('|')} />
              </Box>
            )}
          </Flex>

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

  const header = <AppHeader studyIds={configsList} studyConfigs={studyConfigs} />;

  const main = introduction.enabled ? (
    <AppShell.Main>
      <Container size={1680} px={0}>
        <Grid gap="xl">
          <Grid.Col span={{ base: 12, sm: 4, lg: 3 }}>
            <Box
              component="section"
              aria-label="Introduction"
              className={classes.introduction}
              pos={{ sm: 'sticky' }}
              top={{ sm: 86 }}
              // Scroll within the column when the introduction is long.
              mah={{ sm: 'calc(100vh - 102px)' }}
              style={{ overflowY: 'auto' }}
            >
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
          <Grid.Col span={{ base: 12, sm: 8, lg: 9 }}>
            {studies}
          </Grid.Col>
        </Grid>
      </Container>
    </AppShell.Main>
  ) : (
    <AppShell.Main>
      {/* With neither an introduction nor navigation beside it, a narrower column keeps the cards centered. */}
      <Container size={navEntries.length > 1 ? 1440 : 960} px={0}>
        {studies}
      </Container>
    </AppShell.Main>
  );

  return (
    <>
      {header}
      {main}
    </>
  );
}
