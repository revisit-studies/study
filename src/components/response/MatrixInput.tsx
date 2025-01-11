import {
  Box, Flex, Radio, Text, Checkbox,
} from '@mantine/core';
import { ChangeEvent } from 'react';
import { MatrixResponse, StringOption } from '../../parser/types';
import ReactMarkdownWrapper from '../ReactMarkdownWrapper';
import { useStoreDispatch, useStoreActions } from '../../store/store';

function CheckboxComponent({
  _choices,
  _n,
  idx,
  question,
  answer,
  onChange,
  disabled,
}: {
  _choices: StringOption[],
  _n: number,
  idx: number,
  question: StringOption,
  answer: { value: Record<string, string> },
  onChange: (event: ChangeEvent<HTMLInputElement>, questionKey: string, option: StringOption) => void
  disabled: boolean
}) {
  return (
    <div
      style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: `repeat(${_n}, 1fr)`,
        justifyItems: 'center',
      }}
    >
      {_choices.map((checkbox: StringOption) => (
        <Checkbox
          disabled={disabled}
          key={`${checkbox.label}-${idx}`}
          checked={answer.value[question.label].split('|').includes(checkbox.value)}
          onChange={(event) => onChange(event, question.label, checkbox)}
          value={checkbox.value}
        />
      ))}
    </div>
  );
}
function RadioGroupComponent({
  _choices,
  _n,
  idx,
  question,
  response,
  answer,
  onChange,
  disabled,
}: {
  _choices: StringOption[],
  _n: number,
  idx: number,
  question: StringOption,
  response: MatrixResponse,
  answer: { value: Record<string, string> },
  onChange: (val: string, questionKey: string) => void,
  disabled: boolean

}) {
  return (
    <Radio.Group
      name={`radioInput${response.id}-${idx}`}
      key={`${response.id}-${idx}`}
      style={{
        '--input-description-size': 'calc(var(--mantine-font-size-md) - calc(0.125rem * var(--mantine-scale)))',
        flex: 1,
      }}
      onChange={(val) => onChange(val, question.label)}
      value={answer.value[question.label]}
    >
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: `repeat(${_n}, 1fr)`,
          justifyItems: 'center',
        }}
      >
        {_choices.map((radio: StringOption) => (
          <Radio
            disabled={disabled}
            value={radio.value}
            key={`${radio.label}-${idx}`}
          />
        ))}
      </div>
    </Radio.Group>
  );
}

export default function MatrixInput({
  response,
  answer,
  index,
  disabled,
  enumerateQuestions,
}: {
  response: MatrixResponse;
  answer: { value: Record<string, string> };
  index: number;
  disabled: boolean;
  enumerateQuestions: boolean;
}) {
  const { setMatrixAnswersRadio, setMatrixAnswersCheckbox } = useStoreActions();
  const storeDispatch = useStoreDispatch();

  const {
    answerOptions,
    questionOptions,
    prompt,
    required,
  } = response;

  const _choiceStringToColumns: Record<string, string[]> = {
    likely5: ['Highly Unlikely', 'Unlikely', 'Neutral', 'Likely', 'Highly Likely'],
    likely7: ['Highly Unlikely', 'Unlikely', 'Slightly Unlikely', 'Neutral', 'Slightly Likely', 'Likely', 'Highly Likely'],
    satisfaction5: ['Highly Unsatisfied', 'Unsatisfied', 'Neutral', 'Satisfied', 'Highly Satisfied'],
    satisfaction7: ['Highly Unsatisfied', 'Unsatisfied', 'Slightly Unsatisfied', 'Neutral', 'Slightly Satisfied', 'Satisfied', 'Highly Satisfied'],
  };

  const _choices = typeof answerOptions === 'string' ? _choiceStringToColumns[answerOptions].map((entry) => ({ value: entry, label: entry })) : answerOptions.map((option) => (typeof option === 'string' ? { value: option, label: option } : option));
  const _questions = questionOptions.map((option) => (typeof option === 'string' ? { value: option, label: option } : option));

  // Re-define on change functions. Dispatch answers to store.
  const onChangeRadio = (val: string, questionKey: string) => {
    const payload = {
      type: 'radio',
      questionKey,
      val,
      responseId: response.id,
    };
    storeDispatch(setMatrixAnswersRadio(payload));
  };

  const onChangeCheckbox = (event: ChangeEvent<HTMLInputElement>, questionKey: string, option: StringOption) => {
    const isChecked = event.target.checked;
    const payload = {
      questionKey,
      responseId: response.id,
      value: option.value,
      label: option.label,
      isChecked,
      choiceOptions: _choices,
    };
    storeDispatch(setMatrixAnswersCheckbox(payload));
  };

  const _n = _choices.length;
  const _m = _questions.length;
  return (
    <>
      <Flex direction="row" wrap="nowrap" gap={0}>
        {enumerateQuestions && <Box style={{ minWidth: 'fit-content' }}>{`${index}. `}</Box>}
        <Box style={{ display: 'block' }} className="no-last-child-bottom-padding">
          <ReactMarkdownWrapper text={prompt} required={required} />
        </Box>
      </Flex>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gridTemplateRows: 'auto 1fr',
          margin: '40px 100px 100px 100px',
        }}
      >

        {/* Empty Square */}
        <div
          style={{
            borderBottom: '1px solid var(--mantine-color-dark-0)',
            borderRight: '1px solid var(--mantine-color-dark-0)',
          }}
        />
        {/* Column Headers */}
        <div
          style={{
            height: '100%',
            display: 'grid',
            gridTemplateColumns: `repeat(${_n}, 1fr)`,
            alignItems: 'center',
            justifyItems: 'center',
            borderBottom: '1px solid var(--mantine-color-dark-0)',
          }}
        >
          {_choices.map((entry, idx) => (
            <Text
              key={`choice-${idx}-label`}
              style={{
                fontWeight: 'bold',
                textAlign: 'center',
                fontSize: '0.8em',
              }}
              mb="sm"
              ml="xs"
              mr="xs"
            >
              {entry.label}
            </Text>
          ))}
        </div>
        {/* Row Headers */}
        <div
          style={{
            height: '100%',
            display: 'grid',
            gridTemplateRows: `repeat(${_m}, 1fr)`,
          }}
        >
          {_questions.map((entry, idx) => (
            <Text
              key={`question-${idx}-label`}
              style={{
                height: '60px',
                display: 'flex',
                alignItems: 'center',
                borderRight: '1px solid var(--mantine-color-dark-0)',
                backgroundColor: `${(idx + 1) % 2 === 0 ? 'var(--mantine-color-gray-2)' : 'white'}`,
                paddingLeft: '10px',
              }}
            >
              {entry.label}
            </Text>
          ))}
        </div>
        {/* Rest */}
        <div
          style={{
            height: '100%',
            display: 'grid',
            gridTemplateRows: `repeat(${_m},1fr)`,
          }}
        >
          {_questions.map((question, idx) => (
            <div
              key={`question-${idx}`}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                backgroundColor: `${(idx + 1) % 2 === 0 ? 'var(--mantine-color-gray-2)' : 'white'}`,
              }}
            >
              {response.type === 'matrix-radio'
                ? (
                  <RadioGroupComponent
                    disabled={disabled}
                    idx={idx}
                    question={question}
                    answer={answer}
                    _choices={_choices}
                    _n={_n}
                    onChange={onChangeRadio}
                    response={response}
                  />
                )
                : (
                  <CheckboxComponent
                    disabled={disabled}
                    idx={idx}
                    question={question}
                    answer={answer}
                    _choices={_choices}
                    _n={_n}
                    onChange={onChangeCheckbox}
                  />
                )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
