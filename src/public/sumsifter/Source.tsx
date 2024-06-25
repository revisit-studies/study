import React, { useCallback, useEffect } from 'react';
import {
  Text, Title, ScrollArea, Badge,
} from '@mantine/core';
import style from './sumsifter.module.css';

interface SourceProps {
  sourceList: { id?: string; text: string }[];
  activeSourceId: string | null;
  onSourceBadgePositionChange: (badgeLeft: number, badgeTop: number) => void;
}

function SourceItem({ source, isActive, onActiveRefChange }: { source: { id?: string; text: string }; isActive: boolean, onActiveRefChange: (ref: HTMLSpanElement | null) => void }) {
  const ref = React.useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (isActive) {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      onActiveRefChange(ref.current);
    }
  }, [source.id, isActive, onActiveRefChange]);

  return (
    <Text
      className={style.sourceItem}
      ref={ref}
      component="span"
      px={5}
    >
      {/* {isActive && (
        <Badge
          className={style.sourceItemBadge}
        >
          {source.id}
        </Badge>
      )} */}
      <Text
        component="span"
        bg={isActive ? 'blue.3' : 'transparent'}
        dangerouslySetInnerHTML={{ __html: source.text }}
      />
    </Text>
  );
}

const MemoizedSourceItem = React.memo(SourceItem);

function Source({ sourceList, activeSourceId, onSourceBadgePositionChange }: SourceProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const activeRef = React.useRef<HTMLSpanElement | null>(null);
  const [positionTop, setPositionTop] = React.useState(0);
  const [positionLeft, setPositionLeft] = React.useState(0);

  useEffect(() => {
    if (ref.current) {
      const element = ref.current;
      const handleScroll = () => {
        setPositionLeft(element?.getBoundingClientRect().left || 0);
        setPositionTop(activeRef.current?.getBoundingClientRect().top || 0);
        onSourceBadgePositionChange(element?.getBoundingClientRect().left || 0, activeRef.current?.getBoundingClientRect().top || 0);
      };
      ref.current.addEventListener('scroll', handleScroll);

      return () => {
        element.removeEventListener('scroll', handleScroll);
      };
    }
    return () => { };
  }, [ref, onSourceBadgePositionChange]);

  const handleActiveRefChange = useCallback((e: HTMLSpanElement | null) => {
    activeRef.current = e;
  }, []);

  useEffect(() => {
    const element = ref.current;
    setPositionLeft(element?.getBoundingClientRect().left || 0);
    setPositionTop(activeRef.current?.getBoundingClientRect().top || 0);
    onSourceBadgePositionChange(element?.getBoundingClientRect().left || 0, activeRef.current?.getBoundingClientRect().top || 0);
  }, [activeSourceId, onSourceBadgePositionChange]);

  return (
    <ScrollArea style={{ height: 'calc(100vh - 110px)' }} viewportRef={ref}>
      <Title order={2}>Source Document</Title>

      {sourceList.map((source, index) => (
        <MemoizedSourceItem key={index} source={source} isActive={source.id === activeSourceId} onActiveRefChange={handleActiveRefChange} />
      ))}

      {activeSourceId && (
        <>
          <Badge
            key={activeSourceId}
            className={style.sourceItemBadge}
            color="blue.5"
            style={{
              position: 'fixed',
              left: positionLeft - 10,
              top: positionTop,
              transform: 'translate(-100%, 0)',
            }}
          >
            {activeSourceId}
          </Badge>
          <div style={{
            position: 'fixed',
            left: positionLeft - 10,
            top: positionTop + 16,
            backgroundColor: 'var(--mantine-color-blue-5)',
            height: 2,
            width: ref.current?.clientWidth || 0,
          }}
          />
        </>
      )}
    </ScrollArea>
  );
}

export default Source;
