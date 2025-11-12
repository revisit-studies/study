/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useMemo } from 'react';
import {
  Group, Stack, Text, NumberInput,
} from '@mantine/core';
import { StorageEngine } from '../../../storage/engines/types';
import { ComponentCountTable } from './ComponentCountTable';
import { FactorHeatmap } from './FactorHeatmap';
import { Sequence } from '../../../store/types';

interface StudyConfigFactors {
  factors: Record<string, Factor>;
  sequence: Sequence;
}

interface Factor {
  name: string;
  options: string[];
  order: 'fixed' | 'random';
  numSamples?: number;
}

export function BalanceVisualizer({
  studyConfig,
  storageEngine,
}: {
  studyConfig: StudyConfigFactors;
  storageEngine: StorageEngine | undefined;
}) {
  const [factors] = useState(studyConfig.factors);
  const [sequence] = useState(studyConfig.sequence);
  const [sequenceArray, setSequenceArray] = useState<any[]>([]);
  const [numParticipants, setNumParticipants] = useState<number>(500);

  function extractComponentTemplates(obj: any): string[] {
    const results: string[] = [];

    function traverse(node: any) {
      if (!node || typeof node !== 'object') return;

      for (const [key, value] of Object.entries(node)) {
        if (key === 'componentTemplate') {
          if (typeof value === 'string') {
            results.push(value);
          } else if (Array.isArray(value)) {
            // flatten any array values
            results.push(...value.filter((v) => typeof v === 'string'));
          }
        } else if (typeof value === 'object') {
          traverse(value);
        }
      }
    }

    traverse(obj);
    return results;
  }

  const componentKey = useMemo(() => {
    const templates = extractComponentTemplates(sequence);
    return templates.length > 0 ? templates[0] : '';
  }, [sequence]);

  function countComponents(sequences: any[]): Record<string, number> {
    const sequencesList = numParticipants >= sequences.length
      ? sequences
      : sequences.slice(0, numParticipants);
    const counts: Record<string, number> = {};

    function recurse(components: any[]) {
      for (const comp of components) {
        if (typeof comp === 'string') {
          counts[comp] = (counts[comp] || 0) + 1;
        } else if (comp.components && Array.isArray(comp.components)) {
          recurse(comp.components);
        }
      }
    }

    for (const seq of sequencesList) {
      if (seq.components && Array.isArray(seq.components)) {
        recurse(seq.components);
      }
    }

    return counts;
  }

  useEffect(() => {
    const fetchData = async () => {
      if (!storageEngine || sequenceArray.length !== 0) return;
      const data = await storageEngine.getSequenceArray();
      setSequenceArray(data ?? []);
    };

    fetchData();
  });

  const componentCounts = useMemo(
    () => countComponents(sequenceArray),
    [sequenceArray, numParticipants],
  );

  return (
    <div>
      <Group justify="space-between" align="flex-start">
        <Group>
          <Text color="dimmed">
            Analyzing balance for a study with
            {' '}
            <NumberInput
              value={numParticipants}
              onChange={(val) => setNumParticipants(val as number ?? 0)}
              defaultValue={500}
              hideControls
              size="xs"
              styles={{
                input: {
                  display: 'inline-block',
                  width: '60px',
                  textAlign: 'center',
                  margin: '0 4px',
                  verticalAlign: 'middle',
                },
                root: {
                  display: 'inline-block',
                  verticalAlign: 'middle',
                },
              }}
            />
            {' '}
            participants
          </Text>
        </Group>
      </Group>
      <Stack align="center">
        <FactorHeatmap
          componentCounts={componentCounts}
          componentKey={componentKey}
          factorLevels={factors}
        />
        <Group justify="flex-start" align="flex-start" p="md">
          <ComponentCountTable
            componentCounts={componentCounts}
            componentKey={componentKey}
          />
          <ComponentCountTable
            componentCounts={componentCounts}
            componentKey={componentKey}
            factorLevels={factors}
          />
        </Group>
      </Stack>
    </div>
  );
}
