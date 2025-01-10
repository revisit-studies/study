import {
  ActionIcon, Anchor, AppShell, Card, Container, Flex, Image, Tabs, Text, UnstyledButton,
} from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { IconAlertTriangle, IconExternalLink } from '@tabler/icons-react';
import { GlobalConfig, ParsedConfig, StudyConfig } from '../parser/types';
import { sanitizeStringForUrl } from '../utils/sanitizeStringForUrl';
import { PREFIX } from '../utils/Prefix';
import { ErrorLoadingConfig } from './ErrorLoadingConfig';

const REVISIT_GITHUB_PUBLIC = 'https://github.com/revisit-studies/study/tree/main/public/';

function StudyCards({ configNames, studyConfigs } : { configNames: string[]; studyConfigs: Record<string, ParsedConfig<StudyConfig> | null> }) {
  const navigate = useNavigate();

  return configNames.map((configName) => {
    const config = studyConfigs[configName];
    if (!config) {
      return null;
    }
    const url = sanitizeStringForUrl(configName);

    return (
      <UnstyledButton
        key={configName}
        onClick={(event) => {
          event.preventDefault();
          navigate(`/${url}`);
        }}
        my="sm"
        style={{ width: '100%' }}
      >
        <Card shadow="sm" radius="md" withBorder>
          {config.errors.length > 0
            ? (
              <>
                <Text fw="bold">{configName}</Text>
                <Flex align="center" direction="row">
                  <IconAlertTriangle color="red" />
                  <Text fw="bold" ml={8} color="red">Errors</Text>
                </Flex>
                <ErrorLoadingConfig issues={config.errors} type="error" />
              </>
            )
            : (
              <>
                <Flex direction="row" justify="space-between">
                  <Text fw="bold">
                    {config.studyMetadata.title}
                  </Text>
                  <ActionIcon
                    onClick={(event) => {
                      event.stopPropagation();
                    }}
                    variant="transparent"
                    size={20}
                    style={{ float: 'right' }}
                    component="a"
                    href={`${PREFIX}${url}`}
                  >
                    <IconExternalLink style={{ paddingTop: 4 }} />
                  </ActionIcon>
                </Flex>
                <Text c="dimmed">
                  <Text span fw={500}>Authors: </Text>
                  {config.studyMetadata.authors}
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
                  </Anchor>
                </Text>
              </>
            )}

          {config.warnings.length > 0 && (
          <>
            <Flex align="center" direction="row">
              <IconAlertTriangle color="orange" />
              <Text fw="bold" ml={8} color="orange">Warnings</Text>
            </Flex>
            <ErrorLoadingConfig issues={config.warnings} type="warning" />
          </>
          )}
        </Card>
      </UnstyledButton>
    );
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
  const others = configsList.filter((configName) => !configName.startsWith('demo-') && !configName.startsWith('tutorial-') && !configName.startsWith('example-') && !configName.startsWith('test-'));

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
        <Text mb="sm">Select an experiment to launch:</Text>

        <Tabs variant="outline" defaultValue={others.length > 0 ? 'Others' : 'Demos'}>
          <Tabs.List>
            {others.length > 0 && (
              <Tabs.Tab value="Others">Your Studies</Tabs.Tab>
            )}
            <Tabs.Tab value="Demos">Demo Studies</Tabs.Tab>
            <Tabs.Tab value="Examples">Example Studies</Tabs.Tab>
            <Tabs.Tab value="Tutorials">Tutorials</Tabs.Tab>
            <Tabs.Tab value="Tests">Tests</Tabs.Tab>
          </Tabs.List>

          {others.length > 0 && (
            <Tabs.Panel value="Others">
              <StudyCards configNames={others} studyConfigs={studyConfigs} />
            </Tabs.Panel>
          )}

          <Tabs.Panel value="Demos">
            <StudyCards configNames={demos} studyConfigs={studyConfigs} />
          </Tabs.Panel>

          <Tabs.Panel value="Examples">
            <StudyCards configNames={examples} studyConfigs={studyConfigs} />
          </Tabs.Panel>

          <Tabs.Panel value="Tutorials">
            <StudyCards configNames={tutorials} studyConfigs={studyConfigs} />
          </Tabs.Panel>

          <Tabs.Panel value="Tests">
            <StudyCards configNames={tests} studyConfigs={studyConfigs} />
          </Tabs.Panel>
        </Tabs>
      </Container>
    </AppShell.Main>
  );
}
