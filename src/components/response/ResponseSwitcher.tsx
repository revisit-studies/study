import { Box, Checkbox, Divider } from '@mantine/core';
import { useSearchParams } from 'react-router';
import { useMemo } from 'react';
import { GetInputPropsReturnType } from '@mantine/form/lib/types';
import {
  IndividualComponent, MatrixResponse, Response, SliderResponse, StoredAnswer,
} from '../../parser/types';
import { CheckBoxInput } from './CheckBoxInput';
import { DropdownInput } from './DropdownInput';
import { Reactive } from './ReactiveInput';
import { LikertInput } from './LikertInput';
import { NumericInput } from './NumericInput';
import { RadioInput } from './RadioInput';
import { SliderInput } from './SliderInput';
import { StringInput } from './StringInput';
import { TextAreaInput } from './TextAreaInput';
import { useStudyConfig } from '../../store/hooks/useStudyConfig';
import { MatrixInput } from './MatrixInput';
import { ButtonsInput } from './ButtonsInput';
import classes from './css/Checkbox.module.css';
import { TextOnlyInput } from './TextOnlyInput';

export function ResponseSwitcher({
  response,
  answer,
  storedAnswer,
  index,
  configInUse,
  dontKnowCheckbox,
  otherInput,
}: {
  response: Response;
  answer: GetInputPropsReturnType;
  storedAnswer?: StoredAnswer['answer'];
  index: number;
  configInUse: IndividualComponent;
  dontKnowCheckbox?: GetInputPropsReturnType;
  otherInput?: GetInputPropsReturnType;
}) {
  const ans = (Object.keys(storedAnswer || {}).length > 0 ? { value: storedAnswer![response.id] } : answer) || { value: undefined };
  const dontKnowValue = (Object.keys(storedAnswer || {}).length > 0 ? { checked: storedAnswer![`${response.id}-dontKnow`] } : dontKnowCheckbox) || { checked: undefined };
  const otherValue = (Object.keys(storedAnswer || {}).length > 0 ? { value: storedAnswer![`${response.id}-other`] } : otherInput) || { value: undefined };
  const disabled = Object.keys(storedAnswer || {}).length > 0;

  const [searchParams] = useSearchParams();

  const studyConfig = useStudyConfig();
  const enumerateQuestions = studyConfig.uiConfig.enumerateQuestions ?? false;

  const isDisabled = useMemo(() => {
    if (response.paramCapture) {
      const responseParam = searchParams.get(response.paramCapture);
      return disabled || !!responseParam;
    }

    return disabled;
  }, [disabled, response.paramCapture, searchParams]);

  const fieldInitialValue = useMemo(() => {
    if (response.paramCapture) {
      return searchParams.get(response.paramCapture) || '';
    }

    if (response.type === 'reactive' || response.type === 'checkbox') {
      return [];
    }

    if (response.type === 'matrix-radio' || response.type === 'matrix-checkbox') {
      return Object.fromEntries(response.questionOptions.map((entry) => [entry, '']));
    }

    if (response.type === 'slider' && response.startingValue) {
      return response.startingValue.toString();
    }

    return '';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response.paramCapture, (response as MatrixResponse).questionOptions, (response as SliderResponse).startingValue, response.type, searchParams]);

  return (
    <Box mb={response.withDivider || configInUse.responseDividers ? 'xl' : 'lg'}>
      {response.type === 'numerical' && (
        <NumericInput
          response={response}
          disabled={isDisabled || dontKnowCheckbox?.checked}
          answer={ans as { value: number }}
          index={index}
          enumerateQuestions={enumerateQuestions}
        />
      )}
      {response.type === 'shortText' && (
        <StringInput
          response={response}
          disabled={isDisabled || dontKnowCheckbox?.checked}
          answer={ans as { value: string }}
          index={index}
          enumerateQuestions={enumerateQuestions}
        />
      )}
      {response.type === 'longText' && (
        <TextAreaInput
          response={response}
          disabled={isDisabled || dontKnowCheckbox?.checked}
          answer={ans as { value: string }}
          index={index}
          enumerateQuestions={enumerateQuestions}
        />
      )}
      {response.type === 'likert' && (
        <LikertInput
          response={response}
          disabled={isDisabled || dontKnowCheckbox?.checked}
          answer={ans as { value: string }}
          index={index}
          enumerateQuestions={enumerateQuestions}
        />
      )}
      {response.type === 'dropdown' && (
        <DropdownInput
          response={response}
          disabled={isDisabled || dontKnowCheckbox?.checked}
          answer={ans as { value: string }}
          index={index}
          enumerateQuestions={enumerateQuestions}
        />
      )}
      {response.type === 'slider' && (
        <SliderInput
          response={response}
          disabled={isDisabled || dontKnowCheckbox?.checked}
          answer={ans as { value: number }}
          index={index}
          enumerateQuestions={enumerateQuestions}
        />
      )}
      {response.type === 'radio' && (
        <RadioInput
          response={response}
          disabled={isDisabled || dontKnowCheckbox?.checked}
          answer={ans as { value: string }}
          index={index}
          enumerateQuestions={enumerateQuestions}
          otherValue={otherValue}
        />
      )}
      {response.type === 'checkbox' && (
        <CheckBoxInput
          response={response}
          disabled={isDisabled || dontKnowCheckbox?.checked}
          answer={ans as { value: string[] }}
          index={index}
          enumerateQuestions={enumerateQuestions}
          otherValue={otherValue}
        />
      )}
      {response.type === 'reactive' && (
        <Reactive
          response={response}
          answer={ans as { value: string[] }}
          index={index}
          enumerateQuestions={enumerateQuestions}
        />
      )}
      {(response.type === 'matrix-radio' || response.type === 'matrix-checkbox') && (
        <MatrixInput
          disabled={isDisabled || dontKnowCheckbox?.checked}
          response={response}
          answer={ans as { value: Record<string, string> }}
          index={index}
          enumerateQuestions={enumerateQuestions}
        />
      )}
      {response.type === 'buttons' && (
        <ButtonsInput
          response={response}
          disabled={isDisabled || dontKnowCheckbox?.checked}
          answer={ans as { value: string }}
          index={index}
          enumerateQuestions={enumerateQuestions}
        />
      )}
      {response.type === 'textOnly' && (
        <TextOnlyInput response={response} />
      )}

      {response.withDontKnow && (
        <Checkbox
          mt="xs"
          disabled={isDisabled}
          label="I don't know"
          classNames={{ input: classes.fixDisabled, label: classes.fixDisabledLabel, icon: classes.fixDisabledIcon }}
          {...dontKnowCheckbox}
          checked={dontKnowValue.checked}
          onChange={(event) => { dontKnowCheckbox?.onChange(event.currentTarget.checked); answer.onChange(fieldInitialValue); }}
        />
      )}

      {(response.withDivider || configInUse.responseDividers) && <Divider mt="xl" mb="xs" />}
    </Box>
  );
}
