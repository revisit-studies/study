import { useMemo } from 'react';
import { Paper, Title } from '@mantine/core';
// eslint-disable-next-line camelcase
import { MantineReactTable, useMantineReactTable, type MRT_ColumnDef } from 'mantine-react-table';
import { ParticipantData } from '../../../storage/types';
import { StudyConfig } from '../../../parser/types';
import { getComponentStats, convertNumberToString } from './utils';
import { ComponentData } from '../../types';

export function ComponentStats({
  visibleParticipants,
  studyConfig,
}: {
  visibleParticipants: ParticipantData[];
  studyConfig: StudyConfig;
}) {
  const componentData: ComponentData[] = useMemo(() => getComponentStats(visibleParticipants, studyConfig), [visibleParticipants, studyConfig]);

  // eslint-disable-next-line camelcase
  const columns = useMemo<MRT_ColumnDef<ComponentData>[]>(
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
        Cell: ({ cell }) => {
          const value = cell.getValue<number>();
          return convertNumberToString(value, 'time');
        },
      },
      {
        accessorKey: 'avgCleanTime',
        header: 'Avg Clean Time',
        Cell: ({ cell }) => {
          const value = cell.getValue<number>();
          return convertNumberToString(value, 'time');
        },
      },
      {
        accessorKey: 'correctness',
        header: 'Correctness',
        Cell: ({ cell }) => {
          const value = cell.getValue<number>();
          return convertNumberToString(value, 'correctness');
        },
      },
    ],
    [],
  );

  const table = useMantineReactTable({
    columns,
    data: componentData,
    initialState: {
      sorting: [{ id: 'component.index', desc: false }],
    },
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
