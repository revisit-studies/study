import React, { useCallback, useEffect, useMemo } from 'react';
import { IconArrowBack, IconCirclePlus, IconPencil } from '@tabler/icons-react';
import {
  Title, ScrollArea, Badge, Input, ActionIcon, Tooltip, Divider,
  Box,
} from '@mantine/core';
import { useFocusTrap } from '@mantine/hooks';
import style from './sumsifter.module.css';
import Markdown from './Markdown';

interface SourceProps {
  sourceList: { id: string; text: string }[];
  activeSourceId: string | null;
  onSourceBadgePositionChange: (badgeLeft: number, badgeTop: number) => void;
  onAddToSummary: (text: string, prompt: string) => void;
}

function Source({
  sourceList, activeSourceId, onSourceBadgePositionChange, onAddToSummary,
}: SourceProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const focusTrapRef = useFocusTrap();
  const contentRef = React.useRef<HTMLDivElement>(null);
  const activeRef = React.useRef<HTMLSpanElement | null>(null);
  const [positionTop, setPositionTop] = React.useState(0);
  const [positionLeft, setPositionLeft] = React.useState(0);
  const [userSelection, setUserSelection] = React.useState<string | null>(null);
  const [userSelectionRect, setUserSelectionRect] = React.useState<DOMRect | null>(null);
  const [sourceQuery, setSourceQuery] = React.useState<string>('');
  const [highlightClientRects, setHighlightClientRects] = React.useState<DOMRect[] | null>(null);

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

  const handleActiveRefChange = useCallback((e: HTMLDivElement | null) => {
    activeRef.current = e;
  }, []);

  useEffect(() => {
    if (ref.current) {
      const element = ref.current;
      const handleMouseUp = () => {
        // get selected text
        const selection = window.getSelection();
        if (selection && selection.toString() !== '') {
          setUserSelection(selection.toString());

          // get the bounding box of the selection
          setUserSelectionRect(selection.getRangeAt(0).getBoundingClientRect());

          const ranges = selection.getRangeAt(0);

          setHighlightClientRects(Array.from(ranges.getClientRects()).map((rect) => (
            new DOMRect(
              rect.left - (contentRef.current?.getBoundingClientRect().left || 0),
              rect.top - (contentRef.current?.getBoundingClientRect().top || 0),
              rect.width,
              rect.height,
            )
          )));
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
    if (highlightClientRects) {
      const removeHighlight = () => {
        setHighlightClientRects(null);
        setUserSelection(null);
        setSourceQuery('');
      };
      window.addEventListener('mousedown', removeHighlight);
      return () => {
        window.removeEventListener('mousedown', removeHighlight);
      };
    }
    return () => { };
  }, [highlightClientRects]);

  useEffect(() => {
    const element = ref.current;
    setPositionLeft(element?.getBoundingClientRect().left || 0);
    setPositionTop(activeRef.current?.getBoundingClientRect().top || 0);
    onSourceBadgePositionChange(element?.getBoundingClientRect().left || 0, activeRef.current?.getBoundingClientRect().top || 0);
  }, [activeSourceId, onSourceBadgePositionChange]);

  const userSelectionActionBox = useMemo(() => ({
    top: (userSelectionRect?.top || 0) - (contentRef.current?.getBoundingClientRect().top || 0),
    left: 0,
    bottom: (userSelectionRect?.bottom || 0) - (contentRef.current?.getBoundingClientRect().top || 0),
  }), [userSelectionRect, contentRef]);

  const handleAddToSummary = useCallback(() => {
    onAddToSummary(userSelection || '', 'Include this to the summary.');
    setUserSelection(null);
    setHighlightClientRects(null);
  }, [userSelection, onAddToSummary]);

  const handleMakeDescriptive = useCallback(() => {
    onAddToSummary(userSelection || '', 'Include this to the summary and make this more descriptive.');
    setUserSelection(null);
    setHighlightClientRects(null);
  }, [userSelection, onAddToSummary]);

  const handleSourceQueryChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSourceQuery(event.target.value);
  }, []);

  const handleSourceQueryKeyUp = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      onAddToSummary(userSelection || '', sourceQuery);
      setSourceQuery('');
      setUserSelection(null);
      setHighlightClientRects(null);
    }
  }, [sourceQuery, userSelection, onAddToSummary]);

  return (
    <ScrollArea style={{ height: 'calc(100vh - 110px)' }} pos="relative" viewportRef={ref}>
      <div ref={contentRef} style={{ position: 'relative' }}>
        {/* background highlight */}
        {highlightClientRects && (
          <div className={style.textHighlightContainer}>
            {highlightClientRects.map((rect, index) => (
              <div
                key={index}
                className={style.textHighlight}
                style={{
                  top: rect.top,
                  left: rect.left,
                  width: rect.width,
                  height: rect.height,
                }}
              />
            ))}
          </div>
        )}

        <Title order={2}>Source Document</Title>

        {/* ActiveId for this is activeSourceId, and activeSourceId is null */}
        <Box pos="relative">
          <Markdown
            data={sourceList}
            activeId={activeSourceId}
            activeSourceId={null}
            onActiveRefChange={handleActiveRefChange}
          />
        </Box>

        {userSelection && (
          <div
            className={style.sourceContextPopup}
            style={{
              top: userSelectionActionBox.bottom,
              left: userSelectionActionBox.left,
            }}
            onMouseDown={(e) => { e.stopPropagation(); }}
          >
            <Tooltip label="Include in summary" position="bottom" arrowOffset={50} arrowSize={8} withArrow>
              <ActionIcon variant="transparent" size="md" color="gray" onClick={handleAddToSummary}>
                <IconCirclePlus />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Make it descriptive" position="bottom" arrowOffset={50} arrowSize={8} withArrow>
              <ActionIcon variant="transparent" size="md" color="gray" onClick={handleMakeDescriptive}>
                <IconPencil />
              </ActionIcon>
            </Tooltip>
            <Divider orientation="vertical" />
            <Input
              ref={focusTrapRef}
              size="xs"
              value={sourceQuery}
              onChange={handleSourceQueryChange}
              onKeyUp={handleSourceQueryKeyUp}
              flex={1}
              ml={4}
              placeholder="What do you want to do this selection?"
              rightSection={
                (
                  (sourceQuery.length ? (
                    <IconArrowBack
                      color="var(--mantine-color-gray-5)"
                    />
                  ) : null)
                )
              }
            />
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
