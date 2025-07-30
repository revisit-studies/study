import {
  Table, Spoiler, Stack, Box,
} from '@mantine/core';
import { ParticipantMetadata } from '../../../store/types';

export function MetaCell({ metaData }: { metaData: ParticipantMetadata | undefined }) {
  return (
    <Table.Td>
      <Spoiler w={200} hideLabel="hide" maxHeight={50} showLabel="more">
        <Stack gap="xs">
          <Box>
            <strong>Resolution:</strong>
            {' '}
            {JSON.stringify(metaData?.resolution, null, 2)}
          </Box>
          <Box>
            <strong>User Agent:</strong>
            {' '}
            {metaData?.userAgent}
          </Box>
          <Box>
            <strong>IP:</strong>
            {' '}
            {metaData?.ip}
          </Box>
          <Box>
            <strong>Language:</strong>
            {' '}
            {metaData?.language}
          </Box>
        </Stack>
      </Spoiler>
    </Table.Td>
  );
}
