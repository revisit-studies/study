import {
  Box, Button, Center, Group, Paper, ScrollArea, Stack, Title,
} from '@mantine/core';
import { useEffect, useState } from 'react';
import { IconArrowDown } from '@tabler/icons-react';
import { StoredAnswer } from '../../store/types';
// import { PREFIX } from '../../components/GlobalConfigParser';
import InfoPanel from './components/InfoPanel';
import AnswerPanel from './components/AnswerPanel';
import { ParticipantData } from '../../storage/types';
import { StudyConfig } from '../../parser/types';
import { flattenSequence } from '../utils';

export default function StatsVis(props: { data: ParticipantData[], config: StudyConfig;}) {
  const { config, data } = props;
  // console.log(data, 'dataaa');
  // console.log(config, 'configg');
  const [sequence, setSequence] = useState<string[]>(flattenSequence(data[0].sequence));
  const [activeTrial, setActiveTrial] = useState<string>('');
  const [activeAnswers, setActiveAnswers] = useState<Record<string, StoredAnswer>>({});

  useEffect(() => {
    if (activeTrial.length > 0) {
      const activeA:Record<string, StoredAnswer> = {};
      data.forEach((d) => {
        activeA[d.participantId] = d.answers[activeTrial];
      });
      setActiveAnswers(activeA);
    }
  }, [activeTrial, data]);

  useEffect(() => {
    if (data.length > 0) setSequence(flattenSequence(data[0].sequence));
  }, [data]);

  const extractAnswers = () => {
    const answers: Record<string, Record<string, unknown>> = {};
    // iterate activeAnsers
    for (const [key, value] of Object.entries(activeAnswers)) {
      answers[key] = value.answer;
    }
    return answers;
  };

  return (
    <Paper p={10} m={10} sx={{ boxShadow: '1px 2px 2px 3px lightgrey;', borderRadius: '5px' }}>
      <Group>
        <Box pr={5} sx={{ boxShadow: '3px 0 0 0 orange' }}>
          <Center><Title order={4}>Trials</Title></Center>
          <ScrollArea.Autosize maxHeight={600} mih={500} maw={200} mx="auto">
            <Stack mt={10} spacing="xs" align="center">
              {
                                sequence.map((trial, idx) => (idx === sequence.length - 1
                                  ? <Button key={`btnSelectTrial-${idx}`} variant={activeTrial === trial ? 'filled' : 'outline'}>{`${trial}_${idx}`}</Button>
                                  : (
                                    <>
                                      <Button variant={activeTrial === `${trial}_${idx}` ? 'filled' : 'outline'} onClick={() => setActiveTrial(`${trial}_${idx}`)}>{`${trial}_${idx}`}</Button>
                                      <IconArrowDown size={15} />
                                    </>
                                  )))
                            }
            </Stack>
          </ScrollArea.Autosize>
        </Box>

        <Stack align="flex-start" p={5}>
          <InfoPanel trialName={activeTrial} data={activeAnswers} />
          <AnswerPanel trialName={activeTrial} data={extractAnswers()} />

        </Stack>

      </Group>

    </Paper>
  );
}
