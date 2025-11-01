import {
  Box, Radio, Text, Checkbox,
} from '@mantine/core';
import {
  ChangeEvent, useMemo,
} from 'react';
import { MatrixResponse, StringOption } from '../../parser/types';
import { useStoreDispatch, useStoreActions } from '../../store/store';
import checkboxClasses from './css/Checkbox.module.css';
import radioClasses from './css/Radio.module.css';
import { useStoredAnswer } from '../../store/hooks/useStoredAnswer';
import { InputLabel } from './InputLabel';
import { generateErrorMessage } from './utils';

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
  question: string,
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
          checked={answer.value[question].split('|').includes(checkbox.value)}
          onChange={(event) => onChange(event, question, checkbox)}
          value={checkbox.value}
          classNames={{ input: checkboxClasses.fixDisabled, icon: checkboxClasses.fixDisabledIcon }}
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
  question: string,
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
      onChange={(val) => onChange(val, question)}
      value={answer.value[question]}
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
            classNames={{ radio: radioClasses.fixDisabled, icon: radioClasses.fixDisabledIcon }}
          />
        ))}
      </div>
    </Radio.Group>
  );
}

export function MatrixInput({
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
    prompt,
    secondaryText,
    required,
    infoText,
  } = response;

  const _choiceStringToColumns: Record<string, string[]> = {
    likely5: ['Highly Unlikely', 'Unlikely', 'Neutral', 'Likely', 'Highly Likely'],
    likely7: ['Highly Unlikely', 'Unlikely', 'Slightly Unlikely', 'Neutral', 'Slightly Likely', 'Likely', 'Highly Likely'],
    satisfaction5: ['Highly Unsatisfied', 'Unsatisfied', 'Neutral', 'Satisfied', 'Highly Satisfied'],
    satisfaction7: ['Highly Unsatisfied', 'Unsatisfied', 'Slightly Unsatisfied', 'Neutral', 'Slightly Satisfied', 'Satisfied', 'Highly Satisfied'],
  };

  const _choices = typeof answerOptions === 'string' ? _choiceStringToColumns[answerOptions].map((entry) => ({ value: entry, label: entry })) : answerOptions.map((option) => (typeof option === 'string' ? { value: option, label: option } : option));

  const { questionOrders } = useStoredAnswer();
  const orderedQuestions = useMemo(() => questionOrders[response.id], [questionOrders, response.id]);

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

  const error = generateErrorMessage(response, answer);

  const _n = _choices.length;
  const _m = orderedQuestions.length;
  return (
    <>
      {prompt.length > 0 && <InputLabel prompt={prompt} required={required} index={index} enumerateQuestions={enumerateQuestions} infoText={infoText} />}
      <Text c="dimmed" size="sm" mt={0}>{secondaryText}</Text>
      <Box
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gridTemplateRows: 'auto 1fr',
        }}
        m="md"
        mt="xs"
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
          {orderedQuestions.map((entry, idx) => (
            <Text
              key={`question-${idx}-label`}
              style={{
                height: '80px',
                width: '100%',
                display: 'flex',
                alignItems: 'safe center',
                justifyContent: 'end',
                borderRight: '1px solid var(--mantine-color-dark-0)',
                backgroundColor: `${(idx + 1) % 2 === 0 ? 'var(--mantine-color-gray-2)' : 'white'}`,
                overflowY: 'auto',
              }}
              ta="right"
              p="sm"
              miw={140}
              maw={400}
            >
              {entry}
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
          {orderedQuestions.map((question, idx) => (
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
      </Box>
      {error && (
        <Text c={required ? 'red' : 'orange'} size="sm" mt="xs">
          {error}
        </Text>
      )}
    </>
  );
}
