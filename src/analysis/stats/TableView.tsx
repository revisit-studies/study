import {
  Box, Spoiler, Stack, Table, Title, Text,
} from '@mantine/core';
import { IconCheck, IconProgress } from '@tabler/icons-react';
import { ParticipantData, StoredAnswer } from '../../parser/types';
import { ParticipantMetadata } from '../../store/types';
import { getSequenceFlatMap } from '../../utils/getSequenceFlatMap';

function TableCell(props: {cellData: StoredAnswer}) {
  const { cellData } = props;
  const duration = (cellData.endTime - cellData.startTime) / 1000;
  return (
    <td>
      <Stack miw={100}>
        <Box>
          <Text fw={700} span>Duration:</Text>
          {duration.toFixed(1)}
          {' '}
          s
        </Box>
        {Object.entries(cellData.answer).map(([key, storedAnswer]) => (
          <Box key={`cell-${key}`}>
            <Text fw={500} span>
              <Text fw={700} span>
                {' '}
                {`${key}: `}
              </Text>

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

  const uniqueTrials = [...new Set(...completed.map((complete) => getSequenceFlatMap(complete.sequence)))].filter((trial) => trial !== 'end');

  const headers = [<th key="ID">ID/Status</th>, <th key="meta">Meta</th>, ...uniqueTrials.map((trialName) => <th key={`header-${trialName}`}>{trialName}</th>)];
  const rows = allData.map((record) => (
    <tr key={record.participantId}>
      <td>
        <Box sx={{ display: 'block', whiteSpace: 'nowrap' }}>
          {record.participantId}
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
          <tr>{headers}</tr>
        </thead>
        <tbody>{rows}</tbody>
      </Table>
    ) : <Title>No participant</Title>
  );
}
