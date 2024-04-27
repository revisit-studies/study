import {
  Box, Spoiler, Stack, Table, Title,
} from '@mantine/core';
import { Metadata } from '@trrack/core';
import { IconCheck, IconProgress } from '@tabler/icons-react';
import { GlobalConfig, ParticipantData, StoredAnswer } from '../../parser/types';
import { flattenSequence } from '../utils';
import { ParticipantMetadata } from '../../store/types';

function TableCell(props: {cellData: StoredAnswer}) {
  const { cellData } = props;
  const duration = (cellData.endTime - cellData.startTime) / 1000;
  return (
    <td>
      <Stack miw={100}>
        <Box>
          Duration:
          {duration.toFixed(1)}
          {' '}
          s
        </Box>
        {Object.entries(cellData.answer).map(([key, storedAnswer]) => <Box key={`cell-${key}`}>{`${key}:${storedAnswer}`}</Box>)}
      </Stack>
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
export function TableView(props: { completed: ParticipantData[], inprogress: ParticipantData[]}) {
  const { completed, inprogress } = props;

  const allData = [...completed.map((record) => ({ ...record, completed: true })), ...inprogress.map((record) => ({ ...record, completed: false }))];

  const uniqueTrials = [...new Set(completed.map((complete) => flattenSequence(complete.sequence)).flat().map((trial) => trial))];

  const headers = [<th key="ID">ID</th>, <th key="meta">Meta</th>, ...uniqueTrials.map((trialName) => <th key={`header-${trialName}`}>{trialName}</th>)];
  const rows = allData.map((record) => (
    <tr key={record.participantId}>
      <td>
        <Box>
          {record.participantId}
          {' '}
          {record.completed ? <IconCheck size={15} color="teal" /> : <IconProgress size={15} color="orange" />}
        </Box>
      </td>
      {record.metadata ? <MetaCell metaData={record.metadata} /> : <td>N/A</td>}
      {uniqueTrials.map((trialName) => {
        const userAnswerKey = Object.keys(record.answers).filter((key) => key.includes(trialName))[0];
        return userAnswerKey ? <TableCell cellData={record.answers[userAnswerKey]} /> : <td>N/A</td>;
      })}
    </tr>
  ));
  return (
    completed.length > 0 || inprogress.length > 0 ? (
      <Table>
        <thead>
          <tr>
            {headers}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </Table>
    ) : <Title>No participant</Title>
  );
}
