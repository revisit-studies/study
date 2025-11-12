/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Stack, Text, Box, Paper, Title, Group,
} from '@mantine/core';
import { useState } from 'react';
import {
  IconArrowsCross,
  IconArrowsRight,
  IconDice,
  IconClearAll,
} from '@tabler/icons-react';

interface Factor {
  name: string;
  options: string[];
  order: 'fixed' | 'random';
  numSamples?: number;
}

interface SequenceComponent {
  numSamples?: number;
  components?: (string | SequenceComponent)[];
  id?: string;
  factorsToCombine?: string[];
  componentTemplate?: string;
  order?: 'fixed' | 'random';
  combinationMode?: 'cross' | 'pair';
}

interface Sequence {
  order: 'fixed' | 'random';
  components: (string | SequenceComponent)[];
}

interface StudyConfigFactors {
  factors: Record<string, Factor>;
  sequence: Sequence;
}

export function SequenceVisualizer({
  studyConfig,
}: {
  studyConfig: StudyConfigFactors;
}) {
  const [factors] = useState(studyConfig.factors);
  const [sequence] = useState(studyConfig.sequence);

  const renderFactor = (factorName: string) => {
    const factor = factors[factorName];
    if (!factor) return null;

    const allLevels = factor.numSamples === undefined
      || factor.numSamples === factor.options.length;
    const label = allLevels
      ? `all levels, ${factor.options.length} of ${factor.options.length}`
      : `draw ${factor.numSamples} of ${factor.options.length}`;
    const Icon = allLevels ? IconClearAll : IconDice;

    return (
      <Box
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 4,
        }}
      >
        <Text fw={700} size="md">
          {factor.name}
        </Text>
        <Icon size={18} stroke={1.5} />
        <Text size="md">{label}</Text>
      </Box>
    );
  };

  const calculateTotalTrials = (component: SequenceComponent) => {
    if (!component.factorsToCombine) return 0;

    const nums = component.factorsToCombine.map(
      (f) => factors[f]?.numSamples ?? factors[f]?.options.length ?? 1,
    );

    if (component.combinationMode === 'pair') {
      return Math.max(...nums);
    }
    // cross
    return nums.reduce((acc, val) => acc * val, 1);
  };

  const renderSimpleComponent = (component: string) => (
    <Paper
      shadow="sm"
      p="md"
      style={{
        backgroundColor: '#f3f3f3ff',
        borderRadius: 6,
        flex: 1,
      }}
    >
      <Text fw={600}>{component}</Text>
    </Paper>
  );

  const renderComponent = (
    component: string | SequenceComponent,
    index: number,
  ) => {
    if (!component) return null;

    /// Simple component
    if (typeof component === 'string') {
      return renderSimpleComponent(component);
    }

    /// Random/complex component
    if (component.components) {
      return (
        <Paper
          p="md"
          shadow="xs"
          style={{
            border: '2px dashed #c2c2c2ff',
            borderRadius: 8,
            backgroundColor: '#f9f9f9',
            flex: 1,
          }}
        >
          <Stack>
            {component.order === 'fixed' ? null : (
              <Box
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: -10,
                  marginLeft: 5,
                }}
              >
                <IconDice size={20} color="black" style={{ marginTop: 10 }} />
                <Text
                  fw={500}
                  size="md"
                  color="black"
                  mt="sm"
                  style={{ textAlign: 'left' }}
                >
                  {component.numSamples !== component.components.length
                    ? `Randomly draw ${component.numSamples} of ${component.components.length}`
                    : 'Show all in random order'}
                </Text>
              </Box>
            )}

            {component.components.map((subComp: string | SequenceComponent, idx: number) => renderComponent(subComp, idx))}
          </Stack>
        </Paper>
      );
    }

    /// Factor component
    if (component.factorsToCombine) {
      const totalTrials = calculateTotalTrials(component);
      return (
        <Paper
          p="md"
          shadow="xs"
          style={{
            border: '2px dashed #555',
            borderRadius: 8,
            backgroundColor: '#f9f9f9',
            flex: 1,
          }}
        >
          <Stack>
            {/* Component Heading */}
            <Title order={4} mb="sm" style={{ color: '#333' }}>
              {component.id}
            </Title>

            {/* Factors */}
            {component.factorsToCombine.map((factorName, i, arr) => {
              const factor = factors[factorName];
              if (!factor) return null;

              return (
                <Stack key={factorName}>
                  <Paper p={20} style={{ backgroundColor: '#e7f5ff5c' }}>
                    {renderFactor(factorName)}

                    <Box
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 6,
                      }}
                    >
                      {factor.options.map((option) => (
                        <Box
                          key={option}
                          px="sm"
                          py={2}
                          style={{
                            backgroundColor: '#e7f5ff', // very light green
                            border: '1px solid #d0ebff',
                            borderRadius: 16,
                            fontSize: 16,
                            fontWeight: 500,
                          }}
                        >
                          {option}
                        </Box>
                      ))}
                    </Box>
                  </Paper>

                  {/* Paired / Crossed Text with Icon */}
                  {i < arr.length - 1 && (
                    <Box
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        marginTop: 8,
                        marginLeft: 20,
                      }}
                    >
                      {component.combinationMode === 'pair' ? (
                        <IconArrowsRight size={26} color="black" />
                      ) : (
                        <IconArrowsCross size={26} color="black" />
                      )}
                      <Text size="md" color="black">
                        {component.combinationMode === 'pair'
                          ? 'paired with'
                          : 'crossed with'}
                      </Text>
                    </Box>
                  )}
                </Stack>
              );
            })}

            {/* Total Trials */}
            {component.factorsToCombine.length > 0 && (
              <Text
                fw={500}
                size="md"
                color="black"
                mt="sm"
                style={{ textAlign: 'left' }}
              >
                Total trials seen by each:
                {' '}
                {component.combinationMode === 'pair'
                  ? Math.max(
                    ...component.factorsToCombine.map(
                      (f) => factors[f]?.numSamples
                          ?? factors[f]?.options.length
                          ?? 0,
                    ),
                  )
                  : component.factorsToCombine.reduce(
                    (acc, f) => acc
                        * (factors[f]?.numSamples
                          ?? factors[f]?.options.length
                          ?? 1),
                    1,
                  )}
              </Text>
            )}
          </Stack>
        </Paper>
      );
    }

    return null;
  };

  return (
    <Stack>
      <Title order={3}>Study Flow</Title>
      {sequence.components.map((comp, idx) => renderComponent(comp, idx))}
    </Stack>
  );
}
