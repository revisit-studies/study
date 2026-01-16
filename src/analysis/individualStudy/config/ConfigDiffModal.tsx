import {
  Badge, Box, Flex, Group, Paper, Stack, Text,
} from '@mantine/core';
import { diffLines, Change } from 'diff';
import { ConfigInfo } from './utils';

export function ConfigDiffModal({ configs }: { configs: ConfigInfo[] }) {
  if (configs.length !== 2) {
    return null;
  }

  const [config1, config2] = configs;

  const json1 = JSON.stringify(config1.config, null, 2);
  const json2 = JSON.stringify(config2.config, null, 2);

  const differences = diffLines(json1, json2);

  return (
    <Stack gap="md">
      <Flex justify="space-between" px="xs">
        <Group gap="sm">
          <Badge variant="light" color="red">{config1.version}</Badge>
          <Text size="sm" c="dimmed">
            (
            {config1.participantCount}
            {' '}
            participants)
          </Text>
        </Group>
        <Group gap="sm">
          <Badge variant="light" color="green">{config2.version}</Badge>
          <Text size="sm" c="dimmed">
            (
            {config2.participantCount}
            {' '}
            participants)
          </Text>
        </Group>
      </Flex>
      <Paper radius="sm" style={{ overflow: 'hidden' }}>
        <Box style={{ fontFamily: 'monospace', fontSize: '13px' }}>
          {differences.flatMap((part: Change, idx: number) => {
            const lines = part.value.split('\n').filter((line, i, arr) => i < arr.length - 1 || line !== '');

            return lines.map((line, lineIdx) => {
              let bgColor = 'transparent';
              let borderColor = 'transparent';
              let textColor = 'inherit';
              let prefix = '  ';

              if (part.removed) {
                bgColor = '#ffe5e5';
                borderColor = '#ff6b6b';
                textColor = '#c92a2a';
                prefix = '- ';
              } else if (part.added) {
                bgColor = '#e6fcf5';
                borderColor = '#51cf66';
                textColor = '#2b8a3e';
                prefix = '+ ';
              }

              return (
                <Box
                  key={`${idx}-${lineIdx}`}
                  style={{
                    backgroundColor: bgColor,
                    color: textColor,
                    padding: '4px 12px',
                    borderLeft: `3px solid ${borderColor}`,
                    whiteSpace: 'pre',
                    fontWeight: part.removed || part.added ? 500 : 400,
                  }}
                >
                  <Text component="span" ff="monospace" size="sm">
                    {prefix}
                    {line}
                  </Text>
                </Box>
              );
            });
          })}
        </Box>
      </Paper>
    </Stack>
  );
}
