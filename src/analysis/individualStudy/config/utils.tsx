import { JSX } from 'react';
import {
  Badge, Flex, Group, Text,
} from '@mantine/core';
import { diffLines, Change } from 'diff';
import { StudyConfig } from '../../../parser/types';

export interface ConfigInfo {
  version: string;
  hash: string;
  date: string;
  timeFrame: string;
  participantCount: number;
  config: StudyConfig;
}

export function formatDate(date: Date): string | JSX.Element {
  if (date.valueOf() === 0 || Number.isNaN(date.valueOf())) {
    return <Text size="sm" c="dimmed">None</Text>;
  }

  return date.toLocaleDateString([], { hour: '2-digit', minute: '2-digit' });
}

export function buildConfigRows(
  fetchedConfigs: Record<string, StudyConfig>,
  visibleParticipants: { participantConfigHash: string; answers: Record<string, { startTime: number; endTime: number }> }[],
): ConfigInfo[] {
  return Object.entries(fetchedConfigs).map(([hash, config]) => {
    const filteredParticipants = visibleParticipants.filter((participant) => participant.participantConfigHash === hash);
    const storedAnswers = filteredParticipants.flatMap((p) => Object.values(p.answers));

    const startTime = storedAnswers.map((answer: { startTime: number; endTime: number }) => answer.startTime).filter((t): t is number => t !== undefined && t > 0);
    const endTime = storedAnswers.map((answer: { startTime: number; endTime: number }) => answer.endTime).filter((t): t is number => t !== undefined && t > 0);

    const earliestStartTime = startTime.length > 0 ? Math.min(...startTime.values()) : null;
    const latestEndTime = endTime.length > 0 ? Math.max(...endTime.values()) : null;

    const formatTimeFrame = (timestamp: number) => {
      const formatted = formatDate(new Date(timestamp));
      return typeof formatted === 'string' ? formatted : 'N/A';
    };

    const getTimeFrame = (): string => {
      if (earliestStartTime && latestEndTime) {
        return `${formatTimeFrame(earliestStartTime)} - ${formatTimeFrame(latestEndTime)}`;
      }
      if (earliestStartTime) {
        return formatTimeFrame(earliestStartTime);
      }
      return 'N/A';
    };

    return {
      version: config.studyMetadata?.version || 'N/A',
      hash,
      date: config.studyMetadata?.date || 'N/A',
      timeFrame: getTimeFrame(),
      participantCount: filteredParticipants.length,
      config,
    };
  });
}

export function generateDiffView(configs: ConfigInfo[]): JSX.Element | null {
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
        <Text size="sm" c="dimmed">→</Text>
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
