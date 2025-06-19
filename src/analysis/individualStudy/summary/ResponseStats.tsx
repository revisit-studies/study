import { useMemo } from 'react';
import { Text } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
// eslint-disable-next-line camelcase
import { MantineReactTable, useMantineReactTable, type MRT_ColumnDef } from 'mantine-react-table';
import { ParticipantData } from '../../../storage/types';
import { Response, StudyConfig } from '../../../parser/types';
import { studyComponentToIndividualComponent } from '../../../utils/handleComponentInheritance';
import 'mantine-react-table/styles.css';

interface TableRow {
  component: string;
  type: string;
  question: string;
  options: string;
  correctness: string;
}

function getResponseOptions(response: Response): string {
  // Slider
  // example: Bad (0), Mid (50), Good (100)
  if (response.type === 'slider') {
    return response.options.map((option) => `${option.label} (${option.value})`).join(', ');
  }
  // Dropdown, Checkbox, Radio, Button
  // example: Option 1, Option 2, Option 3
  if ('options' in response) {
    return response.options.join(', ');
  }
  // Matrix Radio, Matrix Checkbox
  // example: Questions: Question 1, Question 2, Question 3
  // example: Answers: Answer 1, Answer 2, Answer 3
  if ('answerOptions' in response && 'questionOptions' in response) {
    return `Questions: ${response.questionOptions.join(', ')} \n Answers: ${Array.isArray(response.answerOptions) ? response.answerOptions.join(', ') : response.answerOptions}`;
  }
  // Likert Scale
  // example: Dislike ~ Like (9 items)
  if ('numItems' in response) {
    return `${response.leftLabel ? ` ${response.leftLabel} ~ ${response.rightLabel}` : ''} (${response.numItems} items)`;
  }
  return 'N/A';
}

function calculateTaskStats(visibleParticipants: ParticipantData[]) {
  const validParticipants = visibleParticipants.filter((p) => !p.rejected);
  const stats: Record<string, { name: string; correctness: number; participantCount: number }> = {};

  validParticipants.forEach((participant) => {
    Object.entries(participant.answers).forEach(([taskId, answer]) => {
      const parts = taskId.split('_');
      const component = parts.length === 4 ? parts[2] : parts[0];

      if (!stats[component]) {
        stats[component] = {
          name: component,
          correctness: 0,
          participantCount: 0,
        };
      }
      // In progress participants are not included in the stats
      if (answer.endTime === -1) {
        return;
      }
      const stat = stats[component];
      stat.participantCount += 1;

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
      // Check if any participant has correct answers defined for this component
      const hasCorrectAnswers = Object.values(validParticipants).some((participant) => Object.entries(participant.answers).some(([key, answer]) => {
        const parts = key.split('_');
        const component = parts.length === 4 ? parts[2] : parts[0];
        return component === stat.name && answer.correctAnswer && answer.correctAnswer.length > 0;
      }));
      return {
        ...stat,
        correctness: hasCorrectAnswers ? (stat.correctness / stat.participantCount) * 100 : NaN,
      };
    });
}

export function ResponseStats({ visibleParticipants, studyConfig }: { visibleParticipants: ParticipantData[]; studyConfig: StudyConfig }) {
  const tableData: TableRow[] = useMemo(() => {
    const stats = calculateTaskStats(visibleParticipants);
    const data: TableRow[] = [];

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
  const columns = useMemo<MRT_ColumnDef<TableRow>[]>(
    () => [
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
    },
    mantineSearchTextInputProps: {
      placeholder: 'Search responses...',
      leftSection: <IconSearch size={16} />,
    },
  });

  if (visibleParticipants.length === 0 || tableData.length === 0) {
    return <Text>No data available</Text>;
  }

  return <MantineReactTable table={table} />;
}
