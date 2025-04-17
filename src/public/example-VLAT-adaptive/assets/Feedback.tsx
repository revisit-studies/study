import {
  Group, Text, Title, Center, Card, ColorSwatch,
} from '@mantine/core';
import { StimulusParams } from '../../../store/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function Feedback({ answers }: StimulusParams<any>) {
  const taskid = 'vlatResp';
  const images = import.meta.glob('../assets/vlatImg/*.png', { eager: true });
  const imgMap: Record<string, string> = {};

  for (const path in images) {
    if (path) {
      const fileName = path.split('/').pop()?.replace('.png', '') || '';
      const mod = images[path] as { default: string };
      imgMap[fileName] = mod.default;
    }
  }

  const topAnswer = Object.entries(answers)
    .filter(([key, _]) => key.startsWith('dynamicBlock'))
    .filter(([_, value]) => value.endTime > -1);

  const score = +topAnswer[topAnswer.length - 1][1].answer.score;
  let correctNum = 0;
  const correctRecord = topAnswer.map((item) => {
    const ans = item[1].answer[taskid];
    const correctAns = item[1].correctAnswer[0].answer;
    if (ans === correctAns) correctNum += 1;
    return ans === correctAns;
  });

  // console.log(topAnswer, 'topAnswer');

  return (
    <>
      <Center>
        <Title>
          Your score is
          {+score.toFixed(2)}
        </Title>
      </Center>
      <Center>
        <Card w={600}>
          <Title order={4} mb={20}>
            You got
            {' '}
            {correctNum}
            {' '}
            correct out of
            {' '}
            {topAnswer.length}
            {' '}
            questions. Here is your record:
          </Title>
          <Group>
            {correctRecord.map((c, idx) => (
              <ColorSwatch key={`circle${idx}`} color={c ? 'green' : 'red'} />
            ))}
          </Group>
          <Text mt={20} size="sm" c="grey">*This score is based on an adaptive testing methodology and cannot be mapped to 0-1 or 0-100. Instead, it can be used to compare runs between yourself or with other peoples’ scores.</Text>
        </Card>
      </Center>

    </>
  );
}
