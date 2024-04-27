import {
  Box,
  Flex, Group,
  Header, Image, MediaQuery, Select, Space, Title,
} from '@mantine/core';

import { useNavigate, useSearchParams } from 'react-router-dom';
import React, { useState } from 'react';
import { PREFIX } from '../../../utils/Prefix';

export default function AppHeader(props:{ studyIds: string[], selectedId: string | undefined}) {
  const { studyIds, selectedId } = props;
  const navigate = useNavigate();
  const [activeExp, setActiveExp] = useState<string | undefined>(selectedId);
  // const page = window.location.pathname.split('/')[2];
  const selectorData = studyIds.map((id) => ({ value: id, label: id }));
  const onExpChange = (value: string) => {
    setActiveExp(value);
    navigate(`/analysis/stats/${value}`);
  };

  return (
    <Header height={70} p="md" miw={800}>
      <Group position="apart">
        <Group sx={{ cursor: 'pointer' }} onClick={() => navigate('/analysis/dashboard')}>
          <Image maw={40} src={`${PREFIX}revisitAssets/revisitLogoSquare.svg`} alt="Revisit Logo" />
          <MediaQuery smallerThan="md" styles={{ display: 'none' }}>
            <Title span order={4}>
              reVISit Analytics Platform /
              {`${selectedId || 'Dashboard'}`}
            </Title>
          </MediaQuery>
        </Group>

        <Box>
          <Flex
            gap="md"
            justify="flex-end"
            align="center"
            direction="row"
            wrap="wrap"
          >

            {activeExp && (
              <Select
                placeholder="Select an experiment"
                data={selectorData}
                value={activeExp}
                onChange={onExpChange}
              />
            )}

          </Flex>
        </Box>
      </Group>

    </Header>
  );
}
