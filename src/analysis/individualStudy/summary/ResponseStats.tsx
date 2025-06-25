import { useMemo } from 'react';
import { Text } from '@mantine/core';
// eslint-disable-next-line camelcase
import { MantineReactTable, useMantineReactTable, type MRT_ColumnDef } from 'mantine-react-table';
import { ParticipantData } from '../../../storage/types';
import { StudyConfig } from '../../../parser/types';
import { studyComponentToIndividualComponent } from '../../../utils/handleComponentInheritance';
import 'mantine-react-table/styles.css';
import { calculateTaskStats, getResponseOptions } from './utils';
import { ResponseData } from './types';

export function ResponseStats({ visibleParticipants, studyConfig }: { visibleParticipants: ParticipantData[]; studyConfig: StudyConfig }) {
  const tableData: ResponseData[] = useMemo(() => {
    const stats = calculateTaskStats(visibleParticipants);
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
    },
  ], []);

  const table = useMantineReactTable({
    columns,
    data: tableData,
  });

  if (visibleParticipants.length === 0 || tableData.length === 0) {
    return <Text>No data available</Text>;
  }

  return <MantineReactTable table={table} />;
}
