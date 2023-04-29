import { Card, Container, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { GlobalConfig } from '../parser/types';
import { sanitizeStringForUrl } from '../utils/sanitizeStringForUrl';

type Props = {
  globalConfig: GlobalConfig;
};

const ConfigSwitcher = ({ globalConfig }: Props) => {
  const { configs, configsList } = globalConfig;
  return (
    <Container size="xs" px="xs" style={{ marginTop: 100, marginBottom: 100 }}>
      <Text>Select an experiment to launch:</Text>
      {configsList.map((configName) => {
        const config = configs[configName];
        const url = sanitizeStringForUrl(config.title);

        return (
          <Link
            key={config.title}
            to={`/${url}`}
            /* my="sm" */ style={{ width: '100%' }}
          >
            <Card shadow="sm" radius="md" withBorder>
              <Text fw="bold">{config.title}</Text>
              <Text c="dimmed">{config.description}</Text>
            </Card>
          </Link>
        );
      })}
    </Container>
  );
};

export default ConfigSwitcher;
