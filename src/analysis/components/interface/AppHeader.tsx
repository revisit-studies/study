import {
  Button,
  Container,
  Flex, Group,
  Header, Image, MediaQuery, Select, Space, Title,
} from '@mantine/core';

import { IconHome, IconDeviceDesktopAnalytics } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import React, { useState } from 'react';
import { PREFIX } from '../../../utils/Prefix';

export default function AppHeader(props:{ studyIds: string[]}) {
  const { studyIds } = props;
  const [activeExp, setActiveExp] = useState<string | null>(null);
  const navigate = useNavigate();
  const page = window.location.pathname.split('/')[2];
  const selectorData = studyIds.map((id) => ({ value: id, label: id }));

  const onExpChange = (value: string) => {
    setActiveExp(value);
    navigate(`/analysis/stats/?exp=${value}`);
  };

  return (
    <Header height={70} p="md">
      <Group>
        <Image maw={40} src={`${PREFIX}revisitAssets/revisitLogoSquare.svg`} alt="Revisit Logo" />
        <Space w="md" />

        <MediaQuery smallerThan="md" styles={{ display: 'none' }}>
          <Title span order={4}>reVISit Analytics Platform</Title>
        </MediaQuery>

        <Container fluid>
          <Flex
            gap="md"
            justify="flex-end"
            align="center"
            direction="row"
            wrap="wrap"
          >
            <Button
              color="orange"
              onClick={() => { navigate('/analysis/dashboard'); }}
              variant={page === 'dashboard' ? 'filled' : 'outline'}
            >
              <IconHome size={20} />
            </Button>
            <Button
              color="orange"
              onClick={() => { navigate('/analysis/stats'); }}
              variant={page === 'stats' ? 'filled' : 'outline'}
            >
              <IconDeviceDesktopAnalytics size={20} />
            </Button>
            {page === 'stats' && (
              <Select
                placeholder="Select an experiment"
                data={selectorData}
                value={activeExp}
                onChange={onExpChange}
              />
            )}

          </Flex>
        </Container>
      </Group>

    </Header>
  );
}
