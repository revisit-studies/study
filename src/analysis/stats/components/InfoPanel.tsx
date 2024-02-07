import { useEffect, useState } from 'react';
import {
  Badge, Box, Container, Group, Text,
} from '@mantine/core';
import { toDisplayData } from '../../utils';
import { StoredAnswer } from '../../../store/types';

export interface BasicStats {
  min: number;
  max: number;
  mean: number;
  mid: number;
  maxUser: string;
  minUser: string;
}
export default function InfoPanel(props: { data: Record<string, StoredAnswer>, trialName: string}) {
  const { data, trialName } = props;

  const [timeStats, setTimeStats] = useState<BasicStats>();

  useEffect(() => {
    // console.log(data, 'info panel data update');
    function calculateStats() {
      let max = 0;
      let min = Number.MAX_VALUE;
      let minUser = '';
      let maxUser = '';
      let sum = 0;
      const durationAry:number[] = [];

      Object.entries(data).forEach(([pid, answers]) => {
        const duration = answers.endTime - answers.startTime;
        sum += duration;
        durationAry.push(duration);
        if (duration > max) {
          max = duration;
          maxUser = pid;
        }
        if (duration < min) {
          min = duration;
          minUser = pid;
        }
      });
      durationAry.sort((a, b) => a - b);
      const mean = sum / durationAry.length;
      const mid = durationAry.length % 2 === 0 ? (durationAry[durationAry.length / 2] + durationAry[durationAry.length / 2 - 1]) / 2 : durationAry[Math.floor(durationAry.length / 2)];
      setTimeStats({
        max,
        min,
        minUser,
        maxUser,
        mean,
        mid,
      });
    }
    if (data) calculateStats();
  }, [data]);

  return (
    <Container fluid p={10} sx={{ boxShadow: '1px 2px 2px 3px lightgrey;', borderRadius: '5px' }}>
      {timeStats && (
      <Group>
        {trialName.length > 0 && (
        <Box>
          <Box>
            <Badge radius="xs" sx={{ display: 'inline' }}>Fastest:</Badge>
            <Text span>{` ${timeStats.minUser}`}</Text>
          </Box>
          <Box>
            <Badge radius="xs" sx={{ display: 'inline' }}>Slowest:</Badge>
            <Text span>{` ${timeStats.maxUser}`}</Text>
          </Box>
          <Box>
            <Badge radius="xs" sx={{ display: 'inline' }}>Mean:</Badge>
            <Text span>{ ` ${toDisplayData(timeStats.mean)}`}</Text>
          </Box>
          <Box>
            <Badge radius="xs" sx={{ display: 'inline' }}>Median:</Badge>
            <Text span>{` ${toDisplayData(timeStats.mid)}`}</Text>

          </Box>
        </Box>
        )}
        {/* <MeanVis trialName={trialName} stats={timeStats} /> */}

      </Group>
      )}

    </Container>

  );
}
