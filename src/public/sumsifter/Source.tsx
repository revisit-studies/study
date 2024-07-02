import React, { useCallback, useEffect, useMemo } from 'react';
import {
  Text, Title, ScrollArea, Badge,
  Button,
} from '@mantine/core';
import style from './sumsifter.module.css';

interface SourceProps {
  sourceList: { id?: string; text: string }[];
  activeSourceId: string | null;
  onSourceBadgePositionChange: (badgeLeft: number, badgeTop: number) => void;
  onAddToSummary: (text: string) => void;
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

function Source({
  sourceList, activeSourceId, onSourceBadgePositionChange, onAddToSummary,
}: SourceProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const activeRef = React.useRef<HTMLSpanElement | null>(null);
  const [positionTop, setPositionTop] = React.useState(0);
  const [positionLeft, setPositionLeft] = React.useState(0);
  const [userSelection, setUserSelection] = React.useState<string | null>(null);
  const [userSelectectionRect, setUserSelectionRect] = React.useState<DOMRect | null>(null);

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
    if (ref.current) {
      const element = ref.current;
      const handleMouseUp = () => {
        // get selected text
        const selection = window.getSelection();
        if (selection) {
          setUserSelection(selection.toString());

          // get the bounding box of the selection
          setUserSelectionRect(selection.getRangeAt(0).getBoundingClientRect());
        } else {
          setUserSelection(null);
        }
      };

      element.addEventListener('mouseup', handleMouseUp);
      return () => {
        element.removeEventListener('mouseup', handleMouseUp);
      };
    }
    return () => { };
  }, [ref]);

  useEffect(() => {
    const element = ref.current;
    setPositionLeft(element?.getBoundingClientRect().left || 0);
    setPositionTop(activeRef.current?.getBoundingClientRect().top || 0);
    onSourceBadgePositionChange(element?.getBoundingClientRect().left || 0, activeRef.current?.getBoundingClientRect().top || 0);
  }, [activeSourceId, onSourceBadgePositionChange]);

  const userSelectionActionBox = useMemo(() => ({
    top: (userSelectectionRect?.top || 0) - (contentRef.current?.getBoundingClientRect().top || 0),
    left: (userSelectectionRect?.left || 0) - (contentRef.current?.getBoundingClientRect().left || 0) + (userSelectectionRect?.width || 0) / 2,
  }), [userSelectectionRect, contentRef]);

  const handleAddToSummary = useCallback(() => {
    onAddToSummary(userSelection || '');

    // clear selection
    window.getSelection()?.removeAllRanges();
    setUserSelection(null);
  }, [userSelection, onAddToSummary]);

  return (
    <ScrollArea style={{ height: 'calc(100vh - 110px)' }} pos="relative" viewportRef={ref}>
      <div ref={contentRef} style={{ position: 'relative' }}>

        <Title order={2}>Source Document</Title>

        {sourceList.map((source, index) => (
          <MemoizedSourceItem key={index} source={source} isActive={source.id === activeSourceId} onActiveRefChange={handleActiveRefChange} />
        ))}

        {userSelection && (
          <div
            className={style.sourceContextPopup}
            style={{
              top: userSelectionActionBox.top,
              left: userSelectionActionBox.left,
            }}
          >
            <Button variant="transparent" size="xs" color="gray" onClick={handleAddToSummary}>Add to Summary</Button>
          </div>
        )}

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
      </div>
    </ScrollArea>
  );
}

export default Source;
