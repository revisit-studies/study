import {
  ActionIcon,
  Aside,
  Flex,
  Paper,
  ScrollArea,
  Space,
  Text,
} from '@mantine/core';
import { DownloadPanel } from '../DownloadPanel';
import { StepsPanel } from './StepsPanel';
import { useStudyConfig } from '../../store/hooks/useStudyConfig';
import { useStoreSelector } from '../../store/store';
import React, { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { IconArrowRight } from '@tabler/icons-react';
import { useCurrentStep } from '../../routes';

export default function AppAside() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const showAdmin = useStoreSelector((state: any) => state.unTrrackedSlice.showAdmin);
  const navigate = useNavigate();

  const { studyId = null } = useParams<{
    studyId: string;
  }>();

  const currentStep = useCurrentStep();
  const studyConfig = useStudyConfig();

  const taskList = useStoreSelector((state) => state.trrackedSlice.sequence);

  const tasks = taskList.map((task) => ({
    ...studyConfig.components[task],
    id: task,
  }));

  return showAdmin ? (
    <Aside p="0" width={{ base: 300 }} style={{ zIndex: 0 }}>
      <ScrollArea p="0">
        <Aside.Section grow component={ScrollArea} px="xs" my="lg">
          <StepsPanel order={studyConfig.sequence} />
        </Aside.Section>

        <Aside.Section grow component={ScrollArea} px="xs" my="lg">
          {currentStep === 'end' && <DownloadPanel studyConfig={studyConfig} />}
        </Aside.Section>

        <Aside.Section grow component={ScrollArea} px="xs" my="lg">
          {tasks.map((task, index) => (
            <React.Fragment key={`admin_${task.id}`}>
              <Paper radius={0} p={0} withBorder>
                <Paper radius={0} p="xl">
                  <Flex style={{ justifyContent: 'space-between' }}>
                    <Text c="gray.9">
                      <Text span fw={700} inherit>
                        Task {index + 1}:
                      </Text>{' '}
                      {task.id}
                    </Text>
                    <Space></Space>
                    <ActionIcon
                      bg="white"
                      onClick={() => navigate(`/${studyId}/${task.id}`)}
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
                          {key}: {(task.meta as Record<string, ReactNode>)[key]}
                        </Text>
                      );
                    })}
                </Paper>
              </Paper>

              <Space h="md" />
            </React.Fragment>
          ))}
        </Aside.Section>
      </ScrollArea>
    </Aside>
  ) : null;
}
