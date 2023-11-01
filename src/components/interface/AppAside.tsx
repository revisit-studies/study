import {
  ActionIcon,
  Aside,
  Flex,
  Paper,
  ScrollArea,
  Space,
  Text
} from '@mantine/core';
import { useCurrentStep } from '../../routes';
import { useFlagsSelector } from '../../store/flags';
import { DownloadPanel } from '../DownloadPanel';
import { StepsPanel } from './StepsPanel';
import { useStudyConfig } from '../../store/hooks/useStudyConfig';
import { useAppDispatch, useAppSelector } from '../../store/store';
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { IconArrowRight } from '@tabler/icons-react';

export default function AppAside() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const showAdmin = useFlagsSelector((state: any) => state.showAdmin);
  const navigate = useNavigate();

  const step = useCurrentStep();

  const { studyId = null } = useParams<{
    studyId: string;
  }>();

  const studyConfig = useStudyConfig();

  const taskList = useAppSelector((state) => state.trrackedSlice.order);

  const tasks = taskList.map((task) => ({...studyConfig.components[task], id: task}));

  return showAdmin ? (
    <Aside p="md" width={{ base: 300 }} style={{ zIndex: 0 }}>
      <StepsPanel order={studyConfig.sequence} />

      <Space h="md" />

      {step === 'end' && <DownloadPanel />}
      
      <Aside.Section grow component={ScrollArea} mx="-xs" px="xs" my="lg">
        {tasks.map((task, index) => (
          <React.Fragment key={`admin_${task.id}`}>
            <Paper radius={0} p={0} withBorder>
              <Paper radius={0} p="xl">
                <Flex style={{ justifyContent: 'space-between'}}>
                  <Text c="gray.9">
                    <Text
                      span
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
                      navigate(`/${studyId}/${task.id}`)
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
