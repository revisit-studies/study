import React, { useEffect } from 'react';
import {
  Text, Title, ScrollArea, Badge,
} from '@mantine/core';
import style from './sumsifter.module.css';

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
      className={style.sourceItem}
      ref={ref}
      component="span"
      px={5}
    >
      {isActive && (
        <Badge
          className={style.sourceItemBadge}
        >
          {source.id}
        </Badge>
      )}
      <Text
        component="span"
        bg={isActive ? 'blue.3' : 'transparent'}
        dangerouslySetInnerHTML={{ __html: source.text }}
      />
    </Text>
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
