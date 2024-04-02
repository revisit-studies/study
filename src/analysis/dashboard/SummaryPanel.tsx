import {
  Badge, Box, Button, Card, Center, Text, Title, Container, Flex,
} from '@mantine/core';
import React, { useEffect, useMemo, useState } from 'react';
import { IconTable } from '@tabler/icons-react';
import { DateRangePicker, DateRangePickerValue } from '@mantine/dates';
import LineChart from '../components/charts/LineChart';
import { SummaryPanelProps } from '../types';
import { ParticipantData } from '../../storage/types';
import { getSequenceFlatMap } from '../../utils/getSequenceFlatMap';
import { Sequence, StoredAnswer } from '../../store/types';

const isStudyCompleted = (sequence : Sequence, answers: Record<string, StoredAnswer>) => getSequenceFlatMap(sequence).every((step, idx) => {
  if (step === 'end') {
    return true;
  }
  return answers[`${step}_${idx}`] !== undefined;
});

const isWithinRange = (answers: Record<string, StoredAnswer>, rangeTime: DateRangePickerValue) => {
  const timeStamps = Object.values(answers).map((ans) => [ans.startTime, ans.endTime]).flat();
  if (rangeTime[0] === null || rangeTime[1] === null) {
    return false;
  }
  return Math.min(...timeStamps) >= rangeTime[0].getTime() && Math.max(...timeStamps) <= rangeTime[1].getTime();
};

export function SummaryPanel(props: SummaryPanelProps) {
  const { studyId, data } = props;

  const times = data.map((d) => Object.values(d.answers).map((ans) => [ans.startTime, ans.endTime]).flat()).flat();
  const [rangeTime, setRangeTime] = useState<DateRangePickerValue>([new Date(Math.min(...times)), new Date(Math.max(...times))]);

  const [completedParticipants, setCompletedParticipants] = useState<ParticipantData[]>([]);
  const [inProgressParticipants, setInProgressParticipants] = useState<ParticipantData[]>([]);

  useEffect(() => {
    if (data.length > 0 && data[0].sequence.components) {
      const inRangeData = data.filter((d) => isWithinRange(d.answers, rangeTime));

      const completedData: ParticipantData[] = [];
      const inProgressData: ParticipantData[] = [];

      inRangeData.forEach((d) => {
        if (isStudyCompleted(d.sequence, d.answers)) {
          completedData.push(d);
        } else {
          inProgressData.push(d);
        }
      });

      setCompletedParticipants(completedData);
      setInProgressParticipants(inProgressData);
    }
  }, [data, rangeTime]);

  const completedStatsData = useMemo(() => {
    if (completedParticipants.length > 0) {
      return completedParticipants
        .map((participant) => Math.max(
          ...Object.values(participant.answers).map((ans) => ans.endTime).flat(),
        ))
        .sort((a, b) => a - b)
        .map((time, idx) => ({
          time,
          value: idx + 1,
        }));
    }

    return [];
  }, [completedParticipants]);

  return (
    <Container>
      <Card p="lg" shadow="md" withBorder>
        <Flex align="center" mb={16} justify="space-between">
          <Title order={5}>{studyId}</Title>
          <Button leftIcon={<IconTable />}>
            Download Tidy Data
          </Button>
        </Flex>

        <DateRangePicker
          label={(
            <Flex direction="row" wrap="nowrap" gap="xs" align="center" mb={4}>
              <Text>Time Filter:</Text>
              <Badge size="sm" color="orange">
                Total:&nbsp;
                {inProgressParticipants.length + completedParticipants.length}
              </Badge>
              <Badge size="sm" color="green">
                Completed:&nbsp;
                {completedParticipants.length}
              </Badge>
              <Badge size="sm" color="cyan">
                In Progress:&nbsp;
                {inProgressParticipants.length}
              </Badge>
            </Flex>
            )}
          placeholder="Pick dates range"
          value={rangeTime}
          onChange={setRangeTime}
        />

        {completedStatsData.length >= 2
          ? <LineChart domainH={[0, 100]} rangeH={[10, 200]} domainV={[0, 100]} rangeV={[10, 100]} data={completedStatsData} labelV="" labelH="" />
          : (
            <Box h={262}>
              <Center style={{ height: '100%' }}>
                <Text>Not enough participants for chart</Text>
              </Center>
            </Box>
          )}
      </Card>
    </Container>
  );
}
