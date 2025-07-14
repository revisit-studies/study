import {
  Table, Stack, Box, Text,
} from '@mantine/core';
import { StoredAnswer } from '../../../store/types';

export function AnswerCell({ cellData }: { cellData: StoredAnswer }) {
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
