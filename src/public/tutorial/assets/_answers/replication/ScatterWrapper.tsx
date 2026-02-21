/**
 * Authors: The ReVISit team
 * Description:
 *    This file is the wrapper component for the Scatter plots
 */

import {
  Center, Group, Stack, Text,
} from '@mantine/core';
import { Scatter } from './Scatter';
import { StimulusParams } from '../../../../../store/types';

/**
 * Holds 2 Scatter Plots
 * @param param0 - r1 is the correlation value for 1, r2 is the correlation value for 2,
 * onClick is a function that determines the functionality when a graph is clicked.
 * @returns 2 Scatter Plots
 */
export default function ScatterWrapper({ parameters }: StimulusParams<{ r1: number; r2: number }>) {
  const { r1, r2 } = parameters;
  const r1DatasetName = `dataset_${r1.toFixed(1)}_size_100.csv`;
  const r2DatasetName = `dataset_${r2.toFixed(1)}_size_100.csv`;

  return (
    <Stack style={{ width: '100%', height: '100%' }}>
      <Text style={{
        textAlign: 'center', paddingBottom: '0px', fontSize: '18px', fontWeight: 'bold',
      }}
      >
        Please select the visualization that appears to have a larger correlation.
      </Text>
      <Text style={{
        textAlign: 'center', paddingBottom: '24px', fontSize: '18px', fontWeight: 'bold',
      }}
      >
        You can either click the buttons or use the‚ left and right keys.
      </Text>
      <Center>
        <Group style={{ gap: '40px' }} mb="md">
          <Scatter r={r1} datasetName={r1DatasetName} />
          <Scatter r={r2} datasetName={r2DatasetName} />
        </Group>
      </Center>
    </Stack>
  );
}
