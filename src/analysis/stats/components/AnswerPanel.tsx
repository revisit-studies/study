import {
  Box, Container, Group, Stack, Title,
} from '@mantine/core';
import React, { useEffect, useState } from 'react';
import { VegaLite } from 'react-vega';
import { IndividualComponent, InheritedComponent, RadioResponse } from '../../../parser/types';

export default function AnswerPanel(props: { data: Record<string, Record<string, unknown>>, trialName: string, config: IndividualComponent | InheritedComponent | undefined}) {
  const { data, config, trialName } = props;
  const [correctUser, setCorrectUser] = useState<string[]>([]);
  const [incorrectUser, setIncorrectUser] = useState<string[]>([]);
  const [categoricalStats, setCategoricalStats] = useState<{option:string, count:number}[]>([]);
  const [correctValue, setCorrectValue] = useState<string>('');
  useEffect(() => {
    const responses = config?.response;
    const correct:string[] = [];
    const incorrect:string[] = [];
    if (responses) {
      responses.forEach((response) => {
        const { id, correctAnswer } = response;
        if (correctAnswer) {
          setCorrectValue(correctAnswer as string);
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

            const categoryData:{option:string, count:number}[] = (response as RadioResponse).options.map((op) => ({
              option: op.value as string,
              count: map.get(op.value as string) || 0,
            }));
            setCategoricalStats(categoryData);
          }
        }
      });
      setCorrectUser(correct);
      setIncorrectUser(incorrect);
    }
  }, [data]);

  const specBoxer = {
    data: {
      values: [
        { result: 'correct', start: 0, end: correctUser.length / (correctUser.length + incorrectUser.length) },
        { result: 'incorecct', start: correctUser.length / (correctUser.length + incorrectUser.length), end: 1 },
      ],
    },
    mark: { type: 'bar', cornerRadius: 5 },
    encoding: {
      x: {
        field: 'start', type: 'quantitative', axis: { title: 'corect VS incorrect' }, scale: { domain: [0, 1] },
      },
      x2: { field: 'end' },
      color: {
        field: 'result',
        type: 'nominal',
        scale: { range: ['lightgreen', 'pink'] },
      },
    },
  };

  const specBarChart = {
    width: 300,
    data: {
      values: categoricalStats,
    },
    mark: { type: 'bar', cornerRadiusEnd: 5 },
    encoding: {
      x: { field: 'option', type: 'ordinal' },
      y: { field: 'count', type: 'quantitative' },
    },
  };

  return (
    <Container p={10} sx={{ boxShadow: '1px 2px 2px 3px lightgrey;', borderRadius: '5px' }}>
      <Stack>
        <Box>
          {/* <CorrectVis correct={correctUser} incorrect={incorrectUser} trialName={trialName} /> */}
          {correctUser.length === 0 && incorrectUser.length === 0
            ? <Title order={4}> No correct answer for this question</Title>
            : <VegaLite spec={specBoxer} actions={false} />}

          {correctValue !== '' && <VegaLite spec={specBarChart} actions={false} />}

        </Box>
        <Box />
      </Stack>

    </Container>
  );
}
