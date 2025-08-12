import {
  Group, Text, Title, Grid, Card, ColorSwatch, Box, Center,
} from '@mantine/core';
import React, { useState } from 'react';
import { IconEyeglass2 } from '@tabler/icons-react';
import { StimulusParams } from '../../../store/types';
import FeedbackTrial from './FeedbackTrial';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function Feedback({ answers }: StimulusParams<any>) {
  const taskid = 'vlatResp';

  const topAnswer = Object.entries(answers)
    .filter(([key, _]) => key.startsWith('dynamicBlock'))
    .filter(([_, value]) => value.endTime > -1);

  const [currentCheck, setCurrentCheck] = useState<number>(0);

  const score = +topAnswer[topAnswer.length - 1][1].answer.score;
  let correctNum = 0;

  const openTrialCheck = (idx: number) => {
    setCurrentCheck(idx);
  };

  const replayRecord = topAnswer.map((item) => {
    const ans = item[1].answer[taskid];
    const correctAns = item[1].correctAnswer[0].answer;
    const activeQidx = item[1].parameters.activeQuestionIdx;
    const correct = ans === correctAns;
    if (correct) correctNum += 1;
    return {
      activeQidx,
      ans,
      correctAns,
      correct,
    };
  });

  return (
    <Grid maw={1800}>
      <Grid.Col span={{ base: 12, md: 12, lg: 4 }}>
        <Title order={2} ml={-50}>
          <Center>
            Your score is
            {' '}
            {+score.toFixed(2)}
          </Center>

        </Title>
        <Card>
          <Center>
            <Title order={4} mb={20}>
              You got
              {' '}
              {correctNum}
              {' '}
              correct out of
              {' '}
              {topAnswer.length}
              {' '}
              questions.
              <br />
              <Text c="grey">(Click each circle to check the question and your answer)</Text>
            </Title>
          </Center>
          <Group>
            {replayRecord.map((record, idx) => (
              <ColorSwatch style={{ cursor: 'pointer' }} key={`circle${idx}`} color={record.correct ? 'green' : 'red'} onClick={() => openTrialCheck(idx)}>
                {idx === currentCheck && <IconEyeglass2 size={12} />}
              </ColorSwatch>
            ))}
          </Group>
          <Center>
            <Text w="80%" mt={20} size="sm" c="grey">*This score is based on an adaptive testing methodology and cannot be mapped to 0-1 or 0-100. Instead, it can be used to compare runs between yourself or with other peoples’ scores.</Text>

          </Center>
        </Card>
      </Grid.Col>

      <Grid.Col span={{ base: 12, md: 12, lg: 8 }}>
        <Box w={1000}><FeedbackTrial activeQuestionIdx={replayRecord[currentCheck].activeQidx as number} userAnswer={replayRecord[currentCheck].ans as string} correctAnswer={replayRecord[currentCheck].correctAns} /></Box>
      </Grid.Col>
    </Grid>
  );
}
