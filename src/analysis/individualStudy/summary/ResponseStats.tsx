import { useMemo, useState } from 'react';
import {
  Badge, Flex, Paper, Text, Title, Tooltip,
} from '@mantine/core';
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_ColumnDef as MrtColumnDef,
  type MRT_SortingState as MrtSortingState,
} from 'mantine-react-table';
import { ParticipantDataWithStatus } from '../../../storage/types';
import { StudyConfig } from '../../../parser/types';
import { getResponseStats, getResponseStatsForConfigs, convertNumberToString } from './utils';
import { ResponseData } from '../../types';

function isResponseOutdated(row: ResponseData, currentConfigLabel?: string) {
  const configs = row.configs ?? [];
  if (!currentConfigLabel || configs.length === 0) return false;
  return !configs.includes(currentConfigLabel);
}

function compareValues(aVal: unknown, bVal: unknown): number {
  if (typeof aVal === 'number' && typeof bVal === 'number') {
    const aNaN = Number.isNaN(aVal);
    const bNaN = Number.isNaN(bVal);
    if (aNaN && bNaN) return 0;
    if (aNaN) return 1;
    if (bNaN) return -1;
    return aVal - bVal;
  }
  if (typeof aVal === 'string' && typeof bVal === 'string') {
    return aVal.localeCompare(bVal);
  }
  return 0;
}

function renderResponseComponentCell(
  row: { original: ResponseData },
  currentConfigLabel?: string,
) {
  const configs = row.original.configs ?? [];
  const hasCurrentConfig = currentConfigLabel ? configs.includes(currentConfigLabel) : false;
  const hasOutdatedConfig = configs.length > 0 && !hasCurrentConfig;

  return (
    <Flex align="center" gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
      <Tooltip label={row.original.component} withinPortal>
        <Text
          size="sm"
          style={{
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: 0,
            flex: 1,
          }}
        >
          {row.original.component}
        </Text>
      </Tooltip>
      {hasOutdatedConfig && (
        <Badge size="xs" variant="light" color="gray" style={{ flexShrink: 0 }}>Outdated</Badge>
      )}
    </Flex>
  );
}

function renderResponseConfigListCell(
  row: { original: ResponseData },
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

export function ResponseStats({
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
  const [sorting, setSorting] = useState<MrtSortingState>([]);
  const responseData: ResponseData[] = useMemo(
    () => {
      const rows = useSelectedConfigRows
        ? getResponseStatsForConfigs(visibleParticipants, selectedConfigRows, allConfigs)
        : getResponseStats(visibleParticipants, studyConfig, allConfigs);
      // Outdated rows are always pinned below current rows; user sort applies within each group
      return [...rows].sort((a, b) => {
        const aOutdated = isResponseOutdated(a, currentConfigLabel) ? 1 : 0;
        const bOutdated = isResponseOutdated(b, currentConfigLabel) ? 1 : 0;
        if (aOutdated !== bOutdated) return aOutdated - bOutdated;

        for (let i = 0; i < sorting.length; i += 1) {
          const sort = sorting[i];
          const cmp = compareValues(
            a[sort.id as keyof ResponseData],
            b[sort.id as keyof ResponseData],
          );
          if (cmp !== 0) return sort.desc ? -cmp : cmp;
        }
        return 0;
      });
    },
    [visibleParticipants, studyConfig, allConfigs, useSelectedConfigRows, selectedConfigRows, currentConfigLabel, sorting],
  );

  const columns = useMemo<MrtColumnDef<ResponseData>[]>(() => [
    {
      accessorKey: 'component',
      header: 'Component',
      Cell: ({ row }) => renderResponseComponentCell(row, currentConfigLabel),
    },
    {
      accessorKey: 'type',
      header: 'Type',
      size: 50,
    },
    {
      accessorKey: 'question',
      header: 'Question',
      size: 200,
    },
    {
      accessorKey: 'options',
      header: 'Options',
      size: 200,
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
      Cell: ({ row }) => renderResponseConfigListCell(row, currentConfigLabel),
    } satisfies MrtColumnDef<ResponseData>] : []),
  ], [useSelectedConfigRows, currentConfigLabel]);

  const table = useMantineReactTable({
    columns,
    data: responseData,
    manualSorting: true,
    state: { sorting },
    onSortingChange: setSorting,
    mantinePaperProps: {
      style: { overflow: 'hidden' },
    },
  });

  return (
    <Paper shadow="sm" p="md" withBorder>
      <Title order={4} mb="md">Response Statistics</Title>
      <MantineReactTable table={table} />
    </Paper>
  );
}
