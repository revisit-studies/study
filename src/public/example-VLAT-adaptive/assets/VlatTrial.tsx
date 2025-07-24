import { useEffect, useState } from 'react';
import {
  Grid, Radio, Image, Box, Stack,
} from '@mantine/core';
import { StimulusParams } from '../../../store/types';
import { VLATQuestions } from './vlatQ';

export default function VlatTrial({ parameters, setAnswer, answers }: StimulusParams<{ activeQuestionIdx: number, qidx: number, score: number }>) {
  const taskid = 'vlatResp';
  const userAnswer = answers[`dynamicBlock_1_VlatTrial_${parameters.qidx}`].answer[taskid];
  const [currentanswer, setCurrentAnswer] = useState<string>(userAnswer ? userAnswer as string : '');
  const activeQuestion = VLATQuestions.filter((q) => q.originID === parameters.activeQuestionIdx)[0];
  const [answerChecked, setAnswerChecked] = useState(false);
  const images = import.meta.glob('../assets/vlatImg/*.png', { eager: true });
  const imgMap: Record<string, string> = {};

  useEffect(() => {
    const hasIncrrectAnswer = Object.keys(answers[`dynamicBlock_1_VlatTrial_${parameters.qidx}`].incorrectAnswers).length > 0;
    setAnswerChecked(hasIncrrectAnswer);
  }, [answers]);

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
        <Grid.Col span={4} pt={20}>
          <Radio.Group
            name="question"
            label={activeQuestion.question}
            value={`${currentanswer}`}
            size="md"
          >
            <Stack mt={30}>
              {
                    activeQuestion.options.map((op:string, idx:number) => (
                      <Radio
                        disabled={userAnswer !== undefined || answerChecked}
                        value={`${String.fromCharCode(65 + idx)}`}
                        label={`${String.fromCharCode(65 + idx)}. ${op}`}
                        key={`op${idx}`}
                        onClick={() => setCurrentAnswer(String.fromCharCode(65 + idx))}
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
