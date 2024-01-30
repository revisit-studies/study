import {
  Slider, SliderProps, Stack, Text,
} from '@mantine/core';
import { SliderResponse } from '../../parser/types';
import { generateErrorMessage } from './utils';

type inputProps = {
  response: SliderResponse;
  disabled: boolean;
  answer: object;
};

export default function SliderInput({
  response,
  disabled,
  answer,
}: inputProps) {
  const { prompt, options } = response;

  const errorMessage = generateErrorMessage(response, answer);
  return (
    <Stack spacing={2}>
      <Text fz="md" fw={500}>
        {prompt}
      </Text>
      <Slider
        disabled={disabled}
        labelAlwaysOn
        sx={{ marginTop: '5px', marginBottom: '30px' }}
        marks={options as SliderProps['marks']}
        {...answer}
        styles={(theme) => ({
          mark: {
            width: 12,
            height: 12,
            borderRadius: 6,
            transform: 'translateX(-3px) translateY(-2px)',
          },
          markFilled: {
            borderColor: theme.colors.blue[6],
          },
          markLabel: {
            fontSize: theme.fontSizes.sm,
            marginBottom: 5,
            marginTop: 0,
          },
          thumb: {
            height: 24,
            width: 24,
            backgroundColor: theme.white,
            borderWidth: 1,
            boxShadow: theme.shadows.sm,
          },
          label: {
            top: -4,
            height: 28,
            lineHeight: 28,
            width: 28,
            padding: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            fontWeight: 700,
            color: 'orange',
            backgroundColor: 'transparent',
          },
        })}
      />
      {errorMessage ? <Text size={12} c="#fa5252">{errorMessage}</Text> : null}
    </Stack>
  );
}
