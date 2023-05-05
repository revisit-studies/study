import RadioInput from './RadioInput';

type inputProps = {
  title: string;
  desc: string;
  likertPreset: string;
  required: boolean;
  answer: object;
  disabled: boolean;
  leftLabel: string;
  rightLabel: string;
};

export default function LikertInput({
  disabled = false,
  title = 'Your Question',
  desc = 'additional description',
  likertPreset = '5',
  answer,
  required,
    leftLabel = '',
    rightLabel = '',
}: inputProps) {
  const radioData = [];
  for (let i = 1; i <= +likertPreset; i++) {
    radioData.push({ label: `${i}`, value: `${i}` });
  }

  return (
    <>
      <RadioInput
        disabled={disabled}
        title={title}
        desc={desc}
        radioData={radioData}
        answer={answer}
        required={required}
        leftLabel={leftLabel}
        rightLabel={rightLabel}
      />
    </>
  );
}
