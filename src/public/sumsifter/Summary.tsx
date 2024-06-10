import { Badge, Stack, Text } from '@mantine/core';

interface SummaryProps {
  sentences: { text: string; sources: string[] }[];
  onSourceClick: (sourceId: string | null) => void;
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
              {sentence.sources.map((src, idx) => (
                <Badge
                  key={idx}
                  onMouseEnter={() => onSourceClick(src)}
                  onMouseLeave={() => onSourceClick(null)}
                  style={{ cursor: 'pointer' }}
                >
                  {src}
                </Badge>
              )).reduce((prev, curr) => (
                <>
                  {prev}
                  {' '}
                  {curr}
                </>
              ))}
            </span>
          )}
        </Text>
      ))}
    </Stack>
  );
}

export default Summary;
