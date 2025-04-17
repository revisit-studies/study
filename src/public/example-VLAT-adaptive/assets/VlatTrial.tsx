import { useEffect, useState } from 'react';
import {
  Grid, Radio, Image, Box, Stack,
} from '@mantine/core';
import { StimulusParams } from '../../../store/types';
import { VLATQuestions } from './vlatQ';

export default function VlatTrial({ parameters, setAnswer, answers }: StimulusParams<{ activeQuestionIdx: number, qidx: number, score: number }>) {
  const taskid = 'vlatResp';
  const userAnswer = answers[`dynamicBlock_2_VlatTrial_${parameters.qidx}`].answer[taskid];
  const [currentanswer, setCurrentAnswer] = useState<number>(userAnswer ? +userAnswer : -1);
  const activeQuestion = VLATQuestions.filter((q) => q.originID === parameters.activeQuestionIdx)[0];
  const images = import.meta.glob('../assets/vlatImg/*.png', { eager: true });
  const imgMap: Record<string, string> = {};

  useEffect(() => {
    setAnswer({
      status: true,
      answers: {
        [taskid]: currentanswer,
        score: parameters.score,
      },
    });
  }, [currentanswer]);

  for (const path in images) {
    if (path) {
      const fileName = path.split('/').pop()?.replace('.png', '') || '';
      const mod = images[path] as { default: string };
      imgMap[fileName] = mod.default;
    }
  }

  return (
    <Box>
      <Grid>
        <Grid.Col span={8}>
          <Image
            radius="sm"
            src={imgMap[activeQuestion.img]}
            alt="VIS"
            w="100%"
            maw={900}
          />
        </Grid.Col>
        <Grid.Col span={4}>
          <Radio.Group
            name="question"
            label={activeQuestion.question}
            value={`${currentanswer}`}
            size="md"
          >
            <Stack mt={20}>
              {
                    activeQuestion.options.map((op:string, idx:number) => (
                      <Radio
                        disabled={userAnswer !== undefined}
                        value={`${idx}`}
                        label={`${String.fromCharCode(65 + idx)}. ${op}`}
                        key={`op${idx}`}
                        onClick={() => setCurrentAnswer(idx)}
                      />
                    ))
                  }
            </Stack>

          </Radio.Group>
        </Grid.Col>
      </Grid>
    </Box>
  );
}
