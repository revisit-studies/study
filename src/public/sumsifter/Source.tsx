import React, { useEffect } from 'react';
import { Text, Title, ScrollArea } from '@mantine/core';

interface SourceProps {
  sourceList: { id?: string; text: string }[];
  activeSourceId: string | null;
}

function SourceItem({ source, isActive }: { source: { id?: string; text: string }; isActive: boolean }) {
  const ref = React.useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (isActive) {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [source.id, isActive]);

  return (
    <Text
      ref={ref}
      component="span"
      bg={isActive ? 'blue.3' : 'transparent'}
      px={5}
      dangerouslySetInnerHTML={{ __html: source.text }}
    />
  );
}

const MemoizedSourceItem = React.memo(SourceItem);

function Source({ sourceList, activeSourceId }: SourceProps) {
  const combinedText = sourceList.map((source, index) => (
    <MemoizedSourceItem key={index} source={source} isActive={source.id === activeSourceId} />
  ));

  return (
    <ScrollArea style={{ height: 'calc(100vh - 105px)' }}>
      <Title order={2}>Source Document</Title>
      {combinedText}
    </ScrollArea>
  );
}

export default Source;
