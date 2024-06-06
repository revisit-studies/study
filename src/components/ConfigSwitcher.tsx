import {
  Anchor, AppShell, Card, Container, Flex, Image, Text, UnstyledButton,
} from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { IconAlertTriangle } from '@tabler/icons-react';
import { ErrorObject } from 'ajv';
import { GlobalConfig, StudyConfig } from '../parser/types';
import { sanitizeStringForUrl } from '../utils/sanitizeStringForUrl';
import { PREFIX } from '../utils/Prefix';
import { ErrorLoadingConfig } from './ErrorLoadingConfig';

const REVISIT_GITHUB_PUBLIC = 'https://github.com/revisit-studies/study/tree/main/public/';

type Props = {
  globalConfig: GlobalConfig;
  studyConfigs: {[key: string]: StudyConfig & { errors?: ErrorObject<string, Record<string, unknown>, unknown>[] }};
};

function ConfigSwitcher({ globalConfig, studyConfigs }: Props) {
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
              onClick={() => {
                navigate(`/${url}`);
              }}
              my="sm"
              style={{ width: '100%' }}
            >
              <Card shadow="sm" radius="md" withBorder>
                {config.errors
                  ? (
                    <>
                      <Flex align="center" direction="row">
                        <IconAlertTriangle color="red" />
                        <Text fw="bold" ml={8} color="red">{configName}</Text>
                      </Flex>
                      <ErrorLoadingConfig errors={config.errors} />
                    </>
                  )
                  : (
                    <>
                      <Text fw="bold">{config.studyMetadata.title}</Text>
                      <Text c="dimmed">
                        {`Authors: ${config.studyMetadata.authors}`}
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
              </Card>
            </UnstyledButton>
          );
        })}

      </Container>
    </AppShell.Main>
  );
}

export default ConfigSwitcher;
