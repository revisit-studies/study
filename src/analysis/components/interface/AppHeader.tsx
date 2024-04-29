import {
  Flex, Header, Image, Select, Title, Space, Grid,
} from '@mantine/core';

import { useNavigate } from 'react-router-dom';
import React, { useState } from 'react';
import { PREFIX } from '../../../utils/Prefix';

export default function AppHeader(props: { studyIds: string[], selectedId: string | undefined}) {
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
      <Grid mt={-7} align="center">
        <Grid.Col span={6}>
          <Flex align="center" onClick={() => navigate('/analysis/dashboard')} sx={{ cursor: 'pointer' }}>
            <Image maw={40} src={`${PREFIX}revisitAssets/revisitLogoSquare.svg`} alt="Revisit Logo" />
            <Space w="md" />
            <Title order={4}>ReVISit Analytics Platform</Title>
          </Flex>
        </Grid.Col>

        <Grid.Col span={6}>
          <Flex
            justify="flex-end"
            direction="row"
          >
            <Select
              placeholder="Select Study"
              data={selectorData}
              value={activeExp}
              onChange={onExpChange}
            />
          </Flex>
        </Grid.Col>
      </Grid>
    </Header>
  );
}
