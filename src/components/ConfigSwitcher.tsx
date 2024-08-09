import {
  ActionIcon, Anchor, AppShell, Card, Container, Flex, Image, Text, UnstyledButton,
} from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { IconAlertTriangle, IconExternalLink } from '@tabler/icons-react';
import { GlobalConfig, ParsedStudyConfig } from '../parser/types';
import { sanitizeStringForUrl } from '../utils/sanitizeStringForUrl';
import { PREFIX } from '../utils/Prefix';
import { ErrorLoadingConfig } from './ErrorLoadingConfig';

const REVISIT_GITHUB_PUBLIC = 'https://github.com/revisit-studies/study/tree/main/public/';

function ConfigSwitcher({
  globalConfig,
  studyConfigs,
}: {
  globalConfig: GlobalConfig;
  studyConfigs: Record<string, ParsedStudyConfig | null>;
}) {
  const { configsList } = globalConfig;
  const navigate = useNavigate();

  return (
    <AppShell.Main>
      <Container size="xs" px="xs">
        <Image
          maw={150}
          mx="auto"
          mb="xl"
          radius="md"
          src={`${PREFIX}revisitAssets/revisitLogoSquare.svg`}
          alt="reVISit"
        />
        <Text>Select an experiment to launch:</Text>
        {configsList.map((configName) => {
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
        })}

      </Container>
    </AppShell.Main>
  );
}

export default ConfigSwitcher;
