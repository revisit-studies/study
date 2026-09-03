import {
  Group, Paper, Stack, Switch, Text, Title,
} from '@mantine/core';
import { IconMoon, IconSun } from '@tabler/icons-react';
import { useState } from 'react';
import { useStoredStudyColorMode } from '../../../store/hooks/useStoredStudyColorMode';

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
  const { studyColorMode, updateStudyColorMode } = useStoredStudyColorMode(studyId);
  const [isSaving, setIsSaving] = useState(false);
  const isLoading = studyColorMode === null;

  const handleColorSchemeChange = async (darkModeEnabled: boolean) => {
    setIsSaving(true);
    try {
      await updateStudyColorMode(darkModeEnabled ? 'dark' : 'light');
    } catch (error) {
      console.error('Failed to save study color mode:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Stack
      gap="lg"
      w="60%"
      mx="auto"
    >
      <Stack gap="md">
        {styleOptions.map((option) => (
          <Paper key={option.name} p="md" radius="md" withBorder>
            <Group justify="space-between" align="center" wrap="nowrap">
              <Title order={5}>{option.name}</Title>
              {option.name === 'Default' && (
                <Switch
                  size="md"
                  checked={studyColorMode === 'dark'}
                  disabled={isLoading || isSaving}
                  onChange={(event) => { handleColorSchemeChange(event.currentTarget.checked); }}
                  onLabel={<IconMoon size={14} />}
                  offLabel={<IconSun size={14} />}
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
