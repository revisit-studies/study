import {
  Badge, Flex, Group, Text,
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
    <Flex direction="column">
      <Flex justify="space-between">
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
      <div style={{ fontFamily: 'monospace', fontSize: '13px' }}>
        {differences.map((part: Change, idx: number) => {
          const lines = part.value.split('\n').filter((line, i, arr) => i < arr.length - 1 || line !== '');

          return lines.map((line, lineIdx) => {
            let bgColor = 'transparent';
            let borderColor = 'transparent';
            let prefix = ' ';

            if (part.removed) {
              bgColor = '#f8d7da';
              borderColor = '#dc3545';
              prefix = '-';
            } else if (part.added) {
              bgColor = '#d4edda';
              borderColor = '#28a745';
              prefix = '+';
            }

            return (
              <div
                key={`${idx}-${lineIdx}`}
                style={{
                  backgroundColor: bgColor,
                  padding: '2px 8px',
                  borderLeft: `4px solid ${borderColor}`,
                  whiteSpace: 'pre',
                  minHeight: '18px',
                }}
              >
                {prefix}
                {' '}
                {line}
              </div>
            );
          });
        })}
      </div>
    </Flex>
  );
}
