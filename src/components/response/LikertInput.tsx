import { LikertResponse, RadioResponse } from '../../parser/types';
import { RadioInput } from './RadioInput';

export function LikertInput({
  response,
  disabled,
  answer,
  index,
  enumerateQuestions,
}: {
  response: LikertResponse;
  disabled: boolean;
  answer: object;
  index: number;
  enumerateQuestions: boolean;
}) {
  const { numItems, start, spacing } = response;

  const options = [];
  const startValue = start ?? 1;
  const spacingValue = spacing ?? 1;

  for (let i = 0; i < +numItems; i += 1) {
    const value = startValue + (i * spacingValue);
    options.push({ label: `${value}`, value: `${value}` });
  }

  const radioResponse: RadioResponse = {
    ...response,
    type: 'radio',
    options,
    horizontal: true,
  };

  return (
    <RadioInput
      disabled={disabled}
      response={radioResponse}
      answer={answer}
      index={index}
      enumerateQuestions={enumerateQuestions}
      stretch
    />
  );
}
