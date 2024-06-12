import React, { useEffect } from 'react';
import { Text, Title, ScrollArea } from '@mantine/core';

interface SourceProps {
  sourceList: { id?: string; text: string }[];
  activeSourceId: string | null;
}

function SourceItem({ source, activeSourceId }: { source: { id?: string; text: string }; activeSourceId: string | null }) {
  const ref = React.useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (source.id === activeSourceId) {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [source.id, activeSourceId]);

  return (
    <Text
      ref={ref}
      component="span"
      bg={source.id === activeSourceId ? 'blue.1' : 'transparent'}
      px={5}
      dangerouslySetInnerHTML={{ __html: source.text }}
    />
  );
}

function Source({ sourceList, activeSourceId }: SourceProps) {
  const combinedText = sourceList.map((source, index) => (
    <React.Fragment key={index}>
      <SourceItem source={source} activeSourceId={activeSourceId} />
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
