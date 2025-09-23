import { Flex, Text } from '@mantine/core';
import { StimulusParams } from '../../../store/types';

export default function HSL({ parameters }: StimulusParams<{ left: number; right: number; message: string; color: string; }>) {
  return (
    <>
      {/* Feedback message based on user's last answer */}
      <Text ta="center" mb="16px" c={parameters.color}>
        {parameters.message}
      </Text>

      {/* Two squares with the same hue and lightness but different saturation */}
      <Flex direction="row" justify="space-between" mb="16px">
        <div style={{ width: '40%', height: '150px', backgroundColor: `hsl(248, ${parameters.left}%, 50%)` }} />
        <div style={{ width: '40%', height: '150px', backgroundColor: `hsl(248, ${parameters.right}%, 50%)` }} />
      </Flex>

      {/* Display the saturation value of each square */}
      <Flex direction="row" justify="space-between" mb="16px">
        <Text>
          Left square saturation:
          {' '}
          {parameters.left}
          %
        </Text>
        <Text>
          Right square saturation:
          {' '}
          {parameters.right}
          %
        </Text>
      </Flex>
    </>
  );
}
