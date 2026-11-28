import { Box, Spoiler, Stack } from '@mantine/core';
import { ParticipantMetadata } from '../../../store/types';

export function MetaCell({ metaData }: { metaData: ParticipantMetadata | undefined }) {
  const firstLoad = metaData?.loadTimings?.[0];
  return (
    <Spoiler w={200} hideLabel="hide" maxHeight={50} showLabel="more">
      <Stack gap="xs" fz="sm">
        <Box>
          <strong>Resolution:</strong>
          {' '}
          {metaData?.resolution ? JSON.stringify(metaData.resolution, null, 2) : 'null'}
        </Box>
        <Box>
          <strong>User Agent:</strong>
          {' '}
          {metaData?.userAgent || 'null'}
        </Box>
        <Box>
          <strong>IP:</strong>
          {' '}
          {metaData?.ip || 'null'}
        </Box>
        <Box>
          <strong>Language:</strong>
          {' '}
          {metaData?.language || 'null'}
        </Box>
        {firstLoad && (
          <Box>
            <strong>Load time:</strong>
            {' '}
            {`${(firstLoad.readyMs / 1000).toFixed(1)}s`}
            {metaData!.loadTimings!.length > 1 && ` (first of ${metaData!.loadTimings!.length} loads)`}
          </Box>
        )}
      </Stack>
    </Spoiler>
  );
}
