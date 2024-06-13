import {
  Badge, Box, Button, Card, Center, Text, Title, Container, Flex, Group, Popover,
} from '@mantine/core';
import React, { useMemo, useState } from 'react';
import { IconChartHistogram } from '@tabler/icons-react';
import { DatePickerInput } from '@mantine/dates';
import { VegaLite } from 'react-vega';
import { useDisclosure, useResizeObserver } from '@mantine/hooks';
import { useNavigate } from 'react-router-dom';
import { ParticipantData } from '../../storage/types';
import { StoredAnswer, StudyConfig } from '../../parser/types';
import { DownloadButtons } from '../../components/downloader/DownloadButtons';

function isWithinRange(answers: Record<string, StoredAnswer>, rangeTime: [Date | null, Date | null]) {
  const timeStamps = Object.values(answers).map((ans) => [ans.startTime, ans.endTime]).flat();
  if (rangeTime[0] === null || rangeTime[1] === null) {
    return false;
  }
  return Math.min(...timeStamps) >= rangeTime[0].getTime() && Math.max(...timeStamps) <= rangeTime[1].getTime();
}

export function SummaryPanel(props: { studyId: string; allParticipants: ParticipantData[]; config: StudyConfig }) {
  const {
    studyId, allParticipants, config,
  } = props;
  const navigate = useNavigate();
  const [ref, dms] = useResizeObserver();

  const completionTimes = allParticipants
    .filter((d) => d.completed)
    .map((d) => Math.max(...Object.values(d.answers).map((ans) => ans.endTime).filter((time) => time !== undefined)))
    .filter((d) => Number.isFinite(d));
  const [rangeTime, setRangeTime] = useState<[Date | null, Date | null]>([
    new Date(new Date(Math.min(...(completionTimes.length > 0 ? completionTimes : [new Date().getTime()]))).setHours(0, 0, 0, 0)),
    new Date(new Date(Math.max(...(completionTimes.length > 0 ? completionTimes : [new Date().getTime()]))).setHours(24, 0, 0, 0)),
  ]);

  const completedParticipants = useMemo(() => allParticipants.filter((d) => d.completed && isWithinRange(d.answers, rangeTime)), [allParticipants, rangeTime]);
  const inProgressParticipants = useMemo(() => allParticipants.filter((d) => !d.completed && isWithinRange(d.answers, rangeTime)), [allParticipants, rangeTime]);

  const completedStatsData = useMemo(() => {
    if (completedParticipants.length > 0) {
      return [
        { Date: rangeTime[0]?.getTime(), Participants: 0 },
        ...completedParticipants
          .map((participant) => Math.max(
            ...Object.values(participant.answers).map((ans) => ans.endTime).flat(),
          ))
          .sort((a, b) => a - b)
          .map((time, idx) => ({
            Date: time,
            Participants: idx,
          })),
        { Date: rangeTime[1]?.getTime(), Participants: completedParticipants.length },
      ];
    }

    return [];
  }, [completedParticipants, rangeTime]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const spec: any = useMemo(() => ({
    width: dms.width - 40 - 8, // width - card padding - vega padding
    height: 200,
    mark: {
      type: 'line',
      interpolate: 'step-before',
    },
    encoding: {
      x: { field: 'Date', type: 'temporal', scale: { domain: [rangeTime[0]?.getTime(), rangeTime[1]?.getTime()] } },
      y: { field: 'Participants', type: 'quantitative' },
    },
    data: { values: completedStatsData },
  }), [dms.width, rangeTime, completedStatsData]);

  const [checkOpened, { close: closeCheck, open: openCheck }] = useDisclosure(false);

  return (
    <Container>
      <Card ref={ref} padding="lg" shadow="md" withBorder>
        <Flex align="center" mb={16} justify="space-between">
          <Flex direction="column">
            <Title order={5} mb={4}>{studyId}</Title>
            <Flex direction="row" wrap="nowrap" gap="xs" align="center" mb={4}>
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
          </Flex>
          <Group>
            <DownloadButtons allParticipants={allParticipants} studyId={studyId} config={config} />

            <Popover opened={checkOpened}>
              <Popover.Target>
                <Button
                  onClick={() => navigate(`/analysis/stats/${studyId}`)}
                  onMouseEnter={openCheck}
                  onMouseLeave={closeCheck}
                  px={4}
                >
                  <IconChartHistogram />
                </Button>
              </Popover.Target>
              <Popover.Dropdown>
                <Text>Analyze and manage study data</Text>
              </Popover.Dropdown>
            </Popover>
          </Group>
        </Flex>

        <DatePickerInput
          type="range"
          label="Time Filter"
          placeholder="Select a date range"
          value={rangeTime}
          onChange={setRangeTime}
        />

        {completedStatsData.length > 0
          ? (
            <>
              <Text mt={16}>Finished Participants</Text>
              <VegaLite spec={spec} actions={false} />
            </>
          )
          : (
            <Box h={293.4}>
              <Center style={{ height: '100%' }}>
                <Text>Not enough participants for chart</Text>
              </Center>
            </Box>
          )}
      </Card>
    </Container>
  );
}
