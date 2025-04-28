import {
  Flex, Image, Select, Title, Space, Grid, AppShell, Button,
} from '@mantine/core';

import { useLocation, useNavigate, useParams } from 'react-router';

import { IconListCheck, IconSettings } from '@tabler/icons-react';
import { PREFIX } from '../../utils/Prefix';

export function AppHeader({ studyIds }: { studyIds: string[] }) {
  const navigate = useNavigate();
  const { studyId } = useParams();
  const location = useLocation();

  const selectorData = studyIds.map((id) => ({ value: id, label: id })).sort((a, b) => a.label.localeCompare(b.label));

  const inAnalysis = location.pathname.includes('analysis');

  return (
    <AppShell.Header p="md">
      <Grid mt={-7} align="center">
        <Grid.Col span={6}>
          <Flex align="center" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            <Image w={40} src={`${PREFIX}revisitAssets/revisitLogoSquare.svg`} alt="Revisit Logo" />
            <Space w="md" />
            <Title order={4} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {inAnalysis ? 'ReVISit Analytics Platform' : 'ReVISit Studies'}
            </Title>
          </Flex>
        </Grid.Col>

        <Grid.Col span={6}>
          <Flex
            justify="flex-end"
            direction="row"
          >
            {inAnalysis && (
              <>
                <Select
                  allowDeselect={false}
                  placeholder="Select Study"
                  data={selectorData}
                  value={studyId}
                  onChange={(value) => navigate(`/analysis/stats/${value}`)}
                  mr={16}
                />
                <Button component="a" href={`${PREFIX}${studyId}`} target="_blank" leftSection={<IconListCheck />} mr="sm">
                  Go to Study
                </Button>
              </>
            )}

            <IconSettings onClick={() => navigate('/settings')} style={{ cursor: 'pointer', marginTop: inAnalysis ? 6 : undefined }} />
          </Flex>
        </Grid.Col>
      </Grid>
    </AppShell.Header>
  );
}
