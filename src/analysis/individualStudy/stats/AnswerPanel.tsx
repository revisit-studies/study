import {
  Box, Card, Container, Flex, Title,
} from '@mantine/core';
import React, { useEffect, useMemo, useState } from 'react';
import { VegaLite, VisualizationSpec } from 'react-vega';
import { useResizeObserver } from '@mantine/hooks';
import { IndividualComponent, InheritedComponent, RadioResponse } from '../../../parser/types';

export default function AnswerPanel({ data, config }: { data: Record<string, Record<string, unknown>>, config: IndividualComponent | InheritedComponent | undefined}) {
  const [correctUser, setCorrectUser] = useState<string[]>([]);
  const [incorrectUser, setIncorrectUser] = useState<string[]>([]);
  const [categoricalStats, setCategoricalStats] = useState<{option:string, count:number, correct:boolean}[]>([]);
  const [ref, dms] = useResizeObserver();

  useEffect(() => {
    const responses = config?.response;
    const correct:string[] = [];
    const incorrect:string[] = [];
    if (responses) {
      responses.forEach((response) => {
        const { correctAnswer } = config;
        const { id } = response;
        if (correctAnswer) {
          for (const [user, answers] of Object.entries(data)) {
            const ans = answers[id];
            if (ans === correctAnswer) {
              correct.push(user);
            } else {
              incorrect.push(user);
            }
          }
          // set categorical data
          if (response.type === 'radio') {
            const map = new Map<string, number>();
            for (const answers of Object.values(data)) {
              const ans:string = answers[id] as string;
              if (map.has(ans)) {
                map.set(ans, map.get(ans) as number + 1);
              } else {
                map.set(ans, 1);
              }
            }

            const categoryData: { option: string, count: number, correct: boolean }[] = (response as RadioResponse).options.map((op) => (typeof op === 'string' ? {
              option: op,
              count: map.get(op as string) || 0,
              correct: op === correctAnswer.find((ans) => ans.id === id)?.answer,
            } : {
              option: op.value as string,
              count: map.get(op.value as string) || 0,
              correct: op.value === correctAnswer.find((ans) => ans.id === id)?.answer,
            }));
            setCategoricalStats(categoryData);
          }
        }
      });
      setCorrectUser(correct);
      setIncorrectUser(incorrect);
    }
  }, [config, data]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const specBoxer = useMemo(() => ({
    height: 50,
    width: dms.width - 100,
    data: {
      values: [
        { result: 'correct', start: 0, end: correctUser.length / (correctUser.length + incorrectUser.length) },
        { result: 'incorrect', start: correctUser.length / (correctUser.length + incorrectUser.length), end: 1 },
      ],
    },
    mark: { type: 'bar', cornerRadius: 5 },
    encoding: {
      x: {
        field: 'start', type: 'quantitative', axis: { title: 'correct VS incorrect' }, scale: { domain: [0, 1] },
      },
      x2: { field: 'end' },
      color: {
        field: 'result',
        type: 'nominal',
        scale: { range: ['lightgreen', 'pink'] },
      },
    },
  }), [correctUser, incorrectUser, dms]);

  const specBarChart = useMemo(() => ({
    width: dms.width - 50,
    height: 200,
    data: {
      values: categoricalStats,
    },
    mark: { type: 'bar', point: false },
    encoding: {
      x: { field: 'option', type: 'ordinal' },
      y: { field: 'count', type: 'quantitative' },
      color: {
        field: 'correct',
        type: 'nominal',
        scale: { range: ['pink', 'lightgreen'] },
      },
    },
  }), [categoricalStats, dms]);

  return (
    <Container p={5} style={{ boxShadow: '1px 2px 2px 3px lightgrey;', borderRadius: '5px' }}>
      <Flex
        gap="lg"
        justify="left"
        align="flex-start"
        direction="row"
        wrap="wrap"
      >
        <Box
          pl={5}
          style={{
            width: '50%', height: 20, backgroundColor: 'orange', borderRadius: '0px 10px 10px 0px',
          }}
        >
          <Title order={6}>Answer Stats</Title>
        </Box>
        <Card ref={ref}>
          {/* <CorrectVis correct={correctUser} incorrect={incorrectUser} trialName={trialName} /> */}
          {correctUser.length === 0 && incorrectUser.length === 0
            ? <Title order={4}> No correct answer for this question</Title>
            : <VegaLite spec={specBoxer as unknown as VisualizationSpec} actions={false} />}
          {categoricalStats.length > 0 && <VegaLite spec={specBarChart as unknown as VisualizationSpec} actions={false} />}

          <Box />
        </Card>
      </Flex>
    </Container>
  );
}
