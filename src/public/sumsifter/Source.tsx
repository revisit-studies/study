import React from 'react';
import { Stack, Text } from '@mantine/core';

interface SourceProps {
  sourceList: { id: string; text: string }[];
  activeSourceId: string | null;
}

function Source({ sourceList, activeSourceId }: SourceProps) {
  return (
    <Stack>
      {sourceList.map((source) => (
        <Text key={source.id} bg={source.id === activeSourceId ? 'blue.1' : 'transparent'} px={5}>
          {source.text}
        </Text>
      ))}
    </Stack>
  );
}

export default Source;
