import {
  Input, Slider, SliderProps,
} from '@mantine/core';
import { SliderResponse } from '../../parser/types';
import { generateErrorMessage } from './utils';
import ReactMarkdownWrapper from '../ReactMarkdownWrapper';

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
  const { prompt, required, options } = response;

  const errorMessage = generateErrorMessage(response, answer);
  return (
    <Input.Wrapper
      label={<ReactMarkdownWrapper text={prompt} required={required} />}
      error={errorMessage}
      size="md"
    >
      <Slider
        disabled={disabled}
        labelAlwaysOn
        style={{ marginTop: '5px', marginBottom: '30px' }}
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
    </Input.Wrapper>
  );
}
