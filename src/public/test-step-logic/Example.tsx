import { Text } from '@mantine/core';
import { StimulusParams } from '../../store/types';

export default function Example({ parameters }: StimulusParams<{ n: number }>) {
  return <Text>{parameters && parameters.n !== undefined ? parameters.n : 'There was a problem'}</Text>;
}
