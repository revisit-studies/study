import { Card, Container, Text, UnstyledButton } from '@mantine/core';
import { GlobalConfig } from '../parser/types';
import { sanitizeStringForUrl } from '../utils/sanitizeStringForUrl';
import { useNavigateWithParams } from '../utils/useNavigateWithParams';
import { useEffect, useState } from 'react';
import { parseGlobalConfig } from '../parser/parser';
import {useNavigate} from 'react-router-dom';


type Props = {
  globalConfig: GlobalConfig;
};

const ConfigSwitcher = ({ globalConfig }: Props) => {
  const { configs, configsList } = globalConfig;
  const navigate = useNavigateWithParams();
  
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
    <Container size="xs" px="xs" style={{ marginTop: 100, marginBottom: 100 }}>
      <Text>Select an experiment to launch:</Text>
      {configsList.map((configName) => {
        const config = configs[configName];
        const url = sanitizeStringForUrl(config.title);

        return (
          <UnstyledButton
            key={config.title}
            onClick={() => {
              navigate(`/${url}`);
            }}
            my="sm"
            style={{ width: '100%' }}
          >
            <Card shadow="sm" radius="md" withBorder>
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
