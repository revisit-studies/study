import { useEffect, useState } from 'react';
import { parseGlobalConfig } from '../parser/parser';
import {
  Text,
  Card,
  Container,
  UnstyledButton,
} from '@mantine/core';

async function fetchStudyConfig(configLocation: string) {
  const config = await (await fetch(configLocation)).text();
  return parseGlobalConfig(config);
}

const ConfigSwitcher = ({ onChange }: { onChange: (path: string) => void }) => {
  const [configs, setConfigs] = useState<
    { title: string; path: string; description: string }[]
  >([]);

  useEffect(() => {
    const queryParameters = new URLSearchParams(window.location.search);
    const studyConfig = queryParameters.get('studyConfig');
  
    fetchStudyConfig(`${import.meta.env.PROD ? '/revisit-study-frontend/' : '/'}configs/global.hjson`).then((cfg) => {
      setConfigs(
        cfg.configsList.map((configId) => ({ ...cfg.configs[configId] }))
      );
      if (studyConfig && cfg.configsList.includes(studyConfig)) {
        onChange(cfg.configs[studyConfig].path);
      }
    });
  }, []);

  return (
      <Container size="xs" px="xs" style={{marginTop: 100, marginBottom: 100}}>
            <Text>Select an experiment to launch:</Text>
            {configs.map((config) => {
              return (
                <UnstyledButton key={config.title} my="sm" style={{ width: '100%' }}>
                  <Card
                    shadow="sm"
                    radius="md"
                    withBorder
                    onClick={() => {
                      onChange(config.path);
                    }}
                  >
                    <Text fw="bold">{config.title}</Text>
                    <Text c="dimmed">{config.description}</Text>
                  </Card>
                </UnstyledButton>
              );
            })}
      </Container>
  );
};

export default ConfigSwitcher;
