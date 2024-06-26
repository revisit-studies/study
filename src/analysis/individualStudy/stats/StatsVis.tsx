import {
  Box, Button, Center, Flex, Group, Paper, ScrollArea, Select, Stack, Title,
} from '@mantine/core';
import { useCallback, useEffect, useState } from 'react';
import { IconArrowDown, IconArrowLeft } from '@tabler/icons-react';
import { StoredAnswer } from '../../../store/types';
import InfoPanel from './InfoPanel';
import AnswerPanel from './AnswerPanel';
import { ParticipantData } from '../../../storage/types';
import { StudyConfig, IndividualComponent, InheritedComponent } from '../../../parser/types';
import { getSequenceFlatMap } from '../../../utils/getSequenceFlatMap';

export default function StatsVis({ config, data }: { data: ParticipantData[], config: StudyConfig }) {
  const [sequence, setSequence] = useState<string[]>([]);
  const [participantsList, setParticipantsList] = useState<string[]>(['All']);
  const [activeParticipant, setActiveParticipant] = useState<string | null>(null);
  const [activeTrial, setActiveTrial] = useState<string>('');
  const [activeAnswers, setActiveAnswers] = useState<Record<string, StoredAnswer>>({});
  const [activeConfig, setActiveConfig] = useState< IndividualComponent | InheritedComponent>();

  const getAllTrials = useCallback(() => {
    const allTrials = new Set();
    data.forEach((d) => {
      const trials = getSequenceFlatMap(d.sequence);
      trials.forEach((trial) => allTrials.add(trial));
    });
    return Array.from(allTrials);
  }, [data]);

  const oneActiveParticipantChange = useCallback((value: string | null, option: unknown) => {
    setActiveParticipant(value);
    if (value === 'All') setSequence(getAllTrials() as string[]);
    else setSequence(getSequenceFlatMap(data.filter((d) => d.participantId === value)[0].sequence));
  }, [data, getAllTrials]);

  useEffect(() => {
    setParticipantsList(['All', ...data.map((d) => d.participantId)]);
    if (activeTrial.length > 0) {
      const activeanswers:Record<string, StoredAnswer> = {};

      // get answers
      data.forEach((d) => {
        Object.entries(d.answers).forEach(([key, value]) => {
          const trialName = key.split('_').slice(0, -1).join('_');
          if (trialName === activeTrial) {
            activeanswers[d.participantId] = value;
          }
        });
      });
      setActiveAnswers(activeanswers);

      // get config
      const trialConfig = config.components[activeTrial];
      setActiveConfig(trialConfig);
    }
    if (data.length > 0) oneActiveParticipantChange('All', undefined);
  }, [activeTrial, config.components, data, oneActiveParticipantChange]);

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
    <Flex>
      <Box pr={5} style={{ boxShadow: '3px 0 0 0 orange' }}>
        <Center><Title order={4}>Trials</Title></Center>
        <ScrollArea.Autosize mah={600} mih={500} maw={200} mx="auto">
          <Select data={participantsList} defaultValue="All" onChange={oneActiveParticipantChange} />
          {activeParticipant === 'All' && (
            <Group mt={20}>
              {sequence.map((trial, idx) => <Button key={`btn-trial-${idx}`} variant={activeTrial === `${trial}` ? 'filled' : 'outline'} onClick={() => onTrialClick(trial)}>{`${trial}`}</Button>) }
            </Group>
          )}

          {activeParticipant !== 'All' && (
            <Stack mt={20} gap="xs" align="center">
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
            <AnswerPanel config={activeConfig} data={extractAnswers()} />
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
  );
}
