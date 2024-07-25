import {
  Box, Spoiler, Stack, Table, Text, Flex, Checkbox, Button, Tooltip, LoadingOverlay, Group, Select, Space,
} from '@mantine/core';
import {
  IconCheck, IconProgress,
  IconSearch,
  IconX,
} from '@tabler/icons-react';
import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { openConfirmModal } from '@mantine/modals';
import { ParticipantData, StoredAnswer, StudyConfig } from '../../../parser/types';
import { ParticipantMetadata } from '../../../store/types';
import { configSequenceToUniqueTrials, findBlockForStep, getSequenceFlatMap } from '../../../utils/getSequenceFlatMap';
import { useStorageEngine } from '../../../storage/storageEngineHooks';
import { DownloadButtons } from '../../../components/downloader/DownloadButtons';
import { useAuth } from '../../../store/hooks/useAuth';

function AnswerCell({ cellData }: { cellData: StoredAnswer }) {
  return (
    <Table.Td>
      <Stack miw={100}>
        {Object.entries(cellData.answer).map(([key, storedAnswer]) => (
          <Box key={`cell-${key}`}>
            <Text fw={700} span>
              {' '}
              {`${key}: `}
            </Text>
            <Text span>
              {`${storedAnswer}`}
            </Text>
          </Box>
        ))}
      </Stack>
    </Table.Td>
  );
}

function DurationCell({ cellData }: { cellData: StoredAnswer }) {
  const duration = (cellData.endTime - cellData.startTime) / 1000;
  return (
    <Table.Td>
      {duration.toFixed(1)}
      {' '}
      s
    </Table.Td>
  );
}

function MetaCell(props:{metaData: ParticipantMetadata}) {
  const { metaData } = props;
  return (
    <Table.Td>
      <Spoiler w={200} hideLabel="hide" maxHeight={50} showLabel="more">
        <Stack gap="xs">
          <Box>
            IP:
            {' '}
            {metaData.ip}
          </Box>
          <Box>
            Language:
            {' '}
            {metaData.language}
          </Box>
          <Box>
            Resolution:
            {' '}
            {JSON.stringify(metaData.resolution)}
          </Box>
          <Box>
            User Agent:
            {' '}
            {metaData.userAgent}
          </Box>
        </Stack>
      </Spoiler>
    </Table.Td>
  );
}
export function TableView({
  completed,
  inProgress,
  rejected,
  studyConfig,
  refresh,
}: {
  completed: ParticipantData[];
  inProgress: ParticipantData[];
  rejected: ParticipantData[];
  studyConfig: StudyConfig;
  refresh: () => Promise<void>;
}) {
  const { storageEngine } = useStorageEngine();
  const { studyId } = useParams();
  const { user } = useAuth();
  const rejectParticipant = async (participantId: string) => {
    if (storageEngine && studyId) {
      if (user.isAdmin) {
        await storageEngine.rejectParticipant(studyId, participantId);
        await refresh();
      } else {
        console.warn('You are not authorized to perform this action.');
      }
    }
  };
  const [checked, setChecked] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const openModal = () => openConfirmModal({
    title: 'Confirm rejecting participants',
    children: (
      <Text size="sm">
        Are you sure you want to reject the selected participants? This action is
        {' '}
        <Text span fw={700} td="underline" inherit>irreversible</Text>
        , and will return the participants&apos; sequences to the beginning of the sequence array.
      </Text>
    ),
    labels: { confirm: 'Reject Participants', cancel: 'Cancel' },
    confirmProps: { color: 'red' },
    cancelProps: { variant: 'subtle', color: 'dark' },
    onCancel: () => {},
    onConfirm: async () => {
      setLoading(true);
      const promises = checked.map(async (participantId) => await rejectParticipant(participantId));
      await Promise.all(promises);
      setChecked([]);
      await refresh();
      setLoading(false);
    },
  });

  const allParticipants = useMemo(() => [...completed, ...inProgress, ...rejected], [completed, inProgress, rejected]);

  function handleSelect(value: string) {
    if (value === 'all') {
      if (checked.length === allParticipants.length) {
        setChecked([]);
      } else {
        setChecked(allParticipants.map((record) => record.participantId));
      }
    } else if (!checked.includes(value)) {
      setChecked([...checked, value]);
    } else {
      setChecked(checked.filter((item) => item !== value));
    }
  }
  const uniqueTrials = configSequenceToUniqueTrials(studyConfig.sequence);
  const headers = [
    <Table.Th key="action">
      <Flex justify="center">
        <Checkbox mb={-4} checked={checked.length === allParticipants.length} onChange={() => handleSelect('all')} />
      </Flex>
    </Table.Th>,
    <Table.Th key="ID">ID</Table.Th>,
    <Table.Th key="status">Status</Table.Th>,
    <Table.Th key="meta">Meta</Table.Th>,
    ...uniqueTrials.flatMap((trial) => [
      <Table.Th key={`header-${trial.componentName}-${trial.timesSeenInBlock}`}>{trial.componentName}</Table.Th>,
      <Table.Th key={`header-${trial.componentName}-${trial.timesSeenInBlock}-duration`}>
        <span style={{ whiteSpace: 'nowrap' }}>{trial.componentName}</span>
        {' '}
        Duration
      </Table.Th>,
    ]),
    <Table.Th key="total-duration">Total Duration</Table.Th>,
  ];

  const rows = allParticipants.map((record) => (
    <Table.Tr key={record.participantId}>
      <Table.Td>
        <Flex justify="center">
          <Checkbox mb={-4} checked={checked.includes(record.participantId)} onChange={() => handleSelect(record.participantId)} />
        </Flex>
      </Table.Td>
      <Table.Td style={{ whiteSpace: 'nowrap' }}>
        {record.participantId}
      </Table.Td>
      <Table.Td>
        <Flex direction="row" align="center">
          {
          // eslint-disable-next-line no-nested-ternary
          record.rejected ? <Tooltip label="Rejected"><IconX size={16} color="red" style={{ marginBottom: -3 }} /></Tooltip>
            : record.completed
              ? <Tooltip label="Completed"><IconCheck size={16} color="teal" style={{ marginBottom: -3 }} /></Tooltip>
              : <Tooltip label="In Progress"><IconProgress size={16} color="orange" style={{ marginBottom: -3 }} /></Tooltip>
        }
          {(!record.completed) && (
          <Text size="sm" mb={-1} ml={4}>
            {((Object.entries(record.answers).filter(([_, entry]) => entry.endTime !== undefined).length / (getSequenceFlatMap(record.sequence).length - 1)) * 100).toFixed(2)}
            %
          </Text>
          )}
        </Flex>
      </Table.Td>
      {record.metadata ? <MetaCell metaData={record.metadata} /> : <Table.Td>N/A</Table.Td>}
      {uniqueTrials.map((trial) => {
        const sequenceBlock = findBlockForStep(record.sequence, trial.orderPath);
        const trialData = sequenceBlock && Object.entries(record.answers)
          .sort((a, b) => {
            const aIndex = parseInt(a[0].slice(a[0].lastIndexOf('_') + 1), 10);
            const bIndex = parseInt(b[0].slice(b[0].lastIndexOf('_') + 1), 10);
            return aIndex - bIndex;
          })
          .filter(([trialId]) => {
            const trialName = trialId.slice(0, trialId.lastIndexOf('_'));
            const trialIndex = parseInt(trialId.slice(trialId.lastIndexOf('_') + 1), 10);
            return trialName === trial.componentName && trialIndex <= sequenceBlock[0].lastIndex && trialIndex >= sequenceBlock[0].firstIndex;
          });
        return (trialData !== null && trialData.length >= trial.timesSeenInBlock + 1 ? (
          <React.Fragment key={`cellgroup-${record.participantId}-${trial.componentName}-${trial.timesSeenInBlock}`}>
            <AnswerCell cellData={trialData[trial.timesSeenInBlock][1]} />
            <DurationCell cellData={trialData[trial.timesSeenInBlock][1]} />
          </React.Fragment>
        ) : (
          <React.Fragment key={`cellgroup-${record.participantId}-${trial.componentName}-${trial.timesSeenInBlock}`}>
            <Table.Td>N/A</Table.Td>
            <Table.Td>N/A</Table.Td>
          </React.Fragment>
        ));
      })}
      <DurationCell
        cellData={{
          startTime: Math.min(...Object.values(record.answers).map((a) => a.startTime)),
          endTime: Math.max(...Object.values(record.answers).map((a) => a.endTime)),
          answer: {},
          windowEvents: [],
        }}
        key={`cell-${record.participantId}-total-duration`}
      />
    </Table.Tr>
  ));

  return (
    allParticipants.length > 0 ? (
      <>
        <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />
        <Flex justify="space-between" mb={8} p={8}>
          <Group>
            <Select
              w={350}
              variant="filled"
              placeholder="Search for a participant ID"
              data={allParticipants.map((record) => ({ value: record.participantId, label: record.participantId }))}
              searchable
              value={null}
              leftSection={<IconSearch size={14} />}
              onChange={(value) => value && handleSelect(value)}
            />
          </Group>
          <Group>
            <DownloadButtons allParticipants={[...completed, ...inProgress]} studyId={studyId || ''} />
            <Button disabled={checked.length === 0 || !user.isAdmin} onClick={openModal} color="red">Reject Participants</Button>
          </Group>
        </Flex>
        <Flex direction="column" style={{ width: '100%', overflow: 'auto' }}>
          <Table striped withTableBorder>
            <Table.Thead>
              <Table.Tr>{headers}</Table.Tr>
            </Table.Thead>
            <Table.Tbody>{rows}</Table.Tbody>
          </Table>
        </Flex>
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
