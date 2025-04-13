import { useEffect, useState } from 'react';
import {
  Grid, Radio, Image,
} from '@mantine/core';
import { StimulusParams } from '../../../store/types';
import { VLATQuestions } from './vlatQ';

export default function VlatTrial({ parameters, setAnswer }: StimulusParams<{ activeQuestionIdx: number }>) {
  // console.log(parameters.activeQuestionIdx, 'q idx');
  const [currentanswer, setCurrentAnswer] = useState<number>(-1);
  const activeQuestion = VLATQuestions[parameters.activeQuestionIdx];
  const images = import.meta.glob('../assets/vlatImg/*.png', { eager: true });
  const imgMap: Record<string, string> = {};
  const taskid = 'vlatResp';

  useEffect(() => {
    setAnswer({
      status: true,
      answers: {
        [taskid]: String.fromCharCode(65 + currentanswer),
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
    <Grid>
      <Grid.Col md={8} sm={12}>
        <Image
          radius="sm"
          src={imgMap[activeQuestion.img]}
          alt="VIS"
          w={600}
        />
      </Grid.Col>
      <Grid.Col md={4} sm={12}>
        <div style={{ textAlign: 'left', paddingLeft: '20px', display: 'inline-block' }}>
          <Radio.Group
            name="question"
            orientation="vertical"
            label={activeQuestion.question}
            value={`${currentanswer}`}
            size="md"
          >
            {
                            activeQuestion.options.map((op:string, idx:number) => (
                              <Radio
                                value={`${idx}`}
                                label={`${String.fromCharCode(65 + idx)}.${op}`}
                                key={`op${idx}`}
                                onClick={() => setCurrentAnswer(idx)}
                              />
                            ))
                        }
          </Radio.Group>

        </div>

      </Grid.Col>
    </Grid>
  );
}
