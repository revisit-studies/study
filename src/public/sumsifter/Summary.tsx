import React from 'react';
import { Stack, Text } from '@mantine/core';

interface SummaryProps {
  sentences: { text: string; sources: string[] }[];
  onSourceClick: (sourceId: string) => void;
}

function Summary({ sentences, onSourceClick }: SummaryProps) {
  return (
    <Stack>
      {sentences.map((sentence, index) => (
        <Text key={index}>
          {sentence.text}
          {' '}
          {sentence.sources.length > 0 && (
            <span>
              [
              {sentence.sources.map((src, idx) => (
                <a key={idx} href="#" onClick={() => onSourceClick(src)}>
                  {src}
                </a>
              )).reduce((prev, curr) => (
                <>
                  {prev}
                  ,
                  {' '}
                  {curr}
                </>
              ))}
              ]
            </span>
          )}
        </Text>
      ))}
    </Stack>
  );
}

export default Summary;
