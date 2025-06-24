import { Text } from '@mantine/core';
import { StimulusParams } from '../../../../store/types';

export default function Questions({ parameters }: StimulusParams<{ question: string; message: string; color: string; }>) {
  return (
    <>
      {/* Feedback message based on user's last answer */}
      <Text ta="center" mb="16px" c={parameters.color}>
        {parameters.message}
      </Text>

      {/* Question */}
      <Text ta="center" c={parameters.color}>
        {parameters.question}
      </Text>
    </>
  );
}
