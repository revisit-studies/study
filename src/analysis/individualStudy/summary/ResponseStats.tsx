import { useMemo } from 'react';
import { Text, Paper, Title } from '@mantine/core';
// eslint-disable-next-line camelcase
import { MantineReactTable, useMantineReactTable, type MRT_ColumnDef } from 'mantine-react-table';
import { ParticipantData } from '../../../storage/types';
import { StudyConfig } from '../../../parser/types';
import { getResponseStats } from './utils';
import { ResponseData } from '../../types';

const extractNumericValue = (value: string, unit: string): number => {
  if (value === 'N/A') return -1;
  return parseFloat(value.replace(unit, '')) || 0;
};

export function ResponseStats({ visibleParticipants, studyConfig }: { visibleParticipants: ParticipantData[]; studyConfig: StudyConfig }) {
  const tableData: ResponseData[] = useMemo(() => getResponseStats(visibleParticipants, studyConfig), [visibleParticipants, studyConfig]);

  // eslint-disable-next-line camelcase
  const columns = useMemo<MRT_ColumnDef<ResponseData>[]>(() => [
    {
      accessorKey: 'component',
      header: 'Component',
    },
    {
      accessorKey: 'type',
      header: 'Type',
    },
    {
      accessorKey: 'question',
      header: 'Question',
    },
    {
      accessorKey: 'options',
      header: 'Options',
    },
    {
      accessorKey: 'correctness',
      header: 'Correctness',
      sortingFn: (rowA, rowB) => {
        const a = extractNumericValue(rowA.original.correctness.toString(), '%');
        const b = extractNumericValue(rowB.original.correctness.toString(), '%');
        return a - b;
      },
    },
  ], []);

  const table = useMantineReactTable({
    columns,
    data: tableData,
    initialState: {
      sorting: [{ id: 'component', desc: false }],
    },
    mantinePaperProps: {
      style: { overflow: 'hidden' },
    },
    mantineTableContainerProps: {
      style: { overflow: 'auto' },
    },
  });

  return (
    <Paper shadow="sm" p="md" withBorder>
      <Title order={4} mb="md">Response Statistics</Title>
      {(visibleParticipants.length === 0 || tableData.length === 0)
        ? <Text ta="center" mb="md">No data available</Text>
        : <MantineReactTable table={table} />}
    </Paper>
  );
}
