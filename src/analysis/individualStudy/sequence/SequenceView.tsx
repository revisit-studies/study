/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Stack, Text, Textarea, Button,
} from '@mantine/core';
import { useState } from 'react';
import { ParticipantData } from '../../../storage/types';
import { StudyConfig } from '../../../parser/types';
import { SequenceVisualizer } from './SequenceVisualizer';

export function SequenceView({
  visibleParticipants,
  studyConfig,
}: {
  visibleParticipants: ParticipantData[];
  studyConfig: StudyConfig;
}) {
  const [jsonInput, setJsonInput] = useState('');
  const [studyConfigFactors, setStudyConfigFactors] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // TEMP: input the JSON here for the Factors config
  const handleParseJson = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      setStudyConfigFactors(parsed);
      setError(null);
      console.log('Parsed studyConfigFactors:', parsed);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <Stack w="60%">
      <Textarea
        placeholder="Paste your JSON here"
        value={jsonInput}
        onChange={(e) => setJsonInput(e.currentTarget.value)}
        minRows={8}
      />

      <Button onClick={handleParseJson}>Load Factor Spec</Button>

      {error && (
        <Text color="red">
          Error parsing JSON:
          {error}
        </Text>
      )}

      {studyConfigFactors ? (
        <Stack>
          <Text>
            Successfully loaded JSON into
            {' '}
            <code>studyConfigFactors</code>
            :
          </Text>
          <SequenceVisualizer studyConfig={studyConfigFactors} />
        </Stack>
      ) : null}
    </Stack>
  );
}
