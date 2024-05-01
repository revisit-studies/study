import {
  Box, Spoiler, Stack, Table, Text,
  Flex,
} from '@mantine/core';
import { IconCheck, IconProgress } from '@tabler/icons-react';
import { ParticipantData, StoredAnswer, StudyConfig } from '../../parser/types';
import { ParticipantMetadata } from '../../store/types';
import { configSequenceToUniqueTrials, findBlockForStep } from '../../utils/getSequenceFlatMap';

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
export function TableView({ completed, inProgress, studyConfig }: { completed: ParticipantData[], inProgress: ParticipantData[], studyConfig: StudyConfig }) {
  const uniqueTrials = configSequenceToUniqueTrials(studyConfig.sequence);
  const headers = [
    <th key="ID">ID/Status</th>,
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
        <Box sx={{ display: 'block', whiteSpace: 'nowrap' }}>
          {record.participantId}
          {'  '}
          {record.completed
            ? <IconCheck size={16} color="teal" style={{ marginBottom: -3 }} />
            : <IconProgress size={16} color="orange" style={{ marginBottom: -3 }} />}
        </Box>
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
          .filter(([trialId, answer]) => {
            const trialName = trialId.slice(0, trialId.lastIndexOf('_'));
            const trialIndex = parseInt(trialId.slice(trialId.lastIndexOf('_') + 1), 10);
            return trialName === trial.componentName && trialIndex <= sequenceBlock[0].lastIndex && trialIndex >= sequenceBlock[0].firstIndex;
          });
        return (trialData !== null && trialData.length >= trial.timesSeenInBlock + 1 ? (
          <>
            <AnswerCell key={`cell-${record.participantId}-${trial.componentName}-${trial.timesSeenInBlock}`} cellData={trialData[0][1]} />
            <DurationCell key={`cell-${record.participantId}-${trial.componentName}-${trial.timesSeenInBlock}-duration`} cellData={trialData[0][1]} />
          </>
        ) : (
          <>
            <td key={`cell-${record.participantId}-${trial.componentName}`}>N/A</td>
            <td key={`cell-${record.participantId}-${trial.componentName}-duration`}>N/A</td>
          </>
        ));
      })}
      <td>
        <DurationCell cellData={{
          startTime: Math.min(...Object.values(record.answers).map((a) => a.startTime)),
          endTime: Math.max(...Object.values(record.answers).map((a) => a.endTime)),
          answer: {},
          windowEvents: [],
        }}
        />
      </td>
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
