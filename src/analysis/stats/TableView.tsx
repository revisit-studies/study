import {
  Box, Spoiler, Stack, Table, Text,
  Flex,
  Checkbox,
  Button,
  Tooltip,
  LoadingOverlay,
  Group,
  Select,
} from '@mantine/core';
import {
  IconCheck, IconProgress,
  IconSearch,
  IconX,
} from '@tabler/icons-react';
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { openConfirmModal } from '@mantine/modals';
import { ParticipantData, StoredAnswer, StudyConfig } from '../../parser/types';
import { ParticipantMetadata } from '../../store/types';
import { configSequenceToUniqueTrials, findBlockForStep, getSequenceFlatMap } from '../../utils/getSequenceFlatMap';
import { useStorageEngine } from '../../storage/storageEngineHooks';

function AnswerCell({ cellData }: { cellData: StoredAnswer }) {
  return (
    <td>
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
    </td>
  );
}

function DurationCell({ cellData }: { cellData: StoredAnswer }) {
  const duration = (cellData.endTime - cellData.startTime) / 1000;
  return (
    <td>
      {duration.toFixed(1)}
      {' '}
      s
    </td>
  );
}

function MetaCell(props:{metaData: ParticipantMetadata}) {
  const { metaData } = props;
  return (
    <td>
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
    </td>
  );
}
export function TableView({
  completed,
  inProgress,
  studyConfig,
  refresh,
}: {
  completed: ParticipantData[];
  inProgress: ParticipantData[];
  studyConfig: StudyConfig;
  refresh: ()=> void;
}) {
  const { storageEngine } = useStorageEngine();
  const { studyId } = useParams();
  const rejectParticipant = async (participantId: string) => {
    if (storageEngine && studyId) {
      await storageEngine.rejectParticipant(studyId, participantId);
      refresh();
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
      refresh();
      setLoading(false);
    },
  });

  function handleSelect(value: string) {
    if (value === 'all') {
      if (checked.length === [...completed, ...inProgress].length) {
        setChecked([]);
      } else {
        setChecked([...completed, ...inProgress].map((record) => record.participantId));
      }
    } else if (!checked.includes(value)) {
      setChecked([...checked, value]);
    } else {
      setChecked(checked.filter((item) => item !== value));
    }
  }
  const uniqueTrials = configSequenceToUniqueTrials(studyConfig.sequence);
  const headers = [
    <th key="action">
      <Flex justify="center">
        <Checkbox mb={-4} checked={checked.length === [...completed, ...inProgress].length} onChange={() => handleSelect('all')} />
      </Flex>
    </th>,
    <th key="ID">ID</th>,
    <th key="status">Status</th>,
    <th key="meta">Meta</th>,
    ...uniqueTrials.flatMap((trial) => [
      <th key={`header-${trial.componentName}-${trial.timesSeenInBlock}`}>{trial.componentName}</th>,
      <th key={`header-${trial.componentName}-${trial.timesSeenInBlock}-duration`}>
        {trial.componentName}
        {' '}
        Duration
      </th>,
    ]),
    <th key="total-duration">Total Duration</th>,
  ];

  const rows = [...completed, ...inProgress].map((record) => (
    <tr key={record.participantId}>
      <td>
        <Flex justify="center">
          <Checkbox mb={-4} checked={checked.includes(record.participantId)} onChange={() => handleSelect(record.participantId)} />
        </Flex>
      </td>
      <td style={{ whiteSpace: 'nowrap' }}>
        {record.participantId}
      </td>
      <td>
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
            {(Object.entries(record.answers).length / (getSequenceFlatMap(record.sequence).length - 1)) * 100}
            %
          </Text>
          )}
        </Flex>
      </td>
      {record.metadata ? <MetaCell metaData={record.metadata} /> : <td>N/A</td>}
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
            <td>N/A</td>
            <td>N/A</td>
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
    </tr>
  ));

  return (
    [...completed, ...inProgress].length > 0 ? (
      <>
        <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />
        <Flex justify="space-between" mb={8} p={8}>
          <Group>
            <Select
              w={350}
              variant="filled"
              placeholder="Search for a participant ID"
              data={[...completed, ...inProgress].map((record) => ({ value: record.participantId, label: record.participantId }))}
              searchable
              leftSection={<IconSearch size={14} />}
              onChange={(value) => value && handleSelect(value)}
            />
          </Group>
          <Group>
            <Button disabled={checked.length === 0} onClick={openModal} color="red" size="xs">Reject Participants</Button>
          </Group>
        </Flex>
        <Table striped withTableBorder>
          <thead>
            <tr>{headers}</tr>
          </thead>
          <tbody>{rows}</tbody>
        </Table>
      </>
    ) : (
      <Flex justify="center" align="center" style={{ height: '100%' }}>
        <Text>No data available</Text>
      </Flex>
    )
  );
}
