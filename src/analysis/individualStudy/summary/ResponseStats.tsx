import { useMemo } from 'react';
import { Text, Paper, Title } from '@mantine/core';
// eslint-disable-next-line camelcase
import { MantineReactTable, useMantineReactTable, type MRT_ColumnDef } from 'mantine-react-table';
import { ParticipantData } from '../../../storage/types';
import { StudyConfig } from '../../../parser/types';
import { studyComponentToIndividualComponent } from '../../../utils/handleComponentInheritance';
import { calculateResponseStats, getResponseOptions } from './utils';
import { ResponseData } from '../../types';

const extractNumericValue = (value: string, unit: string): number => {
  if (value === 'N/A') return -1;
  return parseFloat(value.replace(unit, '')) || 0;
};

export function ResponseStats({ visibleParticipants, studyConfig }: { visibleParticipants: ParticipantData[]; studyConfig: StudyConfig }) {
  const tableData: ResponseData[] = useMemo(() => {
    const stats = calculateResponseStats(visibleParticipants);
    const data: ResponseData[] = [];

    stats.forEach((stat) => {
      const component = studyConfig.components[stat.name];
      if (!component) return;

      const responses = studyComponentToIndividualComponent(component, studyConfig).response;
      if (responses.length === 0) return;

      responses.forEach((response) => {
        const correctnessStr = !Number.isNaN(stat.correctness) ? `${stat.correctness.toFixed(1)}%` : 'N/A';
        data.push({
          component: stat.name,
          type: response.type,
          question: response.prompt,
          options: getResponseOptions(response),
          correctness: correctnessStr,
        });
      });
    });

    return data;
  }, [visibleParticipants, studyConfig]);

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
        const a = extractNumericValue(rowA.original.correctness, '%');
        const b = extractNumericValue(rowB.original.correctness, '%');
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
      style: { overflow: 'hidden' },
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
