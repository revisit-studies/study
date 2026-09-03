import {
  Group, Paper, Stack, Switch, Text, Title,
} from '@mantine/core';
import { IconMoon, IconSun } from '@tabler/icons-react';

const styleOptions = [
  {
    name: 'Default',
    description: 'A placeholder description for the default style.',
  },
  {
    name: 'A...',
    description: 'A placeholder description for the A style.',
  },
  {
    name: 'B...',
    description: 'A placeholder description for the B style.',
  },
];

export function StyleView({ studyId }: { studyId: string }) {
  return (
    <Stack
      gap="lg"
      w="60%"
      mx="auto"
      data-study-id={studyId}
    >
      <Stack gap="md">
        {styleOptions.map((option) => (
          <Paper key={option.name} p="md" radius="md" withBorder>
            <Group justify="space-between" align="center" wrap="nowrap">
              <Title order={5}>{option.name}</Title>
              {option.name === 'Default' && (
                <Switch
                  size="md"
                  onLabel={<IconSun size={14} />}
                  offLabel={<IconMoon size={14} />}
                />
              )}
            </Group>
            <Text size="sm" c="dimmed" mt={4}>
              {option.description}
            </Text>
          </Paper>
        ))}
      </Stack>
    </Stack>
  );
}
