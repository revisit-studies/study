import { useMemo } from 'react';
import { Paper, Title } from '@mantine/core';
// eslint-disable-next-line camelcase
import { MantineReactTable, useMantineReactTable, type MRT_ColumnDef } from 'mantine-react-table';
import { ParticipantData } from '../../../storage/types';
import { StudyConfig } from '../../../parser/types';
import { getResponseStats, convertNumberToString } from './utils';
import { ResponseData } from '../../types';

export function ResponseStats({
  visibleParticipants,
  studyConfig,
}: {
  visibleParticipants: ParticipantData[];
  studyConfig: StudyConfig;
}) {
  const responseData: ResponseData[] = useMemo(() => getResponseStats(visibleParticipants, studyConfig), [visibleParticipants, studyConfig]);

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
      Cell: ({ cell }) => {
        const value = cell.getValue<number>();
        return convertNumberToString(value, 'correctness');
      },
    },
  ], []);

  const table = useMantineReactTable({
    columns,
    data: responseData,
    initialState: {
      sorting: [{ id: 'component.index', desc: true }],
    },
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
