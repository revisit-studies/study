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
  const { numItems } = response;

  const options = [];

  for (let i = 1; i <= +numItems; i += 1) {
    options.push({ label: `${i}`, value: `${i}` });
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
