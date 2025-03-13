import React, { useEffect, useMemo, useState } from 'react';
import {
  Badge, Box, Card, Container, Flex, Group, Text, Title,
} from '@mantine/core';
import { VegaLite, VisualizationSpec } from 'react-vega';
import { useResizeObserver } from '@mantine/hooks';
import { IndividualComponent, InheritedComponent, ParticipantData } from '../../../parser/types';

function toDisplayData(milliseconds:number) {
  const minutes = Math.floor(milliseconds / (1000 * 60));
  const seconds = ((milliseconds % (1000 * 60)) / 1000).toFixed(2);
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

export interface BasicStats {
  min: number;
  max: number;
  mean: number;
  mid: number;
  maxUser: string;
  minUser: string;
}
export function InfoPanel(props: { data: ParticipantData['answers'], trialName: string, config: IndividualComponent | InheritedComponent | undefined }) {
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

        if (duration < 0) {
          return;
        }

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

  const spec:VisualizationSpec = useMemo(() => ({
    width: dms.width - 8, // width - card padding - vega padding
    height: 200,
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
        mark: { type: 'line', point: false },
        encoding: {
          x: {
            field: 'v',
            type: 'quantitative',
            axis: { title: 'Duration(s)' },
            scale: { domain: [timeStats.min / 1050, timeStats.max / 970] },
          },
        },
      },
      {
        mark: { type: 'tick', color: 'teal', point: false },
        encoding: {
          x: {
            field: 'v',
            type: 'quantitative',
            axis: { title: 'Duration(s)' },
            scale: { domain: [timeStats.min / 1050, timeStats.max / 970] },
          },
        },
      },

      {
        mark: {
          type: 'point',
          filled: true,
          color: 'red',
          point: false,
        },
        encoding: {
          x: { v: timeStats.mean / 1000, type: 'quantitative' }, // Position the red dot at the mean value
        },
      },
    ],
  }), [dms, timeStats]);

  return (
    <Container p={10}>
      <Flex
        gap="lg"
        justify="left"
        align="flex-start"
        direction="row"
        wrap="wrap"
      >

        {/* instruction and description */}
        {(config?.description || config?.instruction) && (
          <Card ref={ref} mih={105} p={5} style={{ boxShadow: '1px 2px 2px 3px lightgrey;', borderRadius: '5px' }}>
            <Box
              pl={5}
              style={{
                width: '50%', height: 20, backgroundColor: 'orange', borderRadius: '0px 10px 10px 0px',
              }}
            >
              <Title order={6}>Question Details</Title>
            </Box>

            {
                config?.instruction
                && (
                <Box maw={400}>
                  <Badge color="green" radius="xs" style={{ display: 'inline' }}>instruction:</Badge>
                  <Text span>{` ${config?.instruction}`}</Text>
                </Box>
                )
            }
            {
                config?.description
                && (
                <Box maw={400}>
                  <Badge color="green" radius="xs" style={{ display: 'inline' }}>description:</Badge>
                  <Text span>{` ${config?.description}`}</Text>
                </Box>
                )
            }
          </Card>
        )}

        {/* meta */}
        {
              config && config.meta && (
              <Box maw={300} p={5} mih={105} style={{ boxShadow: '1px 2px 2px 3px lightgrey;', borderRadius: '5px' }}>
                <Box
                  pl={5}
                  style={{
                    width: '50%', height: 20, backgroundColor: 'orange', borderRadius: '0px 10px 10px 0px',
                  }}
                >
                  <Title order={6}>Meta Data</Title>
                </Box>

                {Object.entries(config.meta).map(([key, value]) => (
                  <Box key={`BoxMeta-${key}`}>
                    <Badge color="green" radius="xs" style={{ display: 'inline' }}>
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
          <Box p={5} style={{ boxShadow: '1px 2px 2px 3px lightgrey;', borderRadius: '5px' }}>
            <Box
              pl={5}
              style={{
                width: '50%', height: 20, backgroundColor: 'orange', borderRadius: '0px 10px 10px 0px',
              }}
            >
              <Title order={6}>Time Stats</Title>
            </Box>

            <Group>

              <Box mih={105} p={5}>
                <Box>
                  <Badge radius="xs" style={{ display: 'inline' }}>Fastest:</Badge>
                  <Text span>{` ${timeStats.minUser}`}</Text>
                </Box>
                <Box>
                  <Badge radius="xs" style={{ display: 'inline' }}>Slowest:</Badge>
                  <Text span>{` ${timeStats.maxUser}`}</Text>
                </Box>
                <Box>
                  <Badge radius="xs" style={{ display: 'inline' }}>Mean:</Badge>
                  <Text span>{ ` ${toDisplayData(timeStats.mean)}`}</Text>
                </Box>
                <Box>
                  <Badge radius="xs" style={{ display: 'inline' }}>Median:</Badge>
                  <Text span>{` ${toDisplayData(timeStats.mid)}`}</Text>

                </Box>
              </Box>
              <VegaLite spec={spec} actions={false} />
            </Group>
          </Box>

        )}
      </Flex>
    </Container>
  );
}
