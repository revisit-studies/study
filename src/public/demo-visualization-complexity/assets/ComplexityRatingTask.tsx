import {
  Button, Checkbox, Divider, Group, Paper, Rating, Stack, Text, Title,
} from '@mantine/core';
import { useMemo, useState } from 'react';
import { StimulusParams } from '../../../store/types';

interface ComplexityRatingTaskParameters {
  stimulusNumber: number;
}

const TAGS = [
  'Many data points',
  'Many visual elements',
  'Many colors',
  'Many encodings',
  'Dense layout',
  'Unfamiliar chart type',
  'Text or labels',
  'Multiple views',
] as const;

function seededValue(seed: number, offset: number) {
  const value = Math.sin((seed + 1) * (offset + 1) * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function VisualizationPreview({ stimulusNumber }: ComplexityRatingTaskParameters) {
  const marks = 18 + Math.floor(seededValue(stimulusNumber, 0) * 52);
  const colors = ['#228be6', '#fa5252', '#40c057', '#fab005', '#7950f2', '#15aabf'];
  const variant = stimulusNumber % 3;

  return (
    <svg aria-label={`Visualization stimulus ${stimulusNumber}`} height="390" role="img" viewBox="0 0 720 390" width="100%">
      <rect fill="#ffffff" height="390" width="720" />
      <line stroke="#adb5bd" strokeWidth="2" x1="65" x2="65" y1="30" y2="335" />
      <line stroke="#adb5bd" strokeWidth="2" x1="65" x2="690" y1="335" y2="335" />
      {Array.from({ length: 5 }, (_, index) => (
        <line key={index} stroke="#e9ecef" x1="65" x2="690" y1={75 + index * 52} y2={75 + index * 52} />
      ))}
      {variant === 0 && Array.from({ length: marks }, (_, index) => {
        const x = 80 + seededValue(stimulusNumber, index + 1) * 585;
        const y = 45 + seededValue(stimulusNumber, index + 101) * 270;
        const radius = 4 + seededValue(stimulusNumber, index + 201) * 13;
        return <circle cx={x} cy={y} fill={colors[index % colors.length]} fillOpacity="0.72" key={index} r={radius} />;
      })}
      {variant === 1 && Array.from({ length: marks }, (_, index) => {
        const width = Math.max(5, 580 / marks - 2);
        const height = 20 + seededValue(stimulusNumber, index + 1) * 255;
        return <rect fill={colors[index % colors.length]} height={height} key={index} width={width} x={75 + index * (580 / marks)} y={335 - height} />;
      })}
      {variant === 2 && Array.from({ length: marks }, (_, index) => {
        const x = 75 + (index / Math.max(marks - 1, 1)) * 600;
        const y = 65 + seededValue(stimulusNumber, index + 1) * 230;
        const nextX = 75 + ((index + 1) / Math.max(marks - 1, 1)) * 600;
        const nextY = 65 + seededValue(stimulusNumber, index + 2) * 230;
        return index === marks - 1 ? null : <line key={index} stroke={colors[index % colors.length]} strokeWidth="3" x1={x} x2={nextX} y1={y} y2={nextY} />;
      })}
      <text fill="#495057" fontSize="18" x="72" y="20">Visualization {stimulusNumber}</text>
    </svg>
  );
}

export default function ComplexityRatingTask({ parameters, setAnswer }: StimulusParams<ComplexityRatingTaskParameters>) {
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const startedAt = useMemo(() => Date.now(), []);

  const toggleTag = (tag: string) => {
    setTags((currentTags) => (currentTags.includes(tag)
      ? currentTags.filter((currentTag) => currentTag !== tag)
      : [...currentTags, tag]));
  };

  const submit = () => {
    setSubmitted(true);
    setAnswer({
      status: true,
      answers: {
        stimulusNumber: parameters.stimulusNumber,
        complexityScore: rating,
        tags,
        elapsedSeconds: Math.round((Date.now() - startedAt) / 1000),
      },
    });
  };

  return (
    <Stack gap="lg" maw={900} mx="auto">
      <Paper p="md" withBorder>
        <VisualizationPreview stimulusNumber={parameters.stimulusNumber} />
      </Paper>
      <Divider />
      <Stack gap="xs">
        <Title order={3}>How complex does this data visualization seem to you?</Title>
        <Group justify="space-between"><Text size="sm">Very simple</Text><Text size="sm">Very complex</Text></Group>
        <Rating aria-label="Perceived visualization complexity" count={10} highlightSelectedOnly onChange={setRating} readOnly={submitted} size="xl" value={rating} />
      </Stack>
      <Stack gap="xs">
        <Text fw={600}>What contributed to your rating? Select at least one.</Text>
        {TAGS.map((tag) => <Checkbox checked={tags.includes(tag)} disabled={submitted} key={tag} label={tag} onChange={() => toggleTag(tag)} />)}
      </Stack>
      <Button disabled={submitted || rating === 0 || tags.length === 0} onClick={submit}>
        {submitted ? 'Response recorded' : 'Record response'}
      </Button>
    </Stack>
  );
}
