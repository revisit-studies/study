/* eslint-disable react/no-unstable-nested-components */
import {
  Text, Flex, Group, Space, Tooltip, Badge, RingProgress, Stack, ActionIcon,
} from '@mantine/core';
import {
  JSX, useCallback, useEffect, useMemo, useState,
} from 'react';
import { useParams } from 'react-router';
import {
  MantineReactTable, MRT_Cell as MrtCell, MRT_ColumnDef as MrtColumnDef, MRT_RowSelectionState as MrtRowSelectionState, useMantineReactTable,
} from 'mantine-react-table';
import {
  IconCheck, IconHourglassEmpty, IconX, IconCopy,
} from '@tabler/icons-react';

import {
  ParticipantData, StoredAnswer, StudyConfig,
} from '../../../parser/types';
import { ParticipantRejectModal } from '../ParticipantRejectModal';
import { participantName } from '../../../utils/participantName';
import { AllTasksTimeline } from '../replay/AllTasksTimeline';
import { youtubeReadableDuration } from '../../../utils/humanReadableDuration';
import { getSequenceFlatMap } from '../../../utils/getSequenceFlatMap';
import { MetaCell } from './MetaCell';
import { componentAnswersAreCorrect } from '../../../utils/correctAnswer';

function formatDate(date: Date): string | JSX.Element {
  if (date.valueOf() === 0 || Number.isNaN(date.valueOf())) {
    return <Text size="sm" c="dimmed">None</Text>;
  }

  return date.toLocaleDateString([], { hour: '2-digit', minute: '2-digit' });
}

export function TableView({
  visibleParticipants,
  studyConfig,
  refresh,
  width,
  stageColors,
  selectedParticipants,
  onSelectionChange,
}: {
  visibleParticipants: ParticipantData[];
  studyConfig: StudyConfig;
  refresh: () => Promise<Record<number, ParticipantData>>;
  width: number;
  stageColors: Record<string, string>;
  selectedParticipants: ParticipantData[];
  onSelectionChange: (participants: ParticipantData[]) => void;
}) {
  const { studyId } = useParams();
  const [checked, setChecked] = useState<MrtRowSelectionState>({});

  useEffect(() => {
    const newSelectedParticipants = Object.keys(checked).filter((v) => checked[v])
      .map((participantId) => visibleParticipants.find((p) => p.participantId === participantId))
      .filter((p) => p !== undefined) as ParticipantData[];
    onSelectionChange(newSelectedParticipants);
  }, [checked, visibleParticipants, onSelectionChange]);

  const handleRefresh = useCallback(async () => {
    await refresh();
  }, [refresh]);

  const [copied, setCopied] = useState<string | null>(null);

  const handleCopyParticipantId = (participantId: string) => {
    navigator.clipboard.writeText(participantId);
    setCopied(participantId);
    setTimeout(() => setCopied(null), 2000);
  };

  const columns = useMemo<MrtColumnDef<ParticipantData>[]>(() => {
    const hasCondition = visibleParticipants.some((participant) => participant.conditions ?? participant.searchParams?.condition);

    return [
      {
        accessorFn: (row: ParticipantData) => {
          const incompleteEntries = Object.entries(row.answers || {}).filter((e) => e[1].startTime === 0);

          return { percent: (Object.entries(row.answers).length - incompleteEntries.length) / (getSequenceFlatMap(row.sequence).length - 1), completed: row.completed, rejected: row.rejected };
        },
        header: 'Status',
        size: 100,
        Cell: ({ cell }: { cell: MrtCell<ParticipantData, { percent: number, completed: boolean, rejected: ParticipantData['rejected'] }> }) => {
          const cellValue = cell.getValue();
          return (
            cellValue.rejected ? (
              <Stack align="center" justify="center" gap={4} w="100%">
                <Tooltip label="Rejected"><IconX size={30} color="red" style={{ marginBottom: -3 }} /></Tooltip>
                <Text size="xs" c="dimmed" ta="center">{cellValue.rejected.reason}</Text>
              </Stack>
            )
              : cellValue.completed ? (
                <Group align="center" justify="center" w="100%">
                  <Tooltip label="Completed"><IconCheck size={30} color="teal" style={{ marginBottom: -3 }} /></Tooltip>
                </Group>
              )
                : (
                  <Group align="center" justify="center" w="100%">
                    <Tooltip label="In Progress">
                      <RingProgress
                        size={30}
                        thickness={4}
                        sections={[{ value: cellValue.percent * 100, color: 'blue' }]}
                      />
                    </Tooltip>
                  </Group>
                ));
        },
      },
      {
        accessorKey: 'participantIndex',
        header: '#',
        size: 80,
      },
      {
        accessorKey: 'stage',
        header: 'Stage',
        size: 100,
        Cell: ({ cell }: { cell: MrtCell<ParticipantData, string> }) => {
          const stageName = cell.getValue();
          if (!stageName || stageName === '') {
            return (
              <Badge
                color="gray"
                size="md"
                variant="light"
              >
                N/A
              </Badge>
            );
          }
          const stageColor = stageColors[stageName] || '#F05A30';
          return (
            <Badge
              color={stageColor}
              size="md"
              variant="filled"
            >
              {stageName}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'participantId',
        header: 'ID',
        Cell: ({ row }: { row: { original: ParticipantData } }) => (
          <Flex align="center">
            <Text size="sm">{row.original.participantId}</Text>
            <Tooltip label={copied === row.original.participantId ? 'Copied' : 'Copy ID'}>
              <ActionIcon
                variant="subtle"
                onClick={() => handleCopyParticipantId(row.original.participantId)}
                color="gray"
              >
                <IconCopy size={16} />
              </ActionIcon>
            </Tooltip>
          </Flex>
        ),
      },
      ...(studyConfig.uiConfig.participantNameField ? [
        {
          accessorFn: (row: ParticipantData) => participantName(row, studyConfig),
          header: 'Name',
          size: 100,
        },
      ] : []),
      ...(hasCondition ? [
        {
          accessorFn: (row: ParticipantData) => {
            const { conditions } = row;
            if (Array.isArray(conditions) && conditions.length > 0) {
              return conditions.join(',');
            }
            return conditions ?? row.searchParams?.condition ?? 'default';
          },
          header: 'Condition',
          size: 130,
        },
      ] : []),
      {
        accessorFn: (row: ParticipantData) => new Date(Math.max(...Object.values<StoredAnswer>(row.answers).filter((data) => data.endTime > 0).map((s) => s.endTime)) - Math.min(...Object.values<StoredAnswer>(row.answers).filter((data) => data.startTime > 0).map((s) => s.startTime))),
        header: 'Duration',
        size: 120,
        Cell: ({ cell }: { cell: MrtCell<ParticipantData, Date> }) => (
          !Number.isNaN(cell.getValue()) ? (
            <Badge
              variant="light"
              size="md"
              color="gray"
              leftSection={<IconHourglassEmpty width={18} height={18} style={{ paddingTop: 1 }} />}
              pb={1}
            >
              {`${youtubeReadableDuration(+cell.getValue()) || 'N/A'}`}
            </Badge>
          ) : 'Incomplete'
        ),

      },
      {
        accessorFn: (row: ParticipantData) => new Date(Math.min(...Object.values<StoredAnswer>(row.answers).filter((data) => data.startTime > 0).map((s) => s.startTime))),
        header: 'Start Time',
        size: 150,
        Cell: ({ cell }: { cell: MrtCell<ParticipantData, Date> }) => (formatDate(cell.getValue() as Date)),
      },
      {
        accessorFn: (row: ParticipantData) => Object.values(row.answers).filter((answer) => answer.correctAnswer.length > 0 && answer.endTime > 0).map((answer) => componentAnswersAreCorrect(answer.answer, answer.correctAnswer)),
        header: 'Correct Answers',
        size: 160,
        Cell: ({ cell }: { cell: MrtCell<ParticipantData, boolean[]> }) => (
          <Group gap={4}>
            <Badge
              variant="light"
              size="md"
              color="green"
              leftSection={<IconCheck width={18} height={18} style={{ paddingTop: 1 }} />}
              pb={1}
            >
              {cell.getValue().filter((b) => b).length}
            </Badge>
            <Badge
              variant="light"
              size="md"
              color="red"
              leftSection={<IconX width={18} height={18} style={{ paddingTop: 1 }} />}
              pb={1}
            >

              {cell.getValue().length - cell.getValue().filter((b) => b).length}
            </Badge>
          </Group>
        ),
      },
      {
        accessorKey: 'metadata',
        header: 'Metadata',
        size: 200,
        Cell: ({ cell }: { cell: MrtCell<ParticipantData, ParticipantData['metadata']> }) => <MetaCell metaData={cell.getValue()} />,
      },
    ];
  }, [studyConfig, stageColors, copied, visibleParticipants]);

  const table = useMantineReactTable({
    columns,
    data: visibleParticipants, // must be memoized or stable (useState, useMemo, defined outside of this component, etc.)
    enableColumnResizing: true,
    columnResizeMode: 'onEnd',
    enableRowSelection: true,
    getRowId: (originalRow) => originalRow.participantId,
    onRowSelectionChange: setChecked,
    manualPagination: true,
    state: { rowSelection: checked },
    paginationDisplayMode: 'pages',
    enablePagination: false,
    enableRowVirtualization: true,
    mantinePaperProps: { style: { maxHeight: '100%', display: 'flex', flexDirection: 'column' } },
    layoutMode: 'grid',
    renderDetailPanel: ({ row }) => {
      const r = row.original;

      if (!r.participantId) {
        return null;
      }

      return (
        <AllTasksTimeline maxLength={undefined} studyConfig={studyConfig} studyId={studyId || ''} participantData={r} width={width - 60} />
      );
    },
    defaultColumn: {
      minSize: 20, // allow columns to get smaller than default
      maxSize: 1000, // allow columns to get larger than default
      size: 180, // make columns wider by default
    },
    enableDensityToggle: false,
    positionToolbarAlertBanner: 'none',
    renderTopToolbarCustomActions: () => (
      <Flex mb={8} p={8}>
        <ParticipantRejectModal selectedParticipants={selectedParticipants} refresh={handleRefresh} />
      </Flex>
    ),
  });

  return (
    visibleParticipants.length > 0 ? (
      <MantineReactTable
        table={table}
      />
    ) : (
      <>
        <Space h="xl" />
        <Flex justify="center" align="center">
          <Text>No data available</Text>
        </Flex>
      </>
    )
  );
}
