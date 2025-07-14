/* eslint-disable react/no-unstable-nested-components */
/* eslint-disable camelcase */
import {
  Text, Flex, Button, LoadingOverlay, Group, Space, Modal, TextInput,
  Box,
  Table,
  Tooltip,
} from '@mantine/core';
import React, {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { data, useParams } from 'react-router';
import {
  MantineReactTable, MRT_Cell, MRT_ColumnDef, MRT_RowSelectionState, useMantineReactTable,
} from 'mantine-react-table';
import { IconCheck, IconProgress } from '@tabler/icons-react';

import {
  ParticipantData, StoredAnswer, StudyConfig,
} from '../../../parser/types';
import { useStorageEngine } from '../../../storage/storageEngineHooks';
import { DownloadButtons } from '../../../components/downloader/DownloadButtons';
import { useAuth } from '../../../store/hooks/useAuth';
import 'mantine-react-table/styles.css';
import { participantName } from '../../../utils/participantName';
import { AllTasksTimeline } from '../replay/AllTasksTimeline';

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

function formatTimeWithDays(date: Date): string | JSX.Element {
  if (date.valueOf() === 0 || Number.isNaN(date.valueOf())) {
    return <Text size="sm" c="dimmed">Incomplete</Text>;
  }
  // Get total milliseconds since epoch (or use any delta duration in ms)
  const totalMilliseconds = date.getTime();

  // Convert to total seconds (assuming you're dealing with duration, not clock time)
  const totalSeconds = Math.floor(totalMilliseconds / 1000);

  const days = Math.floor(totalSeconds / 86400);
  const remainingSecondsAfterDays = totalSeconds % 86400;

  const hours = Math.floor(remainingSecondsAfterDays / 3600);
  const minutes = Math.floor((remainingSecondsAfterDays % 3600) / 60);
  const seconds = remainingSecondsAfterDays % 60;

  const totalHours = days * 24 + hours;

  return `${totalHours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function TableView({
  visibleParticipants,
  studyConfig,
  refresh,
  width,
}: {
  visibleParticipants: ParticipantData[];
  studyConfig: StudyConfig;
  refresh: () => Promise<void>;
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
      accessorKey: 'completed', header: 'Status', size: 130, Cell: ({ cell }) => (cell.getValue() ? <Tooltip label="Completed"><IconCheck size={16} color="teal" style={{ marginBottom: -3 }} /></Tooltip> : <Tooltip label="In Progress"><IconProgress size={16} color="orange" style={{ marginBottom: -3 }} /></Tooltip>),
    },
    { accessorKey: 'participantIndex', header: '#', size: 140 },
    { accessorKey: 'participantId', header: 'ID' },
    ...(studyConfig.uiConfig.participantNameField ? [{ accessorFn: (row: ParticipantData) => participantName(row, studyConfig), header: 'Name' }] : []),
    {
      accessorFn: (row: ParticipantData) => new Date(Math.max(...Object.values<StoredAnswer>(row.answers).filter((data) => data.endTime > 0).map((s) => s.endTime)) - Math.min(...Object.values<StoredAnswer>(row.answers).filter((data) => data.startTime > 0).map((s) => s.startTime))),
      header: 'Total Duration',
      Cell: ({ cell }: {cell: MRT_Cell<ParticipantData, Date>}) => formatTimeWithDays(cell.getValue()) || 'Incomplete',

    },

    {
      accessorFn: (row: ParticipantData) => new Date(Math.min(...Object.values<StoredAnswer>(row.answers).filter((data) => data.startTime > 0).map((s) => s.startTime))),
      Cell: ({ cell }) => (
        formatDate(cell.getValue() as Date)
      ),
      header: 'Start Time',
    },
    {
      accessorFn: (row: ParticipantData) => new Date(Math.max(...Object.values<StoredAnswer>(row.answers).filter((data) => data.endTime > 0).map((s) => s.endTime))),
      Cell: ({ cell }) => (
        formatDate(cell.getValue() as Date)
      ),
      header: 'End Time',
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
    layoutMode: 'grid',
    renderDetailPanel: ({ row, table }) => {
      const r = row.original;
      return (
        <AllTasksTimeline maxLength={undefined} studyConfig={studyConfig} studyId={studyId || ''} height={200} participantData={r} width={width - 40} />
      );
    },
    defaultColumn: {
      minSize: 20, // allow columns to get smaller than default
      maxSize: 1000, // allow columns to get larger than default
      size: 180, // make columns wider by default
    },
  });

  return (
    visibleParticipants.length > 0 ? (
      <>
        <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />
        <Flex justify="space-between" mb={8} p={8}>
          <Group>
            <DownloadButtons visibleParticipants={visibleParticipants} studyId={studyId || ''} />
            <Button disabled={Object.keys(checked).length === 0 || !user.isAdmin} onClick={() => setModalRejectParticipantsOpened(true)} color="red">
              Reject Participants (
              {Object.keys(checked).length}
              )
            </Button>
          </Group>
        </Flex>
        <Flex direction="column" style={{ width: '100%', overflow: 'auto' }}>
          <MantineReactTable
            table={table}

          />
        </Flex>
        <Modal
          opened={modalRejectParticipantsOpened}
          onClose={() => setModalRejectParticipantsOpened(false)}
          title={(
            <Text>
              Reject Participants (
              {checked.length}
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
