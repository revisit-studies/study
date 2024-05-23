import {
  Checkbox, Container, Flex, Paper, Space, Text,
} from '@mantine/core';
import React, { useCallback, useState } from 'react';
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
  const [participantsToVisualize, setParticipantsToVisualize] = useState<ParticipantData[]>([...completed]);

  const handleCheckboxChange = useCallback((value: string[]) => {
    const participants = [];
    if (value.includes('completed')) {
      participants.push(...completed);
    }
    if (value.includes('inprogress')) {
      participants.push(...inprogress);
    }
    if (value.includes('rejected')) {
      participants.push(...rejected);
    }
    setParticipantsToVisualize(participants);
  }, [completed, inprogress, rejected]);

  return (
    <Container fluid>
      <Paper shadow="sm" p="md" withBorder>
        <Flex direction="row" align="center">
          <Checkbox.Group defaultValue={['completed']} ml={8} mb={4} spacing="sm" onChange={handleCheckboxChange}>
            <Checkbox value="completed" label="Completed" />
            <Checkbox value="inprogress" label="In Progress" />
            <Checkbox value="rejected" label="Rejected" />
          </Checkbox.Group>
        </Flex>
        {(participantsToVisualize.length > 0) ? (
          <StatsVis
            config={studyConfig}
            data={participantsToVisualize}
          />
        ) : (
          <>
            <Space h="xl" />
            <Flex justify="center" align="center">
              <Text>No data available</Text>
            </Flex>
          </>
        )}
      </Paper>
    </Container>
  );
}
