import { useMemo } from 'react';
import {
  Text, Paper, Title,
} from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
// eslint-disable-next-line camelcase
import { MantineReactTable, useMantineReactTable, type MRT_ColumnDef } from 'mantine-react-table';
import { ParticipantData } from '../../../storage/types';
import { calculateComponentStats } from './utils';

interface TableRow {
  component: string;
  participants: number;
  avgTime: string;
  avgCleanTime: string;
  correctness: string;
}

const extractNumericValue = (value: string, unit: string): number => {
  if (value === 'N/A') return -1;
  return parseFloat(value.replace(unit, '')) || 0;
};

export function ComponentStats({ visibleParticipants }: { visibleParticipants: ParticipantData[] }) {
  const tableData: TableRow[] = useMemo(() => {
    const stats = calculateComponentStats(visibleParticipants);
    return stats.map((stat) => ({
      component: stat.name,
      participants: stat.participantCount,
      avgTime: Number.isFinite(stat.avgTime) ? `${stat.avgTime.toFixed(1)}s` : 'N/A',
      avgCleanTime: Number.isFinite(stat.avgCleanTime) ? `${stat.avgCleanTime.toFixed(1)}s` : 'N/A',
      correctness: !Number.isNaN(stat.correctness) ? `${stat.correctness.toFixed(1)}%` : 'N/A',
    }));
  }, [visibleParticipants]);

  // eslint-disable-next-line camelcase
  const columns = useMemo<MRT_ColumnDef<TableRow>[]>(
    () => [
      {
        accessorKey: 'component',
        header: 'Component',
      },
      {
        accessorKey: 'participants',
        header: 'Participants',
      },
      {
        accessorKey: 'avgTime',
        header: 'Avg Time',
        sortingFn: (rowA, rowB) => {
          const a = extractNumericValue(rowA.original.avgTime, 's');
          const b = extractNumericValue(rowB.original.avgTime, 's');
          return a - b;
        },
      },
      {
        accessorKey: 'avgCleanTime',
        header: 'Avg Clean Time',
        sortingFn: (rowA, rowB) => {
          const a = extractNumericValue(rowA.original.avgCleanTime, 's');
          const b = extractNumericValue(rowB.original.avgCleanTime, 's');
          return a - b;
        },
      },
      {
        accessorKey: 'correctness',
        header: 'Correctness',
        sortingFn: (rowA, rowB) => {
          const a = extractNumericValue(rowA.original.correctness, '%');
          const b = extractNumericValue(rowB.original.correctness, '%');
          return a - b;
        },
      },
    ],
    [],
  );

  const table = useMantineReactTable({
    columns,
    data: tableData,
    enableGlobalFilter: true,
    enableColumnFilters: false,
    enableSorting: true,
    enablePagination: true,
    initialState: {
      pagination: { pageSize: 10, pageIndex: 0 },
      sorting: [{ id: 'component', desc: false }],
    },
    mantineSearchTextInputProps: {
      placeholder: 'Search components...',
      leftSection: <IconSearch size={16} />,
    },
    mantinePaperProps: {
      style: { overflow: 'hidden' },
    },
    mantineTableContainerProps: {
      style: { overflow: 'hidden' },
    },
  });

  return (
    <Paper shadow="sm" p="md" withBorder>
      <Title order={4} mb="md">Component Statistics</Title>
      {(visibleParticipants.length === 0 || tableData.length === 0)
        ? <Text ta="center" mb="md">No data available</Text>
        : <MantineReactTable table={table} />}
    </Paper>
  );
}
