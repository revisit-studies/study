import React from 'react';
import { Text, Title, ScrollArea } from '@mantine/core';

interface SourceProps {
  sourceList: { id?: string; text: string }[];
  activeSourceId: string | null;
}

function Source({ sourceList, activeSourceId }: SourceProps) {
  const combinedText = sourceList.map((source, index) => (
    <React.Fragment key={index}>
      <Text
        component="span"
        bg={source.id === activeSourceId ? 'blue.1' : 'transparent'}
        px={5}
        dangerouslySetInnerHTML={{ __html: source.text }}
      />
      {' '}
    </React.Fragment>
  ));

  return (
    <ScrollArea style={{ height: '800px' }}>
      <Title order={2}>Source</Title>
      <Text>
        {combinedText}
      </Text>
    </ScrollArea>
  );
}

export default Source;
