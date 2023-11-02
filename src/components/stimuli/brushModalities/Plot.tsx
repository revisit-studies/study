
import {Stack, Text} from '@mantine/core';
import { StimulusParams } from '../../../store/types';
import Bar from './Bar';
import Scatter from './Scatter';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
export function Plot({ parameters, trialId }: StimulusParams) {
  return (
    <Stack>
        <Bar/>
        <Scatter/>
    </Stack>
  );
}

export default Plot;