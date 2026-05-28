import { Box, Spoiler, Stack } from '@mantine/core';
import { ParticipantMetadata } from '../../../store/types';

export function MetaCell({ metaData }: { metaData: ParticipantMetadata | undefined }) {
  return (
    <Spoiler w={200} hideLabel="hide" maxHeight={50} showLabel="more">
      <Stack gap="xs">
        <Box fz="sm">
          <strong>Resolution:</strong>
          {' '}
          {metaData?.resolution ? JSON.stringify(metaData.resolution, null, 2) : 'N/A'}
        </Box>
        <Box fz="sm">
          <strong>User Agent:</strong>
          {' '}
          {metaData?.userAgent || 'N/A'}
        </Box>
        <Box fz="sm">
          <strong>IP:</strong>
          {' '}
          {metaData?.ip || 'N/A'}
        </Box>
        <Box fz="sm">
          <strong>Language:</strong>
          {' '}
          {metaData?.language || 'N/A'}
        </Box>
      </Stack>
    </Spoiler>
  );
}
