import { Table } from '@mantine/core';
import { EventType } from 'vega';
import { getCleanedDuration } from '../../../utils/getCleanedDuration';

export function DurationCell({ cellData }: { cellData: { startTime?: number; endTime?: number; windowEvents: EventType[] } }) {
  const duration = cellData.endTime && cellData.startTime ? (cellData.endTime - cellData.startTime) / 1000 : NaN;
  const cleanedDuration = cellData.endTime && cellData.startTime ? getCleanedDuration(cellData as never) : NaN;
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
