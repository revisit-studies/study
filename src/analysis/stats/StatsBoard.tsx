import {
  Badge,
  Box,
  Container,
  Group, MultiSelect,
  Paper,
  SelectItem,
  Stack, Tabs,
  Text,
  Title,
} from '@mantine/core';
import React, { useEffect, useState } from 'react';
import {
  IconSquareCheck, IconProgressBolt, IconArrowUp,
} from '@tabler/icons-react';
import { useParams } from 'react-router-dom';
import { ParticipantData } from '../../storage/types';
import { StudyConfig } from '../../parser/types';
import StatsVis from './StatsVis';

export function StatsBoard({
  studyConfig,
  inprogress,
  completed,
  rejected,
}: {
studyConfig: StudyConfig;
completed: ParticipantData[];
inprogress: ParticipantData[];
rejected: ParticipantData[];
}) {
  const [dropdownData, setDropdownData] = useState<SelectItem[]>([]);
  const [activeParticipants, setActiveParticipants] = useState<string[]>([]);
  const { studyId } = useParams();

  useEffect(() => {
    if (activeParticipants.includes('All')) {
      setDropdownData([{ label: 'All', value: 'All' }, ...completed.map((d) => ({ value: d.participantId, label: d.participantId, disabled: true }))]);
    } else setDropdownData([{ label: 'All', value: 'All' }, ...completed.map((d) => ({ value: d.participantId, label: d.participantId }))]);
  }, [completed, activeParticipants]);

  return (
    <Container fluid>
      {(studyId && completed && inprogress) ? (
        <Box
          mt={10}
          p={10}
        >
          <Paper p={10} sx={{ boxShadow: '1px 2px 2px 3px lightgrey;', borderRadius: '5px' }}>
            <Group>
              <Stack spacing="xs" mb={10}>
                <Title order={3}>
                  {' '}
                  {studyId}
                </Title>
                <Text>
                  Total Participants:
                  {completed.length + inprogress.length}
                </Text>
              </Stack>
              <Tabs defaultValue="completed" orientation="vertical">
                <Tabs.List>
                  <Tabs.Tab
                    rightSection={(
                      <Badge
                        color="green"
                        sx={{ width: 16, height: 16, pointerEvents: 'none' }}
                        variant="filled"
                        size="xs"
                        p={0}
                      >
                        {completed.length}
                      </Badge>
                            )}
                    value="completed"
                    icon={(
                      <IconSquareCheck
                        color="green"
                        size={12}
                      />
                    )}
                  >
                    Completed
                  </Tabs.Tab>

                  <Tabs.Tab
                    rightSection={(
                      <Badge
                        color="yellow"
                        sx={{ width: 16, height: 16, pointerEvents: 'none' }}
                        variant="filled"
                        size="xs"
                        p={0}
                      >
                        {inprogress.length}
                      </Badge>
                            )}
                    value="inprogress"
                    icon={(
                      <IconProgressBolt
                        color="orange"
                        size={12}
                      />
                    )}
                  >
                    In Progress
                  </Tabs.Tab>

                </Tabs.List>
                <Tabs.Panel value="completed" pt="xs">
                  <Paper p={10}>
                    <MultiSelect
                      maxDropdownHeight={400}
                      clearable
                      miw={300}
                      data={dropdownData}
                      onChange={setActiveParticipants}
                    />

                  </Paper>
                </Tabs.Panel>

                <Tabs.Panel value="inprogress" pt="xs">
                  For In progress users, a seperate view.
                </Tabs.Panel>

              </Tabs>
            </Group>

          </Paper>

        </Box>
      ) : (
        <Box ml="50%">
          <Box ml={200}>
            <IconArrowUp size={30} display="block" />
          </Box>
          <Title>Please select an experiment</Title>
        </Box>
      )}

      {studyConfig && (activeParticipants.length > 1 || activeParticipants.includes('All')) && (
      <StatsVis
        config={studyConfig}
        data={activeParticipants.includes('All')
          ? completed
          : completed.filter((d) => activeParticipants.includes(d.participantId))}
      />
      )}
      {activeParticipants.length === 0 && (
      <Title ml={200} order={4}>
        <IconArrowUp size={30} />
        Select 1 participant to check individual detials, select 2+ participants to check aggregated results
      </Title>
      )}

    </Container>

  );
}
