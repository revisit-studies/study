import {
  Anchor, AppShell, Button, Card, Container, Divider, Flex, Image, rem, Tabs, Text,
} from '@mantine/core';
import {
  IconAlertTriangle, IconChartHistogram, IconExternalLink, IconListCheck,
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
import { REVISIT_MODE } from '../storage/engines/StorageEngine';
import { FirebaseStorageEngine } from '../storage/engines/FirebaseStorageEngine';
import { useAuth } from '../store/hooks/useAuth';

function StudyCard({ configName, config, url }: { configName: string; config: ParsedConfig<StudyConfig>; url: string }) {
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

  const [modes, setModes] = useState<Record<REVISIT_MODE, boolean> | null>(null);
  useEffect(() => {
    if (!storageEngine) return;

    storageEngine.getModes(configName).then((m) => {
      setModes(m);
    });
  }, [configName, storageEngine]);

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

  return (
    <Card key={configName} shadow="sm" radius="md" my="sm" withBorder>
      {config.errors.length > 0
        ? (
          <>
            <Text fw="bold">{configName}</Text>
            <Flex align="center" direction="row">
              <IconAlertTriangle color="red" />
              <Text fw="bold" ml={8} color="red">Errors</Text>
            </Flex>
            <ErrorLoadingConfig issues={config.errors} type="error" />
            {config.warnings.length > 0 && (
              <>
                <Flex align="center" direction="row">
                  <IconAlertTriangle color="orange" />
                  <Text fw="bold" ml={8} color="orange">Warnings</Text>
                </Flex>
                <ErrorLoadingConfig issues={config.warnings} type="warning" />
              </>
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
              <>
                <Flex align="center" direction="row">
                  <IconAlertTriangle color="orange" />
                  <Text fw="bold" ml={8} color="orange">Warnings</Text>
                </Flex>
                <ErrorLoadingConfig issues={config.warnings} type="warning" />
              </>
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

            <Flex direction="row" align="end" gap="sm" mt="md">
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
                href={`${PREFIX}${url}`}
              >
                Go to Study
              </Button>
            </Flex>
          </>
        )}
    </Card>
  );
}

function StudyCards({ configNames, studyConfigs }: { configNames: string[]; studyConfigs: Record<string, ParsedConfig<StudyConfig> | null> }) {
  return configNames.map((configName) => {
    const config = studyConfigs[configName];
    if (!config) {
      return null;
    }
    const url = sanitizeStringForUrl(configName);

    return <StudyCard key={configName} configName={configName} config={config} url={url} />;
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

  // Extract unique prefixes from study names and create dynamic categories
  const studyCategories = useMemo(() => {
    const categories: Record<string, string[]> = {};
    const otherStudies: string[] = [];

    configsList.forEach((configName) => {
      const dashIndex = configName.indexOf('-');
      if (dashIndex === -1) {
        // No dash found, put in "Other"
        otherStudies.push(configName);
      } else {
        // Extract prefix (everything before first dash)
        const prefix = configName.substring(0, dashIndex);
        if (!categories[prefix]) {
          categories[prefix] = [];
        }
        categories[prefix].push(configName);
      }
    });

    // Add "Other" category if there are studies without prefixes
    if (otherStudies.length > 0) {
      categories.other = otherStudies;
    }

    return categories;
  }, [configsList]);

  // Get visibility for all studies and filter by admin status and public accessibility
  const [categoryVisibility, setCategoryVisibility] = useState<Record<string, Record<string, boolean>>>({});
  useEffect(() => {
    async function getVisibilities() {
      const visibility: Record<string, Record<string, boolean>> = {};

      await Promise.all(
        Object.entries(studyCategories).map(async ([category, studies]) => {
          visibility[category] = {};
          await Promise.all(
            studies.map(async (configName) => {
              if (storageEngine instanceof FirebaseStorageEngine) {
                const modes = await storageEngine.getModes(configName);
                visibility[category][configName] = modes.analyticsInterfacePubliclyAccessible;
              } else {
                // For non-Firebase storage, show all studies
                visibility[category][configName] = true;
              }
            }),
          );
        }),
      );

      setCategoryVisibility(visibility);
    }
    getVisibilities();
  }, [studyCategories, storageEngine]);

  const { user } = useAuth();

  // Filter studies based on visibility and admin status for each category
  const filteredCategories = useMemo(() => {
    const filtered: Record<string, string[]> = {};

    Object.entries(studyCategories).forEach(([category, studies]) => {
      const categoryVisibilityMap = categoryVisibility[category] || {};
      filtered[category] = studies.filter((configName) => categoryVisibilityMap[configName] || user.isAdmin);
    });

    // Remove empty categories
    Object.keys(filtered).forEach((category) => {
      if (filtered[category].length === 0) {
        delete filtered[category];
      }
    });

    return filtered;
  }, [studyCategories, categoryVisibility, user]);

  // Helper function to convert category name to title case
  const toTitleCase = (str: string) => {
    if (str === 'other') return 'Other';
    return str.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  // Get available categories for tabs
  const availableCategories = Object.keys(filteredCategories);
  const defaultTab = availableCategories.length > 0 ? availableCategories[0] : 'other';

  const [searchParams] = useSearchParams();
  const tab = useMemo(() => searchParams.get('tab') || defaultTab, [searchParams, defaultTab]);
  const navigate = useNavigate();

  return (
    <AppShell.Main>
      <Container size="sm" px={0}>
        <Image
          maw={150}
          mx="auto"
          mb="xl"
          radius="none"
          src={`${PREFIX}revisitAssets/defake.svg`}
          alt="reVISit"
        />
        <Tabs variant="outline" value={tab} onChange={(value) => navigate(`/?tab=${value}`)}>
          <Tabs.List>
            {availableCategories.map((category) => (
              <Tabs.Tab key={category} value={category}>
                {toTitleCase(category)}
              </Tabs.Tab>
            ))}
          </Tabs.List>

          {availableCategories.map((category) => (
            <Tabs.Panel key={category} value={category}>
              {category === 'other' ? (
                <Text c="dimmed" mt="sm">Studies without a category prefix.</Text>
              ) : (
                <Text c="dimmed" mt="sm">
                  Studies in the
                  {' '}
                  {toTitleCase(category)}
                  {' '}
                  category.
                </Text>
              )}
              <StudyCards configNames={filteredCategories[category]} studyConfigs={studyConfigs} />
            </Tabs.Panel>
          ))}
        </Tabs>
      </Container>
    </AppShell.Main>
  );
}
