import React, { useEffect, useMemo, useState } from 'react';
import {
  Badge, Box, Container, Group, Text,
} from '@mantine/core';
import { VegaLite } from 'react-vega';
import { useResizeObserver } from '@mantine/hooks';
import { toDisplayData } from '../../utils';
import { StoredAnswer } from '../../../store/types';
import { IndividualComponent, InheritedComponent } from '../../../parser/types';

export interface BasicStats {
  min: number;
  max: number;
  mean: number;
  mid: number;
  maxUser: string;
  minUser: string;
}
export default function InfoPanel(props: { data: Record<string, StoredAnswer>, trialName: string, config: IndividualComponent | InheritedComponent | undefined }) {
  const { data, trialName, config } = props;
  const [timeStats, setTimeStats] = useState<BasicStats>({
    max: 0,
    min: 0,
    minUser: '',
    maxUser: '',
    mean: 0,
    mid: 0,
  });
  const [ref, dms] = useResizeObserver();

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

  const spec = useMemo(() => ({
    width: 300, // width - card padding - vega padding    height: 100,
    height: 100,
    data: {
      values: [
        {
          v: timeStats.min / 1000,
          type: 'value',
        },
        {
          v: timeStats.max / 1000,
          type: 'value',
        },

      ],
    },

    layer: [
      {

        mark: { type: 'line', point: true },
        encoding: {
          x: {
            field: 'v', type: 'quantitative', axis: { title: 'Duration(s)' }, scale: { domain: [timeStats.min / 1050, timeStats.max / 970] },
          },
        },
      },
      {
        mark: { type: 'tick', color: 'teal' },
        encoding: {
          x: {
            field: 'v', type: 'quantitative', axis: { title: 'Duration(s)' }, scale: { domain: [timeStats.min / 1050, timeStats.max / 970] },
          },
        },
      },

      {
        mark: { type: 'point', filled: true, color: 'red' },
        encoding: {
          x: { v: timeStats.mean / 1000 }, // Position the red dot at the mean value
        },
      },
    ],
  }), [dms, timeStats]);

  return (
    <Container fluid p={10}>
      {timeStats && (
        <Group>
          {
                  config && config.meta && (
                  <Box p={5} mih={105} sx={{ boxShadow: '1px 2px 2px 3px lightgrey;', borderRadius: '5px' }}>
                    {Object.entries(config.meta).map(([key, value]) => (
                      <Box key={`box-${key}`}>
                        <Badge color="green" radius="xs" sx={{ display: 'inline' }}>
                          {key}
                          :
                        </Badge>
                        <Text span>{` ${value}`}</Text>
                      </Box>
                    ))}
                  </Box>
                  )
              }
          {trialName.length > 0 && (
          <Group sx={{ boxShadow: '1px 2px 2px 3px lightgrey;', borderRadius: '5px' }}>
            <Box mih={105} p={5}>
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
            <VegaLite spec={spec} actions={false} />
          </Group>
          )}

        </Group>
      )}
    </Container>

  );
}
