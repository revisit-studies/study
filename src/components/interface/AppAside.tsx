import { ActionIcon, Aside, Flex, Paper, Space, Text } from '@mantine/core';
import { StepsPanel } from '../../admin/StepsPanel';
import { useFlagsSelector } from '../../store/flags';
import { IconArrowRight } from '@tabler/icons-react';

export default function AppAside() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const showAdmin = useFlagsSelector((state: any) => state.showAdmin);

  return showAdmin ? (
    <Aside p="md" width={{ lg: 300 }} style={{ zIndex: 0 }}>
      <StepsPanel />

      <Space h="md" />

      {[true, false].map((isCorrect) => 
      <>
        <Paper radius={0} p={0} withBorder>
          <Paper bg={isCorrect ? 'blue.0' : 'red.0'} radius={0} p="xl">
            <Flex>
              <Text c="gray.9"><Text span c={isCorrect ? 'blue.8' : 'orange.8'} fw={700} inherit>Task 8:</Text> Task Instructions</Text>
              <ActionIcon bg="white">
                <IconArrowRight size="1.125rem" />
              </ActionIcon>
            </Flex>
          </Paper>

          <Paper radius={0} p="xl">
            <Text>Test</Text>
          </Paper>
        </Paper>

        <Space h="md" />
      </>
      )}
    </Aside>
  ) : null;
}
