/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useMemo } from 'react';
import {
  Stack, Group, Box, Text,
} from '@mantine/core';
import { StorageEngine } from '../../../storage/engines/types';

export function SequenceTable({
  storageEngine,
}: {
  storageEngine: StorageEngine | undefined;
}) {
  const [sequenceArray, setSequenceArray] = useState<unknown[]>([]);

  function getBlueShade(depth: number) {
    const shades = [
      '#ffffff',
      '#e7f5ff',
      '#d0ebff',
      '#a5d8ff',
      '#74c0fc',
      '#4dabf7',
    ];
    return shades[Math.min(depth, shades.length - 1)];
  }

  function renderComponents(
    components: unknown[],
    depth = 0,
    keyPrefix = 'root',
  ): React.ReactNode {
    return (
      <Group wrap="wrap" key={keyPrefix} ml={depth * 8}>
        {components.map((comp, idx) => {
          if (typeof comp === 'string') {
            // Simple string component — render as a pill
            return (
              <Box
                key={comp}
                px="sm"
                py={2}
                style={{
                  backgroundColor: getBlueShade(depth),
                  border: '1px solid #c8e6c9',
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                {comp}
              </Box>
            );
          }

          // Nested component group
          if (Array.isArray(comp.components)) {
            return (
              <Group key={`${keyPrefix}-${idx}`}>
                {renderComponents(
                  comp.components,
                  depth + 1,
                  `${keyPrefix}-${idx}`,
                )}
              </Group>
            );
          }

          return null;
        })}
      </Group>
    );
  }

  useEffect(() => {
    const fetchData = async () => {
      if (!storageEngine || sequenceArray.length !== 0) return;
      const data = await storageEngine.getSequenceArray();
      setSequenceArray(data ?? []);
    };

    fetchData();
  });

  const sequenceTable = useMemo(
    () => (
      <Stack>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '14px',
          }}
        >
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #ccc' }}>
              <th style={{ padding: '6px' }}>Participant</th>
              <th style={{ padding: '6px' }}>Sequence</th>
            </tr>
          </thead>
          <tbody>
            {sequenceArray.map((seq, index) => (
              <tr
                key={index}
                style={{
                  borderBottom: '1px solid #eee',
                  verticalAlign: 'top',
                }}
              >
                <td style={{ padding: '8px', fontWeight: 500 }}>{index + 1}</td>
                <td style={{ padding: '8px' }}>
                  {seq.components ? (
                    <Group>
                      {renderComponents(seq.components)}
                    </Group>
                  ) : (
                    <Text c="dimmed" size="sm">
                      (no components)
                    </Text>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Stack>
    ),
    [sequenceArray],
  );

  return (
    <>
      {' '}
      {sequenceArray.length > 0 ? (
        sequenceTable
      ) : (
        <p>Loading sequence data...</p>
      )}
    </>
  );
}
