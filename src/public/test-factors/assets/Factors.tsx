import { Text } from '@mantine/core';
import { StimulusParams } from '../../../store/types';

export function Factors({ parameters }: StimulusParams<unknown>) {
  return <Text>{JSON.stringify(parameters)}</Text>;
}

export default Factors;
