import { useMemo } from 'react';
import { Text } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
// eslint-disable-next-line camelcase
import { MantineReactTable, useMantineReactTable, type MRT_ColumnDef } from 'mantine-react-table';
import { ParticipantData } from '../../../storage/types';
import { getCleanedDuration } from '../../../utils/getCleanedDuration';
import 'mantine-react-table/styles.css';

interface TableRow {
  component: string;
  participants: number;
  avgTime: string;
  avgCleanTime: string;
  correctness: string;
}

function calculateComponentStats(visibleParticipants: ParticipantData[]) {
  const validParticipants = visibleParticipants.filter((p) => !p.rejected);
  const stats: Record<string, {
    name: string;
    avgTime: number;
    avgCleanTime: number;
    participantCount: number;
    correctness: number;
  }> = {};

  validParticipants.forEach((participant) => {
    const components = new Set<string>();
    Object.entries(participant.answers).forEach(([taskId, answer]) => {
      const component = `${taskId.split('_')[0]}`;

      if (!stats[component]) {
        stats[component] = {
          name: component,
          avgTime: 0,
          avgCleanTime: 0,
          participantCount: 0,
          correctness: 0,
        };
      }
      if (answer.endTime === -1) {
        return;
      }
      const stat = stats[component];
      const time = (answer.endTime - answer.startTime) / 1000;
      const cleanTime = getCleanedDuration(answer as never);

      stat.avgTime += time;
      stat.avgCleanTime += cleanTime ? cleanTime / 1000 : 0;

      if (!components.has(component)) {
        components.add(component);
        stat.participantCount += 1;
      }

      if (answer.correctAnswer && answer.correctAnswer.length > 0) {
        const isCorrect = answer.correctAnswer.every((correctAnswer) => {
          const participantAnswer = answer.answer[correctAnswer.id];
          return correctAnswer.answer === participantAnswer;
        });
        stat.correctness += isCorrect ? 1 : 0;
      }
    });
  });

  return Object.values(stats)
    .map((stat) => {
      const questions = Object.values(validParticipants).flatMap((participant) => Object.keys(participant.answers).filter((key) => key.startsWith(stat.name) && participant.answers[key]?.correctAnswer?.length > 0));

      const totalAttempts = Object.values(validParticipants).reduce((count, participant) => count + Object.keys(participant.answers).filter((key) => key.startsWith(stat.name) && participant.answers[key].endTime !== -1).length, 0);

      const hasCorrectAnswers = questions.length > 0;

      return {
        ...stat,
        avgTime: totalAttempts ? stat.avgTime / totalAttempts : 0,
        avgCleanTime: totalAttempts ? stat.avgCleanTime / totalAttempts : 0,
        correctness: hasCorrectAnswers ? (stat.correctness / questions.length) * 100 : NaN,
      };
    });
}

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
      },
      {
        accessorKey: 'avgCleanTime',
        header: 'Avg Clean Time',
      },
      {
        accessorKey: 'correctness',
        header: 'Correctness',
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
  });

  if (visibleParticipants.length === 0 || tableData.length === 0) {
    return <Text>No data available</Text>;
  }

  return <MantineReactTable table={table} />;
}
