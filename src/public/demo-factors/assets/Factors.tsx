import { Text } from '@mantine/core';
import { StimulusParams } from '../../../store/types';

export function Factors({
  parameters, setAnswer, provenanceState, updateState = () => null,
}: StimulusParams<unknown, unknown>) {
  return <Text>{JSON.stringify(parameters)}</Text>;
}

export default Factors;
