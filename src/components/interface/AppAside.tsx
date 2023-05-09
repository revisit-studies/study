import { ActionIcon, Aside, Flex, Paper, ScrollArea, Space, Text } from '@mantine/core';
import { StepsPanel } from './StepsPanel';
import { useFlagsSelector } from '../../store/flags';
import { IconArrowRight } from '@tabler/icons-react';
import { useCurrentStep } from '../../routes';
import { useAppSelector } from '../../store';
import { TrialsComponent } from '../../parser/types';
import { useNavigateWithParams } from '../../utils/useNavigateWithParams';
import React from 'react';
import { useParams } from 'react-router-dom';

export default function AppAside() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const showAdmin = useFlagsSelector((state: any) => state.showAdmin);
  const navigateWithParams = useNavigateWithParams();

  const step = useCurrentStep();
  const config = useAppSelector((state) => state.study.config?.components[step]);
  const trialConfig = config as TrialsComponent;
  const tasks = trialConfig?.type === 'practice' || trialConfig?.type === 'trials' ? trialConfig.order.map((trialId) => ({...trialConfig.trials[trialId], id: trialId
  })) : [];

  const { studyId = null } = useParams<{
    studyId: string;
  }>();
  
  return showAdmin ? (
    <Aside p="md" width={{ lg: 300 }} style={{ zIndex: 0 }}>
      <StepsPanel />

      <Space h="md" />

      <Aside.Section grow component={ScrollArea} mx="-xs" px="xs">
      {tasks.map((task, index, isCorrect) => 
      <React.Fragment key={`admin_${task.id}`}>
        <Paper radius={0} p={0} withBorder>
          <Paper bg={isCorrect ? 'blue.0' : 'red.0'} radius={0} p="xl">
            <Flex>
              <Text c="gray.9"><Text span c={isCorrect ? 'blue.8' : 'orange.8'} fw={700} inherit>Task {index + 1}:</Text> {task.instruction}</Text>
              <ActionIcon bg="white" onClick={() => navigateWithParams(`/${studyId}/${step}/${task.id}`)}>
                <IconArrowRight size="1.125rem" />
              </ActionIcon>
            </Flex>
          </Paper>

        <Paper radius={0} p="xl">
            {task.meta && <Text fw={900}>Task Meta:</Text>}
            {task.meta && Object.keys(task.meta).map((key)=>{
                return <Text>{key}: {(task.meta as any)[key]}</Text>;
            })}
        </Paper>

        </Paper>

        <Space h="md" />
      </React.Fragment>
      )}
      </Aside.Section>
    </Aside>
  ) : null;
}
