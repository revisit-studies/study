import {
  ActionIcon,
  Aside,
  Flex,
  Paper,
  ScrollArea,
  Space,
  Text,
} from '@mantine/core';
import { IconArrowRight } from '@tabler/icons-react';
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ContainerComponent, IndividualComponent } from '../../parser/types';
import { useCurrentStep } from '../../routes';
import { useAppSelector } from '../../store';
import { useFlagsSelector } from '../../store/flags';
import { DownloadPanel } from '../DownloadPanel';
import { StepsPanel } from './StepsPanel';

export default function AppAside() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const showAdmin = useFlagsSelector((state: any) => state.showAdmin);
  const navigate = useNavigate();

  const step = useCurrentStep();
  const config = useAppSelector(
    (state) => state.unTrrackedSlice.config?.components[step]
  );
  const trialConfig = config as ContainerComponent;
  const tasks =
    trialConfig?.type === 'container'
      ? (trialConfig.order as string[]).map((trialId) => ({
          ...trialConfig.components[trialId] as IndividualComponent,
          id: trialId,
        }))
      : [];

  const { studyId = null } = useParams<{
    studyId: string;
  }>();

  return showAdmin ? (
    <Aside p="md" width={{ base: 300 }} style={{ zIndex: 0 }}>
      <StepsPanel />

      <Space h="md" />

      {step === 'end' && <DownloadPanel />}

      <Aside.Section grow component={ScrollArea} mx="-xs" px="xs">
        {tasks.map((task, index, isCorrect) => (
          <React.Fragment key={`admin_${task.id}`}>
            <Paper radius={0} p={0} withBorder>
              <Paper bg={isCorrect ? 'blue.0' : 'red.0'} radius={0} p="xl">
                <Flex style={{ justifyContent: 'space-between'}}>
                  <Text c="gray.9">
                    <Text
                      span
                      c={isCorrect ? 'blue.8' : 'orange.8'}
                      fw={700}
                      inherit
                    >
                      Task {index + 1}:
                    </Text>{' '}
                    {task.id}
                  </Text>
                  <Space></Space>
                  <ActionIcon
                    bg="white"
                    onClick={() =>
                      navigate(`/${studyId}/${step}/${task.id}`)
                    }
                  >
                    <IconArrowRight size="1.125rem" />
                  </ActionIcon>
                </Flex>
              </Paper>

              <Paper radius={0} p="xl">
                {task.description && (
                  <Text fw={900}>
                    Description:{' '}
                    <Text fw={400} component="span">
                      {task.description}
                    </Text>
                  </Text>
                )}
                {task.meta && <Text fw={900}>Task Meta:</Text>}
                {task.meta &&
                  Object.keys(task.meta).map((key) => {
                    return (
                      <Text key={key}>
                        {key}: {(task.meta as any)[key]}
                      </Text>
                    );
                  })}
              </Paper>
            </Paper>

            <Space h="md" />
          </React.Fragment>
        ))}
      </Aside.Section>
    </Aside>
  ) : null;
}
