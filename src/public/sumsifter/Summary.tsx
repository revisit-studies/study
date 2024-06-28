import React, { useEffect } from 'react';
import {
  Badge, Title, ScrollArea, Text,
  Box,
  Input,
  Button,
} from '@mantine/core';
import style from './sumsifter.module.css';

interface SummaryProps {
  sentences: { id: string, text: string; sources: string[] }[];
  onSourceClick: (summaryId: string | null, sourceId: string | null) => void;
  activeSourceId: string | null;
  onSummaryBadgePositionChange: (badgeTop: number) => void;
  onSubmitQuery: (queryText: string) => void;
}

function SummarySourceItem({
  sentence, src, idx, onSourceClick, activeSourceId,
}: { sentence: { id: string, text: string; sources: string[] }, src: string, idx: number, onSourceClick: (ref: HTMLDivElement | null, summaryId: string | null, sourceId: string | null) => void, activeSourceId: string | null }) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  return (
    <React.Fragment key={idx}>
      <Badge
        ref={ref}
        className={style.badge}
        onClick={() => {
          onSourceClick(ref.current, sentence.id, src);
        }}
        style={{ cursor: 'pointer' }}
        color={activeSourceId === src ? 'blue.5' : 'gray.5'}
      >
        {src}
      </Badge>
      {idx < sentence.sources.length - 1 && ', '}
    </React.Fragment>
  );
}

function Summary({
  sentences, onSourceClick, activeSourceId, onSummaryBadgePositionChange, onSubmitQuery,
}: SummaryProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const activeRef = React.useRef<HTMLSpanElement | null>(null);
  const [positionTop, setPositionTop] = React.useState(0);
  const [positionLeft, setPositionLeft] = React.useState(0);
  const [positionLeftSummary, setPositionLeftSummary] = React.useState(0);

  const [queryText, setQueryText] = React.useState('');

  useEffect(() => {
    if (ref.current) {
      const element = ref.current;
      const handleScroll = () => {
        setPositionTop(activeRef.current?.getBoundingClientRect().top || 0);
        setPositionLeftSummary(activeRef.current?.getBoundingClientRect().left || 0);
        setPositionLeft(ref.current?.getBoundingClientRect().right || 0);
        onSummaryBadgePositionChange(activeRef.current?.getBoundingClientRect().top || 0);
      };
      ref.current.addEventListener('scroll', handleScroll);

      return () => {
        element.removeEventListener('scroll', handleScroll);
      };
    }
    return () => { };
  }, [ref, onSummaryBadgePositionChange]);

  const paragraph = sentences.map((sentence, index) => {
    // Use a regular expression to capture the text before and the last punctuation mark
    const regex = /^(.*?)([.?!])?$/;
    const match = sentence.text.match(regex);
    const textBeforePunctuation = match ? match[1] : sentence.text;
    const punctuation = match ? match[2] : '';

    const handleSourceClick = (elem: HTMLDivElement | null, summaryId: string | null, sourceId: string | null) => {
      onSourceClick(summaryId, sourceId);
      onSummaryBadgePositionChange(elem?.getBoundingClientRect().top || 0);
      activeRef.current = elem;
      setPositionTop(elem?.getBoundingClientRect().top || 0);
      setPositionLeftSummary(elem?.getBoundingClientRect().left || 0);
      setPositionLeft(ref.current?.getBoundingClientRect().right || 0);
    };

    return (
      <React.Fragment key={index}>
        {textBeforePunctuation}
        {' '}
        {sentence.sources.length > 0 && (
          <span>
            [
            {sentence.sources.map((src, idx) => (
              <SummarySourceItem key={idx} sentence={sentence} src={src} idx={idx} onSourceClick={handleSourceClick} activeSourceId={activeSourceId} />
            ))}
            ]
          </span>
        )}
        {punctuation}
        {' '}
      </React.Fragment>
    );
  });

  return (
    <ScrollArea style={{ height: 'calc(100vh - 110px)' }} viewportRef={ref}>
      <Title order={2} mb={16}>LLM-Generated Summary</Title>
      <Text>
        {paragraph}
      </Text>
      <Box display="flex">
        <Input placeholder="Type your query here." onChange={(e) => { setQueryText(e.target.value); }} mr={10} flex={1} />
        <Button onClick={() => { onSubmitQuery(queryText); }}>Send</Button>
      </Box>
      <div style={{
        position: 'fixed',
        top: positionTop + 18,
        left: positionLeftSummary + 5,
        backgroundColor: 'var(--mantine-color-blue-5)',
        height: 2,
        width: positionLeft - positionLeftSummary + 35,
      }}
      />
    </ScrollArea>
  );
}

export default Summary;
