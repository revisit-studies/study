import {
  Box, Button, Center, Flex, Group, Paper, ScrollArea, Select, Stack, Title,
} from '@mantine/core';
import { useEffect, useState } from 'react';
import { IconArrowDown, IconArrowLeft } from '@tabler/icons-react';
import { StoredAnswer } from '../../store/types';
// import { PREFIX } from '../../components/GlobalConfigParser';
import InfoPanel from './components/InfoPanel';
import AnswerPanel from './components/AnswerPanel';
import { ParticipantData } from '../../storage/types';
import { StudyConfig, IndividualComponent, InheritedComponent } from '../../parser/types';
import { extractTrialName, flattenSequence } from '../utils';

export default function StatsVis(props: { data: ParticipantData[], config: StudyConfig;}) {
  const { config, data } = props;
  const [sequence, setSequence] = useState<string[]>([]);
  const [participantsList, setParticipantsList] = useState<string[]>(['All']);
  const [activeParticipant, setActiveParticipant] = useState<string | null>(null);
  const [activeTrial, setActiveTrial] = useState<string>('');
  const [activeAnswers, setActiveAnswers] = useState<Record<string, StoredAnswer>>({});
  const [activeConfig, setActiveConfig] = useState< IndividualComponent | InheritedComponent>();

  const getAllTrials = () => {
    const allTrials = new Set();
    data.forEach((d) => {
      const trials = flattenSequence(d.sequence).map((trial) => extractTrialName(trial));
      trials.forEach((trial) => allTrials.add(trial));
    });
    return Array.from(allTrials);
  };

  const oneActiveParticipantChange = (value: string) => {
    setActiveParticipant(value);
    if (value === 'All') setSequence(getAllTrials() as string[]);
    else setSequence(flattenSequence(data.filter((d) => d.participantId === value)[0].sequence));
  };

  useEffect(() => {
    setParticipantsList(['All', ...data.map((d) => d.participantId)]);
    if (activeTrial.length > 0) {
      const activeanswers:Record<string, StoredAnswer> = {};

      // get answers
      data.forEach((d) => {
        Object.entries(d.answers).forEach(([key, value]) => {
          if (extractTrialName(key) === activeTrial) {
            activeanswers[d.participantId] = value;
          }
        });
      });
      setActiveAnswers(activeanswers);

      // get config
      const trialConfig = config.components[activeTrial];
      setActiveConfig(trialConfig);
    }
    if (data.length > 0) oneActiveParticipantChange('All');
  }, [activeTrial, data]);

  const extractAnswers = () => {
    const answers: Record<string, Record<string, unknown>> = {};
    // iterate activeAnswers
    for (const [key, value] of Object.entries(activeAnswers)) {
      answers[key] = value.answer;
    }
    return answers;
  };

  const onTrialClick = (trial: string) => {
    if (trial !== 'end') setActiveTrial(trial);
  };

  return (
    <Paper p={10} m={10} sx={{ boxShadow: '1px 2px 2px 3px lightgrey;', borderRadius: '5px' }}>
      <Flex>
        <Box pr={5} sx={{ boxShadow: '3px 0 0 0 orange' }}>
          <Center><Title order={4}>Trials</Title></Center>
          <ScrollArea.Autosize maxHeight={600} mih={500} maw={200} mx="auto">
            <Select data={participantsList} defaultValue="All" onChange={oneActiveParticipantChange} />
            {activeParticipant === 'All'
                  && (
                  <Group mt={20}>
                    {sequence.map((trial, idx) => <Button key={`btn-trial-${idx}`} variant={activeTrial === `${trial}` ? 'filled' : 'outline'} onClick={() => onTrialClick(trial)}>{`${trial}`}</Button>) }
                  </Group>
                  )}

            {activeParticipant !== 'All'
                  && (
                  <Stack mt={20} spacing="xs" align="center">
                    {sequence.map((trial, idx) => (
                      <>
                        <Button variant={activeTrial === `${trial}_${idx}` ? 'filled' : 'outline'}>{`${trial}_${idx}`}</Button>
                        <IconArrowDown size={15} />
                      </>
                    ))}
                  </Stack>
                  )}

          </ScrollArea.Autosize>
        </Box>

        { activeTrial.length > 0
          ? (
            <Stack align="flex-start" p={5}>
              <InfoPanel config={activeConfig} trialName={activeTrial} data={activeAnswers} />
              <AnswerPanel config={activeConfig} trialName={activeTrial} data={extractAnswers()} />
            </Stack>
          )
          : (
            <Center>
              <Title order={2} ml={10}>
                <IconArrowLeft size={30} />
                {' '}
                Please Select a trial to view the stats
              </Title>
            </Center>
          )}

      </Flex>

    </Paper>
  );
}
