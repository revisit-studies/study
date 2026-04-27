import {
  Box, Radio, Text, Checkbox,
} from '@mantine/core';
import {
  ChangeEvent, useMemo,
} from 'react';
import { MatrixResponse, ParsedStringOption } from '../../parser/types';
import { useStoreDispatch, useStoreActions } from '../../store/store';
import checkboxClasses from './css/Checkbox.module.css';
import radioClasses from './css/Radio.module.css';
import { useStoredAnswer } from '../../store/hooks/useStoredAnswer';
import { InputLabel } from './InputLabel';
import { OptionLabel } from './OptionLabel';
import { parseStringOptions } from '../../utils/stringOptions';
import { getMatrixAnswerOptions, isMatrixDontKnowValue, MATRIX_DONT_KNOW_OPTION } from '../../utils/responseOptions';

function CheckboxComponent({
  _choices,
  _n,
  idx,
  question,
  answer,
  onChange,
  disabled,
}: {
  _choices: ParsedStringOption[],
  _n: number,
  idx: number,
  question: string,
  answer: { value: Record<string, string> },
  onChange: (event: ChangeEvent<HTMLInputElement>, questionKey: string, option: ParsedStringOption) => void
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
      {_choices.map((checkbox: ParsedStringOption) => (
        <Checkbox
          disabled={disabled}
          key={`${checkbox.label}-${idx}`}
          checked={(answer.value?.[question] || '').split('|').includes(checkbox.value)}
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
  _choices: ParsedStringOption[],
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
      value={answer.value?.[question]}
    >
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: `repeat(${_n}, 1fr)`,
          justifyItems: 'center',
        }}
      >
        {_choices.map((radio: ParsedStringOption) => (
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
  error,
  enumerateQuestions,
}: {
  response: MatrixResponse;
  answer: { value: Record<string, string> };
  index: number;
  disabled: boolean;
  error?: string | null;
  enumerateQuestions: boolean;
}) {
  const { setMatrixAnswersRadio, setMatrixAnswersCheckbox } = useStoreActions();
  const storeDispatch = useStoreDispatch();

  const {
    prompt,
    secondaryText,
    required,
    infoText,
  } = response;

  const _choices = useMemo<ParsedStringOption[]>(
    () => getMatrixAnswerOptions(response),
    [response],
  );

  const questions = useMemo(
    () => parseStringOptions(response.questionOptions),
    [response.questionOptions],
  );
  const questionsByValue = useMemo(
    () => Object.fromEntries(questions.map((question) => [question.value, question])),
    [questions],
  );

  const { questionOrders } = useStoredAnswer();
  const orderedQuestions = useMemo(() => questionOrders[response.id] || questions.map((question) => question.value), [questionOrders, questions, response.id]);

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

  const onChangeCheckbox = (event: ChangeEvent<HTMLInputElement>, questionKey: string, option: ParsedStringOption) => {
    const isChecked = event.target.checked;
    const currentValues = (answer.value[questionKey] || '').split('|').filter((entry) => entry !== '');
    const dispatchCheckboxUpdate = (value: string, checked: boolean) => storeDispatch(setMatrixAnswersCheckbox({
      questionKey,
      responseId: response.id,
      value,
      label: _choices.find((choice) => choice.value === value)?.label || value,
      isChecked: checked,
      choiceOptions: _choices,
    }));

    if (response.withDontKnow && isMatrixDontKnowValue(option.value) && isChecked) {
      currentValues
        .filter((entry) => !isMatrixDontKnowValue(entry))
        .forEach((value) => dispatchCheckboxUpdate(value, false));
    } else if (response.withDontKnow && !isMatrixDontKnowValue(option.value) && isChecked && currentValues.some(isMatrixDontKnowValue)) {
      dispatchCheckboxUpdate(MATRIX_DONT_KNOW_OPTION.value, false);
    }

    dispatchCheckboxUpdate(option.value, isChecked);
  };

  const _n = _choices.length;
  const _m = orderedQuestions.length;
  const dontKnowIndex = _choices.findIndex(
    (choice) => isMatrixDontKnowValue(choice.value) || isMatrixDontKnowValue(choice.label),
  );
  const separatorAfterIndex = dontKnowIndex > 0 ? dontKnowIndex - 1 : -1;
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
            alignItems: 'stretch',
            justifyItems: 'stretch',
            borderBottom: '1px solid var(--mantine-color-dark-0)',
            position: 'relative',
          }}
        >
          {separatorAfterIndex >= 0 && (
            <div
              style={{
                position: 'absolute',
                left: `${((separatorAfterIndex + 1) / _n) * 100}%`,
                top: 0,
                bottom: 0,
                width: '1px',
                backgroundColor: 'var(--mantine-color-dark-0)',
                pointerEvents: 'none',
              }}
            />
          )}
          {_choices.map((entry, idx) => (
            <Box
              key={`choice-${idx}-label`}
              style={{
                width: '100%',
                minWidth: 0,
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                fontSize: '0.8em',
                overflow: 'hidden',
                overflowWrap: 'anywhere',
              }}
              px={4}
            >
              <OptionLabel
                label={
                  (isMatrixDontKnowValue(entry.value) || isMatrixDontKnowValue(entry.label))
                    ? "I don't  \nknow"
                    : entry.label
                }
                infoText={entry.infoText}
              />
            </Box>
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
          {orderedQuestions.map((questionKey, idx) => (
            <Box
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
              <OptionLabel label={(questionsByValue[questionKey]?.label || questionKey)} infoText={questionsByValue[questionKey]?.infoText} />
            </Box>
          ))}
        </div>
        {/* Rest */}
        <div
          style={{
            height: '100%',
            display: 'grid',
            gridTemplateRows: `repeat(${_m},1fr)`,
            position: 'relative',
          }}
        >
          {separatorAfterIndex >= 0 && (
            <div
              style={{
                position: 'absolute',
                left: `${((separatorAfterIndex + 1) / _n) * 100}%`,
                top: 0,
                bottom: 0,
                width: '1px',
                backgroundColor: 'var(--mantine-color-dark-0)',
                pointerEvents: 'none',
                zIndex: 1,
              }}
            />
          )}
          {orderedQuestions.map((questionKey, idx) => (
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
                    question={questionKey}
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
                    question={questionKey}
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
