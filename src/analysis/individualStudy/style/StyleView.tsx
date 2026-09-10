import {
  Group, Paper, Radio, Stack, Switch, Text, Title,
} from '@mantine/core';
import { IconMoon, IconSun } from '@tabler/icons-react';
import { useState } from 'react';
import { useStoredStudyColorMode } from '../../../store/hooks/useStoredStudyColorMode';
import { useStoredStudyStyle } from '../../../store/hooks/useStoredStudyStyle';

const styleOptions = [
  {
    value: 'default',
    name: 'Default',
    description: 'The standard ReVISit layout.',
  },
  {
    value: 'formLayout',
    name: 'Form Layout',
    description: 'A compact layout with an 800px content area and smaller headings.',
  },
  {
    value: 'placeholder3',
    name: 'Style 3',
    description: 'An additional style will be available here.',
    disabled: true,
  },
  {
    value: 'placeholder4',
    name: 'Style 4',
    description: 'An additional style will be available here.',
    disabled: true,
  },
];

export function StyleView({ studyId }: { studyId: string }) {
  const { studyColorMode, updateStudyColorMode } = useStoredStudyColorMode(studyId);
  const [isSavingColorMode, setIsSavingColorMode] = useState(false);
  const {
    studyStyle, updateStudyStyle, isSaving: isSavingStyle, error: styleError,
  } = useStoredStudyStyle(studyId);

  const handleColorSchemeChange = async (darkModeEnabled: boolean) => {
    setIsSavingColorMode(true);
    try {
      await updateStudyColorMode(darkModeEnabled ? 'dark' : 'light');
    } catch (error) {
      console.error('Failed to save study color mode:', error);
    } finally {
      setIsSavingColorMode(false);
    }
  };

  return (
    <Stack gap="lg" w="60%" mx="auto">
      <Paper p="md" radius="md" withBorder>
        <Group justify="space-between" align="center" wrap="nowrap">
          <Title order={5}>Color Mode</Title>
          <Switch
            size="md"
            aria-label="Dark mode"
            checked={studyColorMode === 'dark'}
            disabled={studyColorMode === null || isSavingColorMode}
            onChange={(event) => { handleColorSchemeChange(event.currentTarget.checked); }}
            onLabel={<IconMoon size={14} />}
            offLabel={<IconSun size={14} />}
          />
        </Group>
      </Paper>
      <Radio.Group
        aria-label="Study style"
        value={studyStyle ?? ''}
        onChange={(value) => {
          if (value === 'default' || value === 'formLayout') updateStudyStyle(value);
        }}
      >
        <Stack gap="md">
          {styleOptions.map((option) => (
            <Paper key={option.value} p="md" radius="md" withBorder opacity={option.disabled ? 0.5 : 1}>
              <Group justify="space-between" align="center" wrap="nowrap">
                <Title order={5}>{option.name}</Title>
                <Radio
                  value={option.value}
                  aria-label={option.name}
                  disabled={option.disabled || studyStyle === null || isSavingStyle}
                />
              </Group>
              <Text size="sm" c="dimmed" mt={4}>{option.description}</Text>
            </Paper>
          ))}
        </Stack>
      </Radio.Group>
      {styleError && <Text role="alert" c="red" size="sm">{styleError}</Text>}
    </Stack>
  );
}
