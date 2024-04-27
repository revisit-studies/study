import { Box, Stack, Table } from '@mantine/core';
import { GlobalConfig, ParticipantData, StoredAnswer } from '../../parser/types';
import { flattenSequence } from '../utils';

function TableCell(props: {cellData: StoredAnswer}) {
  const { cellData } = props;
  const duration = (cellData.endTime - cellData.startTime) / 1000;
  return (
    <td>
      <Stack>
        <Box>
          Duration:
          {duration.toFixed(1)}
          {' '}
          s
        </Box>
        {Object.entries(cellData.answer).map(([key, storedAnswer]) => <Box key={key}>{`${key}:${storedAnswer}`}</Box>)}
      </Stack>
    </td>
  );
}
export function TableView(props: { completed: ParticipantData[], inprogress: ParticipantData[]}) {
  const { completed, inprogress } = props;

  const uniqueTrials = [...new Set(completed.map((complete) => flattenSequence(complete.sequence)).flat().map((trial) => trial))];

  const headers = [<th key="ID">ID</th>, ...uniqueTrials.map((trialName) => <th key={trialName}>{trialName}</th>)];

  const rows = completed.map((complete) => (
    <tr key={complete.participantConfigHash}>
      <td>{complete.participantId}</td>
      {uniqueTrials.map((trialName) => {
        const userAnswerKey = Object.keys(complete.answers).filter((key) => key.includes(trialName))[0];
        return userAnswerKey ? <TableCell cellData={complete.answers[userAnswerKey]} /> : <td>N/A</td>;
      })}
    </tr>
  ));
  return (
    <Table>
      <thead>
        <tr>
          {headers}
        </tr>
      </thead>
      <tbody>{rows}</tbody>
    </Table>
  );
}
