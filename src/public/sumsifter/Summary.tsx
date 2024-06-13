import React from 'react';
import {
  Badge, Title, ScrollArea, Text,
} from '@mantine/core';
import style from './sumsifter.module.css';

interface SummaryProps {
  sentences: { id: string, text: string; sources: string[] }[];
  onSourceClick: (summaryId: string | null, sourceId: string | null) => void;
  activeSourceId: string | null;
}

function Summary({ sentences, onSourceClick, activeSourceId }: SummaryProps) {
  const paragraph = sentences.map((sentence, index) => {
    // Use a regular expression to capture the text before and the last punctuation mark
    const regex = /^(.*?)([.?!])?$/;
    const match = sentence.text.match(regex);
    const textBeforePunctuation = match ? match[1] : sentence.text;
    const punctuation = match ? match[2] : '';

    return (
      <React.Fragment key={index}>
        {textBeforePunctuation}
        {' '}
        {sentence.sources.length > 0 && (
          <span>
            [
            {sentence.sources.map((src, idx) => (
              <React.Fragment key={idx}>
                <Badge
                  className={style.badge}
                  onClick={() => onSourceClick(sentence.id, src)}
                  onMouseEnter={() => {
                    if (activeSourceId !== src) {
                      onSourceClick(null, null);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                  color={activeSourceId === src ? 'blue.5' : 'gray.5'}
                >
                  {src}
                </Badge>
                {idx < sentence.sources.length - 1 && ', '}
              </React.Fragment>
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
    <ScrollArea style={{ height: 'calc(100vh - 105px)' }}>
      <Title order={2} mb={16}>LLM-Generated Summary</Title>
      <Text>
        {paragraph}
      </Text>
    </ScrollArea>
  );
}

export default Summary;
