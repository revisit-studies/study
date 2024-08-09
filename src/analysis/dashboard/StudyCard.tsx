import {
  Box, Button, Card, Center, Text, Title, Container, Flex, Group, Tooltip,
} from '@mantine/core';
import React, { useMemo, useState } from 'react';
import { IconChartHistogram } from '@tabler/icons-react';
import { DatePickerInput } from '@mantine/dates';
import { VegaLite } from 'react-vega';
import { useResizeObserver } from '@mantine/hooks';
import { useNavigate } from 'react-router-dom';
import { ParticipantData } from '../../storage/types';
import { StoredAnswer } from '../../parser/types';
import { DownloadButtons } from '../../components/downloader/DownloadButtons';
import { ParticipantStatusBadges } from '../interface/ParticipantStatusBadges';
import { PREFIX } from '../../utils/Prefix';

function isWithinRange(answers: Record<string, StoredAnswer>, rangeTime: [Date | null, Date | null]) {
  const timeStamps = Object.values(answers).map((ans) => [ans.startTime, ans.endTime]).flat();
  if (rangeTime[0] === null || rangeTime[1] === null) {
    return false;
  }
  return Math.min(...timeStamps) >= rangeTime[0].getTime() && Math.max(...timeStamps) <= rangeTime[1].getTime();
}

export function StudyCard({ studyId, allParticipants }: { studyId: string; allParticipants: ParticipantData[]; }) {
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

  const [completed, inProgress, rejected, completedInTime] = useMemo(() => {
    const comp = allParticipants.filter((d) => !d.rejected && d.completed);
    const prog = allParticipants.filter((d) => !d.rejected && !d.completed);
    const rej = allParticipants.filter((d) => d.rejected);
    return [comp, prog, rej, comp.filter((d) => isWithinRange(d.answers, rangeTime))];
  }, [allParticipants, rangeTime]);

  const completedStatsData = useMemo(() => {
    if (completedInTime.length > 0) {
      return [
        { Date: rangeTime[0]?.getTime(), Participants: 0 },
        ...completedInTime
          .map((participant) => Math.max(
            ...Object.values(participant.answers).map((ans) => ans.endTime).flat(),
          ))
          .sort((a, b) => a - b)
          .map((time, idx) => ({
            Date: time,
            Participants: idx,
          })),
        { Date: rangeTime[1]?.getTime(), Participants: completedInTime.length },
      ];
    }

    return [];
  }, [completedInTime, rangeTime]);

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

  return (
    <Container>
      <Card ref={ref} padding="lg" shadow="md" withBorder>
        <Flex align="center" mb="xs" justify="space-between">
          <Flex direction="row" align="center">
            <Title order={5}>{studyId}</Title>
            <ParticipantStatusBadges completed={completed.length} inProgress={inProgress.length} rejected={rejected.length} filteredCompleted={completedInTime.length} />
          </Flex>
          <Group>
            <DownloadButtons allParticipants={allParticipants} studyId={studyId} />
            <Tooltip label="Analyze and manage study data">
              <Button
                onClick={(event) => { if (!event.ctrlKey && !event.metaKey) { event.preventDefault(); navigate(`/analysis/stats/${studyId}`); } }}
                px={4}
                component="a"
                href={`${PREFIX}analysis/stats/${studyId}`}
              >
                <IconChartHistogram />
              </Button>
            </Tooltip>
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
