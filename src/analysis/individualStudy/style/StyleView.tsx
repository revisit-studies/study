import {
  ColorSwatch, Group, Paper, Stack, Switch, Text, Title,
} from '@mantine/core';
import { IconMoon, IconSun } from '@tabler/icons-react';

const styleOptions = [
  {
    name: 'Default',
    description: 'The standard ReVISit appearance for participant-facing study content.',
    colors: ['#228BE6', '#15AABF', '#40C057', '#F59F00'],
  },
  {
    name: 'G...',
    description: 'An additional style preset will be available here.',
    colors: ['#7950F2', '#BE4BDB', '#FA5252', '#FD7E14'],
  },
  {
    name: 'Q...',
    description: 'An additional style preset will be available here.',
    colors: ['#7950F2', '#BE4BDB', '#FA5252', '#FD7E14'],
  },
];

export function StyleView({ studyId }: { studyId: string }) {
  return (
    <Stack gap="lg" w="60%" mx="auto" aria-label={`Style settings for ${studyId}`}>
      <Paper shadow="sm" p="lg" radius="md" withBorder>
        <Title order={4} mb="sm">Style</Title>
        <Text mb="lg">
          Style settings let you control the appearance of your study, including colors, fonts, and layout. You can customize these settings to match your branding or personal preferences.
        </Text>

        <Switch
          mb="lg"
          size="md"
          label="Light / dark mode"
          onLabel={<IconSun size={14} />}
          offLabel={<IconMoon size={14} />}
        />

        <Stack gap="md">
          {styleOptions.map((option) => (
            <Paper key={option.name} p="md" radius="md" withBorder>
              <Title order={5} mb={4}>{option.name}</Title>
              <Text size="sm" c="dimmed">{option.description}</Text>
              <Group gap="xs" mt="md">
                {option.colors.map((color) => (
                  <ColorSwatch key={color} color={color} size={24} />
                ))}
              </Group>
            </Paper>
          ))}
        </Stack>
      </Paper>
    </Stack>
  );
}
