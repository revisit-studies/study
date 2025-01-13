import {
  Anchor, AppShell, Button, Card, Container, Divider, Flex, Image, rem, Tabs, Text,
} from '@mantine/core';
import {
  IconAlertTriangle, IconChartHistogram, IconExternalLink, IconListCheck,
} from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import {
  GlobalConfig, ParsedConfig, StudyConfig,
} from '../parser/types';
import { sanitizeStringForUrl } from '../utils/sanitizeStringForUrl';
import { PREFIX } from '../utils/Prefix';
import { ErrorLoadingConfig } from './ErrorLoadingConfig';
import { ParticipantStatusBadges } from '../analysis/interface/ParticipantStatusBadges';
import { useStorageEngine } from '../storage/storageEngineHooks';
import { REVISIT_MODE } from '../storage/engines/StorageEngine';

const REVISIT_GITHUB_PUBLIC = 'https://github.com/revisit-studies/study/tree/main/public/';

function StudyCard({ configName, config, url }: { configName: string; config: ParsedConfig<StudyConfig>; url: string }) {
  const { storageEngine } = useStorageEngine();

  const [studyStatusAndTiming, setStudyStatusAndTiming] = useState<{completed: number; rejected: number; inProgress: number; minTime: Timestamp | number | null; maxTime: Timestamp | number | null} | null>(null);
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

    return null;
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
                href={`${REVISIT_GITHUB_PUBLIC}${url}`}
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

function StudyCards({ configNames, studyConfigs } : { configNames: string[]; studyConfigs: Record<string, ParsedConfig<StudyConfig> | null> }) {
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
  const { configsList } = globalConfig;

  const demos = configsList.filter((configName) => configName.startsWith('demo-'));
  const tutorials = configsList.filter((configName) => configName.startsWith('tutorial-'));
  const examples = configsList.filter((configName) => configName.startsWith('example-'));
  const tests = configsList.filter((configName) => configName.startsWith('test-'));
  const libraries = configsList.filter((configName) => configName.startsWith('library-'));
  const others = configsList.filter((configName) => !configName.startsWith('demo-') && !configName.startsWith('tutorial-') && !configName.startsWith('example-') && !configName.startsWith('test-') && !configName.startsWith('library-'));

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
        <Tabs variant="outline" defaultValue={others.length > 0 ? 'Others' : 'Demos'}>
          <Tabs.List>
            {others.length > 0 && (
              <Tabs.Tab value="Others">Your Studies</Tabs.Tab>
            )}
            <Tabs.Tab value="Demos">Demo Studies</Tabs.Tab>
            <Tabs.Tab value="Examples">Example Studies</Tabs.Tab>
            <Tabs.Tab value="Tutorials">Tutorials</Tabs.Tab>
            <Tabs.Tab value="Tests">Tests</Tabs.Tab>
            <Tabs.Tab value="Libraries">Libraries</Tabs.Tab>
          </Tabs.List>

          {others.length > 0 && (
            <Tabs.Panel value="Others">
              <StudyCards configNames={others} studyConfigs={studyConfigs} />
            </Tabs.Panel>
          )}

          <Tabs.Panel value="Demos">
            <Text c="dimmed" mt="sm">These studies show off individual features of the reVISit platform.</Text>
            <StudyCards configNames={demos} studyConfigs={studyConfigs} />
          </Tabs.Panel>

          <Tabs.Panel value="Examples">
            <Text c="dimmed" mt="sm">These are full studies that demonstrate the capabilities of the reVISit platform.</Text>
            <StudyCards configNames={examples} studyConfigs={studyConfigs} />
          </Tabs.Panel>

          <Tabs.Panel value="Tutorials">
            <Text c="dimmed" mt="sm">These studies are designed to help you learn how to use the reVISit platform.</Text>
            <StudyCards configNames={tutorials} studyConfigs={studyConfigs} />
          </Tabs.Panel>

          <Tabs.Panel value="Tests">
            <Text c="dimmed" mt="sm">These studies exist for testing purposes.</Text>
            <StudyCards configNames={tests} studyConfigs={studyConfigs} />
          </Tabs.Panel>

          <Tabs.Panel value="Libraries">
            <Text c="dimmed" mt="sm">Here you can see an example of every library that we publish</Text>
            <StudyCards configNames={libraries} studyConfigs={studyConfigs} />
          </Tabs.Panel>
        </Tabs>
      </Container>
    </AppShell.Main>
  );
}
