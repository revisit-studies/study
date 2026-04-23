import { useMemo } from 'react';
import {
  Badge, Flex, Paper, Text, Title,
} from '@mantine/core';
import { MantineReactTable, useMantineReactTable, type MRT_ColumnDef as MrtColumnDef } from 'mantine-react-table';
import { ParticipantDataWithStatus } from '../../../storage/types';
import { StudyConfig } from '../../../parser/types';
import { getComponentStats, getComponentStatsForConfigs, convertNumberToString } from './utils';
import { ComponentData } from '../../types';

function renderComponentNameCell(
  row: { original: ComponentData },
  currentConfigLabel?: string,
) {
  const configs = row.original.configs ?? [];
  const hasCurrentConfig = currentConfigLabel ? configs.includes(currentConfigLabel) : false;
  const hasOutdatedConfig = configs.length > 0 && !hasCurrentConfig;

  return (
    <Flex align="center" gap={6} wrap="nowrap">
      <Text size="sm">{row.original.component}</Text>
      {hasOutdatedConfig && (
        <Badge size="xs" variant="light" color="gray">Outdated</Badge>
      )}
    </Flex>
  );
}

function renderConfigListCell(
  row: { original: ComponentData },
  currentConfigLabel?: string,
) {
  return (
    <Flex
      align="center"
      gap={6}
      wrap="nowrap"
      style={{ whiteSpace: 'nowrap', minWidth: 'max-content' }}
    >
      {(row.original.configs ?? []).map((config, index, configs) => (
        <Flex
          key={config}
          align="center"
          gap={4}
          wrap="nowrap"
          style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          <Text size="sm">{config}</Text>
          {config === currentConfigLabel ? (
            <Badge
              size="xs"
              variant="light"
              px={6}
              style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              Current
            </Badge>
          ) : null}
          {index < configs.length - 1 && (
            <Text size="sm" c="dimmed" style={{ flexShrink: 0 }}>,</Text>
          )}
        </Flex>
      ))}
    </Flex>
  );
}

export function ComponentStats({
  visibleParticipants,
  studyConfig,
  allConfigs,
  selectedConfigRows,
  currentConfigLabel,
}: {
  visibleParticipants: ParticipantDataWithStatus[];
  studyConfig: StudyConfig;
  allConfigs: Record<string, StudyConfig>;
  selectedConfigRows: Array<{ configHash: string; configLabel: string; studyConfig: StudyConfig }>;
  currentConfigLabel?: string;
}) {
  const useSelectedConfigRows = selectedConfigRows.length > 0;
  const componentData: ComponentData[] = useMemo(
    () => (useSelectedConfigRows
      ? getComponentStatsForConfigs(visibleParticipants, selectedConfigRows, allConfigs)
      : getComponentStats(visibleParticipants, studyConfig, allConfigs)),
    [visibleParticipants, studyConfig, allConfigs, useSelectedConfigRows, selectedConfigRows],
  );

  const columns = useMemo<MrtColumnDef<ComponentData>[]>(
    () => [
      {
        accessorKey: 'component',
        header: 'Component',
        Cell: ({ row }) => renderComponentNameCell(row, currentConfigLabel),
      },
      {
        accessorKey: 'participants',
        header: 'Participants',
        size: 50,
      },
      {
        accessorKey: 'avgTime',
        header: 'Avg Time',
        size: 50,
        Cell: ({ cell }) => {
          const value = cell.getValue<number>();
          return convertNumberToString(value, 'time');
        },
      },
      {
        accessorKey: 'avgCleanTime',
        header: 'Avg Clean Time',
        size: 50,
        Cell: ({ cell }) => {
          const value = cell.getValue<number>();
          return convertNumberToString(value, 'time');
        },
      },
      {
        accessorKey: 'correctness',
        header: 'Correctness',
        size: 50,
        Cell: ({ cell }) => {
          const value = cell.getValue<number>();
          return convertNumberToString(value, 'correctness');
        },
      },
      ...(useSelectedConfigRows ? [{
        accessorKey: 'configs',
        header: 'Configs',
        Cell: ({ row }) => renderConfigListCell(row, currentConfigLabel),
      } satisfies MrtColumnDef<ComponentData>] : []),
    ],
    [useSelectedConfigRows, currentConfigLabel],
  );

  const table = useMantineReactTable({
    columns,
    data: componentData,
    mantinePaperProps: {
      style: { overflow: 'hidden' },
    },
  });

  return (
    <Paper shadow="sm" p="md" withBorder>
      <Title order={4} mb="md">Component Statistics</Title>
      <MantineReactTable table={table} />
    </Paper>
  );
}
