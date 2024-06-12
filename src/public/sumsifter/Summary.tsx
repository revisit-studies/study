import React from 'react';
import { Badge, Title, Text } from '@mantine/core';

interface SummaryProps {
  sentences: { text: string; sources: string[] }[];
  onSourceClick: (sourceId: string | null) => void;
}

function Summary({ sentences, onSourceClick }: SummaryProps) {
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
                  onMouseEnter={() => onSourceClick(src)}
                  onMouseLeave={() => onSourceClick(null)}
                  style={{ cursor: 'pointer' }}
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
    <Text>
      <Title order={2}>Summary</Title>
      {paragraph}
    </Text>
  );
}

export default Summary;
