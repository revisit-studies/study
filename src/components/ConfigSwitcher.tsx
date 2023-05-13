import { Card, Container, Image, Text, UnstyledButton } from '@mantine/core';
import { GlobalConfig, StudyConfig } from '../parser/types';
import { sanitizeStringForUrl } from '../utils/sanitizeStringForUrl';
import { useNavigateWithParams } from '../utils/useNavigateWithParams';

export const PREFIX = import.meta.env.PROD
  ? import.meta.env.VITE_BASE_PATH
  : '/';

type Props = {
  globalConfig: GlobalConfig;
  studyConfigs: {[key: string]: StudyConfig};
};

const ConfigSwitcher = ({ globalConfig, studyConfigs }: Props) => {
  const { configsList } = globalConfig;
  const navigate = useNavigateWithParams();

  return (
    <Container size="xs" px="xs" style={{ marginTop: 100, marginBottom: 100 }}>
      <Image
        maw={150}
        mx="auto"
        mb="xl"
        radius="md"
        src={`${PREFIX}assets/revisitLogoSquare.svg`}
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
              <Text fw="bold">{config.studyMetadata.title}</Text>
              <Text c="dimmed">{config.studyMetadata.description}</Text>
            </Card>
          </UnstyledButton>
        );
      })}
    </Container>
  );
};

export default ConfigSwitcher;
