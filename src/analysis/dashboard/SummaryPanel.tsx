import {
  Badge, Box, Button, Card, Center, Text, Title, Container, Flex, Group,
} from '@mantine/core';
import React, { useEffect, useMemo, useState } from 'react';
import { IconCodePlus, IconTable } from '@tabler/icons-react';
import { DateRangePicker, DateRangePickerValue } from '@mantine/dates';
import { VegaLite } from 'react-vega';
import { useDisclosure, useResizeObserver } from '@mantine/hooks';
import { ParticipantData } from '../../storage/types';
import { getSequenceFlatMap } from '../../utils/getSequenceFlatMap';
import { StoredAnswer } from '../../store/types';
import { download, DownloadTidy } from '../../components/DownloadTidy';
import { StudyConfig } from '../../parser/types';

const isStudyCompleted = (participant: ParticipantData) => getSequenceFlatMap(participant.sequence).every((step, idx) => {
  if (step === 'end') {
    return true;
  }
  return participant.answers[`${step}_${idx}`] !== undefined;
});

const isWithinRange = (answers: Record<string, StoredAnswer>, rangeTime: DateRangePickerValue) => {
  const timeStamps = Object.values(answers).map((ans) => [ans.startTime, ans.endTime]).flat();
  if (rangeTime[0] === null || rangeTime[1] === null) {
    return false;
  }
  return Math.min(...timeStamps) >= rangeTime[0].getTime() && Math.max(...timeStamps) <= rangeTime[1].getTime();
};

export function SummaryPanel(props: { studyId: string; allParticipants: ParticipantData[]; config: StudyConfig }) {
  const {
    studyId, allParticipants, config,
  } = props;
  const [openDownload, { open, close }] = useDisclosure(false);

  const [ref, dms] = useResizeObserver();

  const completionTimes = allParticipants
    .filter((d) => isStudyCompleted(d))
    .map((d) => Math.max(...Object.values(d.answers).map((ans) => ans.endTime)));
  const [rangeTime, setRangeTime] = useState<DateRangePickerValue>([
    new Date(new Date(Math.min(...completionTimes, new Date().getTime())).setHours(0, 0, 0, 0)),
    new Date(new Date(Math.max(...completionTimes, new Date().getTime())).setHours(24, 0, 0, 0)),
  ]);

  const [completedParticipants, setCompletedParticipants] = useState<ParticipantData[]>([]);
  const [inProgressParticipants, setInProgressParticipants] = useState<ParticipantData[]>([]);

  useEffect(() => {
    if (allParticipants.length > 0 && allParticipants[0].sequence.components) {
      const inRangeData = allParticipants.filter((d) => isWithinRange(d.answers, rangeTime));

      const completedData: ParticipantData[] = [];
      const inProgressData: ParticipantData[] = [];

      inRangeData.forEach((d) => {
        if (isStudyCompleted(d)) {
          completedData.push(d);
        } else {
          inProgressData.push(d);
        }
      });

      setCompletedParticipants(completedData);
      setInProgressParticipants(inProgressData);
    }
  }, [allParticipants, rangeTime]);

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
  }), [dms, completedStatsData]);

  return (
    <Container>
      <Card ref={ref} p="lg" shadow="md" withBorder>
        <Flex align="center" mb={16} justify="space-between">
          <Title order={5}>{studyId}</Title>
          <Group>
            <Button
              leftIcon={<IconCodePlus />}
              disabled={allParticipants.length === 0}
              onClick={() => {
                download(JSON.stringify(allParticipants, null, 2), `${studyId}_all.json`);
              }}
            >
              JSON
            </Button>

            <Button
              leftIcon={<IconTable />}
              onClick={open}
              disabled={allParticipants.length === 0}
            >
              TIDY
            </Button>
          </Group>
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

      <DownloadTidy
        opened={openDownload}
        close={close}
        filename={`${studyId}_all_tidy.csv`}
        studyConfig={config}
        data={allParticipants}
      />
    </Container>
  );
}
