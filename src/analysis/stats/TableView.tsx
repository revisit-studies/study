import {
  Box, Spoiler, Stack, Table, Text,
  Flex,
} from '@mantine/core';
import { IconCheck, IconProgress } from '@tabler/icons-react';
import { ParticipantData, StoredAnswer } from '../../parser/types';
import { ParticipantMetadata } from '../../store/types';
import { getSequenceFlatMap } from '../../utils/getSequenceFlatMap';

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
        <Stack spacing="xs">
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
export function TableView({ completed, inProgress }: { completed: ParticipantData[], inProgress: ParticipantData[] }) {
  const uniqueTrials = [...new Set(...completed.map((complete) => getSequenceFlatMap(complete.sequence)))].filter((trial) => trial !== 'end');

  const headers = [
    <th key="ID">ID/Status</th>,
    <th key="meta">Meta</th>,
    ...uniqueTrials.flatMap((trialName) => [
      <th key={`header-${trialName}`}>{trialName}</th>,
      <th key={`header-${trialName}-duration`}>
        {trialName}
        {' '}
        Duration
      </th>,
    ]),
  ];

  const rows = [...completed, ...inProgress].map((record) => (
    <tr key={record.participantId}>
      <td>
        <Box sx={{ display: 'block', whiteSpace: 'nowrap' }}>
          {record.participantId}
          {'  '}
          {record.completed
            ? <IconCheck size={16} color="teal" style={{ marginBottom: -3 }} />
            : <IconProgress size={16} color="orange" style={{ marginBottom: -3 }} />}
        </Box>
      </td>
      {record.metadata ? <MetaCell metaData={record.metadata} /> : <td>N/A</td>}
      {uniqueTrials.map((trialName) => {
        const userAnswerKey = Object.keys(record.answers).filter((key) => key.includes(trialName))[0];
        return userAnswerKey
          ? [<AnswerCell key={`${userAnswerKey}-answers`} cellData={record.answers[userAnswerKey]} />, <DurationCell key={`${userAnswerKey}-duration`} cellData={record.answers[userAnswerKey]} />]
          : [<td key={`${userAnswerKey}-answers`}>N/A</td>, <td key={`${userAnswerKey}-duration`}>N/A</td>];
      })}
    </tr>
  ));

  return (
    [...completed, ...inProgress].length > 0 ? (
      <Table>
        <thead>
          <tr>{headers}</tr>
        </thead>
        <tbody>{rows}</tbody>
      </Table>
    ) : (
      <Flex justify="center" align="center" style={{ height: '100%' }}>
        <Text>No data available</Text>
      </Flex>
    )
  );
}
