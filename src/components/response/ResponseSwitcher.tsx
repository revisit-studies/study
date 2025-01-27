import { Box, Checkbox, Divider } from '@mantine/core';
import { useSearchParams } from 'react-router';
import { useEffect, useMemo, useState } from 'react';
import { GetInputPropsReturnType, UseFormReturnType } from '@mantine/form/lib/types';
import { IndividualComponent, Response, StoredAnswer } from '../../parser/types';
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

export function ResponseSwitcher({
  response,
  answer,
  storedAnswer,
  index,
  configInUse,
  form,
}: {
  response: Response;
  answer: GetInputPropsReturnType;
  storedAnswer?: StoredAnswer['answer'];
  index: number;
  configInUse: IndividualComponent;
  form: UseFormReturnType<StoredAnswer['answer']>;
}) {
  const ans = (Object.keys(storedAnswer || {}).length > 0 ? { value: storedAnswer![response.id] } : answer) || { value: undefined };
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

  const [dontKnowCheckbox, setDontKnowCheckbox] = useState(!!storedAnswer?.[`${response.id}-dontKnow`] || false);
  useEffect(() => {
    form.setFieldValue(`${response.id}-dontKnow`, dontKnowCheckbox.toString());
    // reset answer value if dontKnowCheckbox changes
    if (!dontKnowCheckbox) {
      form.setFieldValue(response.id, false.toString());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dontKnowCheckbox, response.id]);

  return (
    <Box mb={response.withDivider || configInUse.responseDividers ? 'xl' : 'lg'}>
      {response.type === 'numerical' && (
        <NumericInput
          response={response}
          disabled={isDisabled || dontKnowCheckbox}
          answer={ans as { value: number }}
          index={index}
          enumerateQuestions={enumerateQuestions}
        />
      )}
      {response.type === 'shortText' && (
        <StringInput
          response={response}
          disabled={isDisabled || dontKnowCheckbox}
          answer={ans as { value: string }}
          index={index}
          enumerateQuestions={enumerateQuestions}
        />
      )}
      {response.type === 'longText' && (
        <TextAreaInput
          response={response}
          disabled={isDisabled || dontKnowCheckbox}
          answer={ans as { value: string }}
          index={index}
          enumerateQuestions={enumerateQuestions}
        />
      )}
      {response.type === 'likert' && (
        <LikertInput
          response={response}
          disabled={isDisabled || dontKnowCheckbox}
          answer={ans as { value: string }}
          index={index}
          enumerateQuestions={enumerateQuestions}
        />
      )}
      {response.type === 'dropdown' && (
        <DropdownInput
          response={response}
          disabled={isDisabled || dontKnowCheckbox}
          answer={ans as { value: string }}
          index={index}
          enumerateQuestions={enumerateQuestions}
        />
      )}
      {response.type === 'slider' && (
        <SliderInput
          response={response}
          disabled={isDisabled || dontKnowCheckbox}
          answer={ans as { value: number }}
          index={index}
          enumerateQuestions={enumerateQuestions}
        />
      )}
      {response.type === 'radio' && (
        <RadioInput
          response={response}
          disabled={isDisabled || dontKnowCheckbox}
          answer={ans as { value: string }}
          index={index}
          enumerateQuestions={enumerateQuestions}
        />
      )}
      {response.type === 'checkbox' && (
        <CheckBoxInput
          response={response}
          disabled={isDisabled || dontKnowCheckbox}
          answer={ans as { value: string[] }}
          index={index}
          enumerateQuestions={enumerateQuestions}
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
          disabled={isDisabled || dontKnowCheckbox}
          response={response}
          answer={ans as { value: Record<string, string> }}
          index={index}
          enumerateQuestions={enumerateQuestions}
        />
      )}

      {response.withDontKnow && (
        <Checkbox
          mt="xs"
          disabled={isDisabled}
          label="I don't know"
          checked={dontKnowCheckbox}
          onChange={(event) => setDontKnowCheckbox(event.currentTarget.checked)}
        />
      )}

      {(response.withDivider || configInUse.responseDividers) && <Divider mt="xl" mb="xs" />}
    </Box>
  );
}
