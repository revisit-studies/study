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
            IP:
            {' '}
            {metaData?.ip}
          </Box>
          <Box>
            Language:
            {' '}
            {metaData?.language}
          </Box>
          <Box>
            Resolution:
            {' '}
            {JSON.stringify(metaData?.resolution)}
          </Box>
          <Box>
            User Agent:
            {' '}
            {metaData?.userAgent}
          </Box>
        </Stack>
      </Spoiler>
    </Table.Td>
  );
}
