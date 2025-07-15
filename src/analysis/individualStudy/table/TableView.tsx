/* eslint-disable react/no-unstable-nested-components */
/* eslint-disable camelcase */
import {
  Text, Flex, Button, LoadingOverlay, Group, Space, Modal, TextInput,
  Tooltip,
  Container,
  Badge,
  RingProgress,
  Stack,
} from '@mantine/core';
import React, {
  useCallback, useMemo, useState,
} from 'react';
import { useParams } from 'react-router';
import {
  MantineReactTable, MRT_Cell, MRT_ColumnDef, MRT_RowSelectionState, useMantineReactTable,
} from 'mantine-react-table';
import {
  IconCheck, IconHourglassEmpty, IconX,
} from '@tabler/icons-react';

import {
  ParticipantData, StoredAnswer, StudyConfig,
} from '../../../parser/types';
import { useStorageEngine } from '../../../storage/storageEngineHooks';
import { useAuth } from '../../../store/hooks/useAuth';
import 'mantine-react-table/styles.css';
import { participantName } from '../../../utils/participantName';
import { AllTasksTimeline } from '../replay/AllTasksTimeline';
import { checkAnswerCorrect } from '../../../store/hooks/useNextStep';
import { humanReadableDuration } from '../../../utils/humanReadableDuration';
import { getSequenceFlatMap } from '../../../utils/getSequenceFlatMap';

function formatDate(date: Date): string | JSX.Element {
  if (date.valueOf() === 0 || Number.isNaN(date.valueOf())) {
    return <Text size="sm" c="dimmed">None</Text>;
  }
  const month = date.getMonth() + 1; // Months are 0-based
  const day = date.getDate();
  const year = date.getFullYear();
  const hour = date.getHours();
  const minute = date.getMinutes().toString().padStart(2, '0');

  return `${month}/${day}/${year} ${hour}:${minute}`;
}

export function TableView({
  visibleParticipants,
  studyConfig,
  refresh,
  width,
}: {
  visibleParticipants: ParticipantData[];
  studyConfig: StudyConfig;
  refresh: () => Promise<unknown>;
  width: number;
}) {
  const { storageEngine } = useStorageEngine();
  const { studyId } = useParams();
  const { user } = useAuth();
  const [checked, setChecked] = useState<MRT_RowSelectionState>({});

  const rejectParticipant = useCallback(async (participantId: string, reason: string) => {
    if (storageEngine && studyId) {
      if (user.isAdmin) {
        const finalReason = reason === '' ? 'Rejected by admin' : reason;
        await storageEngine.rejectParticipant(participantId, finalReason, studyId);
        await refresh();
      } else {
        console.warn('You are not authorized to perform this action.');
      }
    }
  }, [refresh, storageEngine, studyId, user.isAdmin]);

  const [loading, setLoading] = useState(false);
  const [modalRejectParticipantsOpened, setModalRejectParticipantsOpened] = useState<boolean>(false);
  const [rejectParticipantsMessage, setRejectParticipantsMessage] = useState<string>('');

  const handleRejectParticipants = useCallback(async () => {
    setLoading(true);
    setModalRejectParticipantsOpened(false);
    const promises = Object.keys(checked).filter((v) => checked[v]).map(async (participantId) => await rejectParticipant(participantId, rejectParticipantsMessage));
    await Promise.all(promises);
    setChecked({});
    await refresh();
    setLoading(false);
  }, [checked, refresh, rejectParticipant, rejectParticipantsMessage]);

  const columns = useMemo<MRT_ColumnDef<ParticipantData>[]>(() => [
    {
      accessorFn: (row: ParticipantData) => {
        const incompleteEntries = Object.entries(row.answers || {}).filter((e) => e[1].startTime === 0);

        return { percent: (Object.entries(row.answers).length - incompleteEntries.length) / (getSequenceFlatMap(row.sequence).length - 1), completed: row.completed, rejected: row.rejected };
      },
      header: 'Status',
      size: 50,
      Cell: ({ cell }: { cell: MRT_Cell<ParticipantData, {percent: number, completed: boolean, rejected: ParticipantData['rejected']}> }) => {
        const cellValue = cell.getValue();
        return (
          cellValue.completed ? <Tooltip label="Completed"><IconCheck size={30} color="teal" style={{ marginBottom: -3 }} /></Tooltip>
            : cellValue.rejected ? (
              <Stack align="center" justify="center" gap={4} w="100%">
                <Tooltip label="Rejected"><IconX size={30} color="red" style={{ marginBottom: -3 }} /></Tooltip>
                <Text size="xs" c="dimmed" ta="center">{cellValue.rejected.reason}</Text>
              </Stack>
            )
              : (
                <Tooltip label="In Progress">
                  <RingProgress
                    size={30}
                    thickness={4}
                    sections={[{ value: cellValue.percent * 100, color: 'blue' }]}
                  />
                </Tooltip>
              ));
      },
    },
    { accessorKey: 'participantIndex', header: '#', size: 50 },
    { accessorKey: 'participantId', header: 'ID' },
    ...(studyConfig.uiConfig.participantNameField ? [{ accessorFn: (row: ParticipantData) => participantName(row, studyConfig), header: 'Name' }] : []),
    {
      accessorFn: (row: ParticipantData) => new Date(Math.max(...Object.values<StoredAnswer>(row.answers).filter((data) => data.endTime > 0).map((s) => s.endTime)) - Math.min(...Object.values<StoredAnswer>(row.answers).filter((data) => data.startTime > 0).map((s) => s.startTime))),
      header: 'Duration',
      Cell: ({ cell }: {cell: MRT_Cell<ParticipantData, Date>}) => (
        !Number.isNaN(cell.getValue()) ? (
          <Badge
            variant="light"
            size="lg"
            color="gray"
            leftSection={<IconHourglassEmpty width={18} height={18} style={{ paddingTop: 1 }} />}
            pb={1}
          >
            {`${humanReadableDuration(+cell.getValue()) || 'N/A'}`}
          </Badge>
        ) : 'Incomplete'
      ),

    },

    {
      accessorFn: (row: ParticipantData) => new Date(Math.min(...Object.values<StoredAnswer>(row.answers).filter((data) => data.startTime > 0).map((s) => s.startTime))),
      Cell: ({ cell }) => (
        formatDate(cell.getValue() as Date)
      ),
      header: 'Start Time',
    },
    {
      accessorFn: (row: ParticipantData) => Object.values(row.answers).filter((answer) => answer.correctAnswer.length > 0 && answer.endTime > 0).map((answer) => checkAnswerCorrect(answer.answer, answer.correctAnswer)),
      header: 'Correct Answers',
      Cell: ({ cell }: {cell: MRT_Cell<ParticipantData, boolean[]>}) => (
        <>
          <Badge
            variant="light"
            size="lg"
            color="green"
            leftSection={<IconCheck width={18} height={18} style={{ paddingTop: 1 }} />}
            pb={1}
          >
            {cell.getValue().filter((b) => b).length}
          </Badge>
          <Badge
            variant="light"
            size="lg"
            color="red"
            leftSection={<IconX width={18} height={18} style={{ paddingTop: 1 }} />}
            pb={1}
          >

            {cell.getValue().length - cell.getValue().filter((b) => b).length}
          </Badge>
        </>
      ),
    },

  ], [studyConfig]);

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
    mantineTableContainerProps: { style: { maxHeight: '75vh' } },
    layoutMode: 'grid',
    renderDetailPanel: ({ row }) => {
      const r = row.original;
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
      <>
        <Flex justify="space-between" mb={8} p={8}>
          <Group>
            <Button disabled={Object.keys(checked).length === 0 || !user.isAdmin} onClick={() => setModalRejectParticipantsOpened(true)} color="red">
              Reject Participants (
              {Object.keys(checked).length}
              )
            </Button>
          </Group>
        </Flex>
        <Modal
          opened={modalRejectParticipantsOpened}
          onClose={() => setModalRejectParticipantsOpened(false)}
          title={(
            <Text>
              Reject Participants (
              {Object.keys(checked).length}
              )
            </Text>
        )}
        >
          <TextInput
            label="Please enter the reason for rejection."
            onChange={(event) => setRejectParticipantsMessage(event.target.value)}
          />
          <Flex mt="sm" justify="right">
            <Button mr={5} variant="subtle" color="dark" onClick={() => { setModalRejectParticipantsOpened(false); setRejectParticipantsMessage(''); }}>
              Cancel
            </Button>
            <Button color="red" onClick={() => handleRejectParticipants()}>
              Reject Participants
            </Button>
          </Flex>
        </Modal>
      </>
    ),
  });

  return (
    visibleParticipants.length > 0 ? (
      <>
        <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />
        <Container fluid style={{ width: '100%', overflow: 'auto', height: '100%' }}>
          <MantineReactTable
            table={table}
          />
        </Container>
      </>

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
