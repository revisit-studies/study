import React from 'react';
import { Stack, Text } from '@mantine/core';

interface SourceProps {
  source: { id: string; text: string } | null;
}

function Source({ source }: SourceProps) {
  return (
    <Stack>
      {source ? (
        <Text>{source.text}</Text>
      ) : (
        <Text>Select a source to view its content.</Text>
      )}
    </Stack>
  );
}

export default Source;
