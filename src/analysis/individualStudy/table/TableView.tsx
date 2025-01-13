import {
  Box, Spoiler, Stack, Table, Text, Flex, Checkbox, Button, Tooltip, LoadingOverlay, Group, Select, Space, Modal, TextInput,
} from '@mantine/core';
import {
  IconCheck, IconProgress,
  IconSearch,
  IconX,
} from '@tabler/icons-react';
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ParticipantData, StoredAnswer, StudyConfig } from '../../../parser/types';
import { ParticipantMetadata } from '../../../store/types';
import { configSequenceToUniqueTrials, findBlockForStep, getSequenceFlatMap } from '../../../utils/getSequenceFlatMap';
import { useStorageEngine } from '../../../storage/storageEngineHooks';
import { DownloadButtons } from '../../../components/downloader/DownloadButtons';
import { useAuth } from '../../../store/hooks/useAuth';
import { getCleanedDuration } from '../../../utils/getCleanedDuration';

function AnswerCell({ cellData }: { cellData: StoredAnswer }) {
  return Number.isFinite(cellData.endTime) && Number.isFinite(cellData.startTime) ? (
    <Table.Td>
      <Stack miw={100}>
        {cellData.timedOut
          ? <Text>Timed out</Text>
          : Object.entries(cellData.answer).map(([key, storedAnswer]) => (
            <Box key={`cell-${key}`}>
              <Text fw={700} span>
                {' '}
                {`${key}: `}
              </Text>
              {/* Checks for stored answer being an object (which is answer type of Matrix responses) */}
              {typeof storedAnswer === 'object'
                ? (
                  <Text size="xs" component="pre" span>
                    {`${JSON.stringify(storedAnswer, null, 2)}`}
                  </Text>
                )
                : (
                  <Text span>
                    {storedAnswer}
                  </Text>
                )}
            </Box>
          ))}
      </Stack>
    </Table.Td>
  ) : (
    <Table.Td>N/A</Table.Td>
  );
}

function DurationCell({ cellData }: { cellData: StoredAnswer }) {
  const duration = (cellData.endTime - cellData.startTime) / 1000;
  const cleanedDuration = getCleanedDuration(cellData);
  return Number.isFinite(cellData.endTime) && Number.isFinite(cellData.startTime) ? (
    <Table.Td>
      {duration.toFixed(1)}
      {' '}
      s
      {cleanedDuration && (
        <>
          <br />
          {' '}
          (
          {(cleanedDuration / 1000).toFixed(1)}
          {' '}
          s)
        </>
      )}
    </Table.Td>
  ) : (
    <Table.Td>N/A</Table.Td>
  );
}

function MetaCell(props: { metaData: ParticipantMetadata }) {
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
  visibleParticipants,
  studyConfig,
  refresh,
}: {
  visibleParticipants: ParticipantData[];
  studyConfig: StudyConfig;
  refresh: () => Promise<void>;
}) {
  const { storageEngine } = useStorageEngine();
  const { studyId } = useParams();
  const { user } = useAuth();
  const rejectParticipant = async (participantId: string, reason: string) => {
    if (storageEngine && studyId) {
      if (user.isAdmin) {
        const finalReason = reason === '' ? 'Rejected by admin' : reason;
        await storageEngine.rejectParticipant(studyId, participantId, finalReason);
        await refresh();
      } else {
        console.warn('You are not authorized to perform this action.');
      }
    }
  };
  const [checked, setChecked] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalRejectParticipantsOpened, setModalRejectParticipantsOpened] = useState<boolean>(false);
  const [rejectParticipantsMessage, setRejectParticipantsMessage] = useState<string>('');

  const handleRejectParticipants = async () => {
    setLoading(true);
    setModalRejectParticipantsOpened(false);
    const promises = checked.map(async (participantId) => await rejectParticipant(participantId, rejectParticipantsMessage));
    await Promise.all(promises);
    setChecked([]);
    await refresh();
    setLoading(false);
  };

  function handleSelect(value: string) {
    if (value === 'all') {
      if (checked.length === visibleParticipants.length) {
        setChecked([]);
      } else {
        setChecked(visibleParticipants.map((record) => record.participantId));
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
        <Checkbox mb={-4} checked={checked.length === visibleParticipants.length} onChange={() => handleSelect('all')} />
      </Flex>
    </Table.Th>,
    <Table.Th key="ID">ID</Table.Th>,
    <Table.Th key="status">Status</Table.Th>,
    <Table.Th key="tags">Tags</Table.Th>,
    <Table.Th key="meta">Meta</Table.Th>,
    ...uniqueTrials.flatMap((trial) => [
      <Table.Th key={`header-${trial.componentName}-${trial.timesSeenInBlock}`}>{trial.componentName}</Table.Th>,
      <Table.Th key={`header-${trial.componentName}-${trial.timesSeenInBlock}-duration`}>
        <span style={{ whiteSpace: 'nowrap' }}>{trial.componentName}</span>
        {' '}
        Duration (clean)
      </Table.Th>,
    ]),
    <Table.Th key="total-duration">Total Duration (clean)</Table.Th>,
  ];

  const rows = visibleParticipants.map((record) => (
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
        <Flex direction="column" miw={100}>
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
                {((Object.entries(record.answers).filter(([_, entry]) => entry.endTime !== -1 && entry.endTime !== undefined).length / (getSequenceFlatMap(record.sequence).length - 1)) * 100).toFixed(2)}
                %
              </Text>
            )}
          </Flex>
          {record.rejected && (
            <Text mt={5} fz={10}>
              {record.rejected.reason}
            </Text>
          )}
        </Flex>
      </Table.Td>

      <Table.Td>
        <Flex direction="column" miw={100}>
          {(record.participantTags || []).map((tag) => (
            <Text key={`tag-${tag}`} fz={10}>
              -
              {' '}
              {tag}
            </Text>
          ))}
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
        return (trialData !== null && trialData.length >= trial.timesSeenInBlock + 1 && trialData[trial.timesSeenInBlock][1].endTime !== -1 ? (
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
          startTime: Math.min(...Object.values(record.answers).filter((a) => a.endTime !== -1 && a.endTime !== undefined).map((a) => a.startTime)),
          endTime: Math.max(...Object.values(record.answers).filter((a) => a.endTime !== -1 && a.endTime !== undefined).map((a) => a.endTime)),
          answer: {},
          helpButtonClickedCount: 0, // not used
          incorrectAnswers: {}, // not used
          windowEvents: Object.values(record.answers).flatMap((a) => a.windowEvents),
          timedOut: false, // not used
        }}
        key={`cell-${record.participantId}-total-duration`}
      />
    </Table.Tr>
  ));

  return (
    visibleParticipants.length > 0 ? (
      <>
        <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />
        <Flex justify="space-between" mb={8} p={8}>
          <Group>
            <Select
              w={350}
              variant="filled"
              placeholder="Search for a participant ID"
              data={[...new Set(visibleParticipants.map((part) => part.participantId))]}
              searchable
              value={null}
              leftSection={<IconSearch size={14} />}
              onChange={(value) => value && handleSelect(value)}
            />
          </Group>
          <Group>
            <DownloadButtons visibleParticipants={visibleParticipants} studyId={studyId || ''} />
            <Button disabled={checked.length === 0 || !user.isAdmin} onClick={() => setModalRejectParticipantsOpened(true)} color="red">
              Reject Participants (
              {checked.length}
              )
            </Button>
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
