/* eslint-disable react/no-unstable-nested-components */
import {
  Text, Flex, Button, Group, Space, Modal, TextInput,
  Tooltip,
  Badge,
  RingProgress,
  Stack,
  Alert,
} from '@mantine/core';
import React, {
  useCallback, useMemo, useState,
} from 'react';
import { useParams } from 'react-router';
import {
  MantineReactTable, MRT_Cell as MrtCell, MRT_ColumnDef as MrtColumnDef, MRT_RowSelectionState as MrtRowSelectionState, useMantineReactTable,
} from 'mantine-react-table';
import {
  IconCheck, IconHourglassEmpty, IconX, IconAlertTriangle,
} from '@tabler/icons-react';

import {
  ParticipantData, StoredAnswer, StudyConfig,
} from '../../../parser/types';
import { useStorageEngine } from '../../../storage/storageEngineHooks';
import { useAuth } from '../../../store/hooks/useAuth';
import { participantName } from '../../../utils/participantName';
import { AllTasksTimeline } from '../replay/AllTasksTimeline';
import { checkAnswerCorrect } from '../../../store/hooks/useNextStep';
import { humanReadableDuration } from '../../../utils/humanReadableDuration';
import { getSequenceFlatMap } from '../../../utils/getSequenceFlatMap';
import { MetaCell } from './MetaCell';
import { DownloadButtons } from '../../../components/downloader/DownloadButtons';

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
}: {
  visibleParticipants: ParticipantData[];
  studyConfig: StudyConfig;
  refresh: () => Promise<Record<number, ParticipantData>>;
  width: number;
}) {
  const { storageEngine } = useStorageEngine();
  const { studyId } = useParams();
  const { user } = useAuth();
  const [checked, setChecked] = useState<MrtRowSelectionState>({});

  const rejectParticipant = useCallback(async (participantId: string, reason: string) => {
    if (storageEngine && studyId) {
      const finalReason = reason === '' ? 'Rejected by admin' : reason;
      await storageEngine.rejectParticipant(participantId, finalReason, studyId);
      await refresh();
    }
  }, [refresh, storageEngine, studyId]);

  const undoRejectParticipant = useCallback(async (participantId: string) => {
    if (storageEngine && studyId) {
      await storageEngine.undoRejectParticipant(participantId, studyId);
      await refresh();
    }
  }, [refresh, storageEngine, studyId]);

  const [modalRejectParticipantsOpened, setModalRejectParticipantsOpened] = useState<boolean>(false);
  const [modalUndoRejectParticipantsOpened, setModalUndoRejectParticipantsOpened] = useState<boolean>(false);
  const [rejectParticipantsMessage, setRejectParticipantsMessage] = useState<string>('');

  const handleRejectParticipants = useCallback(async () => {
    setModalRejectParticipantsOpened(false);
    const participantsToReject = Object.keys(checked)
      .filter((v) => checked[v])
      .filter((participantId) => {
        const participant = visibleParticipants.find((p) => p.participantId === participantId);
        return participant && !participant.rejected;
      });

    const promises = participantsToReject.map(async (participantId) => await rejectParticipant(participantId, rejectParticipantsMessage));
    await Promise.all(promises);
    setChecked({});
    await refresh();
  }, [checked, refresh, rejectParticipant, rejectParticipantsMessage, visibleParticipants]);

  const handleUndoRejectParticipants = useCallback(async () => {
    setModalUndoRejectParticipantsOpened(false);
    const promises = Object.keys(checked).filter((v) => checked[v]).map(async (participantId) => await undoRejectParticipant(participantId));
    await Promise.all(promises);
    setChecked({});
    await refresh();
  }, [checked, refresh, undoRejectParticipant]);

  const selectedData = useMemo(() => {
    const selected = Object.keys(checked).filter((v) => checked[v])
      .map((participantId) => visibleParticipants.find((p) => p.participantId === participantId))
      .filter((p) => p !== undefined) as ParticipantData[];

    return selected.length > 0 ? selected : visibleParticipants;
  }, [checked, visibleParticipants]);

  const selectedParticipants = useMemo(() => Object.keys(checked).filter((v) => checked[v])
    .map((participantId) => visibleParticipants.find((p) => p.participantId === participantId))
    .filter((p) => p !== undefined) as ParticipantData[], [checked, visibleParticipants]);

  const areSelectedParticipantsRejected = useMemo(() => selectedParticipants.length > 0 && selectedParticipants.every((p) => p.rejected), [selectedParticipants]);

  const rejectedParticipantsCount = useMemo(() => selectedParticipants.filter((p) => p.rejected).length, [selectedParticipants]);
  const nonRejectedParticipantsCount = useMemo(() => selectedParticipants.filter((p) => !p.rejected).length, [selectedParticipants]);
  const hasNonRejectedSelected = useMemo(() => selectedParticipants.some((p) => !p.rejected), [selectedParticipants]);

  const columns = useMemo<MrtColumnDef<ParticipantData>[]>(() => [
    {
      accessorFn: (row: ParticipantData) => {
        const incompleteEntries = Object.entries(row.answers || {}).filter((e) => e[1].startTime === 0);

        return { percent: (Object.entries(row.answers).length - incompleteEntries.length) / (getSequenceFlatMap(row.sequence).length - 1), completed: row.completed, rejected: row.rejected };
      },
      header: 'Status',
      size: 50,
      Cell: ({ cell }: { cell: MrtCell<ParticipantData, {percent: number, completed: boolean, rejected: ParticipantData['rejected']}> }) => {
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
    { accessorKey: 'participantIndex', header: '#', size: 50 },
    { accessorKey: 'participantId', header: 'ID' },
    ...(studyConfig.uiConfig.participantNameField ? [{ accessorFn: (row: ParticipantData) => participantName(row, studyConfig), header: 'Name' }] : []),
    {
      accessorFn: (row: ParticipantData) => new Date(Math.max(...Object.values<StoredAnswer>(row.answers).filter((data) => data.endTime > 0).map((s) => s.endTime)) - Math.min(...Object.values<StoredAnswer>(row.answers).filter((data) => data.startTime > 0).map((s) => s.startTime))),
      header: 'Duration',
      Cell: ({ cell }: {cell: MrtCell<ParticipantData, Date>}) => (
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
      Cell: ({ cell }: {cell: MrtCell<ParticipantData, boolean[]>}) => (
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
    {
      accessorKey: 'metadata',
      header: 'Metadata',
      Cell: ({ cell }: {cell: MrtCell<ParticipantData, ParticipantData['metadata']>}) => <MetaCell metaData={cell.getValue()} />,
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
    mantinePaperProps: { style: { maxHeight: '100%', display: 'flex', flexDirection: 'column' } },
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
            {areSelectedParticipantsRejected && (
              <Tooltip label="Only admins can undo rejection" disabled={user.isAdmin}>
                <Button disabled={Object.keys(checked).length === 0 || !user.isAdmin} onClick={() => setModalUndoRejectParticipantsOpened(true)} color="blue">
                  Undo Reject Participants (
                  {Object.keys(checked).length}
                  )
                </Button>
              </Tooltip>
            )}
            {hasNonRejectedSelected && (
              <Tooltip label="Only admins can reject participants" disabled={user.isAdmin}>
                <Button disabled={nonRejectedParticipantsCount === 0 || !user.isAdmin} onClick={() => setModalRejectParticipantsOpened(true)} color="red">
                  Reject Participants (
                  {nonRejectedParticipantsCount}
                  )
                </Button>
              </Tooltip>
            )}
            <DownloadButtons
              visibleParticipants={selectedData}
              studyId={studyId || ''}
            />
          </Group>
        </Flex>
        <Modal
          opened={modalRejectParticipantsOpened}
          onClose={() => setModalRejectParticipantsOpened(false)}
          title={(
            <Text>
              Reject Participants (
              {nonRejectedParticipantsCount}
              )
            </Text>
        )}
        >
          <Alert
            icon={<IconAlertTriangle size={16} />}
            title="Warning"
            color="orange"
            mb="md"
          >
            {rejectedParticipantsCount > 0 && (
              <>
                {rejectedParticipantsCount}
                {' '}
                of your
                {' '}
                {selectedParticipants.length}
                {' '}
                selected participant
                {selectedParticipants.length === 1 ? '' : 's'}
                {' '}
                {rejectedParticipantsCount === 1 ? 'has' : 'have'}
                {' '}
                already been rejected. Clicking reject participants will now reject the other
                {' '}
                {nonRejectedParticipantsCount}
                .
                <br />
                <br />
              </>
            )}
            When participants are rejected, their sequences will be reassigned to other participants.
          </Alert>
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
        <Modal
          opened={modalUndoRejectParticipantsOpened}
          onClose={() => setModalUndoRejectParticipantsOpened(false)}
          title={(
            <Text>
              Undo Reject Participants (
              {Object.keys(checked).length}
              )
            </Text>
        )}
        >
          <Alert
            icon={<IconAlertTriangle size={16} />}
            title="Warning"
            color="orange"
            mb="md"
          >
            When you undo participant rejections, you may end up with unbalanced latin squares. This is because the rejected sequence may have been reassigned.
          </Alert>
          <Text>Are you sure you want to undo the rejection of these participants?</Text>
          <Flex mt="sm" justify="right">
            <Button mr={5} variant="subtle" color="dark" onClick={() => setModalUndoRejectParticipantsOpened(false)}>
              Cancel
            </Button>
            <Button color="blue" onClick={() => handleUndoRejectParticipants()}>
              Undo Reject Participants
            </Button>
          </Flex>
        </Modal>
      </>
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
