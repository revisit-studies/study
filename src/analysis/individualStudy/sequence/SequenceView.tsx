/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Stack, Text, Textarea, Paper, Group, Tabs,
} from '@mantine/core';
import { useState, useEffect } from 'react';
import { ParticipantData } from '../../../storage/types';
import { StudyConfig } from '../../../parser/types';
import { SequenceVisualizer } from './SequenceVisualizer';
import { BalanceVisualizer } from './BalanceVisualizer';
import { SequenceTable } from './SequenceTable';

export function SequenceView({
  visibleParticipants,
  studyConfig,
  studyId,
  storageEngine,
}: {
  visibleParticipants: ParticipantData[];
  studyConfig: StudyConfig;
  studyId: string;
  storageEngine: any;
}) {
  const [jsonInput, setJsonInput] = useState('');
  const [studyConfigFactors, setStudyConfigFactors] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/${studyId}/config_factors.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then((json) => {
        setJsonInput(json);
      })
      .catch((err) => setError(err.message));
  }, [studyId]);

  useEffect(() => {
    if (jsonInput) {
      try {
        const parsed = jsonInput;
        setStudyConfigFactors(parsed);
        setError(null);
      } catch (e: any) {
        setError(e.message);
      }
    }
  }, [jsonInput]);

  // TEMP: input the JSON here for the Factors config
  const handleParseJson = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      setStudyConfigFactors(parsed);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return studyConfigFactors ? (
    <Group justify="space-between" align="flex-start" p="md">
      <Paper w="28%" shadow="sm" p="md" radius="md" withBorder>
        <SequenceVisualizer studyConfig={studyConfigFactors} />
      </Paper>
      <Paper w="70%" shadow="sm" p="md" radius="md" withBorder>
        <Tabs
          variant="pills"
          styles={{ tab: { fontWeight: 700, fontSize: 20 } }}
          defaultValue="balance"
        >
          <Tabs.List>
            <Tabs.Tab key="balance" value="balance">
              Balance Visualizer
            </Tabs.Tab>
            <Tabs.Tab key="table" value="table">
              Sequence Table
            </Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="balance" pt="xs">
            <BalanceVisualizer
              studyConfig={studyConfigFactors}
              storageEngine={storageEngine}
            />
          </Tabs.Panel>
          <Tabs.Panel value="table" pt="xs">
            <SequenceTable storageEngine={storageEngine} />
          </Tabs.Panel>
        </Tabs>
      </Paper>
    </Group>
  ) : null;
}
