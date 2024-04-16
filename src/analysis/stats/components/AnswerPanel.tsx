import {
  Box, Container, Group, Title,
} from '@mantine/core';
import React, { useEffect, useState } from 'react';
import { VegaLite } from 'react-vega';
import { IndividualComponent, InheritedComponent } from '../../../parser/types';

export default function AnswerPanel(props: { data: Record<string, Record<string, unknown>>, trialName: string, config: IndividualComponent | InheritedComponent | undefined}) {
  const { data, config, trialName } = props;
  const [correctUser, setCorrectUser] = useState<string[]>([]);
  const [incorrectUser, setIncorrectUser] = useState<string[]>([]);

  useEffect(() => {
    const responses = config?.response;
    const correct:string[] = [];
    const incorrect:string[] = [];
    if (responses) {
      responses.forEach((response) => {
        const { id, correctAnswer } = response;
        if (correctAnswer) {
          for (const [user, answers] of Object.entries(data)) {
            const ans = answers[id];
            if (ans === correctAnswer) {
              correct.push(user);
            } else {
              incorrect.push(user);
            }
          }
        }
      });
      setCorrectUser(correct);
      setIncorrectUser(incorrect);
    }
  }, [data]);

  const spec = {
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

  return (
    <Container p={10} sx={{ boxShadow: '1px 2px 2px 3px lightgrey;', borderRadius: '5px' }}>
      <Group>
        <Box>
          {/* <CorrectVis correct={correctUser} incorrect={incorrectUser} trialName={trialName} /> */}
          {correctUser.length === 0 && incorrectUser.length === 0
            ? <Title order={4}> No correct answer for this question</Title>
            : <VegaLite spec={spec} actions={false} />}

        </Box>
        <Box />

      </Group>

    </Container>
  );
}
